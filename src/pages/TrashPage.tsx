import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, ArrowRight, Clock3, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { bookKeys, booksApi, readBookSearch, updateBookSearch } from '@/features/books';
import { BookStatusBadge } from '@/features/books/ui/BookStatusBadge';
import { BookStatusFilter } from '@/features/books/ui/BookStatusFilter';
import { errorMessage } from '@/shared/api/errors';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Pagination } from '@/shared/ui/Pagination';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Spinner } from '@/shared/ui/primitives/spinner';

export function TrashPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const { page, limit, status } = readBookSearch(params);
    const cache = useQueryClient();
    const [notice, setNotice] = useState<string | null>(null);
    const listing = useQuery({
        queryKey: bookKeys.list(user?.id || '', 'trash', { page, limit, status }),
        queryFn: ({ signal }) => booksApi.trash({ page, limit, status }, signal),
        enabled: Boolean(user),
    });
    const restore = useMutation({
        mutationFn: (id: string) => booksApi.restore(id),
        onMutate: () => setNotice(null),
        onSuccess: async (book) => {
            setNotice(`Đã khôi phục “${book.title}” vào Sách của tôi.`);
            await cache.invalidateQueries({ queryKey: bookKeys.all });
        },
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (!listing.isFetching && meta && page > Math.max(1, meta.totalPages)) {
            setParams(
                (current) =>
                    updateBookSearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
        }
    }, [listing.isFetching, meta, page, setParams]);

    return (
        <>
            <header className="mb-7 sm:mb-9">
                <h1 className="m-0 font-semibold text-3xl sm:text-4xl">Thùng rác</h1>
                <p className="m-0 mt-2 text-muted-foreground text-sm">
                    Khôi phục sách đã xóa để tiếp tục chỉnh sửa.
                </p>
            </header>
            <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
                <Clock3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="m-0">Bạn có thể khôi phục sách trong vòng 30 ngày kể từ khi xóa.</p>
            </div>
            <Feedback
                success={notice}
                error={restore.error ? errorMessage(restore.error) : null}
                errorMode="toast"
            />
            <BookStatusFilter
                status={status}
                total={meta?.total}
                onChange={(status) => setParams((current) => updateBookSearch(current, { status }))}
            />
            {listing.isPending && <LoadingState layout="rows">Đang tải thùng rác…</LoadingState>}
            {listing.isError && (
                <div className="flex flex-col items-start gap-3">
                    <Feedback error={errorMessage(listing.error)} />
                    <Button variant="outline" onClick={() => void listing.refetch()}>
                        Thử tải lại
                    </Button>
                </div>
            )}
            {listing.isSuccess && listing.data.data.length > 0 && (
                <>
                    <ul className="m-0 grid list-none gap-2 p-0" aria-label="Sách đã xóa">
                        {listing.data.data.map((book) => {
                            const restoring = restore.isPending && restore.variables === book.id;
                            return (
                                <li
                                    key={book.id}
                                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:gap-x-5"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-border">
                                            <BookCoverImage url={book.coverUrl} />
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="wrap-anywhere m-0 font-semibold text-sm">
                                                {book.title}
                                            </h2>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                                                <span>{book.pageCount} trang</span>
                                                <BookStatusBadge status={book.status} />
                                                {book.takenDown && (
                                                    <Badge tone="danger">Đã bị gỡ</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="order-last col-span-2 m-0 text-muted-foreground text-xs md:order-0 md:col-span-1">
                                        <span className="mr-1 md:mr-0 md:block">Đã xóa</span>
                                        <time className="tabular-nums" dateTime={book.deletedAt}>
                                            {formatDate(book.deletedAt)}
                                        </time>
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-w-36"
                                        disabled={restore.isPending}
                                        aria-busy={restoring || undefined}
                                        aria-label={`Khôi phục ${book.title}`}
                                        onClick={() => restore.mutate(book.id)}
                                    >
                                        {restoring ? (
                                            <Spinner data-icon="inline-start" aria-hidden="true" />
                                        ) : (
                                            <ArchiveRestore
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {restoring ? 'Đang khôi phục…' : 'Khôi phục'}
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                    <Pagination
                        page={page}
                        totalPages={listing.data.meta.totalPages}
                        busy={listing.isFetching || restore.isPending}
                        label="Phân trang thùng rác"
                        onPage={(nextPage) =>
                            setParams((current) =>
                                updateBookSearch(current, { page: String(nextPage) }),
                            )
                        }
                    />
                </>
            )}
            {listing.isSuccess && meta?.total === 0 && (
                <Empty className="py-14">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Trash2 aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                            <h2>
                                {status ? 'Chưa có sách ở trạng thái này' : 'Thùng rác đang trống'}
                            </h2>
                        </EmptyTitle>
                        <EmptyDescription>
                            {status
                                ? 'Đổi bộ lọc để xem các sách đã xóa khác.'
                                : 'Sách bạn xóa sẽ xuất hiện ở đây.'}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button variant="outline" asChild>
                            <Link to={status ? '/books/trash' : '/books'}>
                                {status ? 'Xóa bộ lọc' : 'Về Sách của tôi'}
                                {!status && (
                                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                                )}
                            </Link>
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </>
    );
}
