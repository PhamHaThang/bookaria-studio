import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Feedback } from '../shared/ui/Feedback';
import '../features/assets/ui/assets.css';

function UsageList({ usages }: { usages: AssetUsage[] }) {
    return (
        <ul className="asset-usages">
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
            className="asset-image-preview"
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
            className="editor-form asset-metadata-form"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <h2>Thông tin tài nguyên</h2>
            <Feedback error={error} success={success} />
            <fieldset disabled={mutation.isPending}>
                <label htmlFor="asset-name">
                    Tên tài nguyên
                    <input
                        id="asset-name"
                        name="name"
                        defaultValue={asset.name}
                        maxLength={150}
                        required
                    />
                </label>
                <label htmlFor="asset-tags">
                    Nhãn
                    <input
                        id="asset-tags"
                        name="tags"
                        defaultValue={asset.tags.join(', ')}
                        aria-describedby="asset-tags-hint"
                    />
                </label>
                <p id="asset-tags-hint" className="field-hint">
                    Phân cách bằng dấu phẩy, tối đa 20 nhãn; mỗi nhãn tối đa 30 ký tự.
                </p>
                <label htmlFor="asset-author">
                    Tác giả
                    <input
                        id="asset-author"
                        name="authorName"
                        defaultValue={asset.authorName || ''}
                        maxLength={150}
                    />
                </label>
                <label htmlFor="asset-license">
                    Giấy phép
                    <input
                        id="asset-license"
                        name="license"
                        defaultValue={asset.license || ''}
                        maxLength={50}
                    />
                </label>
                <label htmlFor="asset-source">
                    Đường dẫn nguồn
                    <input
                        id="asset-source"
                        name="sourceUrl"
                        type="url"
                        defaultValue={asset.sourceUrl || ''}
                    />
                </label>
                <Button type="submit" loading={mutation.isPending}>
                    {mutation.isPending ? 'Đang lưu…' : 'Lưu thông tin tài nguyên'}
                </Button>
            </fieldset>
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
    if (detail.isPending) return <p role="status">Đang tải tài nguyên…</p>;
    if (detail.isError)
        return (
            <>
                <h1>Chưa mở được tài nguyên</h1>
                <Feedback error={errorMessage(detail.error)} />
                <div className="form-actions">
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
            <div className="page-heading">
                <div>
                    <Link className="back-link" to="/assets">
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
                        ? 'asset-detail-layout asset-detail-readonly'
                        : 'asset-detail-layout'
                }
            >
                <section className="asset-preview-section" aria-label="Xem tài nguyên">
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
                        <p className="asset-scope-note">
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
                    <dl className="asset-facts">
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
                        <section className="asset-usage-section">
                            <h2>Nơi đang sử dụng</h2>
                            {usages.isPending ? (
                                <p role="status">Đang kiểm tra nơi sử dụng…</p>
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
                                <p className="asset-scope-note">
                                    Chưa được dùng trong trang sách. Phiên bản đã xuất bản vẫn có
                                    thể giữ tài nguyên này.
                                </p>
                            )}
                            <Button
                                variant="danger"
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
                <ConfirmDialog
                    title="Xóa tài nguyên?"
                    busy={removal.isPending}
                    onClose={() => setConfirming(false)}
                >
                    <p>
                        Bạn muốn xóa “{asset.name}”? Ảnh bìa hoặc ảnh đại diện đang dùng tài nguyên
                        này cũng sẽ được gỡ. Bạn chưa thể khôi phục tài nguyên từ Studio.
                    </p>
                    <Feedback error={deleteError} />
                    {blockedUsages.length > 0 && <UsageList usages={blockedUsages} />}
                    <div className="form-actions">
                        <Button
                            variant="secondary"
                            disabled={removal.isPending}
                            onClick={() => setConfirming(false)}
                        >
                            Giữ lại
                        </Button>
                        <Button variant="danger" loading={removal.isPending} onClick={remove}>
                            Xóa tài nguyên
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </>
    );
}
export function AssetDetailPage() {
    const { assetId = '' } = useParams();
    return <AssetDetailContent key={assetId} assetId={assetId} />;
}
