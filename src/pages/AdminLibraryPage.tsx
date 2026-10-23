import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { libraryKeys, readLibrarySearch } from '../features/admin/library-model';
import { CategorySelect, libraryApi } from '../features/admin/library-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { AssetThumbnail, assetKeys, assetsApi, assetTypeLabels } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { formatBytes } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';
export function AdminLibraryPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
        query = readLibrarySearch(params);
    const list = useQuery({
        queryKey: libraryKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => libraryApi.library(query, signal),
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
    return (
        <>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Thư viện dùng chung</h1>
                    <p>Tài nguyên có thể được các tác giả sử dụng trong sách.</p>
                </div>
                <Link className="button compact" to="/admin/library/new">
                    Thêm vào thư viện
                </Link>
            </div>
            <form
                className="admin-filters"
                key={params.toString() + categories.isSuccess}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget),
                        next = new URLSearchParams();
                    for (const [key, value] of data) if (value) next.set(key, String(value).trim());
                    setParams(next);
                }}
            >
                <label htmlFor="library-q">
                    Tên tài nguyên
                    <input
                        id="library-q"
                        name="q"
                        type="search"
                        maxLength={100}
                        defaultValue={query.q}
                    />
                </label>
                <label htmlFor="library-type">
                    Loại
                    <select id="library-type" name="type" defaultValue={query.type || ''}>
                        <option value="">Tất cả</option>
                        {Object.entries(assetTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {categories.isSuccess && (
                    <CategorySelect
                        emptyLabel="Tất cả danh mục"
                        label="Lọc danh mục"
                        categories={categories.data}
                        value={query.categoryId || ''}
                    />
                )}
                <button type="submit" className="button compact">
                    Lọc thư viện
                </button>
                <Link to="/admin/library">Xóa bộ lọc</Link>
            </form>
            {categories.isError && <Feedback error={errorMessage(categories.error)} />}
            <AdminReload
                retry={() => {
                    void list.refetch();
                    void categories.refetch();
                }}
                busy={list.isFetching || categories.isFetching}
            />
            {list.isPending && <p role="status">Đang tải thư viện…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} tài nguyên</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows">
                            {list.data.data.map((asset) => (
                                <li key={asset.id}>
                                    <div className="library-row-main">
                                        <AssetThumbnail asset={asset} />
                                        <div>
                                            <h2>
                                                <Link to={`/admin/library/${asset.id}`}>
                                                    {asset.name}
                                                </Link>
                                            </h2>
                                            <p>
                                                {assetTypeLabels[asset.type]} ·{' '}
                                                {formatBytes(asset.sizeBytes)}
                                            </p>
                                            <p>
                                                {asset.authorName} · {asset.license}
                                            </p>
                                            <p>
                                                {categories.data?.find(
                                                    (item) => item.id === asset.categoryId,
                                                )?.name || 'Không có danh mục'}
                                            </p>
                                        </div>
                                    </div>
                                    <Link to={`/admin/library/${asset.id}`}>
                                        Sửa thông tin<span className="sr-only"> {asset.name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có tài nguyên phù hợp</h2>
                            <p>Đổi bộ lọc hoặc chọn tài nguyên cá nhân để đưa vào thư viện.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
