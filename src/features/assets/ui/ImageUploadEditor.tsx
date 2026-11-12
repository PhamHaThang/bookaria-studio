import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { optimizeBookCover } from '@/shared/lib/image-file';
import { Button as PreviewButton } from '@/shared/ui/primitives/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { formatBytes } from '../../../shared/lib/format';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { uploadFile } from '../api/upload-file';
import { assetKeys, assetsApi } from '../model/assets';
import { imageUploadRequest, saveUploadedImage } from '../model/image';
import type { UploadCheckpoint, UploadStage } from '../model/upload';

type Stage = UploadStage | 'preparing' | 'saving';
const stages: Record<Stage, string> = {
    preparing: 'Đang tối ưu ảnh bìa…',
    signing: 'Đang chuẩn bị tải ảnh…',
    uploading: 'Đang tải ảnh…',
    completing: 'Đang xác nhận ảnh…',
    saving: 'Đang lưu thay đổi…',
};

export function ImageUploadEditor({
    kind,
    currentUrl,
    disabled = false,
    embedded = false,
    onSave,
    onBusyChange,
    onUploaded,
}: {
    kind: 'avatar' | 'cover';
    currentUrl: string | null;
    disabled?: boolean;
    embedded?: boolean;
    onSave: (assetId: string | null) => Promise<void>;
    onBusyChange: (busy: boolean) => void;
    onUploaded: () => void;
}) {
    const id = useId();
    const cache = useQueryClient();
    const avatar = kind === 'avatar';
    const title = avatar ? 'Ảnh đại diện' : 'Ảnh bìa sách';
    const purpose = avatar ? 'AVATAR' : 'ASSET';
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [checkpoint, setCheckpoint] = useState<UploadCheckpoint | null>(null);
    const [readyAsset, setReadyAsset] = useState<Asset | null>(null);
    const [stage, setStage] = useState<Stage | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    function resetSelection(clearInput = true) {
        setFile(null);
        setCheckpoint(null);
        setReadyAsset(null);
        setProgress(0);
        if (clearInput && input.current) input.current.value = '';
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (disabled || controller.current || !file) return;
        const active = new AbortController();
        controller.current = active;
        setError(null);
        setNotice(null);
        onBusyChange(true);
        try {
            await saveUploadedImage({
                api: assetsApi,
                transfer: uploadFile,
                file,
                purpose,
                prepareFile: avatar ? undefined : optimizeBookCover,
                onPreparing: () => setStage('preparing'),
                metadata: { tags: [] },
                signal: active.signal,
                checkpoint,
                readyAsset,
                onCheckpoint: (value) => {
                    if (!active.signal.aborted) setCheckpoint(value);
                },
                onStage: (value) => {
                    if (!active.signal.aborted) setStage(value);
                },
                onProgress: (value) => {
                    if (!active.signal.aborted) setProgress(value);
                },
                onReady: (asset) => {
                    setReadyAsset(asset);
                    void cache.invalidateQueries({ queryKey: assetKeys.all });
                    onUploaded();
                },
                onSaving: () => setStage('saving'),
                save: onSave,
            });
            if (active.signal.aborted) return;
            resetSelection();
            setNotice(avatar ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh bìa sách.');
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (controller.current === active) {
                controller.current = null;
                setStage(null);
                onBusyChange(false);
            }
        }
    }
    function cancel() {
        controller.current?.abort();
        controller.current = null;
        setStage(null);
        onBusyChange(false);
        resetSelection();
        setError(null);
        setNotice('Đã dừng tải ảnh.');
    }
    async function remove() {
        if (disabled || controller.current) return;
        const active = new AbortController();
        controller.current = active;
        setStage('saving');
        onBusyChange(true);
        setError(null);
        setNotice(null);
        try {
            await onSave(null);
            if (!active.signal.aborted)
                setNotice(avatar ? 'Đã gỡ ảnh đại diện.' : 'Đã gỡ ảnh bìa sách.');
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (controller.current === active) {
                controller.current = null;
                setStage(null);
                onBusyChange(false);
            }
        }
    }
    const imageUrl = preview || currentUrl;
    const choosingDisabled = disabled || Boolean(stage);
    function chooseImage() {
        if (!choosingDisabled) input.current?.click();
    }
    return (
        <section
            className={cn(
                'image-editor',
                !embedded && 'rounded-[var(--radius-card)] border border-border bg-surface',
                !embedded &&
                    (avatar
                        ? 'p-6 [&_h2]:m-0 [&_h2]:font-semibold [&_h2]:text-lg'
                        : 'editor-form mb-6 max-w-180 p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6 [&_h2]:mt-0 [&_h2]:text-[length:var(--text-xl)]'),
            )}
            aria-labelledby={`${id}-title`}
        >
            <h2 id={`${id}-title`} className={embedded ? 'sr-only' : undefined}>
                {title}
            </h2>
            {!embedded && (
                <p
                    className={cn(
                        'text-muted-foreground text-sm',
                        avatar ? 'mt-1 mb-5' : 'section-description mx-0 mt-[-6px] mb-6',
                    )}
                >
                    {avatar
                        ? 'Ảnh hiển thị trên hồ sơ và góc tài khoản.'
                        : 'Ảnh giúp nhận diện sách trong danh sách của bạn.'}
                </p>
            )}
            <Feedback error={error} success={notice} />
            <div
                className={cn(
                    'image-editor-layout grid [&_form]:min-w-0',
                    embedded ? 'items-center' : 'items-start',
                    avatar
                        ? 'grid-cols-[80px_minmax(0,1fr)] gap-5'
                        : 'grid-cols-[144px_minmax(0,_1fr)] gap-6 max-[600px]:grid-cols-[minmax(0,_1fr)]',
                )}
            >
                <PreviewButton
                    variant="plain"
                    type="button"
                    onClick={chooseImage}
                    disabled={choosingDisabled}
                    aria-label={`Chọn ${title.toLowerCase()} từ ảnh xem trước`}
                    aria-describedby={`${id}-help`}
                    className={cn(
                        'image-editor-preview flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden bg-muted text-[length:var(--text-xs)] text-muted-foreground [&_img]:block [&_img]:size-full',
                        avatar
                            ? 'avatar-preview group/avatar-preview relative size-20 rounded-full border border-border bg-background [&_img]:object-cover'
                            : 'cover-preview h-48 w-36 rounded-[var(--radius-sm)] [&_img]:object-contain',
                    )}
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={file ? `Xem trước ${title.toLowerCase()}` : title}
                        />
                    ) : (
                        <>
                            <span aria-hidden="true">
                                {avatar ? <UserRound size={32} /> : <ImagePlus size={32} />}
                            </span>
                            {!avatar && <span>Chưa có ảnh</span>}
                        </>
                    )}
                    {avatar && (
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-150 group-hover/avatar-preview:opacity-100 group-focus-visible/avatar-preview:opacity-100 group-disabled/avatar-preview:opacity-0 motion-reduce:transition-none"
                        >
                            <ImagePlus className="size-5" />
                        </span>
                    )}
                </PreviewButton>
                <form
                    onSubmit={submit}
                    aria-label={`Cập nhật ${title.toLowerCase()}`}
                    aria-busy={Boolean(stage)}
                >
                    <FieldGroup className={avatar ? 'items-start gap-3' : 'contents'}>
                        <Field orientation="contents">
                            <FieldLabel
                                htmlFor={`${id}-file`}
                                className={avatar ? 'sr-only' : undefined}
                            >
                                {title}
                            </FieldLabel>
                        </Field>
                        {(!avatar || !file) && (
                            <Button
                                type="button"
                                variant={avatar ? 'outline' : 'secondary'}
                                disabled={choosingDisabled}
                                aria-controls={`${id}-file`}
                                aria-describedby={`${id}-help`}
                                onClick={chooseImage}
                            >
                                <ImagePlus data-icon="inline-start" aria-hidden="true" />
                                {file ? 'Đổi ảnh' : `Chọn ${title.toLowerCase()}`}
                            </Button>
                        )}
                        <Input
                            className="hidden"
                            tabIndex={-1}
                            id={`${id}-file`}
                            ref={input}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={choosingDisabled}
                            aria-describedby={`${id}-help`}
                            onChange={(event) => {
                                const selected = event.currentTarget.files?.[0];
                                resetSelection(false);
                                setError(null);
                                setNotice(null);
                                if (!selected) return;
                                try {
                                    imageUploadRequest(selected, purpose);
                                    setFile(selected);
                                } catch (cause) {
                                    setError(errorMessage(cause));
                                }
                            }}
                        />
                        <p
                            id={`${id}-help`}
                            className={
                                avatar
                                    ? 'm-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs leading-relaxed'
                                    : 'field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]'
                            }
                        >
                            <span>JPG, PNG hoặc WebP. Tối đa {avatar ? '2' : '10'} MB.</span>
                            {avatar && file && (
                                <>
                                    <span className="border-border border-l pl-3">
                                        {formatBytes(file.size)}
                                    </span>
                                    <span className="sr-only">Đã chọn ảnh: {file.name}</span>
                                </>
                            )}
                        </p>
                        {!avatar && file && (
                            <p className="image-file-name wrap-anywhere text-[length:var(--text-sm)]">
                                {file.name} · {formatBytes(file.size)}
                            </p>
                        )}
                        {stage && (
                            <div className="image-upload-progress [&_progress]:w-full">
                                <p role="status">
                                    {stages[stage]}
                                    {stage === 'uploading' ? ` ${progress}%` : ''}
                                </p>
                                {stage === 'uploading' && (
                                    <Progress
                                        aria-label="Tiến độ tải ảnh"
                                        value={progress}
                                        max={100}
                                    />
                                )}
                            </div>
                        )}
                        {!stage && readyAsset && (
                            <p
                                className={
                                    avatar
                                        ? 'm-0 text-muted-foreground text-xs leading-relaxed'
                                        : 'field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]'
                                }
                            >
                                Ảnh đã tải xong. Bấm Thử lưu lại để cập nhật, không cần tải ảnh lần
                                nữa.
                            </p>
                        )}
                        {!stage && !readyAsset && checkpoint?.uploaded && (
                            <p
                                className={
                                    avatar
                                        ? 'm-0 text-muted-foreground text-xs leading-relaxed'
                                        : 'field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]'
                                }
                            >
                                Ảnh đã tải xong, đang chờ xác nhận. Bạn có thể thử lại.
                            </p>
                        )}
                        <div
                            className={
                                avatar
                                    ? 'flex flex-wrap items-center gap-3 empty:hidden'
                                    : 'form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2'
                            }
                        >
                            {file && (
                                <Button
                                    type="submit"
                                    disabled={disabled || Boolean(stage)}
                                    aria-busy={Boolean(stage)}
                                >
                                    {Boolean(stage) && (
                                        <Spinner data-icon="inline-start" aria-hidden="true" />
                                    )}
                                    {stage
                                        ? 'Đang xử lý…'
                                        : readyAsset
                                          ? 'Thử lưu lại'
                                          : error
                                            ? 'Thử lại'
                                            : avatar
                                              ? 'Lưu ảnh đại diện'
                                              : 'Lưu ảnh bìa'}
                                </Button>
                            )}
                            {avatar && file && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={choosingDisabled}
                                    aria-controls={`${id}-file`}
                                    aria-describedby={`${id}-help`}
                                    onClick={chooseImage}
                                >
                                    <ImagePlus data-icon="inline-start" aria-hidden="true" />
                                    Đổi ảnh
                                </Button>
                            )}
                            {stage && stage !== 'completing' && stage !== 'saving' && (
                                <Button variant="secondary" onClick={cancel}>
                                    Dừng tải ảnh
                                </Button>
                            )}
                            {!stage && file && (
                                <Button
                                    variant={avatar ? 'ghost' : 'outline'}
                                    disabled={disabled}
                                    onClick={() => {
                                        resetSelection();
                                        setError(null);
                                        setNotice(null);
                                    }}
                                >
                                    Bỏ lựa chọn
                                </Button>
                            )}
                            {!file && currentUrl && (
                                <Button
                                    variant="secondary"
                                    disabled={disabled || Boolean(stage)}
                                    aria-busy={Boolean(stage)}
                                    onClick={() => {
                                        void remove();
                                    }}
                                >
                                    {Boolean(stage) && (
                                        <Spinner data-icon="inline-start" aria-hidden="true" />
                                    )}
                                    {avatar ? 'Gỡ ảnh đại diện' : 'Gỡ ảnh bìa'}
                                </Button>
                            )}
                        </div>
                        {currentUrl && !file && (
                            <p
                                className={
                                    avatar
                                        ? 'm-0 text-muted-foreground text-xs leading-relaxed'
                                        : 'field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]'
                                }
                            >
                                Gỡ ảnh chỉ bỏ liên kết, không xóa tệp đã tải.
                            </p>
                        )}
                    </FieldGroup>
                </form>
            </div>
        </section>
    );
}
