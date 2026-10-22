import {
    AdminBooksQuerySchema,
    type AdminUpdateUserBody,
    AdminUsersQuerySchema,
} from '../../shared/contracts/api/admin.schema';
import { PaginationQuerySchema } from '../../shared/contracts/common.schema';
import type { AdminUser } from '../../shared/contracts/dto.schema';

const page = (params: URLSearchParams) => {
    const parsed = PaginationQuerySchema.shape.page.safeParse(params.get('page') || '1');
    return parsed.success ? parsed.data : 1;
};
export function readAdminUsersSearch(params: URLSearchParams) {
    const role = AdminUsersQuerySchema.shape.role.safeParse(params.get('role') || undefined);
    const status = AdminUsersQuerySchema.shape.status.safeParse(params.get('status') || undefined);
    const sort = AdminUsersQuerySchema.shape.sort.safeParse(params.get('sort') || '-createdAt');
    return AdminUsersQuerySchema.parse({
        page: page(params),
        limit: 12,
        q: (params.get('q') || '').trim().slice(0, 100) || undefined,
        role: role.success ? role.data : undefined,
        status: status.success ? status.data : undefined,
        sort: sort.success ? sort.data : '-createdAt',
    });
}
export function readAdminBooksSearch(params: URLSearchParams) {
    const visibility = AdminBooksQuerySchema.shape.visibility.safeParse(
        params.get('visibility') || 'PUBLIC',
    );
    return AdminBooksQuerySchema.parse({
        page: page(params),
        limit: 12,
        q: (params.get('q') || '').trim().slice(0, 100) || undefined,
        visibility: visibility.success ? visibility.data : 'PUBLIC',
    });
}
export const readAdminQueueSearch = (params: URLSearchParams) => ({
    page: page(params),
    limit: 12,
});
export const adminKeys = {
    all: (user: string) => ['admin', user] as const,
    dashboard: (user: string) => ['admin', user, 'dashboard'] as const,
    users: (user: string, query: unknown) => ['admin', user, 'users', query] as const,
    user: (user: string, id: string) => ['admin', user, 'user', id] as const,
    books: (user: string, query: unknown) => ['admin', user, 'books', query] as const,
    book: (user: string, id: string) => ['admin', user, 'book', id] as const,
    queue: (user: string, query: unknown) => ['admin', user, 'moderation', query] as const,
};
export function userChanges(
    current: AdminUser,
    next: { role: AdminUser['role']; status: AdminUser['status']; quota: string; reason: string },
): AdminUpdateUserBody {
    return {
        ...(next.role !== current.role ? { role: next.role } : {}),
        ...(next.status !== current.status ? { status: next.status } : {}),
        ...(Number(next.quota) !== current.storage.quotaBytes
            ? { storageQuotaBytes: Number(next.quota) }
            : {}),
        ...(next.reason.trim() ? { reason: next.reason.trim() } : {}),
    };
}
export const roleLabel = { AUTHOR: 'Tác giả', ADMIN: 'Quản trị viên' };
export const statusLabel = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa' };
export const visibilityLabel = {
    PUBLIC: 'Công khai',
    UNLISTED: 'Qua liên kết',
    PRIVATE: 'Riêng tư',
};
export const reportLabel = {
    INAPPROPRIATE: 'Nội dung không phù hợp',
    COPYRIGHT: 'Bản quyền',
    OTHER: 'Lý do khác',
};
export const reportStatusLabel = {
    OPEN: 'Chờ xử lý',
    DISMISSED: 'Đã bỏ qua',
    ACTIONED: 'Đã xử lý',
};
export const auditLabel = {
    CREATE_USER: 'Tạo tài khoản',
    LOCK_USER: 'Khóa tài khoản',
    UNLOCK_USER: 'Mở khóa tài khoản',
    CHANGE_ROLE: 'Đổi vai trò',
    SET_QUOTA: 'Đổi hạn mức',
    TAKE_DOWN_BOOK: 'Gỡ sách',
    REINSTATE_BOOK: 'Khôi phục sách',
    RESOLVE_REPORT: 'Xử lý báo cáo',
    DISMISS_REPORT: 'Bỏ qua báo cáo',
    CREATE_LIBRARY_ASSET: 'Thêm tài nguyên dùng chung',
    UPDATE_LIBRARY_ASSET: 'Sửa tài nguyên dùng chung',
    DELETE_ASSET: 'Xóa tài nguyên',
    MANAGE_CATEGORY: 'Quản lý danh mục',
    MANAGE_MARKER: 'Quản lý marker',
    RETRY_JOB: 'Chạy lại tác vụ',
};
export const adminDate = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
              new Date(value),
          )
        : 'Chưa có';
export const bytesLabel = (value: number) =>
    `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value / 1024 ** 2)} MiB`;
