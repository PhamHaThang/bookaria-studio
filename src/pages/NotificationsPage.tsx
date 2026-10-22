import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
            <div className="page-heading insights-heading">
                <div>
                    <h1>Thông báo</h1>
                    <p>Tác vụ xử lý sách và các cập nhật tài khoản của bạn.</p>
                </div>
                <button
                    type="button"
                    className="button secondary compact"
                    disabled={
                        mutation.isPending || !unread.isSuccess || unread.data.meta.total === 0
                    }
                    onClick={() => void mark({ all: true })}
                >
                    Đánh dấu tất cả đã đọc
                </button>
            </div>
            <Feedback error={error} success={message} />
            <fieldset className="status-tabs" aria-label="Lọc thông báo">
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
            <div className="notification-summary">
                <p role="status">
                    {unread.isSuccess
                        ? `${unread.data.meta.total} thông báo chưa đọc`
                        : unread.isPending
                          ? 'Đang cập nhật số chưa đọc…'
                          : 'Chưa cập nhật được số chưa đọc'}
                </p>
                <button
                    type="button"
                    className="button secondary compact"
                    disabled={list.isFetching || unread.isFetching}
                    onClick={() => {
                        void list.refetch();
                        void unread.refetch();
                    }}
                >
                    Tải lại danh sách
                </button>
            </div>
            {list.isPending && <p role="status">Đang tải thông báo…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    {list.data.data.length ? (
                        <ul className="notification-list">
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
                                        <div className="notification-item-content">
                                            <div className="notification-item-labels">
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
                                                <p className="notification-body">{item.body}</p>
                                            )}
                                            <div className="notification-item-actions">
                                                {target && <Link to={target}>Xem nội dung</Link>}
                                                {!item.readAt && (
                                                    <button
                                                        type="button"
                                                        className="button secondary compact"
                                                        disabled={mutation.isPending}
                                                        onClick={() =>
                                                            void mark({ ids: [item.id] })
                                                        }
                                                    >
                                                        Đánh dấu đã đọc
                                                        <span className="sr-only">
                                                            : {item.title}
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>
                                {query.unread ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo'}
                            </h2>
                            <p>
                                {query.unread
                                    ? 'Các thông báo mới sẽ xuất hiện ở đây.'
                                    : 'Khi có kết quả xử lý sách hoặc cập nhật tài khoản, bạn sẽ thấy ở đây.'}
                            </p>
                        </section>
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
