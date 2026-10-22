import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
    adminApi,
    adminDate,
    adminKeys,
    bytesLabel,
    readAdminUsersSearch,
    roleLabel,
    statusLabel,
} from '../features/admin';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

export function AdminUsersPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams(),
        query = readAdminUsersSearch(params);
    const list = useQuery({
        queryKey: adminKeys.users(user?.id || '', query),
        queryFn: ({ signal }) => adminApi.users(query, signal),
        retry: false,
    });
    return (
        <>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Người dùng</h1>
                    <p>Tìm tài khoản, quản lý quyền và dung lượng.</p>
                </div>
                <Link className="button compact" to="/admin/users/new">
                    Tạo người dùng
                </Link>
            </div>
            <form
                className="admin-filters"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget),
                        next = new URLSearchParams();
                    for (const [key, value] of data)
                        if (String(value).trim()) next.set(key, String(value).trim());
                    setParams(next);
                }}
            >
                <label htmlFor="admin-user-q">
                    Tên hoặc email
                    <input
                        type="search"
                        name="q"
                        id="admin-user-q"
                        maxLength={100}
                        defaultValue={query.q}
                    />
                </label>
                <label htmlFor="admin-user-role">
                    Vai trò
                    <select name="role" id="admin-user-role" defaultValue={query.role || ''}>
                        <option value="">Tất cả</option>
                        <option value="AUTHOR">Tác giả</option>
                        <option value="ADMIN">Quản trị viên</option>
                    </select>
                </label>
                <label htmlFor="admin-user-status">
                    Trạng thái
                    <select name="status" id="admin-user-status" defaultValue={query.status || ''}>
                        <option value="">Tất cả</option>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="LOCKED">Đã khóa</option>
                    </select>
                </label>
                <label htmlFor="admin-user-sort">
                    Sắp xếp
                    <select name="sort" id="admin-user-sort" defaultValue={query.sort}>
                        <option value="-createdAt">Mới nhất</option>
                        <option value="createdAt">Cũ nhất</option>
                        <option value="displayName">Tên A–Z</option>
                        <option value="-displayName">Tên Z–A</option>
                        <option value="email">Email A–Z</option>
                        <option value="-email">Email Z–A</option>
                        <option value="updatedAt">Cập nhật cũ nhất</option>
                        <option value="-updatedAt">Cập nhật mới nhất</option>
                        <option value="storageUsedBytes">Dung lượng tăng dần</option>
                        <option value="-storageUsedBytes">Dung lượng giảm dần</option>
                    </select>
                </label>
                <button className="button compact" type="submit">
                    Áp dụng bộ lọc
                </button>
                <Link to="/admin/users">Xóa bộ lọc</Link>
            </form>
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            {list.isPending && <p role="status">Đang tải người dùng…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} người dùng</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows admin-users">
                            {list.data.data.map((item) => (
                                <li key={item.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/users/${item.id}`}>
                                                {item.displayName}
                                            </Link>
                                        </h2>
                                        <p>{item.email}</p>
                                        <div className="admin-metadata">
                                            <Badge
                                                tone={item.role === 'ADMIN' ? 'info' : 'neutral'}
                                            >
                                                {roleLabel[item.role]}
                                            </Badge>
                                            <Badge
                                                tone={
                                                    item.status === 'LOCKED' ? 'danger' : 'success'
                                                }
                                            >
                                                {statusLabel[item.status]}
                                            </Badge>
                                            <span>{item.bookCount} sách</span>
                                        </div>
                                    </div>
                                    <div className="admin-row-detail">
                                        <span>
                                            {bytesLabel(item.storage.usedBytes)} /{' '}
                                            {bytesLabel(item.storage.quotaBytes)}
                                        </span>
                                        <span>Tạo: {adminDate(item.createdAt)}</span>
                                        <Link to={`/admin/users/${item.id}`}>
                                            Xem tài khoản
                                            <span className="sr-only"> {item.email}</span>
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có tài khoản phù hợp</h2>
                            <p>Thử tìm tên hoặc email khác, hoặc xóa bộ lọc.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
