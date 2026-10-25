import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileUp, RefreshCw, Upload } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Feedback } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/primitives/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { errorMessage } from '../../../shared/api/errors';
import type { CompleteAssetBody } from '../../../shared/contracts/api/assets.schema';
import type { Asset } from '../../../shared/contracts/dto.schema';
import type { AssetType } from '../../../shared/contracts/enums.schema';
import { assetKeys, assetsApi, completeAssetForm } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { runAssetUpload, type UploadCheckpoint, type UploadStage } from '../../assets/model/upload';
import { useAuth } from '../../auth';
import { profileKey } from '../../profile';
import { importAccept, importHint, readModelDocument, validateImport } from '../model/import-asset';
import { AssetMediaPreview, useFileUrl } from './AssetMediaPreview';

const stageLabels = {
    signing: 'Đang chuẩn bị tải tệp…',
    uploading: 'Đang tải tệp…',
    completing: 'Đang xác nhận tài nguyên…',
};
export function AssetUploadView({
    type,
    pending,
    onChoose,
    onBack,
    onBusyChange,
}: {
    type: AssetType;
    pending: boolean;
    onChoose: (asset: Asset) => void;
    onBack: () => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
    const { user } = useAuth(),
        cache = useQueryClient();
    const [file, setFile] = useState<File | null>(null),
        [reading, setReading] = useState(false),
        [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null),
        [stage, setStage] = useState<UploadStage | null>(null),
        [progress, setProgress] = useState(0);
    const [checkpoint, setCheckpoint] = useState<UploadCheckpoint | null>(null),
        [assetId, setAssetId] = useState<string | null>(null);
    const active = useRef<AbortController | null>(null),
        version = useRef(0),
        input = useRef<HTMLInputElement>(null),
        metadata = useRef<CompleteAssetBody | null>(null);
    const url = useFileUrl(file),
        busy = Boolean(stage) || pending;
    useEffect(() => {
        onBusyChange(Boolean(stage));
        return () => onBusyChange(false);
    }, [stage, onBusyChange]);
    useEffect(
        () => () => {
            active.current?.abort();
            version.current++;
        },
        [],
    );
    const result = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => assetsApi.detail(assetId || '', signal),
        enabled: Boolean(assetId),
        refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 2000 : false),
        retry: false,
    });
    useEffect(() => {
        if (result.data?.status === 'READY')
            void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
    }, [result.data?.status, cache, user?.id]);
    async function selectFile(selected: File | null) {
        if (!selected || pending || active.current || assetId) return;
        const generation = ++version.current;
        setReading(true);
        setError(null);
        setFile(null);
        setCheckpoint(null);
        metadata.current = null;
        setProgress(0);
        try {
            validateImport(selected, type);
            if (type === 'MODEL') readModelDocument(await selected.arrayBuffer());
            if (version.current !== generation) return;
            setFile(selected);
            setName(selected.name.replace(/\.[^.]+$/, '').slice(0, 150));
        } catch (cause) {
            if (version.current === generation) setError(errorMessage(cause));
        } finally {
            if (version.current === generation) setReading(false);
        }
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file || reading || pending || active.current || assetId) return;
        const form = new FormData(event.currentTarget),
            controller = new AbortController();
        active.current = controller;
        setError(null);
        try {
            const body =
                checkpoint?.uploaded && metadata.current
                    ? metadata.current
                    : completeAssetForm(form);
            metadata.current = body;
            const uploaded = await runAssetUpload({
                api: assetsApi,
                transfer: uploadFile,
                file,
                metadata: body,
                signal: controller.signal,
                checkpoint,
                onStage: (value) => {
                    if (!controller.signal.aborted) setStage(value);
                },
                onCheckpoint: (value) => {
                    if (!controller.signal.aborted) setCheckpoint(value);
                },
                onProgress: (value) => {
                    if (!controller.signal.aborted) setProgress(value);
                },
            });
            controller.signal.throwIfAborted();
            if (uploaded.asset.type !== type)
                throw new Error('Tệp đã tải lên có loại tài nguyên không phù hợp.');
            if (!uploaded.processing)
                cache.setQueryData(
                    assetKeys.detail(user?.id || '', uploaded.asset.id),
                    uploaded.asset,
                );
            setAssetId(uploaded.asset.id);
            void cache.invalidateQueries({ queryKey: assetKeys.lists(user?.id || '') });
            void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
        } catch (cause) {
            if (!controller.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (active.current === controller) {
                active.current = null;
                setStage(null);
            }
        }
    }
    function cancel() {
        active.current?.abort();
        active.current = null;
        setStage(null);
        setProgress(0);
        // A cancelled transfer cannot reuse its partial upload; a failed completion can.
        setCheckpoint(null);
        metadata.current = null;
        setError('Đã dừng tải. Bạn có thể thử lại hoặc chọn tệp khác.');
    }
    const ready = result.data?.status === 'READY',
        failed = result.data?.status === 'FAILED';
    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" aria-busy={busy}>
            <input
                ref={input}
                id="scene-import-file"
                hidden
                type="file"
                accept={importAccept[type]}
                disabled={busy || Boolean(assetId)}
                onChange={(event) => {
                    void selectFile(event.currentTarget.files?.[0] || null);
                    event.currentTarget.value = '';
                }}
            />
            <div className="min-h-0 flex-1 px-6 py-4">
                <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_280px] grid-rows-[minmax(0,1fr)] gap-6">
                    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
                        {url ? (
                            <AssetMediaPreview
                                type={type}
                                url={url}
                                modelOptions={{ controlsTarget, fileSize: file?.size }}
                            />
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                                <FileUp
                                    className="size-9 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <h3 className="font-semibold text-lg">
                                    {type === 'MODEL'
                                        ? 'Xem mô hình trước khi thêm'
                                        : 'Chọn tệp của bạn'}
                                </h3>
                                <p className="max-w-80 text-muted-foreground text-sm">
                                    {importHint[type]}
                                </p>
                                <Button
                                    variant="secondary"
                                    disabled={busy || reading}
                                    onClick={() => input.current?.click()}
                                >
                                    {reading ? <Spinner /> : <Upload data-icon="inline-start" />}
                                    {reading ? 'Đang đọc tệp…' : 'Chọn tệp từ máy'}
                                </Button>
                            </div>
                        )}
                    </div>
                    <FieldGroup className="min-h-0 gap-3 [&_[data-slot=alert]]:m-0 [&_[data-slot=alert]]:py-2 [&_[data-slot=input]]:min-h-10 [&_[data-slot=input]]:text-sm">
                        <Field>
                            <FieldLabel htmlFor="scene-import-name">Tên tài nguyên</FieldLabel>
                            <Input
                                id="scene-import-name"
                                name="name"
                                value={name}
                                onChange={(event) => setName(event.currentTarget.value)}
                                maxLength={150}
                                required
                                disabled={
                                    !file ||
                                    busy ||
                                    Boolean(assetId) ||
                                    Boolean(checkpoint?.uploaded)
                                }
                                placeholder="Ví dụ: Khủng long nhỏ"
                            />
                        </Field>
                        {type === 'MODEL' && (
                            <div
                                ref={setControlsTarget}
                                className="min-w-0 border-border border-y py-3"
                            />
                        )}
                        <Field
                            data-collapsed={Boolean(stage || assetId || checkpoint?.uploaded)}
                            className="data-[collapsed=true]:hidden"
                        >
                            <FieldLabel htmlFor="scene-import-tags">
                                Nhãn{' '}
                                <span className="font-normal text-muted-foreground">
                                    (không bắt buộc)
                                </span>
                            </FieldLabel>
                            <Input
                                id="scene-import-tags"
                                name="tags"
                                disabled={
                                    !file ||
                                    busy ||
                                    Boolean(assetId) ||
                                    Boolean(checkpoint?.uploaded)
                                }
                                placeholder="động vật, tự nhiên"
                            />
                            <FieldDescription className="text-xs [@media(max-height:700px)]:hidden">
                                Phân cách bằng dấu phẩy. Tối đa 20 nhãn.
                            </FieldDescription>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="scene-import-file">Tệp tài nguyên</FieldLabel>
                            {file ? (
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="min-w-0 flex-1 truncate text-sm"
                                        title={file.name}
                                    >
                                        {file.name}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={
                                            busy ||
                                            Boolean(assetId) ||
                                            reading ||
                                            Boolean(checkpoint?.uploaded)
                                        }
                                        onClick={() => input.current?.click()}
                                    >
                                        Thay tệp
                                    </Button>
                                </div>
                            ) : (
                                <FieldDescription className="text-xs">
                                    {importHint[type]}
                                </FieldDescription>
                            )}
                        </Field>
                        <Feedback error={error} />
                        {stage && (
                            <div role="status" className="flex flex-col gap-2 text-sm">
                                <span className="flex items-center gap-2">
                                    <Spinner />
                                    {stageLabels[stage]}
                                    {stage === 'uploading' && ` ${progress}%`}
                                </span>
                                {stage === 'uploading' && (
                                    <Progress value={progress} aria-label="Tiến độ tải tệp" />
                                )}
                            </div>
                        )}
                        {!stage && !assetId && checkpoint?.uploaded && (
                            <p role="status" className="text-muted-foreground text-xs">
                                Tệp đã tải xong. Chỉ cần xác nhận lại.
                            </p>
                        )}
                        {assetId && (
                            <div role="status" className="flex flex-col gap-2 text-sm">
                                {ready ? (
                                    <span className="flex items-center gap-2">
                                        <Check className="size-4" />
                                        Tài nguyên đã sẵn sàng.
                                    </span>
                                ) : failed ? (
                                    <Feedback error="Không xử lý được tệp. Hãy kiểm tra định dạng và tải một bản khác." />
                                ) : result.isError ? (
                                    <>
                                        <Feedback error={errorMessage(result.error)} />
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => void result.refetch()}
                                        >
                                            <RefreshCw />
                                            Kiểm tra lại trạng thái
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex items-center gap-2">
                                            <Spinner />
                                            Đang xử lý tài nguyên…
                                        </span>
                                        <p className="text-muted-foreground text-xs">
                                            Bạn có thể về thư viện trong lúc chờ xử lý.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </FieldGroup>
                </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 border-border border-t px-6 py-3">
                <p className="text-muted-foreground text-xs">
                    {assetId
                        ? 'Tài nguyên đã lưu trong thư viện của bạn.'
                        : 'Tải lên trước, sau đó chọn thêm vào trang.'}
                </p>
                <div className="flex items-center gap-3">
                    {stage && stage !== 'completing' && (
                        <Button variant="ghost" onClick={cancel}>
                            Dừng tải
                        </Button>
                    )}
                    {!busy && (
                        <Button variant="ghost" onClick={onBack}>
                            {assetId ? 'Về tài nguyên của tôi' : 'Về thư viện'}
                        </Button>
                    )}
                    {assetId ? (
                        <Button
                            disabled={!ready || result.isFetching || pending}
                            onClick={() => {
                                if (result.data?.status === 'READY') onChoose(result.data);
                            }}
                        >
                            Thêm vào trang
                        </Button>
                    ) : (
                        <Button type="submit" disabled={!file || reading || busy}>
                            {busy ? <Spinner /> : <Upload data-icon="inline-start" />}
                            {busy
                                ? 'Đang tải…'
                                : checkpoint?.uploaded
                                  ? 'Thử xác nhận lại'
                                  : 'Tải lên'}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
}
