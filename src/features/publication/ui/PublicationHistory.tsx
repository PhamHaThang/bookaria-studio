import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { apiClient } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/primitives/badge';
import { ScrollArea } from '@/shared/ui/primitives/scroll-area';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { createPublicationApi } from '../api/publication-api';

const api = createPublicationApi(apiClient);
const fileSize = (n: number) =>
    n < 1024 * 1024
        ? `${Math.ceil(n / 1024)} KB`
        : `${(n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;

export function PublicationHistory({
    userId,
    bookId,
    currentVersionNo,
    busy,
    onUnpublish,
}: {
    userId: string;
    bookId: string;
    currentVersionNo?: number;
    busy: boolean;
    onUnpublish: () => void;
}) {
    const versions = useInfiniteQuery({
        queryKey: ['publication', userId, bookId, 'versions', 'infinite'],
        initialPageParam: undefined as number | undefined,
        queryFn: ({ pageParam, signal }) =>
            api.versions(bookId, { limit: 5, before: pageParam }, signal),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        retry: false,
    });
    const items = versions.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <section aria-label="Lịch sử xuất bản" className="flex min-h-0 flex-col gap-3">
            <div className="flex shrink-0 flex-col">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-base">Lịch sử xuất bản</h3>
                    <Button
                        variant="destructive-ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={busy}
                        onClick={onUnpublish}
                    >
                        Ngừng chia sẻ
                    </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                    Liên kết sách luôn mở phiên bản đang phát hành.
                </p>
            </div>
            {!versions.data ? (
                versions.isPending ? (
                    <div role="status" className="flex items-center gap-2">
                        <Spinner />
                        Đang tải phiên bản…
                    </div>
                ) : (
                    <Alert tone="danger">
                        Không tải được lịch sử.{' '}
                        <Button variant="link" onClick={() => void versions.refetch()}>
                            Thử lại
                        </Button>
                    </Alert>
                )
            ) : items.length === 0 ? (
                <p className="py-4 text-muted-foreground text-sm">Chưa có phiên bản xuất bản.</p>
            ) : (
                <>
                    <ScrollArea className="flex max-h-80 min-h-0 flex-col [&_[data-slot=scroll-area-viewport]]:h-auto [&_[data-slot=scroll-area-viewport]]:min-h-0 [&_[data-slot=scroll-area-viewport]]:flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain">
                        <ul
                            aria-label="Các phiên bản đã xuất bản"
                            aria-busy={versions.isFetchingNextPage}
                            className="m-0 flex list-none flex-col p-0 pr-3"
                        >
                            {items.map((v) => (
                                <li
                                    key={v.id}
                                    className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                                >
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                Phiên bản {v.versionNo}
                                            </span>
                                            {v.versionNo === currentVersionNo && (
                                                <Badge variant="outline">Đang phát hành</Badge>
                                            )}
                                        </div>
                                        <time
                                            className="text-muted-foreground text-sm"
                                            dateTime={v.publishedAt}
                                        >
                                            {new Date(v.publishedAt).toLocaleString('vi-VN')}
                                        </time>
                                    </div>
                                    <span className="shrink-0 text-muted-foreground text-sm">
                                        {v.pageCount} trang | {fileSize(v.totalBytes)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </ScrollArea>
                    <div className="flex shrink-0 items-center justify-between gap-4 pt-3">
                        <p role="status" className="text-muted-foreground text-xs">
                            {versions.isFetchNextPageError
                                ? 'Chưa tải được phiên bản tiếp theo.'
                                : `Đã hiển thị ${items.length} phiên bản${versions.hasNextPage ? '' : ' (tất cả)'}.`}
                        </p>
                        {versions.hasNextPage && (
                            <Button
                                variant="default"
                                size="sm"
                                disabled={versions.isFetching}
                                onClick={() => {
                                    if (!versions.isFetching) void versions.fetchNextPage();
                                }}
                            >
                                {versions.isFetchingNextPage ? (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                ) : (
                                    <ChevronDown data-icon="inline-start" />
                                )}
                                {versions.isFetchNextPageError
                                    ? 'Thử lại'
                                    : versions.isFetchingNextPage
                                      ? 'Đang tải…'
                                      : 'Tải thêm'}
                            </Button>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
