import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { discoveryApi } from '../features/discovery';
import { PublicBooks } from '../features/discovery/PublicBooks';
import { readDiscoverySearch, updateDiscoverySearch } from '../features/discovery/search';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

const ages = Array.from({ length: 19 }, (_, value) => String(value));

export function ExplorePage() {
    const [params, setParams] = useSearchParams();
    const query = readDiscoverySearch(params);
    const listing = useQuery({
        queryKey: ['discovery', 'books', query],
        queryFn: ({ signal }) => discoveryApi.books(query, signal),
        staleTime: 0,
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (
            listing.isSuccess &&
            !listing.isFetching &&
            meta &&
            query.page > Math.max(1, meta.totalPages)
        )
            setParams(
                (current) =>
                    updateDiscoverySearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
    }, [listing.isSuccess, listing.isFetching, meta, query.page, setParams]);
    const filtered = Boolean(query.q || query.age !== undefined || query.topic || query.language);
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Thư viện sách công khai</h1>
                    <p>Tìm sách tương tác và đọc cùng Bookaria.</p>
                </div>
            </div>
            <form
                className="discovery-filters"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const changes = Object.fromEntries(
                        ['q', 'age', 'topic', 'language', 'sort'].map((key) => [
                            key,
                            String(data.get(key) || '').trim(),
                        ]),
                    );
                    setParams((current) => updateDiscoverySearch(current, changes));
                }}
            >
                <label className="discovery-search">
                    Tên sách
                    <input
                        name="q"
                        type="search"
                        maxLength={100}
                        defaultValue={query.q || ''}
                        placeholder="Tìm theo tên sách"
                    />
                </label>
                <label>
                    Độ tuổi
                    <select name="age" defaultValue={query.age ?? ''}>
                        <option value="">Tất cả độ tuổi</option>
                        {ages.map((age) => (
                            <option key={age} value={age}>
                                {age} tuổi
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Chủ đề
                    <input
                        name="topic"
                        maxLength={50}
                        defaultValue={query.topic || ''}
                        placeholder="Nhập chủ đề"
                    />
                </label>
                <label>
                    Ngôn ngữ
                    <input
                        name="language"
                        pattern="[a-z]{2}(-[A-Z]{2})?"
                        title="Mã ngôn ngữ, ví dụ vi, en hoặc en-US"
                        defaultValue={query.language || ''}
                        placeholder="vi, en, en-US"
                    />
                </label>
                <label>
                    Sắp xếp
                    <select name="sort" defaultValue={query.sort}>
                        <option value="newest">Mới xuất bản</option>
                        <option value="popular">Đọc nhiều</option>
                    </select>
                </label>
                <div className="discovery-filter-actions">
                    <button className="button compact" type="submit">
                        Tìm sách
                    </button>
                    <Link to="/explore" className="button secondary compact">
                        Xóa bộ lọc
                    </Link>
                </div>
            </form>
            {listing.isPending && (
                <p className="list-state" role="status">
                    Đang tải sách…
                </p>
            )}
            {listing.isError && (
                <div className="list-state">
                    <Feedback error={errorMessage(listing.error)} />
                    <button
                        type="button"
                        className="button compact"
                        onClick={() => void listing.refetch()}
                    >
                        Thử tải lại
                    </button>
                </div>
            )}
            {listing.isSuccess && (
                <>
                    <p className="list-summary" role="status">
                        {listing.data.meta.total} cuốn sách
                        {listing.isFetching ? ' · Đang cập nhật…' : ''}
                    </p>
                    {listing.data.data.length ? (
                        <PublicBooks books={listing.data.data} />
                    ) : (
                        <section className="empty-state">
                            <h2>
                                {filtered
                                    ? 'Chưa tìm thấy sách phù hợp'
                                    : 'Thư viện chưa có sách công khai'}
                            </h2>
                            <p>
                                {filtered
                                    ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem thêm sách.'
                                    : 'Các sách được tác giả xuất bản công khai sẽ xuất hiện ở đây.'}
                            </p>
                            {filtered && <Link to="/explore">Xóa bộ lọc</Link>}
                        </section>
                    )}
                    {listing.data.meta.totalPages > 1 && (
                        <nav className="pagination" aria-label="Phân trang thư viện">
                            <button
                                type="button"
                                className="button secondary compact"
                                disabled={query.page <= 1}
                                onClick={() =>
                                    setParams((current) =>
                                        updateDiscoverySearch(current, {
                                            page: String(query.page - 1),
                                        }),
                                    )
                                }
                            >
                                Trang trước
                            </button>
                            <span>
                                Trang {query.page} / {listing.data.meta.totalPages}
                            </span>
                            <button
                                type="button"
                                className="button secondary compact"
                                disabled={query.page >= listing.data.meta.totalPages}
                                onClick={() =>
                                    setParams((current) =>
                                        updateDiscoverySearch(current, {
                                            page: String(query.page + 1),
                                        }),
                                    )
                                }
                            >
                                Trang sau
                            </button>
                        </nav>
                    )}
                </>
            )}
        </>
    );
}
