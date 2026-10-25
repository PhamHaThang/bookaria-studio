import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FilterBar } from '@/shared/ui/FilterBar';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import {
    Card,
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
import { Input } from '@/shared/ui/primitives/input';
import {
    PaginationContent,
    PaginationItem,
    Pagination as PaginationRoot,
} from '@/shared/ui/primitives/pagination';
import { useAuth } from '../features/auth';
import {
    bookKeys,
    bookStatusLabels,
    booksApi,
    readBookSearch,
    updateBookSearch,
} from '../features/books';
import { BookActionsDialog } from '../features/books/ui/BookActionsDialog';
import { errorMessage } from '../shared/api/errors';
import type { BookSummary } from '../shared/contracts/dto.schema';
import { formatDate } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';

export function BooksPage({ trash = false }: { trash?: boolean }) {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readBookSearch(params);
    const createBookTo = { pathname: '/books/new', search: params.toString() };
    const cache = useQueryClient();
    const [deleting, setDeleting] = useState<BookSummary | null>(null);
    const [actions, setActions] = useState<{ book: BookSummary; opener: HTMLElement } | null>(null);
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
            setActions(null);
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
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>{trash ? 'Thùng rác' : 'Sách của tôi'}</h1>
                    <p>
                        {trash
                            ? 'Khôi phục những cuốn sách bạn muốn tiếp tục sử dụng.'
                            : 'Quản lý những cuốn sách bạn đang sáng tạo.'}
                    </p>
                </div>
                {!trash && (
                    <Button asChild>
                        <Link to={createBookTo}>
                            <Plus data-icon="inline-start" aria-hidden="true" />
                            Tạo sách
                        </Link>
                    </Button>
                )}
            </div>
            <Feedback error={actionError} success={notice} />
            {!trash && (
                <>
                    <FilterBar
                        value={query.status || 'all'}
                        onValueChange={(status) =>
                            change({ status: status === 'all' ? undefined : status })
                        }
                        label="Lọc trạng thái sách"
                        options={[
                            { value: 'all', label: 'Tất cả' },
                            ...(['DRAFT', 'PUBLISHED', 'CHANGED'] as const).map((status) => ({
                                value: status,
                                label: bookStatusLabels[status],
                            })),
                        ]}
                    />
                    <form
                        className="books-toolbar mb-6 flex items-center gap-3 rounded-[8px] border border-border border-solid bg-surface p-2 max-[760px]:grid max-[760px]:grid-cols-[minmax(0,_1fr)_auto] max-[700px]:flex-wrap max-[760px]:gap-3 [&_[data-slot=select-trigger]]:min-h-9 [&_[data-slot=select-trigger]]:text-[length:12px] [&_input]:min-h-9 [&_input]:text-[length:12px] [&_label]:m-0 [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375"
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
                        <FieldGroup className="contents">
                            <Field orientation="contents">
                                <FieldLabel
                                    className="search-field flex flex-[1] items-center gap-3 rounded-[var(--radius-md)] border border-input border-solid bg-surface px-3 py-0 max-[760px]:col-[1_/_-1] [&_input:not([type=checkbox])]:m-0 [&_input:not([type=checkbox])]:min-w-0 [&_input:not([type=checkbox])]:border-0 [&_input:not([type=checkbox])]:border-[transparent] [&_input:not([type=checkbox])]:border-solid [&_input:not([type=checkbox])]:bg-[transparent] [&_input:not([type=checkbox])]:px-0 [&_input:not([type=checkbox])]:py-3 [&_svg]:shrink-0 [&_svg]:text-muted-foreground [.asset-filters_&]:mt-2 [.asset-filters_&_input:not([type=checkbox])]:min-h-[calc(var(--control-height)_-_2_*_var(--border-width))] [.asset-filters_&_input:not([type=checkbox])]:py-2 [.books-toolbar_&]:border-0 [.books-toolbar_&]:border-[transparent] [.books-toolbar_&]:border-solid"
                                    htmlFor="book-search"
                                >
                                    <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                        Tìm sách
                                    </span>
                                    <Search size={18} aria-hidden="true" />
                                    <Input
                                        id="book-search"
                                        name="q"
                                        type="search"
                                        defaultValue={query.q}
                                        maxLength={100}
                                        placeholder="Tìm theo tên sách"
                                    />
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel
                                    className="sort-field max-[760px]:min-w-0 [&_[data-slot=select-trigger]]:m-0 [&_[data-slot=select-trigger]]:min-w-[190px] [&_[data-slot=select-trigger]]:text-[length:var(--text-sm)] max-[760px]:[&_[data-slot=select-trigger]]:w-full max-[760px]:[&_[data-slot=select-trigger]]:min-w-0"
                                    htmlFor="book-sort"
                                >
                                    <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                        Sắp xếp sách
                                    </span>
                                    <FormSelect
                                        id="book-sort"
                                        name="sort"
                                        defaultValue={query.sort}
                                        submitOnChange
                                        options={[
                                            { value: '-updatedAt', label: 'Cập nhật gần nhất' },
                                            { value: 'updatedAt', label: 'Cập nhật cũ nhất' },
                                            { value: '-createdAt', label: 'Mới tạo gần nhất' },
                                            { value: 'createdAt', label: 'Tạo cũ nhất' },
                                            { value: 'title', label: 'Tên A–Z' },
                                            { value: '-title', label: 'Tên Z–A' },
                                        ]}
                                    />
                                </FieldLabel>
                            </Field>
                            <Button type="submit">Tìm sách</Button>
                        </FieldGroup>
                    </form>
                </>
            )}
            {listing.isPending && (
                <LoadingState layout={trash ? 'rows' : 'books'}>Đang tải sách…</LoadingState>
            )}
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
            {listing.isSuccess && (
                <>
                    <div
                        className="mx-0 mt-0 mb-3 flex list-summary justify-between gap-4 text-[length:12px] text-muted-foreground [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375"
                        aria-live="polite"
                    >
                        <span>
                            {listing.data.meta.total} cuốn sách
                            {query.q && !trash ? ` khớp “${query.q}”` : ''}
                        </span>
                        {listing.isFetching && <span>Đang cập nhật…</span>}
                    </div>
                    {listing.data.data.length === 0 ? (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <BookOpen size={38} aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>
                                    <h2>
                                        {trash
                                            ? 'Thùng rác đang trống'
                                            : query.q || query.status
                                              ? 'Không tìm thấy sách phù hợp'
                                              : 'Bắt đầu cuốn sách đầu tiên'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        {trash
                                            ? 'Những sách được chuyển vào thùng rác sẽ xuất hiện ở đây.'
                                            : query.q || query.status
                                              ? 'Thử tên khác hoặc xem tất cả trạng thái.'
                                              : 'Tạo sách trống hoặc nhập PDF, ảnh để bắt đầu cuốn sách của bạn.'}
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                {!trash &&
                                    (query.q || query.status ? (
                                        <ActionButton
                                            variant="plain"
                                            className="inline-flex min-h-11 items-center gap-2 border-0 border-[transparent] border-solid bg-[transparent] px-0 py-1 font-semibold text-button text-primary [&:hover:not(:disabled)]:underline [&:hover:not(:disabled)]:underline-offset-1 [.account-actions_&]:text-[length:12px] max-[700px]:[.account-actions_>_&]:min-w-[30px] max-[700px]:[.account-actions_>_&]:flex-[0_0_30px] max-[700px]:[.account-actions_>_&]:gap-0 max-[700px]:[.account-actions_>_&]:p-[5px] max-[700px]:[.account-actions_>_&]:text-[length:0] max-[700px]:[.account-actions_>_&_svg]:w-[18px] [.book-gallery_.book-actions_&]:min-h-7 [.book-gallery_.book-actions_&]:p-[3px]"
                                            type="button"
                                            onClick={() => setParams({})}
                                        >
                                            Xóa bộ lọc
                                        </ActionButton>
                                    ) : (
                                        <Button asChild>
                                            <Link to={createBookTo}>Tạo sách đầu tiên</Link>
                                        </Button>
                                    ))}
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <ul
                            className={
                                trash
                                    ? 'book-list m-0 list-none border-t-[1px] border-t-border p-0 [border-top-style:solid]'
                                    : 'book-list book-gallery m-0 mx-auto grid max-w-375 list-none grid-cols-[repeat(auto-fill,_minmax(240px,_1fr))] gap-[22px] border-0 border-[transparent] border-t-[1px] border-t-border border-solid p-0 [border-top-style:solid] max-[700px]:grid-cols-[repeat(auto-fill,_minmax(210px,_1fr))] max-[700px]:gap-[14px]'
                            }
                        >
                            {!trash && (
                                <li className="book-create-card min-h-[290px] rounded-[var(--radius-lg)] border border-input border-dashed [&:hover]:bg-selected [&_a]:flex [&_a]:size-full [&_a]:min-h-[290px] [&_a]:flex-col [&_a]:items-center [&_a]:justify-center [&_a]:gap-[14px] [&_a]:p-5 [&_a]:text-primary [&_a]:no-underline">
                                    <Link to={createBookTo}>
                                        <Plus size={32} aria-hidden="true" />
                                        <span>Tạo sách mới</span>
                                    </Link>
                                </li>
                            )}
                            {listing.data.data.map((book) => (
                                <Card asChild variant="collection" key={book.id}>
                                    <li
                                        className={
                                            trash
                                                ? 'book-row trash-row grid grid-cols-[52px_minmax(0,_1fr)_130px_44px] items-center gap-5 border-b-[1px] border-b-border px-1 py-6 [border-bottom-style:solid] max-[760px]:grid-cols-[42px_minmax(0,_1fr)_auto] max-[760px]:gap-[var(--space-3)_var(--space-4)] max-[760px]:px-0 max-[760px]:py-5 [&:hover]:bg-muted [.book-gallery_&]:grid [.book-gallery_&]:grid-cols-[minmax(0,_1fr)_auto] [.book-gallery_&]:items-start [.book-gallery_&]:gap-3 [.book-gallery_&]:overflow-hidden [.book-gallery_&]:rounded-[12px] [.book-gallery_&]:border [.book-gallery_&]:border-border [.book-gallery_&]:border-solid [.book-gallery_&]:bg-surface [.book-gallery_&]:p-3 [.book-row&]:grid-cols-[52px_minmax(0,_1fr)_130px_110px] max-[760px]:[.book-row&]:grid-cols-[42px_minmax(0,_1fr)_auto] max-[760px]:[.book-row&]:gap-[var(--space-3)_var(--space-4)] max-[760px]:[.book-row&]:px-0 max-[760px]:[.book-row&]:py-5'
                                                : 'book-row relative grid grid-cols-[52px_minmax(0,_1fr)_130px_44px] items-center gap-5 border-b-[1px] border-b-border px-1 py-6 [border-bottom-style:solid] max-[760px]:grid-cols-[42px_minmax(0,_1fr)_auto] max-[760px]:gap-[var(--space-3)_var(--space-4)] max-[760px]:px-0 max-[760px]:py-5 [&:hover]:bg-muted [.book-gallery_&]:grid [.book-gallery_&]:grid-cols-[minmax(0,_1fr)_auto] [.book-gallery_&]:items-start [.book-gallery_&]:gap-3 [.book-gallery_&]:overflow-hidden [.book-gallery_&]:rounded-[12px] [.book-gallery_&]:border [.book-gallery_&]:border-border [.book-gallery_&]:border-solid [.book-gallery_&]:bg-surface [.book-gallery_&]:p-3'
                                        }
                                        key={book.id}
                                    >
                                        {!trash && (
                                            <ActionButton
                                                variant="plain"
                                                className="absolute inset-0 size-full cursor-pointer rounded-[inherit]"
                                                aria-label={`Thao tác với sách: ${book.title}`}
                                                aria-haspopup="dialog"
                                                onClick={(event) =>
                                                    setActions({
                                                        book,
                                                        opener: event.currentTarget,
                                                    })
                                                }
                                            >
                                                <span className="sr-only">
                                                    Mở lựa chọn cho {book.title}
                                                </span>
                                            </ActionButton>
                                        )}
                                        <CardContent asChild className="p-0">
                                            <div className="book-cover motion-safe:[.book-gallery_.book-row:hover_&_img]:transform-[scale(1.025)] grid h-[66px] w-[50px] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-cover)] text-[var(--text-cover)] [place-items:center] max-[760px]:row-[span_2] max-[760px]:h-[54px] max-[760px]:w-10 [&_img]:size-full [&_img]:object-cover [.book-gallery_&]:col-[1_/_-1] [.book-gallery_&]:row-[1] [.book-gallery_&]:h-[190px] [.book-gallery_&]:w-full [.book-gallery_&]:rounded-[7px] [.book-gallery_&]:bg-[var(--bg-cover)] [.book-gallery_&_img]:object-contain motion-safe:[.book-gallery_&_img]:[transition:transform_180ms_ease-out]">
                                                {book.coverUrl ? (
                                                    <img
                                                        src={book.coverUrl}
                                                        alt=""
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <BookOpen size={27} aria-hidden="true" />
                                                )}
                                            </div>
                                        </CardContent>
                                        <CardHeader asChild className="gap-0 p-0">
                                            <div className="book-info [&_h2]:wrap-anywhere min-w-0 max-[760px]:col-[2_/_4] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h2]:leading-[1.4] max-[760px]:[&_h2]:text-[length:var(--text-md)] [&_h2_a:hover]:text-primary [&_h2_a:hover]:underline [&_h2_a]:text-[inherit] [&_h2_a]:no-underline [&_p]:m-0 [&_p]:text-[length:var(--text-xs)] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-xs)] [.book-gallery_&]:col-[1_/_-1] [.book-gallery_&]:row-[2] [.book-gallery_&]:px-[3px] [.book-gallery_&_h2]:mb-[5px] [.book-gallery_&_h2]:text-[length:15px] [.book-gallery_&_h2]:leading-[1.5] [.book-gallery_&_p]:text-[length:11px]">
                                                <CardTitle asChild>
                                                    <h2>{book.title}</h2>
                                                </CardTitle>
                                                <CardDescription asChild>
                                                    <p>
                                                        {book.pageCount} trang
                                                        <span aria-hidden="true"> · </span>
                                                        {trash && 'deletedAt' in book
                                                            ? 'Đã xóa '
                                                            : 'Cập nhật '}
                                                        {formatDate(
                                                            trash && 'deletedAt' in book
                                                                ? String(book.deletedAt)
                                                                : book.updatedAt,
                                                        )}
                                                    </p>
                                                </CardDescription>
                                            </div>
                                        </CardHeader>
                                        <div className="book-badges flex flex-col items-start gap-2 max-[760px]:col-[2] max-[760px]:flex-row max-[760px]:flex-wrap max-[760px]:items-center [.book-gallery_&]:col-[1] [.book-gallery_&]:row-[3] [.book-gallery_&]:justify-start [.book-gallery_&]:px-[3px]">
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
                                                <span className="moderation-label text-[length:var(--text-xs)] text-destructive">
                                                    Đã bị gỡ
                                                </span>
                                            )}
                                        </div>
                                        {trash ? (
                                            <ActionButton
                                                variant="plain"
                                                className="row-action inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-0 border-[transparent] border-solid bg-[transparent] px-0 py-1 font-semibold text-button text-primary max-[760px]:col-[3] max-[760px]:row-[2] max-[760px]:min-h-11 max-[760px]:text-[length:var(--text-xs)] [&:hover:not(:disabled)]:underline [&:hover:not(:disabled)]:underline-offset-1 [.account-actions_&]:text-[length:12px] max-[700px]:[.account-actions_>_&]:min-w-[30px] max-[700px]:[.account-actions_>_&]:flex-[0_0_30px] max-[700px]:[.account-actions_>_&]:gap-0 max-[700px]:[.account-actions_>_&]:p-[5px] max-[700px]:[.account-actions_>_&]:text-[length:0] max-[700px]:[.account-actions_>_&_svg]:w-[18px] [.book-gallery_&]:col-[2] [.book-gallery_&]:row-[3] [.book-gallery_&]:self-end [.book-gallery_.book-actions_&]:min-h-7 [.book-gallery_.book-actions_&]:p-[3px] [.book-row_&]:whitespace-nowrap"
                                                type="button"
                                                disabled={restore.isPending}
                                                aria-label={`Khôi phục ${book.title}`}
                                                onClick={() => {
                                                    void restoreBook(book.id);
                                                }}
                                            >
                                                <RotateCcw size={17} aria-hidden="true" />
                                                Khôi phục
                                            </ActionButton>
                                        ) : (
                                            <ActionButton
                                                variant="plain"
                                                className="danger-text relative row-action inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border-0 border-[transparent] border-solid bg-[transparent] px-0 py-1 font-semibold text-button text-destructive max-[760px]:col-[3] max-[760px]:row-[2] max-[760px]:min-h-11 max-[760px]:text-[length:var(--text-xs)] [&:hover:not(:disabled)]:underline [&:hover:not(:disabled)]:underline-offset-1 [.account-actions_&]:text-[length:12px] max-[700px]:[.account-actions_>_&]:min-w-[30px] max-[700px]:[.account-actions_>_&]:flex-[0_0_30px] max-[700px]:[.account-actions_>_&]:gap-0 max-[700px]:[.account-actions_>_&]:p-[5px] max-[700px]:[.account-actions_>_&]:text-[length:0] max-[700px]:[.account-actions_>_&_svg]:w-[18px] [.book-gallery_&]:col-[2] [.book-gallery_&]:row-[3] [.book-gallery_&]:self-end [.book-gallery_.book-actions_&]:min-h-7 [.book-gallery_.book-actions_&]:p-[3px] [.book-row_&]:whitespace-nowrap"
                                                type="button"
                                                aria-label={`Chuyển ${book.title} vào thùng rác`}
                                                onClick={() => {
                                                    remove.reset();
                                                    setDeleting(book);
                                                }}
                                            >
                                                <Trash2 size={17} aria-hidden="true" />
                                                <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                    Chuyển vào thùng rác
                                                </span>
                                            </ActionButton>
                                        )}
                                    </li>
                                </Card>
                            ))}
                        </ul>
                    )}
                    {meta && meta.totalPages > 1 && (
                        <PaginationRoot
                            className="pagination mt-8 flex items-center justify-end gap-5 text-[length:var(--text-sm)] tabular-nums max-[760px]:justify-between max-[760px]:gap-2 max-[760px]:text-[length:var(--text-xs)] max-[760px]:[&_.button]:p-3 max-[760px]:[&_.button]:text-[length:var(--text-xs)]"
                            aria-label="Phân trang sách"
                        >
                            <PaginationContent className="m-0 gap-3 p-0">
                                <PaginationItem>
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        disabled={query.page === 1 || listing.isFetching}
                                        onClick={() => change({ page: String(query.page - 1) })}
                                    >
                                        Trang trước
                                    </Button>
                                </PaginationItem>
                                <PaginationItem>
                                    <span>
                                        Trang {query.page} / {meta.totalPages}
                                    </span>
                                </PaginationItem>
                                <PaginationItem>
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        disabled={
                                            query.page >= meta.totalPages || listing.isFetching
                                        }
                                        onClick={() => change({ page: String(query.page + 1) })}
                                    >
                                        Trang sau
                                    </Button>
                                </PaginationItem>
                            </PaginationContent>
                        </PaginationRoot>
                    )}
                </>
            )}
            {actions && (
                <BookActionsDialog
                    key={actions.book.id}
                    book={actions.book}
                    opener={actions.opener}
                    onClose={() => setActions(null)}
                    onDelete={() => {
                        remove.reset();
                        setDeleting(actions.book);
                    }}
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
                                variant="danger"
                                type="button"
                                disabled={remove.isPending}
                                onClick={() => {
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
