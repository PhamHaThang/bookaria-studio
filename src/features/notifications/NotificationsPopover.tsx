import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, CheckCheck, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '@/features/auth/model/session';
import { errorMessage } from '@/shared/api/errors';
import type { MarkNotificationsReadBody } from '@/shared/contracts/api/me.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/primitives/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
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
}: {
    userId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preventCloseFocus?: boolean;
}) {
    const titleId = useId();
    const cache = useQueryClient();
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const lock = useRef(false);
    const query = { page, limit: 8, unread: filter === 'unread' ? ('true' as const) : undefined };
    const list = useQuery({
        queryKey: notificationKeys.list(userId, query),
        queryFn: ({ signal }) => notificationsApi.list(query, signal),
        enabled: open,
        staleTime: 0,
        refetchInterval: open ? 30000 : false,
        refetchIntervalInBackground: false,
    });
    const unread = useUnreadNotifications(userId, true);
    const count = unread.isSuccess ? unread.data.meta.total : undefined;
    const meta = list.data?.meta;
    useEffect(() => {
        if (list.isSuccess && !list.isFetching && meta && page > Math.max(1, meta.totalPages))
            setPage(Math.max(1, meta.totalPages));
    }, [list.isSuccess, list.isFetching, meta, page]);
    const mutation = useMutation({
        mutationFn: (body: MarkNotificationsReadBody) => notificationsApi.read(body),
        retry: false,
        onSuccess: async () => {
            if (auth.store.getState().user?.id !== userId) return;
            setMessage('Đã cập nhật trạng thái thông báo.');
            await cache.invalidateQueries({ queryKey: notificationKeys.all(userId) });
        },
    });
    async function mark(body: MarkNotificationsReadBody) {
        if (lock.current || auth.store.getState().user?.id !== userId) return;
        lock.current = true;
        setError(null);
        setMessage(null);
        try {
            await mutation.mutateAsync(body);
        } catch (cause) {
            if (auth.store.getState().user?.id === userId)
                setError(
                    `${errorMessage(cause)} Tải lại thông báo để kiểm tra trạng thái trước khi thử lại.`,
                );
        } finally {
            lock.current = false;
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
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={count === undefined ? 'Thông báo' : `Thông báo, ${count} chưa đọc`}
                >
                    <Bell aria-hidden="true" />
                    {count !== undefined && count > 0 && (
                        <Badge
                            aria-hidden="true"
                            className="pointer-events-none absolute -top-1 -right-1"
                        >
                            {count > 99 ? '99+' : count}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="w-104 max-w-[calc(100vw-32px)] gap-0 overflow-hidden p-0"
                aria-labelledby={titleId}
                onCloseAutoFocus={(event) => {
                    if (preventCloseFocus) event.preventDefault();
                }}
            >
                <div className="flex items-center justify-between gap-4 px-4 pt-3 pb-2">
                    <h2 id={titleId} className="m-0 text-xl">
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
                <div className="flex items-center justify-between gap-2 px-4 pb-3">
                    <ToggleGroup
                        type="single"
                        aria-label="Lọc thông báo"
                        value={filter}
                        disabled={mutation.isPending}
                        onValueChange={(value) => {
                            if (value) {
                                setFilter(value);
                                setPage(1);
                                setError(null);
                                setMessage(null);
                            }
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
                        <CheckCheck data-icon="inline-start" aria-hidden="true" />
                        Đọc tất cả
                    </Button>
                </div>
                <Separator />
                <ScrollArea
                    className="h-[min(420px,calc(var(--radix-popover-content-available-height)-180px))] min-h-36 overscroll-contain"
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
                    {list.isError && (
                        <div className="p-4">
                            <Alert tone="danger">{errorMessage(list.error)}</Alert>
                            <Button type="button" variant="ghost" size="sm" onClick={reload}>
                                Thử lại
                            </Button>
                        </div>
                    )}
                    {list.isPending && (
                        <p
                            role="status"
                            className="flex items-center justify-center gap-2 p-6 text-muted-foreground"
                        >
                            <Spinner aria-hidden="true" />
                            Đang tải thông báo…
                        </p>
                    )}
                    {list.data &&
                        (list.data.data.length ? (
                            <ul
                                className="m-0 list-none divide-y divide-border p-0"
                                aria-label="Danh sách thông báo"
                            >
                                {list.data.data.map((item) => {
                                    const target = notificationTarget(item.link);
                                    return (
                                        <li
                                            key={item.id}
                                            className={cn('px-4 py-4', !item.readAt && 'bg-muted')}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="wrap-anywhere m-0 min-w-0 text-sm leading-relaxed">
                                                    {item.title}
                                                </h3>
                                                {!item.readAt && (
                                                    <Badge className="shrink-0">Chưa đọc</Badge>
                                                )}
                                            </div>
                                            {item.body && (
                                                <p className="wrap-anywhere mt-2 mb-0 whitespace-pre-wrap text-muted-foreground text-sm">
                                                    {item.body}
                                                </p>
                                            )}
                                            <time
                                                dateTime={item.createdAt}
                                                className="mt-2 block text-muted-foreground text-xs"
                                            >
                                                {dateFormat.format(new Date(item.createdAt))}
                                            </time>
                                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                                {target && (
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link
                                                            to={target}
                                                            onClick={() => onOpenChange(false)}
                                                        >
                                                            Xem nội dung
                                                            <ArrowUpRight
                                                                data-icon="inline-end"
                                                                aria-hidden="true"
                                                            />
                                                        </Link>
                                                    </Button>
                                                )}
                                                {!item.readAt && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={mutation.isPending}
                                                        aria-label={`Đánh dấu đã đọc: ${item.title}`}
                                                        onClick={() =>
                                                            void mark({ ids: [item.id] })
                                                        }
                                                    >
                                                        <Check
                                                            data-icon="inline-start"
                                                            aria-hidden="true"
                                                        />
                                                        Đã đọc
                                                    </Button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <Empty className="border-0 px-5 py-8">
                                <EmptyHeader>
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
                        ))}
                </ScrollArea>
                {meta && meta.totalPages > 1 && (
                    <>
                        <Separator />
                        <nav
                            aria-label="Phân trang thông báo"
                            className="flex items-center justify-between gap-3 px-4 py-2"
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Trang thông báo trước"
                                disabled={page <= 1 || list.isFetching || mutation.isPending}
                                onClick={() => setPage((value) => value - 1)}
                            >
                                <ArrowLeft aria-hidden="true" />
                            </Button>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                Trang {page} / {meta.totalPages}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Trang thông báo sau"
                                disabled={
                                    page >= meta.totalPages || list.isFetching || mutation.isPending
                                }
                                onClick={() => setPage((value) => value + 1)}
                            >
                                <ArrowRight aria-hidden="true" />
                            </Button>
                        </nav>
                    </>
                )}
                <p role="status" className="sr-only">
                    {message}
                </p>
            </PopoverContent>
        </Popover>
    );
}
