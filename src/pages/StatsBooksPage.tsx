import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookStatusBadge } from '@/features/books/ui/BookStatusBadge';
import { BookStatusFilter } from '@/features/books/ui/BookStatusFilter';
import { readStatsRange } from '@/features/stats';
import { BookStatsDialog } from '@/features/stats/BookStatsDialog';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { SearchFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi, readBookSearch, updateBookSearch } from '../features/books';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';
import { Pagination } from '../shared/ui/Pagination';

export function StatsBooksPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { bookId: linkedBookId } = useParams();
    const [params, setParams] = useSearchParams();
    const [selection, setSelection] = useState<{ bookId: string; opener: HTMLElement } | null>(
        null,
    );
    const selectedBookId = linkedBookId ?? selection?.bookId;
    const query = readBookSearch(params);
    const hasFilters = Boolean(query.q || query.status);
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
            <header className="mb-7 sm:mb-9">
                <h1 className="m-0 font-semibold text-3xl sm:text-4xl">Thống kê sách</h1>
                <p className="m-0 mt-2 text-muted-foreground text-sm">
                    Chọn sách để xem lượt mở, tương tác và thiết bị đọc.
                </p>
            </header>
            <form
                className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2"
                aria-label="Tìm sách để xem thống kê"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="contents">
                    <Field className="min-w-0 flex-1 basis-48">
                        <FieldLabel htmlFor="stats-book-search" className="sr-only">
                            Tìm sách của tôi
                        </FieldLabel>
                        <SearchFilter
                            id="stats-book-search"
                            name="q"
                            maxLength={100}
                            value={query.q || ''}
                            loading={list.isFetching}
                            placeholder="Tìm theo tên sách"
                        />
                    </Field>
                </FieldGroup>
            </form>
            <BookStatusFilter
                status={query.status}
                total={meta?.total}
                onChange={(status) => setParams((current) => updateBookSearch(current, { status }))}
            />
            {list.isPending && <LoadingState layout="stats-books">Đang tải sách…</LoadingState>}
            {list.isError && (
                <div className="list-state px-0 py-12">
                    <Feedback error={errorMessage(list.error)} />
                    <Button type="button" onClick={() => void list.refetch()}>
                        Thử tải lại
                    </Button>
                </div>
            )}
            {list.isSuccess && (
                <>
                    {list.data.data.length ? (
                        <ul
                            className="m-0 grid list-none gap-2.5 p-0"
                            aria-label="Sách có thể xem thống kê"
                        >
                            {list.data.data.map((book) => (
                                <li key={book.id}>
                                    <button
                                        type="button"
                                        aria-label={`Xem thống kê sách ${book.title}`}
                                        aria-haspopup="dialog"
                                        className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface p-3 text-left text-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 motion-safe:transition-colors sm:px-4"
                                        onClick={(event) =>
                                            setSelection({
                                                bookId: book.id,
                                                opener: event.currentTarget,
                                            })
                                        }
                                    >
                                        <span className="h-14 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                                            <BookCoverImage url={book.coverUrl} />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span
                                                className="truncate font-semibold text-sm"
                                                title={book.title}
                                            >
                                                {book.title}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-xs">
                                                {book.pageCount} trang
                                                <BookStatusBadge status={book.status} />
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-sm group-hover:text-foreground">
                                            <span className="hidden sm:inline">Xem chi tiết</span>
                                            <ChevronRight className="size-4" aria-hidden="true" />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyMedia>
                                    {hasFilters ? (
                                        <SearchX aria-hidden="true" />
                                    ) : (
                                        <BookOpen aria-hidden="true" />
                                    )}
                                </EmptyMedia>
                                <EmptyTitle>
                                    <h2>
                                        {hasFilters
                                            ? 'Không tìm thấy sách phù hợp'
                                            : 'Bạn chưa có sách'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    {hasFilters
                                        ? 'Thử tên sách khác hoặc đổi bộ lọc trạng thái.'
                                        : 'Sau khi tạo sách, bạn có thể xem số liệu đọc của sách tại đây.'}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button variant="outline" asChild>
                                    <Link to={hasFilters ? '/stats' : '/books/new'}>
                                        {hasFilters ? 'Xóa bộ lọc' : 'Tạo sách đầu tiên'}
                                    </Link>
                                </Button>
                            </EmptyContent>
                        </Empty>
                    )}
                    <Pagination
                        busy={list.isFetching}
                        page={query.page}
                        totalPages={list.data.meta.totalPages}
                        onPage={changePage}
                        label="Phân trang chọn sách thống kê"
                    />
                </>
            )}
            {selectedBookId && (
                <BookStatsDialog
                    key={selectedBookId}
                    bookId={selectedBookId}
                    initialRange={readStatsRange(params)}
                    opener={selection?.opener}
                    onClose={() => {
                        setSelection(null);
                        if (linkedBookId) {
                            const search = new URLSearchParams(params);
                            search.delete('range');
                            void navigate(
                                { pathname: '/stats', search: search.toString() },
                                { replace: true },
                            );
                        }
                    }}
                />
            )}
        </>
    );
}
