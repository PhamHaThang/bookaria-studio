import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { auth, useAuth } from '../features/auth';
import {
    notificationKeys,
    notificationsApi,
    notificationTypeLabels,
    readNotificationSearch,
    useUnreadNotifications,
} from '../features/notifications';
import { notificationTarget } from '../features/notifications/api';
import { errorMessage } from '../shared/api/errors';
import type { MarkNotificationsReadBody } from '../shared/contracts/api/me.schema';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';
import { Pagination } from '../shared/ui/Pagination';

const timestamp = (value: string) =>
    new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
    );

function NotificationsContent({ userId }: { userId: string }) {
    const [params, setParams] = useSearchParams();
    const query = readNotificationSearch(params),
        cache = useQueryClient();
    const list = useQuery({
        queryKey: notificationKeys.list(userId, query),
        queryFn: ({ signal }) => notificationsApi.list(query, signal),
        staleTime: 0,
    });
    const unread = useUnreadNotifications(userId);
    const [message, setMessage] = useState<string | null>(null),
        [error, setError] = useState<string | null>(null);
    const lock = useRef(false);
    const mutation = useMutation({
        mutationFn: (body: MarkNotificationsReadBody) => notificationsApi.read(body),
        retry: false,
    });
    const meta = list.data?.meta;
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
    async function mark(body: MarkNotificationsReadBody) {
        if (lock.current) return;
        lock.current = true;
        setMessage(null);
        setError(null);
        try {
            await mutation.mutateAsync(body);
            if (auth.store.getState().user?.id !== userId) return;
            setMessage('Đã cập nhật trạng thái thông báo.');
            await cache.invalidateQueries({ queryKey: notificationKeys.all(userId) });
        } catch (cause) {
            if (auth.store.getState().user?.id === userId)
                setError(
                    `${errorMessage(cause)} Tải lại danh sách để kiểm tra trạng thái trước khi thử lại.`,
                );
        } finally {
            lock.current = false;
        }
    }
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thông báo</h1>
                    <p>Tác vụ xử lý sách và các cập nhật tài khoản của bạn.</p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={
                        mutation.isPending || !unread.isSuccess || unread.data.meta.total === 0
                    }
                    onClick={() => void mark({ all: true })}
                >
                    Đánh dấu tất cả đã đọc
                </Button>
            </div>
            <Feedback error={error} success={message} />
            <fieldset
                className={
                    'status-tabs mx-0 mt-0 mb-6 flex gap-7 border-b-[1px] border-b-border [border-bottom-style:solid] max-[760px]:gap-5 max-[760px]:overflow-x-auto max-[760px]:text-[length:var(--text-xs)] [&_button.selected]:border-b-primary [&_button.selected]:font-semibold [&_button.selected]:text-primary-hover [&_button]:min-h-11 [&_button]:whitespace-nowrap [&_button]:border-[transparent] [&_button]:border-t-[0] [&_button]:border-r-[0] [&_button]:border-b-[2px] [&_button]:border-l-[0] [&_button]:border-solid [&_button]:bg-[transparent] [&_button]:px-0 [&_button]:py-3 [&_button]:text-[length:12px] [&_button]:text-muted-foreground max-[540px]:[.page-heading:has(+_&[aria-label="Nguồn_tài_nguyên"])]:flex-wrap [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375'
                }
                aria-label="Lọc thông báo"
            >
                {[
                    { label: 'Tất cả', value: undefined },
                    { label: 'Chưa đọc', value: 'true' },
                ].map((filter) => (
                    <button
                        key={filter.label}
                        type="button"
                        className={query.unread === filter.value ? 'selected' : ''}
                        aria-pressed={query.unread === filter.value}
                        onClick={() => setParams(filter.value ? { unread: filter.value } : {})}
                    >
                        {filter.label}
                    </button>
                ))}
            </fieldset>
            <div className="notification-summary mb-4 flex flex-wrap items-center justify-between gap-3">
                <p role="status">
                    {unread.isSuccess
                        ? `${unread.data.meta.total} thông báo chưa đọc`
                        : unread.isPending
                          ? 'Đang cập nhật số chưa đọc…'
                          : 'Chưa cập nhật được số chưa đọc'}
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={list.isFetching || unread.isFetching}
                    onClick={() => {
                        void list.refetch();
                        void unread.refetch();
                    }}
                >
                    Tải lại danh sách
                </Button>
            </div>
            {list.isPending && <p role="status">Đang tải thông báo…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    {list.data.data.length ? (
                        <ul className="notification-list [&_h2]:wrap-anywhere m-0 list-none p-0 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-6 [&_>_li]:[border-bottom-style:solid] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)]">
                            {list.data.data.map((item) => {
                                const target = notificationTarget(item.link);
                                return (
                                    <li
                                        key={item.id}
                                        className={
                                            item.readAt
                                                ? 'notification-read'
                                                : 'notification-unread'
                                        }
                                    >
                                        <div className="notification-item-content min-w-0">
                                            <div className="notification-item-labels mb-3 flex flex-wrap items-center gap-3 text-[length:var(--text-xs)] text-muted-foreground">
                                                <Badge tone={item.readAt ? 'neutral' : 'info'}>
                                                    {item.readAt ? 'Đã đọc' : 'Chưa đọc'}
                                                </Badge>
                                                <span>{notificationTypeLabels[item.type]}</span>
                                                <time dateTime={item.createdAt}>
                                                    {timestamp(item.createdAt)}
                                                </time>
                                            </div>
                                            <h2>{item.title}</h2>
                                            {item.body && (
                                                <p className="notification-body wrap-anywhere max-w-[75ch] [white-space:pre-wrap]">
                                                    {item.body}
                                                </p>
                                            )}
                                            <div className="notification-item-actions mt-4 flex flex-wrap items-center gap-3">
                                                {target && <Link to={target}>Xem nội dung</Link>}
                                                {!item.readAt && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        disabled={mutation.isPending}
                                                        onClick={() =>
                                                            void mark({ ids: [item.id] })
                                                        }
                                                    >
                                                        Đánh dấu đã đọc
                                                        <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                            : {item.title}
                                                        </span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>
                                        {query.unread
                                            ? 'Bạn đã đọc hết thông báo'
                                            : 'Chưa có thông báo'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        {query.unread
                                            ? 'Các thông báo mới sẽ xuất hiện ở đây.'
                                            : 'Khi có kết quả xử lý sách hoặc cập nhật tài khoản, bạn sẽ thấy ở đây.'}
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <Pagination
                        page={query.page}
                        totalPages={list.data.meta.totalPages}
                        label="Phân trang thông báo"
                        onPage={(page) =>
                            setParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set('page', String(page));
                                return next;
                            })
                        }
                    />
                </>
            )}
        </>
    );
}
export function NotificationsPage() {
    const { user } = useAuth();
    return user ? <NotificationsContent key={user.id} userId={user.id} /> : null;
}
