import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { SearchFilter, SelectFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Pagination } from '@/shared/ui/Pagination';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
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
import { BookActionsDialog } from '../features/books/ui/BookActionsDialog';
import { BookInfoDialog } from '../features/books/ui/BookInfoDialog';
import { BookStatusBadge } from '../features/books/ui/BookStatusBadge';
import { BookStatusFilter } from '../features/books/ui/BookStatusFilter';
import { BookStatsDialog } from '../features/stats/BookStatsDialog';
import { errorMessage } from '../shared/api/errors';
import type { BookSummary } from '../shared/contracts/dto.schema';
import { formatDate } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';

export function BooksPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readBookSearch(params);
    const hasFilters = Boolean(query.q || query.status);
    const createBookTo = { pathname: '/books/new', search: params.toString() };
    const cache = useQueryClient();
    const [deleting, setDeleting] = useState<BookSummary | null>(null);
    const [actions, setActions] = useState<{ book: BookSummary; opener: HTMLElement } | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [info, setInfo] = useState<{ bookId: string; opener: HTMLElement | null } | null>(null);
    const [stats, setStats] = useState<{ bookId: string; opener: HTMLElement } | null>(null);
    const listing = useQuery({
        queryKey: bookKeys.list(user?.id || '', 'list', query),
        queryFn: ({ signal }) => booksApi.list(query, signal),
        enabled: Boolean(user),
    });
    const remove = useMutation({
        mutationFn: (id: string) => booksApi.remove(id),
        onSuccess: async () => {
            setDeleting(null);
            setActions(null);
            setNotice('Đã chuyển sách vào thùng rác.');
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
    function confirmDelete(book: BookSummary) {
        remove.reset();
        setDeleting(book);
    }
    return (
        <>
            <header className="mb-7 flex flex-wrap items-center justify-between gap-4 sm:mb-9">
                <div className="min-w-0">
                    <h1 className="m-0 font-semibold text-3xl sm:text-4xl">Sách của tôi</h1>
                    <p className="m-0 mt-2 text-muted-foreground text-sm">
                        Tạo sách tương tác hoặc mở bản đang làm để chỉnh sửa tiếp.
                    </p>
                </div>
                <Button asChild>
                    <Link to={createBookTo} aria-haspopup="dialog">
                        <Plus data-icon="inline-start" aria-hidden="true" />
                        Tạo sách mới
                    </Link>
                </Button>
            </header>
            <Feedback success={notice} />
            <form
                aria-label="Bộ lọc sách"
                className="mb-5"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_14rem] sm:gap-3 [&_[data-slot=input]]:m-0 [&_[data-slot=select-trigger]]:m-0">
                    <Field className="min-w-0">
                        <FieldLabel htmlFor="book-search" className="sr-only">
                            Tìm sách
                        </FieldLabel>
                        <SearchFilter
                            id="book-search"
                            name="q"
                            value={query.q}
                            maxLength={100}
                            loading={listing.isFetching}
                            placeholder="Tìm theo tên sách"
                        />
                    </Field>
                    <Field className="min-w-0">
                        <FieldLabel htmlFor="book-sort" className="sr-only">
                            Sắp xếp sách
                        </FieldLabel>
                        <SelectFilter
                            id="book-sort"
                            name="sort"
                            value={query.sort}
                            options={[
                                { value: '-updatedAt', label: 'Cập nhật gần nhất' },
                                { value: 'updatedAt', label: 'Cập nhật cũ nhất' },
                                { value: '-createdAt', label: 'Mới tạo gần nhất' },
                                { value: 'createdAt', label: 'Tạo cũ nhất' },
                                { value: 'title', label: 'Tên A–Z' },
                                { value: '-title', label: 'Tên Z–A' },
                            ]}
                        />
                    </Field>
                </FieldGroup>
            </form>
            <BookStatusFilter
                status={query.status}
                total={meta?.total}
                onChange={(status) => change({ status })}
            />
            {listing.isPending && <LoadingState layout="books">Đang tải sách…</LoadingState>}
            {listing.isError && (
                <div className="list-state px-0 py-12">
                    <Feedback error={errorMessage(listing.error)} />
                    <Button
                        type="button"
                        onClick={() => {
                            void listing.refetch();
                        }}
                    >
                        Thử tải lại
                    </Button>
                </div>
            )}
            {listing.isSuccess && listing.data.data.length > 0 && (
                <>
                    <ul
                        className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,205px),1fr))] gap-4 p-0"
                        aria-label="Sách của tôi"
                    >
                        <li>
                            <Card
                                asChild
                                size="sm"
                                className="h-full min-h-56 items-center justify-center gap-3 border-dashed px-3 text-center font-medium hover:border-input hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-3px] motion-safe:transition-colors"
                            >
                                <Link to={createBookTo} aria-haspopup="dialog">
                                    <Plus className="size-6" aria-hidden="true" />
                                    Tạo sách mới
                                </Link>
                            </Card>
                        </li>
                        {listing.data.data.map((book) => (
                            <Card
                                key={book.id}
                                asChild
                                size="sm"
                                className="relative gap-0 py-0 hover:border-input motion-safe:transition-colors motion-safe:duration-200"
                            >
                                <li>
                                    <ActionButton
                                        variant="plain"
                                        className="peer absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-offset-[-3px]"
                                        aria-label={`Thao tác với sách: ${book.title}`}
                                        aria-haspopup="dialog"
                                        onClick={(event) =>
                                            setActions({ book, opener: event.currentTarget })
                                        }
                                    />
                                    <CardContent className="relative aspect-[4/3] overflow-hidden bg-muted p-0 motion-safe:peer-focus-visible:[&_img]:scale-[1.04] motion-safe:peer-hover:[&_img]:scale-[1.04]">
                                        <div className="absolute inset-4 grid place-items-center">
                                            <BookCoverImage
                                                url={book.coverUrl}
                                                className="bg-transparent motion-safe:transition-transform motion-safe:duration-200"
                                            />
                                        </div>
                                        <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5 flex flex-wrap justify-end gap-1">
                                            <BookStatusBadge status={book.status} />
                                            {book.takenDown && (
                                                <Badge tone="danger">Đã bị gỡ</Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                    <CardHeader className="min-w-0 gap-x-1 px-3 pt-3 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto]">
                                        <CardTitle asChild>
                                            <h2
                                                className="m-0 truncate text-base"
                                                title={book.title}
                                            >
                                                {book.title}
                                            </h2>
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            {book.pageCount} trang, cập nhật{' '}
                                            {formatDate(book.updatedAt)}
                                        </CardDescription>
                                        <CardAction className="relative z-10">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Tùy chọn sách ${book.title}`}
                                                aria-haspopup="dialog"
                                                onClick={(event) =>
                                                    setActions({
                                                        book,
                                                        opener: event.currentTarget,
                                                    })
                                                }
                                            >
                                                <MoreHorizontal aria-hidden="true" />
                                            </Button>
                                        </CardAction>
                                    </CardHeader>
                                    <div className="mt-auto flex items-center gap-2 p-3">
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm"
                                            className="relative z-10 min-w-0 flex-1"
                                        >
                                            <Link
                                                to={`/books/${book.id}/edit`}
                                                aria-label={`Mở editor cho ${book.title}`}
                                            >
                                                <Pencil
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />
                                                Mở editor
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="destructive-ghost"
                                            size="icon-sm"
                                            className="relative z-10 shrink-0"
                                            aria-label={`Chuyển ${book.title} vào thùng rác`}
                                            title="Chuyển vào thùng rác"
                                            onClick={() => confirmDelete(book)}
                                        >
                                            <Trash2 aria-hidden="true" />
                                        </Button>
                                    </div>
                                </li>
                            </Card>
                        ))}
                    </ul>
                    {meta && meta.totalPages > 1 && (
                        <Pagination
                            page={query.page}
                            totalPages={meta.totalPages}
                            busy={listing.isFetching}
                            label="Phân trang sách"
                            onPage={(page) => change({ page: String(page) })}
                        />
                    )}
                </>
            )}
            {listing.isSuccess && meta?.total === 0 && (
                <Empty className="py-12">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            {hasFilters ? (
                                <SearchX aria-hidden="true" />
                            ) : (
                                <BookOpen aria-hidden="true" />
                            )}
                        </EmptyMedia>
                        <EmptyTitle>
                            <h2>
                                {hasFilters ? 'Không tìm thấy sách phù hợp' : 'Bạn chưa có sách'}
                            </h2>
                        </EmptyTitle>
                        <EmptyDescription>
                            {hasFilters
                                ? 'Thử tên khác hoặc xem tất cả trạng thái.'
                                : 'Bắt đầu từ trang trắng hoặc nhập nội dung có sẵn.'}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        {hasFilters ? (
                            <Button
                                variant="outline"
                                onClick={() => change({ q: undefined, status: undefined })}
                            >
                                Xóa bộ lọc
                            </Button>
                        ) : (
                            <Button variant="outline" asChild>
                                <Link to={createBookTo} aria-haspopup="dialog">
                                    <Plus data-icon="inline-start" aria-hidden="true" />
                                    Tạo sách đầu tiên
                                </Link>
                            </Button>
                        )}
                    </EmptyContent>
                </Empty>
            )}
            {actions && (
                <BookActionsDialog
                    key={actions.book.id}
                    book={actions.book}
                    opener={actions.opener}
                    onClose={() => setActions(null)}
                    onInfo={() => {
                        setInfo({ bookId: actions.book.id, opener: actions.opener });
                        setActions(null);
                    }}
                    onStats={() => {
                        setStats({ bookId: actions.book.id, opener: actions.opener });
                        setActions(null);
                    }}
                    onDelete={() => confirmDelete(actions.book)}
                />
            )}
            {info && (
                <BookInfoDialog
                    key={info.bookId}
                    bookId={info.bookId}
                    opener={info.opener}
                    onClose={() => setInfo(null)}
                />
            )}
            {stats && (
                <BookStatsDialog
                    key={stats.bookId}
                    bookId={stats.bookId}
                    opener={stats.opener}
                    onClose={() => setStats(null)}
                />
            )}
            {deleting && (
                <ConfirmationDialog
                    description={
                        <>
                            <strong>{deleting.title}</strong> sẽ không còn nằm trong Sách của tôi.
                            Bạn có thể khôi phục từ thùng rác.
                        </>
                    }
                    title="Chuyển sách vào thùng rác?"
                    busy={remove.isPending}
                    onClose={() => setDeleting(null)}
                >
                    <Feedback error={remove.error ? errorMessage(remove.error) : null} />
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant="secondary"
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => setDeleting(null)}
                            >
                                Giữ sách
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="destructive"
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => {
                                    setNotice(null);
                                    void remove.mutateAsync(deleting.id).catch(() => undefined);
                                }}
                            >
                                {remove.isPending ? 'Đang chuyển…' : 'Chuyển vào thùng rác'}
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
