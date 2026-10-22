import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assetKeys, assetsApi, completeAssetForm, uploadRequest } from '../features/assets';
import { uploadFile } from '../features/assets/api/upload-file';
import {
    runAssetUpload,
    type UploadCheckpoint,
    type UploadStage,
} from '../features/assets/model/upload';
import { useAuth } from '../features/auth';
import { profileKey } from '../features/profile';
import { errorMessage } from '../shared/api/errors';
import type { CompleteAssetBody } from '../shared/contracts/api/assets.schema';
import { formatBytes } from '../shared/lib/format';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import '../features/assets/ui/assets.css';

const stageLabels = {
    signing: 'Đang chuẩn bị tải tệp…',
    uploading: 'Đang tải tệp…',
    completing: 'Đang xác nhận tài nguyên…',
};
export function AssetUploadPage() {
    const navigate = useNavigate();
    const cache = useQueryClient();
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [checkpoint, setCheckpoint] = useState<UploadCheckpoint | null>(null);
    const [stage, setStage] = useState<UploadStage | null>(null);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    const pendingMetadata = useRef<CompleteAssetBody | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (controller.current) return;
        setError(null);
        setNotice(null);
        if (!file) {
            setError('Hãy chọn một tệp để tải lên.');
            return;
        }
        const form = new FormData(event.currentTarget);
        const active = new AbortController();
        controller.current = active;
        try {
            const metadata =
                checkpoint?.uploaded && pendingMetadata.current
                    ? pendingMetadata.current
                    : completeAssetForm(form);
            pendingMetadata.current = metadata;
            const result = await runAssetUpload({
                api: assetsApi,
                transfer: uploadFile,
                file,
                metadata,
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
            if (active.signal.aborted) return;
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
            navigate(`/assets/${result.asset.id}`, { replace: true, state: { uploaded: true } });
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (!active.signal.aborted) {
                setStage(null);
                controller.current = null;
            }
        }
    }
    function cancel() {
        controller.current?.abort();
        controller.current = null;
        setStage(null);
        setProgress(0);
        setCheckpoint(null);
        setError(null);
        pendingMetadata.current = null;
        setNotice('Đã dừng tải tệp. Bạn có thể chọn tệp khác hoặc thử lại.');
    }
    return (
        <>
            <div className="page-heading">
                <div>
                    <Link className="back-link" to="/assets">
                        Tài nguyên
                    </Link>
                    <h1>Tải tài nguyên</h1>
                    <p>Thêm một tệp vào tài nguyên cá nhân của bạn.</p>
                </div>
            </div>
            <form
                className="editor-form asset-upload-form"
                onSubmit={submit}
                aria-busy={Boolean(stage)}
            >
                <Feedback error={error} success={notice} />
                <fieldset disabled={Boolean(stage) || Boolean(checkpoint?.uploaded)}>
                    <label htmlFor="asset-file">Tệp tài nguyên</label>
                    <input
                        id="asset-file"
                        name="file"
                        type="file"
                        accept=".glb,.gltf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.mp4"
                        aria-describedby="asset-file-help"
                        onChange={(event) => {
                            setCheckpoint(null);
                            setProgress(0);
                            setError(null);
                            setNotice(null);
                            pendingMetadata.current = null;
                            const selected = event.currentTarget.files?.[0] || null;
                            try {
                                if (selected) uploadRequest(selected);
                                setFile(selected);
                            } catch (cause) {
                                setFile(null);
                                setError(errorMessage(cause));
                            }
                        }}
                    />
                    <p id="asset-file-help" className="field-hint">
                        GLB/GLTF, JPG/PNG/WebP: tối đa 10 MB. MP3/WAV, MP4: tối đa 100 MB. Mỗi lần
                        tải một tệp.
                    </p>
                    {file && (
                        <p className="asset-file-summary">
                            {file.name} · {formatBytes(file.size)}
                        </p>
                    )}
                    <label htmlFor="upload-name">
                        Tên tài nguyên
                        <input
                            id="upload-name"
                            name="name"
                            maxLength={150}
                            placeholder="Để trống để dùng tên tệp"
                        />
                    </label>
                    <label htmlFor="upload-tags">
                        Nhãn
                        <input
                            id="upload-tags"
                            name="tags"
                            aria-describedby="upload-tags-hint"
                            placeholder="động vật, tự nhiên"
                        />
                    </label>
                    <p id="upload-tags-hint" className="field-hint">
                        Phân cách bằng dấu phẩy, tối đa 20 nhãn; mỗi nhãn tối đa 30 ký tự.
                    </p>
                </fieldset>
                {stage && (
                    <div className="asset-upload-progress">
                        <p role="status">
                            {stageLabels[stage]}
                            {stage === 'uploading' ? ` ${progress}%` : ''}
                        </p>
                        {stage === 'uploading' && (
                            <progress value={progress} max={100} aria-label="Tiến độ tải tệp" />
                        )}
                    </div>
                )}
                {!stage && checkpoint?.uploaded && (
                    <p className="asset-scope-note">
                        Tệp đã tải xong. Bấm Thử xác nhận lại để hoàn tất; tệp sẽ không bị tải lên
                        lần nữa.
                    </p>
                )}
                <div className="form-actions">
                    <Button type="submit" loading={Boolean(stage)}>
                        {!stage && <Upload size={18} aria-hidden="true" />}
                        {stage
                            ? 'Đang xử lý…'
                            : checkpoint?.uploaded
                              ? 'Thử xác nhận lại'
                              : error && file
                                ? 'Thử tải lại'
                                : 'Tải lên'}
                    </Button>
                    {stage && stage !== 'completing' && (
                        <Button variant="secondary" onClick={cancel}>
                            Dừng tải
                        </Button>
                    )}
                    {!stage && <Link to="/assets">Về tài nguyên</Link>}
                </div>
            </form>
        </>
    );
}
