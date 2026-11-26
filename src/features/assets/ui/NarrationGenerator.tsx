import { useQueryClient } from '@tanstack/react-query';
import { AudioLines, Headphones, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import { CompleteAssetBodySchema } from '@/shared/contracts/api/assets.schema';
import {
    NARRATION_MAX_CHARACTERS,
    type NarrationOptions,
    NarrationOptionsSchema,
} from '@/shared/contracts/api/narration.schema';
import { Button } from '@/shared/ui/Button';
import { LoadingToast } from '@/shared/ui/LoadingToast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Slider } from '@/shared/ui/primitives/slider';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { auth, useAuth } from '../../auth';
import { profileKey } from '../../profile';
import { useFileUrl } from '../../scene/ui/AssetMediaPreview';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';
import { uploadFile } from '../api/upload-file';
import { assetKeys, assetsApi } from '../model/assets';
import { runAssetUpload, type UploadCheckpoint, type UploadStage } from '../model/upload';
import { VoicePicker } from './VoicePicker';

const stageLabels = {
    signing: 'Đang chuẩn bị lưu…',
    uploading: 'Đang tải âm thanh…',
    completing: 'Đang xác nhận tài nguyên…',
};

const pauseChoices = [
    { value: 'short', label: 'Ngắn', duration: '50 ms' },
    { value: 'medium', label: 'Vừa', duration: '150 ms' },
    { value: 'long', label: 'Dài', duration: '400 ms' },
] as const;

function pauseOnUnmount(audio: HTMLAudioElement | null) {
    return () => audio?.pause();
}

export function NarrationGenerator({
    onSaved,
    disabled = false,
    guardNavigation = true,
}: {
    onSaved: () => void;
    disabled?: boolean;
    guardNavigation?: boolean;
}) {
    const id = useId();
    const generationErrorToastId = `${id}-generate-error`;
    const { user } = useAuth();
    const cache = useQueryClient();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [name, setName] = useState('Lời đọc từ văn bản');
    const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
    const [voice, setVoice] = useState('');
    const [options, setOptions] = useState(() => NarrationOptionsSchema.parse({}));
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [stage, setStage] = useState<UploadStage | null>(null);
    const [progress, setProgress] = useState(0);
    const [generated, setGenerated] = useState<{
        file: File;
        text: string;
        voice: string;
        options: NarrationOptions;
    }>();
    const [checkpoint, setCheckpoint] = useState<UploadCheckpoint | null>(null);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const request = useRef<AbortController | null>(null);
    const preview = useRef<HTMLDivElement | null>(null);
    const url = useFileUrl(generated?.file ?? null);
    const busy = generating || Boolean(stage);
    const stale = Boolean(
        generated &&
            (generated.text !== text ||
                generated.voice !== voice ||
                generated.options.speed !== options.speed ||
                generated.options.pause !== options.pause ||
                generated.options.temperature !== options.temperature ||
                generated.options.voiceStrength !== options.voiceStrength),
    );
    const frozen = busy || Boolean(checkpoint?.uploaded);
    const pauseIndex = pauseChoices.findIndex((item) => item.value === options.pause);

    useEffect(() => {
        if (open && generated) preview.current?.scrollIntoView({ block: 'nearest' });
    }, [open, generated]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly reloads voices after a failed request.
    useEffect(() => {
        if (!open || !user?.id) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        void assetsApi
            .narrationVoices(controller.signal)
            .then((items) => {
                if (controller.signal.aborted) return;
                setVoices(items);
                setVoice((value) =>
                    items.some((item) => item.id === value)
                        ? value
                        : items.find((item) => item.id === 'maichi')?.id || items[0].id,
                );
            })
            .catch((cause) => {
                if (!controller.signal.aborted) setError(errorMessage(cause));
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [open, user?.id, retry]);

    useEffect(() => {
        if (!user?.id) request.current?.abort();
        return () => request.current?.abort();
    }, [user?.id]);

    async function generate() {
        if (request.current || !user || checkpoint?.uploaded) return;
        const controller = new AbortController();
        request.current = controller;
        const userId = user.id;
        setGenerating(true);
        setError('');
        toast.dismiss(generationErrorToastId);
        try {
            const file = await assetsApi.generateNarration(
                { text, voice, ...options },
                controller.signal,
            );
            if (controller.signal.aborted || auth.store.getState().user?.id !== userId) return;
            setGenerated({ file, text, voice, options });
            setCheckpoint(null);
        } catch (cause) {
            if (!controller.signal.aborted && auth.store.getState().user?.id === userId)
                toast.error(errorMessage(cause), { id: generationErrorToastId });
        } finally {
            if (request.current === controller) {
                request.current = null;
                setGenerating(false);
            }
        }
    }

    async function save() {
        if (request.current || !user || !generated || stale) return;
        const controller = new AbortController();
        request.current = controller;
        const userId = user.id;
        setError('');
        try {
            if (!name.trim()) throw new Error('Hãy đặt tên cho âm thanh.');
            const result = await runAssetUpload({
                api: assetsApi,
                transfer: uploadFile,
                file: generated.file,
                metadata: CompleteAssetBodySchema.parse({ name: name.trim(), tags: ['voice'] }),
                signal: controller.signal,
                checkpoint,
                onCheckpoint: setCheckpoint,
                onStage: setStage,
                onProgress: setProgress,
            });
            if (controller.signal.aborted || auth.store.getState().user?.id !== userId) return;
            if (result.asset.type !== 'AUDIO') throw new Error('Tệp đã lưu không phải âm thanh.');
            if (!result.processing)
                cache.setQueryData(assetKeys.detail(userId, result.asset.id), result.asset);
            void cache.invalidateQueries({ queryKey: assetKeys.lists(userId) });
            void cache.invalidateQueries({ queryKey: profileKey(userId) });
            closeForm();
            toast.success(
                result.processing
                    ? 'Đã lưu vào tài nguyên. Âm thanh đang được xử lý.'
                    : 'Đã lưu âm thanh vào tài nguyên của bạn.',
            );
            onSaved();
        } catch (cause) {
            if (!controller.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (request.current === controller) {
                request.current = null;
                setStage(null);
                setProgress(0);
            }
        }
    }

    function closeForm() {
        toast.dismiss(generationErrorToastId);
        request.current?.abort();
        request.current = null;
        setOpen(false);
        setText('');
        setName('Lời đọc từ văn bản');
        setVoice('');
        setOptions(NarrationOptionsSchema.parse({}));
        setGenerated(undefined);
        setCheckpoint(null);
        setError('');
        setRetry(0);
        setGenerating(false);
        setStage(null);
        setProgress(0);
    }

    function changeOpen(value: boolean) {
        if (!value && stage) {
            toast.info('Hãy đợi lưu âm thanh xong trước khi đóng.');
            return;
        }
        if (!value) closeForm();
        else setOpen(true);
    }

    return (
        <>
            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={disabled || busy}>
                        <AudioLines data-icon="inline-start" />
                        Tạo âm thanh
                    </Button>
                </DialogTrigger>
                <DialogContent
                    className="flex h-[min(780px,calc(100dvh-32px))] max-w-[min(1080px,calc(100vw-32px))] flex-col overflow-hidden p-0"
                    onPlayCapture={(event) => {
                        for (const audio of event.currentTarget.querySelectorAll('audio')) {
                            if (audio !== event.target) audio.pause();
                        }
                    }}
                >
                    <DialogHeader className="shrink-0 border-border border-b px-5 py-4 pr-12 sm:px-6 sm:pr-12">
                        <DialogTitle>Tạo âm thanh từ văn bản</DialogTitle>
                        <DialogDescription>
                            Chọn giọng, nhập nội dung và nghe thử trước khi lưu.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                        <section
                            aria-label="Nội dung tạo âm thanh"
                            className="flex min-w-0 flex-col gap-4 p-5 sm:p-6"
                        >
                            <Field className="shrink-0 gap-2">
                                <FieldLabel htmlFor={`${id}-voice`} className="m-0">
                                    Giọng đọc
                                </FieldLabel>
                                {loading ? (
                                    <p
                                        role="status"
                                        className="m-0 flex h-10 items-center gap-2 text-muted-foreground text-sm"
                                    >
                                        <Spinner aria-hidden="true" />
                                        Đang tải giọng đọc…
                                    </p>
                                ) : (
                                    <VoicePicker
                                        id={`${id}-voice`}
                                        value={voice}
                                        onValueChange={setVoice}
                                        disabled={frozen || !voices.length}
                                        voices={voices}
                                    />
                                )}
                                {!loading && !voices.length && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setRetry(retry + 1)}
                                    >
                                        Tải lại giọng đọc
                                    </Button>
                                )}
                            </Field>
                            <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2">
                                <Field className="gap-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <FieldLabel id={`${id}-speed-label`} className="m-0">
                                            Tốc độ đọc
                                        </FieldLabel>
                                        <output className="text-sm tabular-nums" aria-hidden="true">
                                            {options.speed.toLocaleString('vi-VN')}×
                                        </output>
                                    </div>
                                    <Slider
                                        min={0.8}
                                        max={1.2}
                                        step={0.1}
                                        value={[options.speed]}
                                        disabled={frozen}
                                        aria-labelledby={`${id}-speed-label`}
                                        aria-valuetext={`${options.speed.toLocaleString('vi-VN')}×`}
                                        onValueChange={([speed]) =>
                                            setOptions({ ...options, speed })
                                        }
                                    />
                                    <div
                                        className="flex justify-between text-muted-foreground text-xs"
                                        aria-hidden="true"
                                    >
                                        <span>Chậm</span>
                                        <span>Bình thường</span>
                                        <span>Nhanh</span>
                                    </div>
                                </Field>
                                <Field className="gap-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <FieldLabel id={`${id}-pause-label`} className="m-0">
                                            Khoảng nghỉ
                                        </FieldLabel>
                                        <output className="text-sm tabular-nums" aria-hidden="true">
                                            {pauseChoices[pauseIndex].duration}
                                        </output>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={2}
                                        step={1}
                                        value={[pauseIndex]}
                                        disabled={frozen}
                                        aria-labelledby={`${id}-pause-label`}
                                        aria-valuetext={`${pauseChoices[pauseIndex].label}, ${pauseChoices[pauseIndex].duration}`}
                                        aria-describedby={`${id}-pause-hint`}
                                        onValueChange={([value]) =>
                                            setOptions({
                                                ...options,
                                                pause: pauseChoices[value].value,
                                            })
                                        }
                                    />
                                    <div
                                        className="flex justify-between text-muted-foreground text-xs"
                                        aria-hidden="true"
                                    >
                                        {pauseChoices.map((item) => (
                                            <span key={item.value}>{item.label}</span>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                            <Field className="flex-1 gap-2">
                                <FieldLabel htmlFor={`${id}-text`} className="m-0">
                                    Nội dung lời đọc
                                </FieldLabel>
                                <Textarea
                                    id={`${id}-text`}
                                    value={text}
                                    onChange={(event) => setText(event.target.value)}
                                    rows={6}
                                    maxLength={NARRATION_MAX_CHARACTERS}
                                    readOnly={frozen}
                                    placeholder="Nhập câu chuyện, lời giới thiệu hoặc nội dung bạn muốn đọc…"
                                    className="mt-0 min-h-32 flex-1 resize-none text-sm"
                                    aria-describedby={`${id}-pause-hint ${id}-limit`}
                                />
                                <span
                                    id={`${id}-limit`}
                                    className="shrink-0 text-right text-muted-foreground text-xs tabular-nums"
                                >
                                    {text.length.toLocaleString('vi-VN')} / 1.500 ký tự
                                </span>
                                <p
                                    id={`${id}-pause-hint`}
                                    className="m-0 text-muted-foreground text-xs leading-relaxed"
                                >
                                    Dấu câu tạo nhịp nghỉ tự nhiên; xuống dòng để tách đoạn. Thanh
                                    kéo thêm khoảng nghỉ giữa các đoạn; đọc nhanh thì nghỉ ngắn hơn.
                                </p>
                            </Field>
                        </section>
                        <div className="flex min-w-0 flex-col border-border border-t sm:border-t-0 sm:border-l">
                            <section
                                ref={preview}
                                aria-label="Bản nghe thử"
                                className="flex min-h-44 flex-1 flex-col gap-4 bg-muted/25 p-5 sm:p-6"
                            >
                                {generated ? (
                                    <div className="flex min-w-0 flex-col gap-3">
                                        <Field className="gap-2">
                                            <FieldLabel htmlFor={`${id}-name`} className="m-0">
                                                Tên âm thanh
                                            </FieldLabel>
                                            <Input
                                                id={`${id}-name`}
                                                value={name}
                                                onChange={(event) => setName(event.target.value)}
                                                maxLength={150}
                                                readOnly={frozen}
                                                className="mt-0 bg-background"
                                            />
                                        </Field>
                                        {url && (
                                            <audio
                                                key={url}
                                                ref={pauseOnUnmount}
                                                controls
                                                preload="metadata"
                                                src={url}
                                                aria-label="Nghe thử âm thanh đã tạo"
                                                className="my-0! h-10 w-full min-w-0"
                                            >
                                                <track kind="captions" />
                                            </audio>
                                        )}
                                        <p
                                            role="status"
                                            className="m-0 text-muted-foreground text-xs leading-relaxed"
                                        >
                                            {stale
                                                ? 'Nội dung, giọng đọc hoặc tùy chỉnh đã đổi. Hãy tạo lại trước khi lưu.'
                                                : 'Nghe lại bản vừa tạo. Khi hài lòng, lưu vào tài nguyên để sử dụng.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div
                                        role={generating ? 'status' : undefined}
                                        className="flex min-h-32 flex-1 flex-col items-center justify-center gap-3 py-4 text-center"
                                    >
                                        {generating ? (
                                            <Spinner
                                                className="size-7 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Headphones
                                                className="size-7 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <p className="m-0 font-medium text-sm">
                                            {generating
                                                ? 'Đang tạo bản nghe thử'
                                                : 'Nghe thử trước khi lưu'}
                                        </p>
                                        <p className="m-0 max-w-56 text-muted-foreground text-xs leading-relaxed">
                                            {generating
                                                ? 'Có thể mất đến 3 phút. Bạn có thể hủy và giữ nội dung đã nhập.'
                                                : 'Chọn giọng và nhập nội dung, rồi bấm “Tạo lời đọc” để nghe kết quả tại đây.'}
                                        </p>
                                    </div>
                                )}
                                <LoadingToast
                                    title={
                                        stage
                                            ? stageLabels[stage]
                                            : generating
                                              ? generated
                                                  ? 'Đang tạo lại lời đọc…'
                                                  : 'Đang tạo bản nghe thử…'
                                              : null
                                    }
                                    description={
                                        stage === 'uploading'
                                            ? `${progress}%`
                                            : generating && generated
                                              ? 'Bản nghe thử cũ vẫn được giữ.'
                                              : undefined
                                    }
                                />
                                {error && (
                                    <p
                                        role="alert"
                                        className="m-0 text-danger-foreground text-sm leading-relaxed"
                                    >
                                        {error}
                                    </p>
                                )}
                            </section>
                            <section
                                aria-labelledby={`${id}-advanced-title`}
                                className="shrink-0 border-border border-t bg-background px-5 py-4 sm:px-6"
                            >
                                <h3
                                    id={`${id}-advanced-title`}
                                    className="m-0 font-semibold text-base leading-6"
                                >
                                    Tùy chỉnh nâng cao
                                </h3>
                                <div className="flex flex-col gap-4 pt-3">
                                    <Field className="gap-2">
                                        <FieldLabel
                                            id={`${id}-temperature-label`}
                                            className="m-0 font-medium leading-5"
                                        >
                                            Mức biến thiên
                                        </FieldLabel>
                                        <ToggleGroup
                                            type="single"
                                            variant="outline"
                                            size="lg"
                                            spacing={0}
                                            className="w-full"
                                            value={String(options.temperature)}
                                            disabled={frozen}
                                            aria-labelledby={`${id}-temperature-label`}
                                            aria-describedby={`${id}-temperature-hint`}
                                            onValueChange={(value) => {
                                                if (value)
                                                    setOptions({
                                                        ...options,
                                                        temperature: Number(value),
                                                    });
                                            }}
                                        >
                                            <ToggleGroupItem className="flex-1" value="0.6">
                                                Ít
                                            </ToggleGroupItem>
                                            <ToggleGroupItem className="flex-1" value="0.8">
                                                Mặc định
                                            </ToggleGroupItem>
                                            <ToggleGroupItem className="flex-1" value="1">
                                                Nhiều
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                        <p
                                            id={`${id}-temperature-hint`}
                                            className="m-0 text-muted-foreground text-xs leading-relaxed"
                                        >
                                            Thay đổi cách đọc giữa các lần tạo.
                                        </p>
                                    </Field>
                                    <Field className="gap-2">
                                        <FieldLabel
                                            id={`${id}-strength-label`}
                                            className="m-0 font-medium leading-5"
                                        >
                                            Độ bám giọng
                                        </FieldLabel>
                                        <ToggleGroup
                                            type="single"
                                            variant="outline"
                                            size="lg"
                                            spacing={0}
                                            className="w-full"
                                            value={String(options.voiceStrength)}
                                            disabled={frozen}
                                            aria-labelledby={`${id}-strength-label`}
                                            aria-describedby={`${id}-strength-hint`}
                                            onValueChange={(value) => {
                                                if (value)
                                                    setOptions({
                                                        ...options,
                                                        voiceStrength: Number(value),
                                                    });
                                            }}
                                        >
                                            <ToggleGroupItem className="flex-1" value="1">
                                                Mặc định
                                            </ToggleGroupItem>
                                            <ToggleGroupItem className="flex-1" value="1.2">
                                                Tăng nhẹ
                                            </ToggleGroupItem>
                                            <ToggleGroupItem className="flex-1" value="1.5">
                                                Tăng
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                        <p
                                            id={`${id}-strength-hint`}
                                            className="m-0 text-muted-foreground text-xs leading-relaxed"
                                        >
                                            Bám sát giọng mẫu hơn. Tăng mức này có thể tạo lâu hơn.
                                        </p>
                                    </Field>
                                </div>
                            </section>
                        </div>
                    </div>
                    <DialogFooter className="mt-0 shrink-0 flex-col-reverse items-stretch justify-between px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={Boolean(stage)}
                            onClick={() =>
                                generating ? request.current?.abort() : changeOpen(false)
                            }
                        >
                            {generating ? 'Hủy tạo' : 'Đóng'}
                        </Button>
                        <div className="flex min-w-0 items-center justify-end gap-2">
                            {generated && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={loading || frozen || !voice || !text.trim()}
                                    onClick={() => void generate()}
                                >
                                    <RotateCcw className="size-3.5" aria-hidden="true" />
                                    Tạo lại
                                </Button>
                            )}
                            {generated ? (
                                <Button
                                    type="button"
                                    className="min-w-0 flex-1 sm:min-w-36 sm:flex-none"
                                    disabled={busy || stale || !name.trim()}
                                    onClick={() => void save()}
                                >
                                    {busy && <Spinner aria-hidden="true" />}
                                    {stage
                                        ? 'Đang lưu…'
                                        : generating
                                          ? 'Đang tạo…'
                                          : 'Lưu vào tài nguyên'}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    className="min-w-0 flex-1 sm:min-w-36 sm:flex-none"
                                    disabled={loading || frozen || !voice || !text.trim()}
                                    onClick={() => void generate()}
                                >
                                    {generating && <Spinner aria-hidden="true" />}
                                    {generating ? 'Đang tạo…' : 'Tạo lời đọc'}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {guardNavigation && open && (
                <NavigationGuard
                    dirty={Boolean(generated)}
                    saving={Boolean(stage)}
                    allowBookNavigation={false}
                    dirtyDescription="Âm thanh vừa tạo chưa được lưu vào tài nguyên. Rời trang sẽ bỏ bản nghe thử."
                />
            )}
        </>
    );
}
