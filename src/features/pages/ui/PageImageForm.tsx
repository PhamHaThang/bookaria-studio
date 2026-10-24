import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { ContractError } from '../../../shared/api/contract';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { uploadRequest } from '../../assets/model/form';
import { runAssetUpload, type UploadCheckpoint } from '../../assets/model/upload';

export type PageImageStage =
    | 'signing'
    | 'uploading'
    | 'completing'
    | 'compiling'
    | 'uploading-marker'
    | 'saving';
export interface ImageAttachmentContext {
    signal: AbortSignal;
    onStage: (stage: PageImageStage) => void;
    onProgress: (value: number) => void;
}
const labels: Record<PageImageStage, string> = {
    signing: 'Đang chuẩn bị tải ảnh…',
    uploading: 'Đang tải ảnh trang…',
    completing: 'Đang xác nhận ảnh…',
    compiling: 'Đang chuẩn bị nhận diện ảnh…',
    'uploading-marker': 'Đang tải dữ liệu nhận diện…',
    saving: 'Đang lưu trang…',
};
export function PageImageForm({
    title,
    action,
    children,
    disabled = false,
    onBusyChange,
    onAttach,
    onUploaded,
}: {
    title: string;
    action: string;
    children?: ReactNode;
    disabled?: boolean;
    onBusyChange: (busy: boolean) => void;
    onUploaded: () => void;
    onAttach: (asset: Asset, form: FormData, context: ImageAttachmentContext) => Promise<void>;
}) {
    const id = useId(),
        input = useRef<HTMLInputElement>(null);
    const controller = useRef<AbortController | null>(null);
    const [file, setFile] = useState<File | null>(null),
        [preview, setPreview] = useState<string | null>(null);
    const [checkpoint, setCheckpoint] = useState<UploadCheckpoint | null>(null),
        [ready, setReady] = useState<Asset | null>(null);
    const [stage, setStage] = useState<PageImageStage | null>(null),
        [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null);
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
    function clear() {
        setFile(null);
        setReady(null);
        setCheckpoint(null);
        setProgress(0);
        if (input.current) input.current.value = '';
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file || disabled || controller.current) return;
        const form = new FormData(event.currentTarget);
        const active = new AbortController();
        controller.current = active;
        onBusyChange(true);
        setError(null);
        setNotice(null);
        try {
            let asset = ready;
            if (!asset) {
                const result = await runAssetUpload({
                    api: assetsApi,
                    transfer: uploadFile,
                    file,
                    metadata: { tags: [] },
                    purpose: 'PAGE_IMAGE',
                    signal: active.signal,
                    checkpoint,
                    onCheckpoint: (value) => {
                        if (!active.signal.aborted) setCheckpoint(value);
                    },
                    onStage: (value) => {
                        if (!active.signal.aborted) setStage(value);
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
                asset = result.asset;
                setReady(asset);
                onUploaded();
            }
            active.signal.throwIfAborted();
            setStage('saving');
            await onAttach(asset, form, {
                signal: active.signal,
                onStage: setStage,
                onProgress: setProgress,
            });
            if (!active.signal.aborted) {
                clear();
                setNotice('Đã lưu ảnh trang.');
            }
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
    return (
        <form
            className="page-image-form grid min-w-0 gap-4 [&_fieldset]:m-0 [&_fieldset]:grid [&_fieldset]:min-w-0 [&_fieldset]:gap-3 [&_fieldset]:border-0 [&_fieldset]:border-[transparent] [&_fieldset]:border-solid [&_fieldset]:p-0 [&_h3]:m-0 [&_input]:w-full [&_input]:min-w-0 [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_select]:w-full [&_select]:min-w-0 [.book-pages_>_&]:mt-5 [.book-pages_>_&]:rounded-[var(--radius-md)] [.book-pages_>_&]:border [.book-pages_>_&]:border-border [.book-pages_>_&]:border-solid [.book-pages_>_&]:bg-surface [.book-pages_>_&]:p-5"
            onSubmit={submit}
            aria-label={title}
            aria-busy={Boolean(stage)}
        >
            <FieldGroup className="contents">
                <h3>{title}</h3>
                <Feedback error={error} success={notice} />
                <fieldset disabled={disabled || Boolean(stage)}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor={`${id}-image`}>Ảnh trang</FieldLabel>
                    </Field>
                    <Input
                        id={`${id}-image`}
                        name="image"
                        type="file"
                        ref={input}
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        aria-describedby={`${id}-help`}
                        onChange={(event) => {
                            const value = event.currentTarget.files?.[0] || null;
                            setReady(null);
                            setCheckpoint(null);
                            setProgress(0);
                            setError(null);
                            setNotice(null);
                            try {
                                if (value) uploadRequest(value, 'PAGE_IMAGE');
                                setFile(value);
                            } catch (cause) {
                                setFile(null);
                                setError(errorMessage(cause));
                            }
                        }}
                    />
                    <p
                        id={`${id}-help`}
                        className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                    >
                        JPG hoặc PNG, tối đa 10 MB. Chọn ảnh rõ nét, đủ cả trang.
                    </p>
                    {preview && (
                        <img
                            className="page-upload-preview max-h-60 max-w-full object-contain [justify-self:start]"
                            src={preview}
                            alt="Xem trước ảnh trang"
                        />
                    )}
                    {file && <p className="page-file-name wrap-anywhere m-0">{file.name}</p>}
                    {children}
                </fieldset>
                {stage && (
                    <div>
                        <p role="status">
                            {labels[stage]}
                            {['uploading', 'compiling', 'uploading-marker'].includes(stage)
                                ? ` ${progress}%`
                                : ''}
                        </p>
                        {['uploading', 'compiling', 'uploading-marker'].includes(stage) && (
                            <Progress
                                aria-label="Tiến độ chuẩn bị trang"
                                max={100}
                                value={progress}
                            />
                        )}
                    </div>
                )}
                {!stage && (ready || checkpoint?.uploaded) && (
                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                        Ảnh đã tải xong. Thử lại sẽ dùng ảnh này, không tải trùng tệp.
                    </p>
                )}
                <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                    <Button
                        type="submit"
                        aria-busy={Boolean(stage)}
                        disabled={disabled || !file || Boolean(stage)}
                    >
                        {Boolean(stage) && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        {stage ? 'Đang xử lý…' : error && file ? 'Thử lại' : action}
                    </Button>
                    {!stage && file && (
                        <Button
                            variant="ghost"
                            disabled={disabled}
                            onClick={() => {
                                clear();
                                setError(null);
                                setNotice(null);
                            }}
                        >
                            Bỏ lựa chọn
                        </Button>
                    )}
                    {stage && stage !== 'saving' && stage !== 'completing' && (
                        <Button
                            variant="secondary"
                            onClick={() => {
                                controller.current?.abort();
                                controller.current = null;
                                setStage(null);
                                onBusyChange(false);
                                setError(null);
                                setNotice('Đã dừng chuẩn bị trang.');
                            }}
                        >
                            Dừng
                        </Button>
                    )}
                </div>
            </FieldGroup>
        </form>
    );
}
