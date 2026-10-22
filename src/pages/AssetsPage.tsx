import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
    readAssetSearch,
    updateAssetSearch,
} from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { ListAssetsQuery } from '../shared/contracts/api/assets.schema';
import type { AssetCategory } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Badge } from '../shared/ui/Badge';
import { Button, buttonStyles } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import '../features/assets/ui/assets.css';

function AssetFilters({
    query,
    categories,
    change,
    filtered,
}: {
    query: ListAssetsQuery;
    categories?: AssetCategory[];
    change: (changes: Record<string, string | undefined>) => void;
    filtered: boolean;
}) {
    const [categoryId, setCategoryId] = useState(query.categoryId || '');
    return (
        <form
            className="asset-filters"
            onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                change({
                    q: String(form.get('q') || '').trim(),
                    type: String(form.get('type') || ''),
                    categoryId: String(form.get('categoryId') || ''),
                    tag: String(form.get('tag') || '').trim(),
                    hasAnimation: form.get('hasAnimation') === 'on' ? 'true' : undefined,
                });
            }}
        >
            <label className="asset-search-label" htmlFor="asset-search">
                Tìm tài nguyên
                <span className="search-field">
                    <Search size={18} aria-hidden="true" />
                    <input
                        id="asset-search"
                        name="q"
                        type="search"
                        defaultValue={query.q || ''}
                        maxLength={100}
                        placeholder="Tìm theo tên tài nguyên"
                    />
                </span>
            </label>
            <div>
                <label htmlFor="asset-type">Loại tài nguyên</label>
                <select id="asset-type" name="type" defaultValue={query.type || ''}>
                    <option value="">Tất cả loại</option>
                    {Object.entries(assetTypeLabels).map(([value, label]) => (
                        <option value={value} key={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="asset-category">Danh mục</label>
                <select
                    id="asset-category"
                    name="categoryId"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                >
                    <option value="">Tất cả danh mục</option>
                    {categoryId && !categories?.some((category) => category.id === categoryId) && (
                        <option value={categoryId}>Danh mục đang chọn</option>
                    )}
                    {categories?.map((category) => (
                        <option value={category.id} key={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </div>
            <label htmlFor="asset-tag">
                Nhãn
                <input
                    id="asset-tag"
                    name="tag"
                    defaultValue={query.tag || ''}
                    maxLength={30}
                    placeholder="Ví dụ: động vật"
                />
            </label>
            <div className="asset-filter-actions">
                <label className="checkbox">
                    <input
                        type="checkbox"
                        name="hasAnimation"
                        defaultChecked={query.hasAnimation === true}
                    />
                    Có hoạt ảnh
                </label>
                <Button type="submit">Tìm tài nguyên</Button>
                {filtered && (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            change({
                                q: undefined,
                                type: undefined,
                                categoryId: undefined,
                                tag: undefined,
                                hasAnimation: undefined,
                            })
                        }
                    >
                        Xóa bộ lọc
                    </Button>
                )}
            </div>
        </form>
    );
}

export function AssetsPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readAssetSearch(params);
    const listing = useQuery({
        queryKey: assetKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => assetsApi.list(query, signal),
        enabled: Boolean(user),
        refetchInterval: (state) =>
            !state.state.error &&
            state.state.data?.data.some((asset) => asset.status === 'PROCESSING')
                ? 3000
                : false,
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: Boolean(user),
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (!listing.isFetching && meta && query.page > Math.max(1, meta.totalPages)) {
            setParams(
                (current) =>
                    updateAssetSearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
        }
    }, [listing.isFetching, meta, query.page, setParams]);
    function change(changes: Record<string, string | undefined>) {
        setParams((current) => updateAssetSearch(current, changes));
    }
    const filtered = Boolean(
        query.q || query.tag || query.type || query.categoryId || query.hasAnimation !== undefined,
    );
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Tài nguyên</h1>
                    <p>Quản lý hình ảnh, mô hình 3D, âm thanh và video của bạn.</p>
                </div>
                <Link to="/assets/upload" className={buttonStyles()}>
                    <Plus size={18} aria-hidden="true" />
                    Tải tài nguyên
                </Link>
            </div>
            <fieldset className="status-tabs" aria-label="Nguồn tài nguyên">
                <button
                    type="button"
                    className={query.scope === 'mine' ? 'selected' : ''}
                    aria-pressed={query.scope === 'mine'}
                    onClick={() => change({ scope: undefined })}
                >
                    Của tôi
                </button>
                <button
                    type="button"
                    className={query.scope === 'library' ? 'selected' : ''}
                    aria-pressed={query.scope === 'library'}
                    onClick={() => change({ scope: 'library' })}
                >
                    Thư viện chung
                </button>
            </fieldset>
            {query.scope === 'library' && (
                <p className="asset-scope-note">
                    Tài nguyên dùng chung do nhóm quản trị cung cấp. Bạn có thể xem thông tin và
                    nguồn sử dụng tại đây.
                </p>
            )}
            <AssetFilters
                key={params.toString()}
                query={query}
                categories={categories.data}
                change={change}
                filtered={filtered}
            />
            {categories.isError && (
                <div className="asset-category-error">
                    <Feedback error="Chưa tải được danh mục. Bạn vẫn có thể tìm tài nguyên." />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            void categories.refetch();
                        }}
                    >
                        Tải lại danh mục
                    </Button>
                </div>
            )}
            {listing.isPending ? (
                <p className="list-state" role="status">
                    Đang tải tài nguyên…
                </p>
            ) : listing.isError ? (
                <div className="list-state">
                    <Feedback error={errorMessage(listing.error)} />
                    <Button
                        onClick={() => {
                            void listing.refetch();
                        }}
                    >
                        Thử tải lại
                    </Button>
                </div>
            ) : (
                <>
                    <p className="list-summary" role="status">
                        {meta?.total} tài nguyên{query.q ? ` khớp “${query.q}”` : ''}
                        {listing.isFetching ? ' · Đang cập nhật…' : ''}
                    </p>
                    {listing.data.data.length === 0 ? (
                        <div className="empty-state">
                            <FolderOpen size={38} aria-hidden="true" />
                            <h2>
                                {filtered
                                    ? 'Không tìm thấy tài nguyên phù hợp'
                                    : query.scope === 'library'
                                      ? 'Thư viện chung chưa có tài nguyên'
                                      : 'Chưa có tài nguyên'}
                            </h2>
                            <p>
                                {filtered
                                    ? 'Thử từ khóa khác hoặc xóa bộ lọc.'
                                    : query.scope === 'library'
                                      ? 'Các tài nguyên được chia sẻ sẽ xuất hiện ở đây.'
                                      : 'Tải tệp đầu tiên để chuẩn bị cho nội dung sách của bạn.'}
                            </p>
                            {filtered ? (
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        change({
                                            q: undefined,
                                            type: undefined,
                                            categoryId: undefined,
                                            tag: undefined,
                                            hasAnimation: undefined,
                                        })
                                    }
                                >
                                    Xóa bộ lọc
                                </Button>
                            ) : (
                                query.scope === 'mine' && (
                                    <Link className={buttonStyles()} to="/assets/upload">
                                        Tải tài nguyên đầu tiên
                                    </Link>
                                )
                            )}
                        </div>
                    ) : (
                        <ul className="asset-list">
                            {listing.data.data.map((asset) => (
                                <li key={asset.id} className="asset-row">
                                    <AssetThumbnail asset={asset} />
                                    <div className="asset-row-info">
                                        <h2>
                                            <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
                                        </h2>
                                        <p>
                                            {assetTypeLabels[asset.type]} ·{' '}
                                            {formatBytes(asset.sizeBytes)}
                                            {asset.meta.animations?.length
                                                ? ` · ${asset.meta.animations.length} hoạt ảnh`
                                                : ''}
                                        </p>
                                        {asset.tags.length > 0 && (
                                            <p className="asset-tag-list">
                                                {asset.tags.slice(0, 4).map((tag) => (
                                                    <span key={tag}>#{tag}</span>
                                                ))}
                                            </p>
                                        )}
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
                                </li>
                            ))}
                        </ul>
                    )}
                    {meta && meta.totalPages > 1 && (
                        <nav className="pagination" aria-label="Phân trang tài nguyên">
                            <Button
                                variant="secondary"
                                disabled={query.page <= 1 || listing.isFetching}
                                onClick={() => change({ page: String(query.page - 1) })}
                            >
                                Trang trước
                            </Button>
                            <span>
                                Trang {query.page} / {meta.totalPages}
                            </span>
                            <Button
                                variant="secondary"
                                disabled={query.page >= meta.totalPages || listing.isFetching}
                                onClick={() => change({ page: String(query.page + 1) })}
                            >
                                Trang sau
                            </Button>
                        </nav>
                    )}
                </>
            )}
        </>
    );
}
