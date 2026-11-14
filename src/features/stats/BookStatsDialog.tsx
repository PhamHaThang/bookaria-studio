import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { bookKeys, booksApi } from '@/features/books';
import { errorMessage } from '@/shared/api/errors';
import { StatsRangeSchema } from '@/shared/contracts/api/books.schema';
import { IdSchema } from '@/shared/contracts/common.schema';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { FilterBar } from '@/shared/ui/FilterBar';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { rangeLabels, type readStatsRange, statsApi, statsKey } from '.';

const ranges = Object.entries(rangeLabels).map(([value, label]) => ({ value, label }));
const StatsContent = lazy(() =>
    import('./StatsContent').then((module) => ({ default: module.StatsContent })),
);

export function BookStatsDialog({
    bookId,
    initialRange = '30d',
    opener,
    onClose,
}: {
    bookId: string;
    initialRange?: ReturnType<typeof readStatsRange>;
    opener?: HTMLElement | null;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const [range, setRange] = useState(initialRange);
    const heading = useRef<HTMLHeadingElement>(null);
    const valid = IdSchema.safeParse(bookId).success;
    const detail = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    const stats = useQuery({
        queryKey: statsKey(user?.id || '', bookId, range),
        queryFn: ({ signal }) => statsApi.book(bookId, { range }, signal),
        enabled: valid && Boolean(user),
        staleTime: 0,
    });
    const pending = detail.isPending || stats.isPending;
    const failed = detail.isError || stats.isError;
    const refreshing = detail.isFetching || stats.isFetching;
    const book = detail.data;
    function refresh() {
        void stats.refetch();
        void detail.refetch();
    }
    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="flex h-[min(840px,calc(100dvh-32px))] max-w-[min(1160px,calc(100vw-32px))] flex-col overflow-hidden p-0"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    heading.current?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                }}
            >
                <DialogHeader className="shrink-0 flex-row flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 pt-5 pr-14 pb-4 sm:px-6 sm:pr-14">
                    <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
                        {book ? (
                            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                                <BookCoverImage url={book.coverUrl} />
                            </div>
                        ) : valid && detail.isPending ? (
                            <Skeleton className="h-16 w-12 shrink-0" />
                        ) : null}
                        <div className="min-w-0">
                            <DialogTitle
                                ref={heading}
                                tabIndex={-1}
                                className="wrap-anywhere outline-none"
                            >
                                {valid ? (book?.title ?? 'Thống kê sách') : 'Không tìm thấy sách'}
                            </DialogTitle>
                            <DialogDescription className="m-0 mt-1">
                                {book
                                    ? `Thống kê sách — ${book.pageCount} trang`
                                    : 'Chi tiết thống kê'}
                            </DialogDescription>
                        </div>
                    </div>
                    {valid && (
                        <div className="flex flex-wrap items-center gap-2">
                            <FilterBar
                                label="Khoảng thời gian"
                                variant="pill"
                                value={range}
                                options={ranges}
                                onValueChange={(value) => setRange(StatsRangeSchema.parse(value))}
                            />
                            <Button
                                variant="utility"
                                size="icon"
                                disabled={refreshing}
                                aria-label="Cập nhật số liệu"
                                title="Cập nhật số liệu"
                                onClick={refresh}
                            >
                                <RefreshCw aria-hidden="true" />
                            </Button>
                        </div>
                    )}
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6 sm:pb-6">
                    {valid && failed && (
                        <div className="flex flex-col items-start gap-4 py-6">
                            <Feedback error={errorMessage(detail.error || stats.error)} />
                            <Button variant="outline" disabled={refreshing} onClick={refresh}>
                                Thử tải lại
                            </Button>
                        </div>
                    )}
                    {valid && !failed && pending && (
                        <LoadingState layout="stats">Đang tải thống kê…</LoadingState>
                    )}
                    {valid && !failed && !pending && stats.data && (
                        <Suspense
                            fallback={
                                <LoadingState layout="stats">Đang tải thống kê…</LoadingState>
                            }
                        >
                            <StatsContent stats={stats.data} />
                        </Suspense>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
