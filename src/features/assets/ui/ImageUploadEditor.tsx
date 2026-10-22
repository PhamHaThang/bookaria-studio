import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { formatBytes } from '../../../shared/lib/format';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { uploadFile } from '../api/upload-file';
import { assetKeys, assetsApi } from '../model/assets';
import { imageUploadRequest, saveUploadedImage } from '../model/image';
import type { UploadCheckpoint, UploadStage } from '../model/upload';
import './image-upload.css';

type Stage = UploadStage | 'saving';
const stages: Record<Stage, string> = {
    signing: 'Đang chuẩn bị tải ảnh…',
    uploading: 'Đang tải ảnh…',
    completing: 'Đang xác nhận ảnh…',
    saving: 'Đang lưu thay đổi…',
};

export function ImageUploadEditor({
    kind,
    currentUrl,
    disabled = false,
    onSave,
    onBusyChange,
    onUploaded,
}: {
    kind: 'avatar' | 'cover';
    currentUrl: string | null;
    disabled?: boolean;
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
    return (
        <section className="editor-form image-editor" aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`}>{title}</h2>
            <p className="section-description">
                {avatar
                    ? 'Ảnh hiển thị trên hồ sơ và góc tài khoản.'
                    : 'Ảnh giúp nhận diện sách trong danh sách của bạn.'}
            </p>
            <Feedback error={error} success={notice} />
            <div className="image-editor-layout">
                <div
                    className={`image-editor-preview ${avatar ? 'avatar-preview' : 'cover-preview'}`}
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
                            <span>Chưa có ảnh</span>
                        </>
                    )}
                </div>
                <form
                    onSubmit={submit}
                    aria-label={`Cập nhật ${title.toLowerCase()}`}
                    aria-busy={Boolean(stage)}
                >
                    <label htmlFor={`${id}-file`}>Chọn {title.toLowerCase()}</label>
                    <input
                        id={`${id}-file`}
                        ref={input}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        disabled={disabled || Boolean(stage)}
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
                    <p id={`${id}-help`} className="field-hint">
                        JPG, PNG hoặc WebP. Tối đa {avatar ? '2' : '10'} MB.
                    </p>
                    {file && (
                        <p className="image-file-name">
                            {file.name} · {formatBytes(file.size)}
                        </p>
                    )}
                    {stage && (
                        <div className="image-upload-progress">
                            <p role="status">
                                {stages[stage]}
                                {stage === 'uploading' ? ` ${progress}%` : ''}
                            </p>
                            {stage === 'uploading' && (
                                <progress aria-label="Tiến độ tải ảnh" value={progress} max={100} />
                            )}
                        </div>
                    )}
                    {!stage && readyAsset && (
                        <p className="field-hint">
                            Ảnh đã tải xong. Bấm Thử lưu lại để cập nhật, không cần tải ảnh lần nữa.
                        </p>
                    )}
                    {!stage && !readyAsset && checkpoint?.uploaded && (
                        <p className="field-hint">
                            Ảnh đã tải xong, đang chờ xác nhận. Bạn có thể thử lại.
                        </p>
                    )}
                    <div className="form-actions">
                        {file && (
                            <Button type="submit" disabled={disabled} loading={Boolean(stage)}>
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
                        {stage && stage !== 'completing' && stage !== 'saving' && (
                            <Button variant="secondary" onClick={cancel}>
                                Dừng tải ảnh
                            </Button>
                        )}
                        {!stage && file && (
                            <Button
                                variant="ghost"
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
                                disabled={disabled}
                                loading={Boolean(stage)}
                                onClick={() => {
                                    void remove();
                                }}
                            >
                                {avatar ? 'Gỡ ảnh đại diện' : 'Gỡ ảnh bìa'}
                            </Button>
                        )}
                    </div>
                    {currentUrl && (
                        <p className="field-hint">Gỡ ảnh chỉ bỏ liên kết, không xóa tệp đã tải.</p>
                    )}
                </form>
            </div>
        </section>
    );
}
