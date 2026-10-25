import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import {
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
    updateAssetForm,
} from '../features/assets';
import { assetInUse } from '../features/assets/model/errors';
import { useAuth } from '../features/auth';
import { bookKeys } from '../features/books';
import { profileKey } from '../features/profile';
import { errorMessage } from '../shared/api/errors';
import type { AssetUsage } from '../shared/contracts/asset.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset } from '../shared/contracts/dto.schema';
import { formatBytes, formatDate } from '../shared/lib/format';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';

function UsageList({ usages }: { usages: AssetUsage[] }) {
    return (
        <ul className="asset-usages wrap-anywhere mb-6 pl-5 [&_li]:py-2">
            {usages.map((usage) => (
                <li key={`${usage.bookId}-${usage.pageId}`}>
                    <Link to={`/books/${usage.bookId}`}>
                        {usage.bookTitle} · Trang {usage.pageNumber}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
function ImagePreview({ asset }: { asset: Asset }) {
    const [failed, setFailed] = useState(false);
    return failed ? (
        <Alert tone="warning">
            Chưa hiển thị được ảnh. Bạn có thể mở tệp bằng liên kết bên dưới hoặc tải lại trang.
        </Alert>
    ) : (
        <img
            className="asset-image-preview mx-auto mt-0 mb-5 block max-h-105 max-w-full object-contain"
            src={asset.url}
            alt={asset.name}
            onError={() => setFailed(true)}
        />
    );
}
function AssetMetadataForm({ asset, onSaved }: { asset: Asset; onSaved: () => Promise<void> }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const mutation = useMutation({
        mutationFn: (form: FormData) => assetsApi.update(asset.id, updateAssetForm(form)),
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending) return;
        setError(null);
        setSuccess(null);
        try {
            await mutation.mutateAsync(new FormData(event.currentTarget));
            await onSaved();
            setSuccess('Đã lưu thông tin tài nguyên.');
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <form
            className="editor-form asset-metadata-form w-full max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-6 p-8 max-[1100px]:max-w-180 max-[540px]:p-5 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <FieldGroup className="contents">
                <h2>Thông tin tài nguyên</h2>
                <Feedback error={error} success={success} />
                <fieldset disabled={mutation.isPending}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-name">
                            Tên tài nguyên
                            <Input
                                id="asset-name"
                                name="name"
                                defaultValue={asset.name}
                                maxLength={150}
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-tags">
                            Nhãn
                            <Input
                                id="asset-tags"
                                name="tags"
                                defaultValue={asset.tags.join(', ')}
                                aria-describedby="asset-tags-hint"
                            />
                        </FieldLabel>
                    </Field>
                    <p
                        id="asset-tags-hint"
                        className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                    >
                        Phân cách bằng dấu phẩy, tối đa 20 nhãn; mỗi nhãn tối đa 30 ký tự.
                    </p>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-author">
                            Tác giả
                            <Input
                                id="asset-author"
                                name="authorName"
                                defaultValue={asset.authorName || ''}
                                maxLength={150}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-license">
                            Giấy phép
                            <Input
                                id="asset-license"
                                name="license"
                                defaultValue={asset.license || ''}
                                maxLength={50}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-source">
                            Đường dẫn nguồn
                            <Input
                                id="asset-source"
                                name="sourceUrl"
                                type="url"
                                defaultValue={asset.sourceUrl || ''}
                            />
                        </FieldLabel>
                    </Field>
                    <Button
                        type="submit"
                        aria-busy={mutation.isPending}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending && (
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                        )}
                        {mutation.isPending ? 'Đang lưu…' : 'Lưu thông tin tài nguyên'}
                    </Button>
                </fieldset>
            </FieldGroup>
        </form>
    );
}
function AssetDetailContent({ assetId }: { assetId: string }) {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const cache = useQueryClient();
    const valid = IdSchema.safeParse(assetId).success;
    const [confirming, setConfirming] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [blockedUsages, setBlockedUsages] = useState<AssetUsage[]>([]);
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId),
        queryFn: ({ signal }) => assetsApi.detail(assetId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
        refetchInterval: (query) =>
            !query.state.error && query.state.data?.status === 'PROCESSING' ? 3000 : false,
    });
    const usages = useQuery({
        queryKey: assetKeys.usages(user?.id || '', assetId),
        queryFn: ({ signal }) => assetsApi.usages(assetId, signal),
        enabled: detail.data?.scope === 'mine',
    });
    const removal = useMutation({ mutationFn: () => assetsApi.remove(assetId) });
    async function remove() {
        if (removal.isPending) return;
        setDeleteError(null);
        setBlockedUsages([]);
        try {
            await removal.mutateAsync();
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            void cache.invalidateQueries({ queryKey: bookKeys.all });
            void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
            navigate('/assets', { replace: true });
        } catch (cause) {
            setDeleteError(errorMessage(cause));
            setBlockedUsages(assetInUse(cause));
        }
    }
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy tài nguyên</h1>
                <p>Đường dẫn tài nguyên không hợp lệ.</p>
                <Link to="/assets">Về tài nguyên</Link>
            </>
        );
    if (detail.isPending) return <LoadingState layout="detail">Đang tải tài nguyên…</LoadingState>;
    if (detail.isError)
        return (
            <>
                <h1>Chưa mở được tài nguyên</h1>
                <Feedback error={errorMessage(detail.error)} />
                <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                    <Button
                        onClick={() => {
                            void detail.refetch();
                        }}
                    >
                        Thử lại
                    </Button>
                    <Link to="/assets">Về tài nguyên</Link>
                </div>
            </>
        );
    const asset = detail.data;
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
                    <h1>{asset.name}</h1>
                    <p>
                        {assetTypeLabels[asset.type]} · {formatBytes(asset.sizeBytes)} ·{' '}
                        {asset.scope === 'mine' ? 'Của tôi' : 'Thư viện chung'}
                    </p>
                </div>
                <Badge
                    tone={
                        asset.status === 'READY'
                            ? 'success'
                            : asset.status === 'FAILED'
                              ? 'danger'
                              : 'warning'
                    }
                >
                    {assetStatusLabels[asset.status]}
                </Badge>
            </div>
            {user?.role === 'ADMIN' && asset.scope === 'mine' && asset.status === 'READY' && (
                <p>
                    <Button variant="secondary" asChild>
                        <Link to={`/admin/library/new?asset=${asset.id}`}>
                            Đưa vào thư viện dùng chung
                        </Link>
                    </Button>
                </p>
            )}
            {location.state?.uploaded && (
                <Alert tone="success">
                    Đã nhận tài nguyên.{' '}
                    {asset.status === 'PROCESSING'
                        ? 'Tệp đang được xử lý; trạng thái sẽ tự cập nhật.'
                        : 'Bạn có thể xem thông tin bên dưới.'}
                </Alert>
            )}
            {asset.status === 'PROCESSING' && (
                <Alert tone="info">
                    Tệp đang được xử lý. Bạn có thể quay lại sau; tài nguyên sẽ sẵn sàng khi xử lý
                    hoàn tất.
                </Alert>
            )}
            {asset.status === 'FAILED' && (
                <Alert tone="danger">
                    {asset.error || 'Không xử lý được tệp. Hãy kiểm tra tệp gốc và tải lại.'}
                </Alert>
            )}
            <div
                className={
                    asset.scope === 'library'
                        ? 'asset-detail-layout asset-detail-readonly grid grid-cols-[minmax(0,_1fr)_minmax(280px,_420px)] grid-cols-[minmax(0,_720px)] items-start gap-8 max-[1100px]:grid-cols-[minmax(0,_1fr)]'
                        : 'asset-detail-layout grid grid-cols-[minmax(0,_1fr)_minmax(280px,_420px)] items-start gap-8 max-[1100px]:grid-cols-[minmax(0,_1fr)]'
                }
            >
                <section
                    className="asset-preview-section min-w-0 max-[1100px]:max-w-180 [&_audio]:mb-5 [&_audio]:max-h-105 [&_audio]:w-full [&_audio]:min-w-0 [&_audio]:max-w-full [&_video]:mb-5 [&_video]:max-h-105 [&_video]:w-full [&_video]:min-w-0 [&_video]:max-w-full"
                    aria-label="Xem tài nguyên"
                >
                    {asset.status === 'READY' && asset.type === 'IMAGE' && (
                        <ImagePreview key={asset.url} asset={asset} />
                    )}
                    {asset.status === 'READY' && asset.type === 'AUDIO' && (
                        // biome-ignore lint/a11y/useMediaCaption: Uploaded assets have no caption track in the current backend contract.
                        <audio
                            controls
                            preload="metadata"
                            src={asset.url}
                            aria-label={`Nghe ${asset.name}`}
                        />
                    )}
                    {asset.status === 'READY' && asset.type === 'VIDEO' && (
                        // biome-ignore lint/a11y/useMediaCaption: Uploaded assets have no caption track in the current backend contract.
                        <video
                            controls
                            preload="metadata"
                            src={asset.url}
                            poster={asset.thumbnailUrl || undefined}
                            aria-label={`Xem ${asset.name}`}
                        />
                    )}
                    {asset.type === 'MODEL' && (
                        <p className="asset-scope-note mx-0 mt-0 mb-6 max-w-[70ch] text-muted-foreground">
                            Mô hình chưa có bản xem trước tại đây. Bạn có thể mở tệp bằng liên kết
                            bên dưới.
                        </p>
                    )}
                    {asset.status === 'READY' && (
                        <p>
                            <a href={asset.url} target="_blank" rel="noreferrer">
                                Mở tệp ở tab mới
                            </a>
                        </p>
                    )}
                    <dl className="asset-facts [&_dd]:wrap-anywhere mx-0 my-6 [&_>_div]:grid [&_>_div]:grid-cols-[130px_minmax(0,_1fr)] [&_>_div]:gap-4 [&_>_div]:border-b-[1px] [&_>_div]:border-b-border [&_>_div]:px-0 [&_>_div]:py-3 [&_>_div]:text-[length:var(--text-sm)] [&_>_div]:[border-bottom-style:solid] max-[540px]:[&_>_div]:grid-cols-[minmax(0,_1fr)] max-[540px]:[&_>_div]:gap-1 [&_dd]:m-0 [&_dd]:tabular-nums [&_dt]:text-muted-foreground">
                        <div>
                            <dt>Định dạng</dt>
                            <dd>{asset.format.toUpperCase()}</dd>
                        </div>
                        <div>
                            <dt>Ngày tải</dt>
                            <dd>{formatDate(asset.createdAt)}</dd>
                        </div>
                        {asset.meta.width && asset.meta.height && (
                            <div>
                                <dt>Kích thước</dt>
                                <dd>
                                    {asset.meta.width} × {asset.meta.height} px
                                </dd>
                            </div>
                        )}
                        {asset.meta.durationSec !== undefined && (
                            <div>
                                <dt>Thời lượng</dt>
                                <dd>
                                    {new Intl.NumberFormat('vi-VN', {
                                        maximumFractionDigits: 1,
                                    }).format(asset.meta.durationSec)}{' '}
                                    giây
                                </dd>
                            </div>
                        )}
                        {asset.meta.triangles !== undefined && (
                            <div>
                                <dt>Số tam giác</dt>
                                <dd>{asset.meta.triangles.toLocaleString('vi-VN')}</dd>
                            </div>
                        )}
                        {asset.meta.animations?.length ? (
                            <div>
                                <dt>Hoạt ảnh</dt>
                                <dd>{asset.meta.animations.join(', ')}</dd>
                            </div>
                        ) : null}
                        {asset.scope === 'library' && (
                            <>
                                <div>
                                    <dt>Tác giả</dt>
                                    <dd>{asset.authorName || 'Chưa cung cấp'}</dd>
                                </div>
                                <div>
                                    <dt>Giấy phép</dt>
                                    <dd>{asset.license || 'Chưa cung cấp'}</dd>
                                </div>
                                <div>
                                    <dt>Nguồn</dt>
                                    <dd>
                                        {asset.sourceUrl ? (
                                            <a
                                                href={asset.sourceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Xem nguồn tài nguyên
                                            </a>
                                        ) : (
                                            'Chưa cung cấp'
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Nhãn</dt>
                                    <dd>{asset.tags.join(', ') || 'Chưa có'}</dd>
                                </div>
                            </>
                        )}
                    </dl>
                    {asset.meta.warnings?.map((warning) => (
                        <Alert key={warning} tone="warning">
                            {warning}
                        </Alert>
                    ))}
                    {asset.scope === 'mine' && (
                        <section className="asset-usage-section mt-8">
                            <h2>Nơi đang sử dụng</h2>
                            {usages.isPending ? (
                                <LoadingState layout="detail">
                                    Đang kiểm tra nơi sử dụng…
                                </LoadingState>
                            ) : usages.isError ? (
                                <>
                                    <Feedback error={errorMessage(usages.error)} />
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            void usages.refetch();
                                        }}
                                    >
                                        Thử kiểm tra lại
                                    </Button>
                                </>
                            ) : usages.data.length ? (
                                <UsageList usages={usages.data} />
                            ) : (
                                <p className="asset-scope-note mx-0 mt-0 mb-6 max-w-[70ch] text-muted-foreground">
                                    Chưa được dùng trong trang sách. Phiên bản đã xuất bản vẫn có
                                    thể giữ tài nguyên này.
                                </p>
                            )}
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    setDeleteError(null);
                                    setBlockedUsages([]);
                                    setConfirming(true);
                                }}
                            >
                                Xóa tài nguyên
                            </Button>
                        </section>
                    )}
                </section>
                {asset.scope === 'mine' && (
                    <AssetMetadataForm
                        key={asset.id}
                        asset={asset}
                        onSaved={() => cache.invalidateQueries({ queryKey: assetKeys.all })}
                    />
                )}
            </div>
            {confirming && (
                <ConfirmationDialog
                    description={
                        <>
                            Bạn muốn xóa “{asset.name}”? Ảnh bìa hoặc ảnh đại diện đang dùng tài
                            nguyên này cũng sẽ được gỡ. Bạn chưa thể khôi phục tài nguyên từ Studio.
                        </>
                    }
                    title="Xóa tài nguyên?"
                    busy={removal.isPending}
                    onClose={() => setConfirming(false)}
                >
                    <Feedback error={deleteError} />
                    {blockedUsages.length > 0 && <UsageList usages={blockedUsages} />}
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant="secondary"
                                disabled={removal.isPending}
                                onClick={() => setConfirming(false)}
                            >
                                Giữ lại
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="destructive"
                                aria-busy={removal.isPending}
                                onClick={remove}
                                disabled={removal.isPending}
                            >
                                {removal.isPending && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}
                                Xóa tài nguyên
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
export function AssetDetailPage() {
    const { assetId = '' } = useParams();
    return <AssetDetailContent key={assetId} assetId={assetId} />;
}
