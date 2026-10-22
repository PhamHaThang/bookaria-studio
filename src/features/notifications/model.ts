import { PaginationQuerySchema } from '../../shared/contracts/common.schema';

export const notificationKeys = {
    all: (userId: string) => ['notifications', userId] as const,
    list: (userId: string, query: object) => ['notifications', userId, 'list', query] as const,
    count: (userId: string) => ['notifications', userId, 'unread-count'] as const,
};
export function readNotificationSearch(params: URLSearchParams) {
    const page = PaginationQuerySchema.shape.page.safeParse(params.get('page') || undefined);
    return {
        page: page.success ? page.data : 1,
        limit: 12,
        unread: params.get('unread') === 'true' ? ('true' as const) : undefined,
    };
}
export const notificationTypeLabels = {
    JOB_SUCCEEDED: 'Tác vụ hoàn tất',
    JOB_FAILED: 'Tác vụ thất bại',
    BOOK_TAKEN_DOWN: 'Sách bị gỡ',
    BOOK_REINSTATED: 'Sách được khôi phục',
    ACCOUNT_LOCKED: 'Tài khoản bị khóa',
    ACCOUNT_UNLOCKED: 'Tài khoản được mở khóa',
};
