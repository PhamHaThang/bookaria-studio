import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
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
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <Link
                        className="back-link mb-4 inline-block text-[length:var(--text-sm)] [.studio-editing_&]:inline [.studio-editing_&]:text-[length:12px]"
                        to="/assets"
                    >
                        Tài nguyên
                    </Link>
                    <h1>Tải tài nguyên</h1>
                    <p>Thêm một tệp vào tài nguyên cá nhân của bạn.</p>
                </div>
            </div>
            <form
                className="editor-form asset-upload-form max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6 [&_>_fieldset_>_label:first-child]:mb-2 [&_input[type=file]::file-selector-button]:mr-3 [&_input[type=file]::file-selector-button]:cursor-pointer [&_input[type=file]::file-selector-button]:rounded-[var(--radius-sm)] [&_input[type=file]::file-selector-button]:border-0 [&_input[type=file]::file-selector-button]:border-[transparent] [&_input[type=file]::file-selector-button]:border-solid [&_input[type=file]::file-selector-button]:bg-secondary [&_input[type=file]::file-selector-button]:px-3 [&_input[type=file]::file-selector-button]:py-2 [&_input[type=file]::file-selector-button]:text-primary [&_input[type=file]::file-selector-button]:[font:inherit] [&_input[type=file]]:overflow-hidden [&_input[type=file]]:p-3"
                onSubmit={submit}
                aria-busy={Boolean(stage)}
            >
                <FieldGroup className="contents">
                    <Feedback error={error} success={notice} />
                    <fieldset disabled={Boolean(stage) || Boolean(checkpoint?.uploaded)}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="asset-file">Tệp tài nguyên</FieldLabel>
                        </Field>
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
                        <p
                            id="asset-file-help"
                            className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                        >
                            GLB/GLTF, JPG/PNG/WebP: tối đa 10 MB. MP3/WAV, MP4: tối đa 100 MB. Mỗi
                            lần tải một tệp.
                        </p>
                        {file && (
                            <p className="asset-file-summary wrap-anywhere mb-6 text-[length:var(--text-sm)] text-muted-foreground">
                                {file.name} · {formatBytes(file.size)}
                            </p>
                        )}
                        <Field orientation="contents">
                            <FieldLabel htmlFor="upload-name">
                                Tên tài nguyên
                                <Input
                                    id="upload-name"
                                    name="name"
                                    maxLength={150}
                                    placeholder="Để trống để dùng tên tệp"
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="upload-tags">
                                Nhãn
                                <Input
                                    id="upload-tags"
                                    name="tags"
                                    aria-describedby="upload-tags-hint"
                                    placeholder="động vật, tự nhiên"
                                />
                            </FieldLabel>
                        </Field>
                        <p
                            id="upload-tags-hint"
                            className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                        >
                            Phân cách bằng dấu phẩy, tối đa 20 nhãn; mỗi nhãn tối đa 30 ký tự.
                        </p>
                    </fieldset>
                    {stage && (
                        <div className="asset-upload-progress mt-6 [&_p]:mb-2 [&_progress]:h-2 [&_progress]:w-full">
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
                        <p className="asset-scope-note mx-0 mt-0 mb-6 max-w-[70ch] text-muted-foreground">
                            Tệp đã tải xong. Bấm Thử xác nhận lại để hoàn tất; tệp sẽ không bị tải
                            lên lần nữa.
                        </p>
                    )}
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <Button type="submit" aria-busy={Boolean(stage)} disabled={Boolean(stage)}>
                            {Boolean(stage) && (
                                <Spinner data-icon="inline-start" aria-hidden="true" />
                            )}
                            {!stage && <Upload data-icon="inline-start" aria-hidden="true" />}
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
                </FieldGroup>
            </form>
        </>
    );
}
