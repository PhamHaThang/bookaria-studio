import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
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
            className="page-image-form"
            onSubmit={submit}
            aria-label={title}
            aria-busy={Boolean(stage)}
        >
            <h3>{title}</h3>
            <Feedback error={error} success={notice} />
            <fieldset disabled={disabled || Boolean(stage)}>
                <label htmlFor={`${id}-image`}>Ảnh trang</label>
                <input
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
                <p id={`${id}-help`} className="field-hint">
                    JPG hoặc PNG, tối đa 10 MB. Chọn ảnh rõ nét, đủ cả trang.
                </p>
                {preview && (
                    <img className="page-upload-preview" src={preview} alt="Xem trước ảnh trang" />
                )}
                {file && <p className="page-file-name">{file.name}</p>}
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
                        <progress aria-label="Tiến độ chuẩn bị trang" max={100} value={progress} />
                    )}
                </div>
            )}
            {!stage && (ready || checkpoint?.uploaded) && (
                <p className="field-hint">
                    Ảnh đã tải xong. Thử lại sẽ dùng ảnh này, không tải trùng tệp.
                </p>
            )}
            <div className="form-actions">
                <Button type="submit" loading={Boolean(stage)} disabled={disabled || !file}>
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
        </form>
    );
}
