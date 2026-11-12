import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '@/features/auth/model/session';
import { errorMessage } from '@/shared/api/errors';
import type { MarkNotificationsReadBody } from '@/shared/contracts/api/me.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Badge as NotificationIndicator } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';
import { ScrollArea } from '@/shared/ui/primitives/scroll-area';
import { Separator } from '@/shared/ui/primitives/separator';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { notificationTarget } from './api';
import { notificationKeys, notificationsApi, useUnreadNotifications } from './index';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export function NotificationsPopover({
    userId,
    open,
    onOpenChange,
    preventCloseFocus = false,
    triggerVariant = 'ghost',
}: {
    userId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preventCloseFocus?: boolean;
    triggerVariant?: 'ghost' | 'utility';
}) {
    const titleId = useId();
    const cache = useQueryClient();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
    const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
    const lock = useRef(false);
    const query = { limit: 12, unread: filter === 'unread' ? ('true' as const) : undefined };
    const list = useInfiniteQuery({
        queryKey: notificationKeys.infinite(userId, query),
        queryFn: ({ pageParam, signal }) =>
            notificationsApi.list({ ...query, page: pageParam }, signal),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.data.length > 0 && last.meta.page < last.meta.totalPages
                ? last.meta.page + 1
                : undefined,
        enabled: open,
        staleTime: 0,
        // Avoid repeatedly reloading every accumulated page while browsing older notifications.
        refetchInterval: (current) =>
            open && (current.state.data?.pages.length ?? 1) === 1 ? 30000 : false,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
    });
    const items = [
        ...new Map(
            list.data?.pages.flatMap((page) => page.data).map((item) => [item.id, item]),
        ).values(),
    ];
    const unread = useUnreadNotifications(userId, true);
    const count = unread.isSuccess ? unread.data.meta.total : undefined;
    const mutation = useMutation({
        mutationFn: (body: MarkNotificationsReadBody) => notificationsApi.read(body),
        retry: false,
        onSuccess: async () => {
            if (auth.store.getState().user?.id !== userId) return;
            setMessage('Đã cập nhật trạng thái thông báo.');
            await cache.invalidateQueries({ queryKey: notificationKeys.all(userId) });
        },
    });

    useEffect(() => {
        if (open) viewport?.scrollTo({ top: 0 });
    }, [open, viewport]);
    useEffect(() => {
        if (
            !open ||
            !viewport ||
            !sentinel ||
            !list.hasNextPage ||
            list.isFetching ||
            list.isFetchNextPageError ||
            mutation.isPending
        )
            return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) void list.fetchNextPage({ cancelRefetch: false });
            },
            { root: viewport, rootMargin: '0px 0px 120px 0px' },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [
        open,
        viewport,
        sentinel,
        list.hasNextPage,
        list.isFetching,
        list.isFetchNextPageError,
        list.fetchNextPage,
        mutation.isPending,
    ]);

    async function mark(body: MarkNotificationsReadBody) {
        if (lock.current || auth.store.getState().user?.id !== userId) return false;
        lock.current = true;
        setError(null);
        setMessage(null);
        try {
            await mutation.mutateAsync(body);
            return auth.store.getState().user?.id === userId;
        } catch (cause) {
            if (auth.store.getState().user?.id === userId)
                setError(
                    `${errorMessage(cause)} Tải lại thông báo để kiểm tra trạng thái trước khi thử lại.`,
                );
            return false;
        } finally {
            lock.current = false;
        }
    }
    async function activate(id: string, readAt: string | null, target: string | null) {
        if (lock.current) return;
        if (!readAt && !(await mark({ ids: [id] }))) return;
        if (auth.store.getState().user?.id !== userId) return;
        if (target) {
            onOpenChange(false);
            navigate(target);
        }
    }
    function reload() {
        setError(null);
        setMessage(null);
        void list.refetch();
        void unread.refetch();
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant={triggerVariant}
                    size="icon"
                    className={cn(
                        'relative',
                        triggerVariant === 'ghost' && 'data-[state=open]:bg-hover',
                    )}
                    aria-label={count === undefined ? 'Thông báo' : `Thông báo, ${count} chưa đọc`}
                >
                    <Bell aria-hidden="true" />
                    {count !== undefined && count > 0 && (
                        <NotificationIndicator
                            variant="dot"
                            aria-hidden="true"
                            className="pointer-events-none absolute top-0 right-0"
                        />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="max-h-(--radix-popover-content-available-height) w-104 max-w-[calc(100vw-32px)] gap-0 overflow-hidden p-0"
                aria-labelledby={titleId}
                onCloseAutoFocus={(event) => {
                    if (preventCloseFocus) event.preventDefault();
                }}
            >
                <div className="flex shrink-0 items-center justify-between gap-4 px-4 pt-3 pb-2">
                    <h2 id={titleId} className="m-0 font-semibold text-lg">
                        Thông báo
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Đóng thông báo"
                        onClick={() => onOpenChange(false)}
                    >
                        <X aria-hidden="true" />
                    </Button>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-3">
                    <ToggleGroup
                        type="single"
                        aria-label="Lọc thông báo"
                        value={filter}
                        disabled={mutation.isPending}
                        onValueChange={(value) => {
                            if (!value) return;
                            setFilter(value);
                            setError(null);
                            setMessage(null);
                        }}
                    >
                        <ToggleGroupItem value="all">Tất cả</ToggleGroupItem>
                        <ToggleGroupItem value="unread">Chưa đọc</ToggleGroupItem>
                    </ToggleGroup>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Đánh dấu tất cả đã đọc"
                        disabled={mutation.isPending || count === undefined || count === 0}
                        onClick={() => void mark({ all: true })}
                    >
                        {mutation.isPending && mutation.variables && 'all' in mutation.variables ? (
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                        ) : (
                            <CheckCheck data-icon="inline-start" aria-hidden="true" />
                        )}
                        Đọc tất cả
                    </Button>
                </div>
                <Separator />
                <ScrollArea
                    key={filter}
                    viewportProps={{ ref: setViewport }}
                    className="h-[min(440px,calc(var(--radix-popover-content-available-height)-128px))] min-h-0 overscroll-contain"
                    aria-busy={list.isFetching || mutation.isPending}
                >
                    {error && (
                        <div className="p-4">
                            <Alert tone="danger">{error}</Alert>
                            <Button type="button" variant="ghost" size="sm" onClick={reload}>
                                Tải lại thông báo
                            </Button>
                        </div>
                    )}
                    {list.isError && !list.isFetchNextPageError && (
                        <div className="p-4">
                            <Alert tone="danger">{errorMessage(list.error)}</Alert>
                            <Button type="button" variant="ghost" size="sm" onClick={reload}>
                                Thử lại
                            </Button>
                        </div>
                    )}
                    {list.isPending && (
                        <LoadingState layout="notifications">Đang tải thông báo…</LoadingState>
                    )}
                    {items.length > 0 && (
                        <>
                            <ul
                                className="m-0 list-none divide-y divide-border p-0"
                                aria-label="Danh sách thông báo"
                            >
                                {items.map((item) => {
                                    const target = notificationTarget(item.link);
                                    const marking =
                                        mutation.isPending &&
                                        mutation.variables &&
                                        'ids' in mutation.variables &&
                                        mutation.variables.ids.includes(item.id);
                                    const rowClassName = cn(
                                        'block w-full px-4 py-3.5 text-left text-foreground outline-none',
                                        !item.readAt && 'bg-surface',
                                        (target || !item.readAt) &&
                                            'transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none',
                                        mutation.isPending && 'cursor-wait',
                                    );
                                    const content = (
                                        <span className="flex items-start gap-3">
                                            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                                <span
                                                    className={cn(
                                                        'wrap-anywhere text-sm leading-snug',
                                                        !item.readAt
                                                            ? 'font-semibold'
                                                            : 'font-medium',
                                                    )}
                                                >
                                                    {item.title}
                                                </span>
                                                {item.body && (
                                                    <span className="wrap-anywhere whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                                                        {item.body}
                                                    </span>
                                                )}
                                                <time
                                                    dateTime={item.createdAt}
                                                    className="text-muted-foreground text-xs"
                                                >
                                                    {dateFormat.format(new Date(item.createdAt))}
                                                </time>
                                            </span>
                                            {marking ? (
                                                <Spinner
                                                    aria-label="Đang cập nhật thông báo"
                                                    className="mt-1 size-3 shrink-0"
                                                />
                                            ) : (
                                                !item.readAt && (
                                                    <span className="mt-1.5 shrink-0">
                                                        <NotificationIndicator
                                                            variant="dot"
                                                            className="size-2 p-0"
                                                            aria-hidden="true"
                                                        />
                                                        <span className="sr-only">Chưa đọc</span>
                                                    </span>
                                                )
                                            )}
                                        </span>
                                    );
                                    return (
                                        <li key={item.id}>
                                            {target ? (
                                                <Link
                                                    to={target}
                                                    className={rowClassName}
                                                    aria-disabled={mutation.isPending || undefined}
                                                    aria-busy={Boolean(marking)}
                                                    onClick={(event) => {
                                                        if (
                                                            event.button !== 0 ||
                                                            event.metaKey ||
                                                            event.ctrlKey ||
                                                            event.shiftKey ||
                                                            event.altKey
                                                        )
                                                            return;
                                                        event.preventDefault();
                                                        void activate(item.id, item.readAt, target);
                                                    }}
                                                >
                                                    {content}
                                                </Link>
                                            ) : !item.readAt ? (
                                                <button
                                                    type="button"
                                                    className={rowClassName}
                                                    disabled={mutation.isPending}
                                                    aria-label={`Đánh dấu đã đọc: ${item.title}`}
                                                    aria-busy={Boolean(marking)}
                                                    onClick={() =>
                                                        void activate(item.id, item.readAt, null)
                                                    }
                                                >
                                                    {content}
                                                </button>
                                            ) : (
                                                <div className={rowClassName}>{content}</div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            <div
                                ref={setSentinel}
                                className="flex min-h-12 flex-col items-center justify-center gap-2 px-4 py-3"
                                role="status"
                                aria-live="polite"
                            >
                                {list.isFetchNextPageError ? (
                                    <>
                                        <span className="text-muted-foreground text-xs">
                                            Chưa tải được thông báo tiếp theo.
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={list.isFetchingNextPage}
                                            onClick={() =>
                                                void list.fetchNextPage({ cancelRefetch: false })
                                            }
                                        >
                                            Thử tải lại
                                        </Button>
                                    </>
                                ) : list.isFetchingNextPage ? (
                                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                                        <Spinner className="size-3.5" aria-hidden="true" />
                                        Đang tải thêm thông báo…
                                    </span>
                                ) : !list.hasNextPage ? (
                                    <span className="text-muted-foreground text-xs">
                                        Đã xem hết thông báo
                                    </span>
                                ) : (
                                    <span className="sr-only">
                                        Cuộn xuống để xem thêm thông báo
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                    {list.isSuccess && items.length === 0 && (
                        <Empty className="border-0 px-5 py-10">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <Bell aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>
                                    <h3 className="m-0 text-base">
                                        {filter === 'unread'
                                            ? 'Bạn đã đọc hết thông báo'
                                            : 'Chưa có thông báo'}
                                    </h3>
                                </EmptyTitle>
                                <EmptyDescription>
                                    {filter === 'unread'
                                        ? 'Thông báo mới sẽ xuất hiện ở đây.'
                                        : 'Kết quả xử lý sách và cập nhật tài khoản sẽ xuất hiện ở đây.'}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </ScrollArea>
                <p role="status" className="sr-only">
                    {message}
                </p>
            </PopoverContent>
        </Popover>
    );
}
