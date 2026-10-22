import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { useAuth } from '../features/auth';
import {
    bookKeys,
    bookStatusLabels,
    booksApi,
    readBookSearch,
    updateBookSearch,
} from '../features/books';
import { errorMessage } from '../shared/api/errors';
import type { BookSummary } from '../shared/contracts/dto.schema';
import { formatDate } from '../shared/lib/format';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Feedback } from '../shared/ui/Feedback';

export function BooksPage({ trash = false }: { trash?: boolean }) {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readBookSearch(params);
    const cache = useQueryClient();
    const [deleting, setDeleting] = useState<BookSummary | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const listing = useQuery({
        queryKey: bookKeys.list(user?.id || '', trash ? 'trash' : 'list', query),
        queryFn: ({ signal }) =>
            trash
                ? booksApi.trash({ page: query.page, limit: query.limit }, signal)
                : booksApi.list(query, signal),
        enabled: Boolean(user),
    });
    const remove = useMutation({
        mutationFn: (id: string) => booksApi.remove(id),
        onSuccess: async () => {
            setDeleting(null);
            setNotice('Đã chuyển sách vào thùng rác.');
            await cache.invalidateQueries({ queryKey: bookKeys.all });
        },
    });
    const restore = useMutation({
        mutationFn: (id: string) => booksApi.restore(id),
        onSuccess: async () => {
            setNotice('Đã khôi phục sách. Sách nằm trong Sách của tôi.');
            await cache.invalidateQueries({ queryKey: bookKeys.all });
        },
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (!listing.isFetching && meta && query.page > Math.max(1, meta.totalPages)) {
            setParams(
                (current) =>
                    updateBookSearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
        }
    }, [listing.isFetching, meta, query.page, setParams]);
    function change(changes: Record<string, string | undefined>) {
        setParams((current) => updateBookSearch(current, changes));
    }
    async function restoreBook(id: string) {
        setActionError(null);
        setNotice(null);
        try {
            await restore.mutateAsync(id);
        } catch (cause) {
            setActionError(errorMessage(cause));
        }
    }
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>{trash ? 'Thùng rác' : 'Sách của tôi'}</h1>
                    <p>
                        {trash
                            ? 'Khôi phục những cuốn sách bạn muốn tiếp tục sử dụng.'
                            : 'Quản lý những cuốn sách bạn đang sáng tạo.'}
                    </p>
                </div>
                {!trash && (
                    <Link className="button compact" to="/books/new">
                        <Plus size={18} aria-hidden="true" />
                        Tạo sách
                    </Link>
                )}
            </div>
            <Feedback error={actionError} success={notice} />
            {!trash && (
                <>
                    <fieldset className="status-tabs" aria-label="Lọc trạng thái sách">
                        {([undefined, 'DRAFT', 'PUBLISHED', 'CHANGED'] as const).map((status) => (
                            <button
                                key={status || 'all'}
                                type="button"
                                className={query.status === status ? 'selected' : ''}
                                aria-pressed={query.status === status}
                                onClick={() => change({ status })}
                            >
                                {status ? bookStatusLabels[status] : 'Tất cả'}
                            </button>
                        ))}
                    </fieldset>
                    <form
                        className="books-toolbar"
                        key={`${query.q}-${query.sort}`}
                        onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            change({
                                q: String(data.get('q') || '').trim(),
                                sort: String(data.get('sort') || '-updatedAt'),
                            });
                        }}
                    >
                        <label className="search-field" htmlFor="book-search">
                            <span className="sr-only">Tìm sách</span>
                            <Search size={18} aria-hidden="true" />
                            <input
                                id="book-search"
                                name="q"
                                type="search"
                                defaultValue={query.q}
                                maxLength={100}
                                placeholder="Tìm theo tên sách"
                            />
                        </label>
                        <label className="sort-field" htmlFor="book-sort">
                            <span className="sr-only">Sắp xếp sách</span>
                            <select
                                id="book-sort"
                                name="sort"
                                defaultValue={query.sort}
                                onChange={(event) => {
                                    const form = event.currentTarget.form;
                                    if (form) form.requestSubmit();
                                }}
                            >
                                <option value="-updatedAt">Cập nhật gần nhất</option>
                                <option value="updatedAt">Cập nhật cũ nhất</option>
                                <option value="-createdAt">Mới tạo gần nhất</option>
                                <option value="createdAt">Tạo cũ nhất</option>
                                <option value="title">Tên A–Z</option>
                                <option value="-title">Tên Z–A</option>
                            </select>
                        </label>
                        <button className="button compact" type="submit">
                            Tìm sách
                        </button>
                    </form>
                </>
            )}
            {listing.isPending && (
                <p className="list-state" role="status">
                    Đang tải sách…
                </p>
            )}
            {listing.isError && (
                <div className="list-state">
                    <Feedback error={errorMessage(listing.error)} />
                    <button
                        className="button compact"
                        type="button"
                        onClick={() => {
                            void listing.refetch();
                        }}
                    >
                        Thử tải lại
                    </button>
                </div>
            )}
            {listing.isSuccess && (
                <>
                    <div className="list-summary" aria-live="polite">
                        <span>
                            {listing.data.meta.total} cuốn sách
                            {query.q && !trash ? ` khớp “${query.q}”` : ''}
                        </span>
                        {listing.isFetching && <span>Đang cập nhật…</span>}
                    </div>
                    {listing.data.data.length === 0 ? (
                        <section className="empty-state">
                            <BookOpen size={38} aria-hidden="true" />
                            <h2>
                                {trash
                                    ? 'Thùng rác đang trống'
                                    : query.q || query.status
                                      ? 'Không tìm thấy sách phù hợp'
                                      : 'Bắt đầu cuốn sách đầu tiên'}
                            </h2>
                            <p>
                                {trash
                                    ? 'Những sách được chuyển vào thùng rác sẽ xuất hiện ở đây.'
                                    : query.q || query.status
                                      ? 'Thử tên khác hoặc xem tất cả trạng thái.'
                                      : 'Tạo một cuốn sách trống và chọn khổ giấy phù hợp.'}
                            </p>
                            {!trash &&
                                (query.q || query.status ? (
                                    <button
                                        className="text-button"
                                        type="button"
                                        onClick={() => setParams({})}
                                    >
                                        Xóa bộ lọc
                                    </button>
                                ) : (
                                    <Link className="button compact" to="/books/new">
                                        Tạo sách đầu tiên
                                    </Link>
                                ))}
                        </section>
                    ) : (
                        <ul className="book-list">
                            {listing.data.data.map((book) => (
                                <li
                                    className={trash ? 'book-row trash-row' : 'book-row'}
                                    key={book.id}
                                >
                                    <div className="book-cover">
                                        {book.coverUrl ? (
                                            <img src={book.coverUrl} alt="" loading="lazy" />
                                        ) : (
                                            <BookOpen size={27} aria-hidden="true" />
                                        )}
                                    </div>
                                    <div className="book-info">
                                        <h2>
                                            {trash ? (
                                                book.title
                                            ) : (
                                                <Link to={`/books/${book.id}`}>{book.title}</Link>
                                            )}
                                        </h2>
                                        <p>
                                            {book.pageCount} trang
                                            <span aria-hidden="true"> · </span>
                                            {trash && 'deletedAt' in book ? 'Đã xóa ' : 'Cập nhật '}
                                            {formatDate(
                                                trash && 'deletedAt' in book
                                                    ? String(book.deletedAt)
                                                    : book.updatedAt,
                                            )}
                                        </p>
                                    </div>
                                    <div className="book-badges">
                                        <Badge
                                            tone={
                                                book.status === 'PUBLISHED'
                                                    ? 'success'
                                                    : book.status === 'CHANGED'
                                                      ? 'warning'
                                                      : 'neutral'
                                            }
                                        >
                                            {bookStatusLabels[book.status]}
                                        </Badge>
                                        {book.takenDown && (
                                            <span className="moderation-label">Đã bị gỡ</span>
                                        )}
                                    </div>
                                    {trash ? (
                                        <button
                                            className="row-action text-button"
                                            type="button"
                                            disabled={restore.isPending}
                                            aria-label={`Khôi phục ${book.title}`}
                                            onClick={() => {
                                                void restoreBook(book.id);
                                            }}
                                        >
                                            <RotateCcw size={17} aria-hidden="true" />
                                            Khôi phục
                                        </button>
                                    ) : (
                                        <button
                                            className="danger-text row-action text-button"
                                            type="button"
                                            aria-label={`Chuyển ${book.title} vào thùng rác`}
                                            onClick={() => {
                                                remove.reset();
                                                setDeleting(book);
                                            }}
                                        >
                                            <Trash2 size={17} aria-hidden="true" />
                                            <span className="sr-only">Chuyển vào thùng rác</span>
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    {meta && meta.totalPages > 1 && (
                        <nav className="pagination" aria-label="Phân trang sách">
                            <button
                                className="button compact secondary"
                                type="button"
                                disabled={query.page === 1 || listing.isFetching}
                                onClick={() => change({ page: String(query.page - 1) })}
                            >
                                Trang trước
                            </button>
                            <span>
                                Trang {query.page} / {meta.totalPages}
                            </span>
                            <button
                                className="button compact secondary"
                                type="button"
                                disabled={query.page >= meta.totalPages || listing.isFetching}
                                onClick={() => change({ page: String(query.page + 1) })}
                            >
                                Trang sau
                            </button>
                        </nav>
                    )}
                </>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Chuyển sách vào thùng rác?"
                    busy={remove.isPending}
                    onClose={() => setDeleting(null)}
                >
                    <p>
                        <strong>{deleting.title}</strong> sẽ không còn nằm trong Sách của tôi. Bạn
                        có thể khôi phục từ thùng rác.
                    </p>
                    <Feedback error={remove.error ? errorMessage(remove.error) : null} />
                    <div className="form-actions">
                        <button
                            className="button compact secondary"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => setDeleting(null)}
                        >
                            Giữ sách
                        </button>
                        <button
                            className="button compact danger"
                            type="button"
                            disabled={remove.isPending}
                            onClick={() => {
                                void remove.mutateAsync(deleting.id).catch(() => undefined);
                            }}
                        >
                            {remove.isPending ? 'Đang chuyển…' : 'Chuyển vào thùng rác'}
                        </button>
                    </div>
                </ConfirmDialog>
            )}
        </>
    );
}
