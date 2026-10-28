import { useQueryClient } from '@tanstack/react-query';
import { Eye, ImagePlus, RotateCcw } from 'lucide-react';
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
import { Button as IconButton } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Switch } from '@/shared/ui/primitives/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { ContractError } from '../../../shared/api/contract';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset, Page } from '../../../shared/contracts/dto.schema';
import { type PageSettings, PageSettingsSchema } from '../../../shared/contracts/scene.schema';
import { assetKeys, assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { uploadRequest } from '../../assets/model/form';
import { runAssetUpload, type UploadCheckpoint } from '../../assets/model/upload';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { pageKeys, pagesApi } from '../../pages';
import type { ImageAttachmentContext } from '../../pages/ui/PageImageForm';
import { profileKey } from '../../profile';
import { settingsPatch } from '../model/objects';
import {
    type PageAudioKey,
    type PageAudioUpload,
    pageAudioRequest,
    uploadPageAudio,
} from '../model/page-audio-upload';
import { PageAudioField } from './PageAudioField';

export type PageSettingsEditorHandle = {
    save: () => Promise<boolean>;
    confirmLeave: (action: () => void) => void;
};
export type PageSettingsDraftView = {
    title: string;
    imageUrl: string | null;
    lighting: PageSettings['lighting'];
};

export function PageSettingsEditor({
    ref,
    page,
    active,
    disabled,
    onReplaceImage,
    onDraftChange,
    onDirtyChange,
    onBusyChange,
}: {
    ref?: Ref<PageSettingsEditorHandle>;
    page: Page;
    active: boolean;
    disabled: boolean;
    onReplaceImage: (asset: Asset, context: ImageAttachmentContext) => Promise<void>;
    onDraftChange: (value: PageSettingsDraftView | null) => void;
    onDirtyChange: (dirty: boolean) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth(),
        cache = useQueryClient();
    const [base, setBase] = useState(page.settings),
        [draft, setDraft] = useState(page.settings);
    const [baseTitle, setBaseTitle] = useState(page.title || ''),
        [title, setTitle] = useState(page.title || '');
    const [busy, setBusy] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const leaveAction = useRef<(() => void) | null>(null);
    const leaveOpener = useRef<HTMLElement | null>(null);
    const form = useRef<HTMLFormElement>(null);
    const [audioFiles, setAudioFiles] = useState<Partial<Record<PageAudioKey, File>>>({});
    const audioUploads = useRef<Partial<Record<PageAudioKey, PageAudioUpload>>>({});
    const imageInput = useRef<HTMLInputElement>(null),
        previewButton = useRef<HTMLButtonElement>(null);
    const checkpoint = useRef<UploadCheckpoint | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const [imagePreview, setImagePreview] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<Asset | null>(null);
    const [stage, setStage] = useState<string | null>(null),
        [progress, setProgress] = useState(0);
    const controller = useRef<AbortController | null>(null);
    const [chosen, setChosen] = useState<Record<string, Asset>>({});
    const [error, setError] = useState<string | null>(null);
    const guard = useRef(false),
        alive = useRef(true);
    const patch = settingsPatch(base, draft);
    const titleDirty = title.trim() !== baseTitle.trim();
    const dirty =
        titleDirty ||
        Object.keys(patch).length > 0 ||
        imageFile !== null ||
        Object.keys(audioFiles).length > 0;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            controller.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (!imageFile) {
            setFilePreview(null);
            setImageSize(null);
            return;
        }
        const url = URL.createObjectURL(imageFile);
        setFilePreview(url);
        setImageSize(null);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);
    useEffect(() => {
        onDirtyChange(dirty);
        return () => onDirtyChange(false);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        onBusyChange(busy);
        return () => onBusyChange(false);
    }, [busy, onBusyChange]);
    useEffect(() => {
        if (!dirty && !busy) {
            setBase(page.settings);
            setDraft(page.settings);
            setBaseTitle(page.title || '');
            setTitle(page.title || '');
        }
    }, [page.settings, page.title, dirty, busy]);
    useEffect(() => {
        if (!active)
            for (const audio of form.current?.querySelectorAll('audio') ?? []) audio.pause();
    }, [active]);
    useEffect(() => {
        onDraftChange({ title, imageUrl: filePreview, lighting: draft.lighting });
        return () => onDraftChange(null);
    }, [title, filePreview, draft.lighting, onDraftChange]);
    function update<K extends keyof PageSettings>(key: K, value: PageSettings[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
        setError(null);
    }
    function resetImage() {
        setImageFile(null);
        setBackgroundImage(null);
        checkpoint.current = null;
        setError(null);
    }
    function resetAudio(key: PageAudioKey) {
        delete audioUploads.current[key];
        setAudioFiles((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        setError(null);
    }
    function discard() {
        audioUploads.current = {};
        setAudioFiles({});
        resetImage();
        setDraft(base);
        setTitle(baseTitle);
        setError(null);
    }
    function confirmLeave(action: () => void) {
        if (guard.current || busy || imagePreview || leaving) return;
        if (!dirty) {
            action();
            return;
        }
        leaveOpener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        leaveAction.current = action;
        setLeaving(true);
    }
    function cancelLeave() {
        leaveAction.current = null;
        setLeaving(false);
    }
    function finishLeave() {
        const action = leaveAction.current;
        leaveAction.current = null;
        setLeaving(false);
        action?.();
    }
    async function saveAndLeave() {
        if (await save()) finishLeave();
    }
    async function save(): Promise<boolean> {
        if (disabled || guard.current) return false;
        if (!dirty) return true;
        guard.current = true;
        const active = new AbortController();
        controller.current = active;
        let imageSaved = false;
        setBusy(true);
        setError(null);
        try {
            const parsed = PageSettingsSchema.parse(draft);
            const uploadedAudio: Record<string, Asset> = {};
            for (const key of ['backgroundAudioAssetId', 'narrationAssetId'] as const) {
                const file = audioFiles[key];
                if (!file) continue;
                const label = key === 'backgroundAudioAssetId' ? 'âm thanh nền' : 'lời thuyết minh';
                const state = audioUploads.current[key] ?? { checkpoint: null };
                audioUploads.current[key] = state;
                const asset = await uploadPageAudio({
                    api: assetsApi,
                    transfer: uploadFile,
                    file,
                    state,
                    signal: active.signal,
                    metadata: {
                        name: file.name.slice(0, 150),
                        tags: [key === 'backgroundAudioAssetId' ? 'bgm' : 'voice'],
                    },
                    onStage: (value) => {
                        if (!active.signal.aborted) {
                            setProgress(0);
                            setStage(
                                value === 'uploading'
                                    ? `Đang tải ${label}…`
                                    : value === 'signing'
                                      ? `Đang chuẩn bị ${label}…`
                                      : `Đang xác nhận ${label}…`,
                            );
                        }
                    },
                    onProgress: (value) => {
                        if (!active.signal.aborted) setProgress(value);
                    },
                    onProcessing: () => {
                        if (!active.signal.aborted) setStage(`Đang xử lý ${label}…`);
                    },
                });
                if (
                    !alive.current ||
                    active.signal.aborted ||
                    auth.store.getState().user?.id !== user?.id
                )
                    return false;
                uploadedAudio[asset.id] = asset;
                setChosen((current) => ({ ...current, [asset.id]: asset }));
                parsed[key] = asset.id;
            }
            const delta = settingsPatch(base, parsed);
            if (imageFile) {
                setProgress(0);
                let ready = backgroundImage;
                if (!ready) {
                    const result = await runAssetUpload({
                        api: assetsApi,
                        transfer: uploadFile,
                        file: imageFile,
                        purpose: 'PAGE_IMAGE',
                        metadata: { tags: [] },
                        signal: active.signal,
                        checkpoint: checkpoint.current,
                        onCheckpoint: (value) => {
                            if (!active.signal.aborted) checkpoint.current = value;
                        },
                        onStage: (value) => {
                            if (!active.signal.aborted) {
                                setProgress(0);
                                setStage(
                                    value === 'signing'
                                        ? 'Đang chuẩn bị tải ảnh…'
                                        : value === 'uploading'
                                          ? 'Đang tải ảnh nền…'
                                          : 'Đang xác nhận ảnh…',
                                );
                            }
                        },
                        onProgress: (value) => {
                            if (!active.signal.aborted) setProgress(value);
                        },
                    });
                    active.signal.throwIfAborted();
                    if (
                        result.processing ||
                        result.asset.type !== 'IMAGE' ||
                        result.asset.status !== 'READY'
                    )
                        throw new ContractError();
                    ready = result.asset;
                    setBackgroundImage(ready);
                    void cache.invalidateQueries({ queryKey: assetKeys.all });
                    void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
                }
                setStage('Đang thay ảnh nền…');
                await onReplaceImage(ready, {
                    signal: active.signal,
                    onStage: (value) => {
                        if (active.signal.aborted) return;
                        setProgress(0);
                        setStage(
                            value === 'compiling'
                                ? 'Đang chuẩn bị nhận diện ảnh…'
                                : value === 'uploading-marker'
                                  ? 'Đang tải dữ liệu nhận diện…'
                                  : 'Đang lưu ảnh nền…',
                        );
                    },
                    onProgress: (value) => {
                        if (!active.signal.aborted) setProgress(value);
                    },
                });
                if (
                    !alive.current ||
                    active.signal.aborted ||
                    auth.store.getState().user?.id !== user?.id
                )
                    return false;
                imageSaved = true;
                resetImage();
            }
            setStage('Đang lưu thiết lập…');
            if (titleDirty || Object.keys(delta).length > 0) {
                const result = await pagesApi.update(page.id, {
                    ...(titleDirty ? { title: title.trim() || null } : {}),
                    ...(Object.keys(delta).length ? { settings: delta } : {}),
                });
                if (!alive.current || auth.store.getState().user?.id !== user?.id) return false;
                setBase(parsed);
                setDraft(parsed);
                setBaseTitle(result.title || '');
                setTitle(result.title || '');
                cache.setQueryData<Page>(pageKeys.detail(user?.id || '', page.id), (current) =>
                    current
                        ? {
                              ...current,
                              title: result.title,
                              settings: { ...current.settings, ...delta },
                              assets: {
                                  ...current.assets,
                                  ...Object.fromEntries(
                                      Object.entries(uploadedAudio).map(([id, asset]) => [
                                          id,
                                          {
                                              type: asset.type,
                                              url: asset.url,
                                              thumbnailUrl: asset.thumbnailUrl,
                                              meta: asset.meta,
                                          },
                                      ]),
                                  ),
                              },
                          }
                        : current,
                );
            }
            audioUploads.current = {};
            setAudioFiles({});
            await Promise.all([
                cache.invalidateQueries({ queryKey: profileKey(user?.id || '') }),
                cache.invalidateQueries({ queryKey: pageKeys.all }),
                cache.invalidateQueries({ queryKey: bookKeys.all }),
                cache.invalidateQueries({ queryKey: assetKeys.all }),
            ]);
            if (!alive.current || auth.store.getState().user?.id !== user?.id) return false;
            return true;
        } catch (cause) {
            if (alive.current && !active.signal.aborted)
                setError(
                    imageSaved
                        ? `Ảnh nền đã được cập nhật. Chưa lưu được các thiết lập còn lại: ${errorMessage(cause)}`
                        : errorMessage(cause),
                );
            return false;
        } finally {
            guard.current = false;
            controller.current = null;
            if (alive.current) {
                setBusy(false);
                setStage(null);
            }
        }
    }
    useImperativeHandle(ref, () => ({ save, confirmLeave }));
    return (
        <>
            <form
                ref={form}
                aria-label="Thiết lập trang"
                className="flex min-h-0 flex-1 flex-col overflow-hidden [--control-height:40px]"
                onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                }}
            >
                <fieldset
                    disabled={disabled || busy}
                    className="m-0 min-h-0 flex-1 overflow-y-auto overscroll-contain border-0 p-4"
                >
                    <FieldGroup className="gap-3">
                        <Field>
                            <FieldLabel htmlFor="page-settings-name" className="m-0">
                                Tên trang
                            </FieldLabel>
                            <Input
                                id="page-settings-name"
                                name="title"
                                value={title}
                                maxLength={150}
                                placeholder={`Trang ${page.orderIndex + 1}`}
                                className="m-0 h-10"
                                onChange={(event) => {
                                    setTitle(event.currentTarget.value);
                                    setError(null);
                                }}
                            />
                            <FieldDescription className="m-0">
                                Để trống để hiển thị theo số trang.
                            </FieldDescription>
                        </Field>
                        <Field className="min-w-0 gap-3">
                            <FieldLabel className="m-0">Ảnh nền trang</FieldLabel>
                            <div className="flex min-w-0 items-center gap-4">
                                <IconButton
                                    ref={previewButton}
                                    type="button"
                                    variant="plain"
                                    className="group relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border p-0"
                                    aria-label="Xem ảnh nền"
                                    onClick={() => setImagePreview(true)}
                                >
                                    <img
                                        src={filePreview || page.image.url}
                                        alt="Ảnh nền trang sách"
                                        className="size-full object-contain transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                                        onLoad={(event) => {
                                            if (imageFile)
                                                setImageSize({
                                                    width: event.currentTarget.naturalWidth,
                                                    height: event.currentTarget.naturalHeight,
                                                });
                                        }}
                                    />
                                    <span
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/15 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                                    >
                                        <span className="flex size-8 items-center justify-center rounded-full bg-surface/95 text-primary shadow-sm">
                                            <Eye className="size-5" />
                                        </span>
                                    </span>
                                </IconButton>
                                <div className="flex min-w-0 flex-1 flex-col gap-3">
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <p className="m-0 truncate text-sm" title={imageFile?.name}>
                                            {imageFile?.name || 'Ảnh nền hiện tại'}
                                        </p>
                                        <p className="m-0 text-muted-foreground text-xs">
                                            {imageFile
                                                ? imageSize
                                                    ? `${imageSize.width} × ${imageSize.height} px`
                                                    : 'Đang đọc ảnh…'
                                                : `${page.image.width} × ${page.image.height} px`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10"
                                            onClick={() => imageInput.current?.click()}
                                        >
                                            <ImagePlus data-icon="inline-start" />
                                            Đổi ảnh nền
                                        </Button>
                                        {imageFile && (
                                            <IconButton
                                                type="button"
                                                variant="plain"
                                                size="icon-sm"
                                                aria-label="Giữ ảnh nền hiện tại"
                                                onClick={resetImage}
                                            >
                                                <RotateCcw />
                                            </IconButton>
                                        )}
                                    </div>
                                    {imageFile && (
                                        <FieldDescription className="m-0 text-xs">
                                            Ảnh mới chưa được lưu
                                            {page.markerMode === 'CUSTOM_MARKER'
                                                ? '; nhận diện AR sẽ được cập nhật khi lưu.'
                                                : '.'}
                                        </FieldDescription>
                                    )}
                                </div>
                            </div>
                            <FieldDescription className="m-0 text-xs">
                                JPG/PNG, tối đa 10 MB. Ảnh được tải lên khi lưu thay đổi.
                            </FieldDescription>
                        </Field>
                        <Input
                            ref={imageInput}
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            hidden
                            className="hidden"
                            aria-label="Tải ảnh nền từ máy"
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = '';
                                if (!file) return;
                                try {
                                    uploadRequest(file, 'PAGE_IMAGE');
                                    setImageFile(file);
                                    setBackgroundImage(null);
                                    checkpoint.current = null;
                                    setError(null);
                                } catch (cause) {
                                    setError(errorMessage(cause));
                                }
                            }}
                        />
                        <FieldSet className="min-w-0 gap-3">
                            <FieldLegend variant="label" className="m-0 mb-2">
                                Âm thanh của trang
                            </FieldLegend>
                            <FieldGroup className="gap-3">
                                {(['backgroundAudioAssetId', 'narrationAssetId'] as const).map(
                                    (key) => {
                                        const background = key === 'backgroundAudioAssetId',
                                            assetId = draft[key];
                                        return (
                                            <FieldGroup key={key} className="min-w-0 gap-3">
                                                <PageAudioField
                                                    background={background}
                                                    loopControl={
                                                        background ? (
                                                            <Field
                                                                orientation="horizontal"
                                                                className="w-auto! shrink-0 gap-2"
                                                                data-disabled={
                                                                    !assetId && !audioFiles[key]
                                                                }
                                                            >
                                                                <FieldLabel
                                                                    htmlFor="page-background-loop"
                                                                    className="m-0 font-normal text-xs"
                                                                >
                                                                    Lặp
                                                                </FieldLabel>
                                                                <Switch
                                                                    id="page-background-loop"
                                                                    aria-label="Phát lặp"
                                                                    checked={draft.backgroundLoop}
                                                                    disabled={
                                                                        (!assetId &&
                                                                            !audioFiles[key]) ||
                                                                        disabled ||
                                                                        busy
                                                                    }
                                                                    onCheckedChange={(value) =>
                                                                        update(
                                                                            'backgroundLoop',
                                                                            value,
                                                                        )
                                                                    }
                                                                />
                                                            </Field>
                                                        ) : undefined
                                                    }
                                                    file={audioFiles[key]}
                                                    hasCurrent={Boolean(assetId)}
                                                    currentName={
                                                        assetId ? chosen[assetId]?.name : undefined
                                                    }
                                                    currentUrl={
                                                        assetId
                                                            ? chosen[assetId]?.url ||
                                                              page.assets[assetId]?.url
                                                            : undefined
                                                    }
                                                    onFile={(file) => {
                                                        try {
                                                            pageAudioRequest(file);
                                                            audioUploads.current[key] = {
                                                                checkpoint: null,
                                                            };
                                                            setAudioFiles((current) => ({
                                                                ...current,
                                                                [key]: file,
                                                            }));
                                                            setError(null);
                                                        } catch (cause) {
                                                            setError(errorMessage(cause));
                                                        }
                                                    }}
                                                    onReset={() => resetAudio(key)}
                                                    onRemove={() => {
                                                        resetAudio(key);
                                                        update(key, null);
                                                    }}
                                                />
                                            </FieldGroup>
                                        );
                                    },
                                )}
                            </FieldGroup>
                            <FieldDescription className="m-0">
                                MP3/WAV, tối đa 100 MB/tệp. Tải lên khi lưu.
                            </FieldDescription>
                        </FieldSet>
                        <Field className="gap-3">
                            <FieldLabel className="m-0">Ánh sáng</FieldLabel>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="lg"
                                value={draft.lighting}
                                aria-label="Ánh sáng"
                                className="w-full"
                                onValueChange={(value) => {
                                    if (value)
                                        update('lighting', value as PageSettings['lighting']);
                                }}
                            >
                                <ToggleGroupItem value="neutral" className="h-10 flex-1">
                                    Trung tính
                                </ToggleGroupItem>
                                <ToggleGroupItem value="warm" className="h-10 flex-1">
                                    Ấm
                                </ToggleGroupItem>
                                <ToggleGroupItem value="cool" className="h-10 flex-1">
                                    Lạnh
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <FieldDescription className="m-0">
                                Áp dụng lên mô hình 3D. Đối tượng 2D không bị ảnh hưởng.
                            </FieldDescription>
                        </Field>
                        <Feedback error={error} />
                    </FieldGroup>
                </fieldset>
                <footer className="flex shrink-0 flex-col gap-3 p-4">
                    {busy && (
                        <div
                            className="flex min-w-0 flex-col gap-2"
                            role="status"
                            aria-live="polite"
                        >
                            <span className="truncate text-muted-foreground text-xs">
                                {stage || 'Đang lưu…'}
                            </span>
                            {(stage?.includes('nhận diện') || stage?.startsWith('Đang tải ')) &&
                                !stage?.includes('lưu') && (
                                    <Progress value={progress} className="h-1.5" />
                                )}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 min-w-0 flex-1"
                            disabled={disabled || busy || !dirty}
                            onClick={discard}
                        >
                            Bỏ thay đổi
                        </Button>
                        <Button
                            type="submit"
                            className="h-10 min-w-0 flex-1"
                            disabled={disabled || busy || !dirty}
                            aria-busy={busy}
                        >
                            {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                        </Button>
                    </div>
                </footer>
            </form>
            <Dialog open={imagePreview} onOpenChange={setImagePreview}>
                <DialogContent
                    className="max-h-[calc(100dvh-48px)] max-w-[min(1100px,calc(100vw-48px))] gap-4 overflow-hidden p-6"
                    onEscapeKeyDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setImagePreview(false);
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        previewButton.current?.focus({ preventScroll: true });
                    }}
                >
                    <DialogHeader className="gap-1.5 pr-10">
                        <DialogTitle className="m-0">Xem ảnh nền</DialogTitle>
                        <DialogDescription className="m-0 truncate">
                            {imageFile?.name || `Ảnh nền trang ${page.orderIndex + 1}`}
                        </DialogDescription>
                    </DialogHeader>
                    <img
                        src={filePreview || page.image.url}
                        alt="Xem đầy đủ ảnh nền trang"
                        className="max-h-[calc(100dvh-180px)] w-full object-contain"
                    />
                </DialogContent>
            </Dialog>
            {leaving && (
                <ConfirmationDialog
                    title="Lưu thiết lập trước khi rời?"
                    className="max-w-[min(560px,calc(100vw-32px))]"
                    description="Thiết lập trang chưa được lưu. Bạn có thể tiếp tục chỉnh sửa, bỏ thay đổi hoặc lưu trước khi rời."
                    busy={busy}
                    onClose={cancelLeave}
                    returnFocus={leaveOpener.current}
                >
                    <Feedback error={error} className="mb-0" />
                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10"
                            disabled={busy}
                            onClick={cancelLeave}
                        >
                            Tiếp tục chỉnh sửa
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10"
                            disabled={busy}
                            onClick={() => {
                                discard();
                                finishLeave();
                            }}
                        >
                            Bỏ thay đổi
                        </Button>
                        <Button
                            size="sm"
                            className="h-10"
                            disabled={disabled || busy}
                            aria-busy={busy}
                            onClick={() => void saveAndLeave()}
                        >
                            {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}Lưu và
                            tiếp tục
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
