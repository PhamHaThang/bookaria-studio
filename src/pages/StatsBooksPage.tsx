import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi, readBookSearch } from '../features/books';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';
import { Pagination } from '../shared/ui/Pagination';

export function StatsBooksPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readBookSearch(
        new URLSearchParams({ q: params.get('q') || '', page: params.get('page') || '1' }),
    );
    const list = useQuery({
        queryKey: bookKeys.list(user?.id || '', 'stats-picker', query),
        queryFn: ({ signal }) => booksApi.list(query, signal),
        enabled: Boolean(user),
    });
    const meta = list.data?.meta;
    const changePage = (page: number) =>
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('page', String(page));
            return next;
        });
    useEffect(() => {
        if (list.isSuccess && !list.isFetching && meta && query.page > Math.max(1, meta.totalPages))
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.set('page', String(Math.max(1, meta.totalPages)));
                    return next;
                },
                { replace: true },
            );
    }, [list.isSuccess, list.isFetching, meta, query.page, setParams]);
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Thống kê sách</h1>
                    <p>Chọn sách để xem lượt mở, tương tác và thiết bị đọc.</p>
                </div>
            </div>
            <form
                className="insights-search"
                key={query.q || ''}
                onSubmit={(event) => {
                    event.preventDefault();
                    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
                    setParams(q ? { q } : {});
                }}
            >
                <label htmlFor="stats-book-search">
                    Tìm sách của tôi
                    <input
                        id="stats-book-search"
                        name="q"
                        type="search"
                        maxLength={100}
                        defaultValue={query.q || ''}
                    />
                </label>
                <button type="submit" className="button compact">
                    Tìm sách
                </button>
            </form>
            {list.isPending && <p role="status">Đang tải sách…</p>}
            {list.isError && (
                <div className="list-state">
                    <Feedback error={errorMessage(list.error)} />
                    <button
                        type="button"
                        className="button compact"
                        onClick={() => void list.refetch()}
                    >
                        Thử tải lại
                    </button>
                </div>
            )}
            {list.isSuccess && (
                <>
                    <p className="list-summary" role="status">
                        {list.data.meta.total} cuốn sách
                    </p>
                    {list.data.data.length ? (
                        <ul className="insights-book-list">
                            {list.data.data.map((book) => (
                                <li key={book.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/books/${book.id}/stats`}>{book.title}</Link>
                                        </h2>
                                        <p>{book.pageCount} trang</p>
                                    </div>
                                    <Link
                                        className="button secondary compact"
                                        to={`/books/${book.id}/stats`}
                                    >
                                        Xem thống kê<span className="sr-only"> {book.title}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>{query.q ? 'Không tìm thấy sách phù hợp' : 'Bạn chưa có sách'}</h2>
                            <Link to={query.q ? '/stats' : '/books/new'}>
                                {query.q ? 'Xóa tìm kiếm' : 'Tạo sách đầu tiên'}
                            </Link>
                        </section>
                    )}
                    <Pagination
                        page={query.page}
                        totalPages={list.data.meta.totalPages}
                        onPage={changePage}
                        label="Phân trang chọn sách thống kê"
                    />
                </>
            )}
        </>
    );
}
