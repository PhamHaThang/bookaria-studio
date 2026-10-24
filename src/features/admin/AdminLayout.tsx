import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { errorMessage } from '../../shared/api/errors';
import { Feedback } from '../../shared/ui/Feedback';
import { useAuth } from '../auth';
import { adminApi, adminKeys } from './index';
import { AdminReload } from './ui';

function AdminGate({ actor }: { actor: string }) {
    const gate = useQuery({
        queryKey: adminKeys.dashboard(actor),
        queryFn: ({ signal }) => adminApi.dashboard(signal),
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
    });
    if (gate.isPending) return <p role="status">Đang kiểm tra quyền quản trị…</p>;
    if (gate.isError)
        return (
            <>
                <h1>Chưa mở được khu vực quản trị</h1>
                <Feedback error={errorMessage(gate.error)} />
                <AdminReload retry={() => void gate.refetch()} busy={gate.isFetching} />
                <p>
                    <Link to="/books">Về sách của tôi</Link>
                </p>
            </>
        );
    return (
        <div className="admin-area min-w-0">
            <nav
                className="admin-nav mb-6 flex flex-wrap gap-[var(--space-2)_var(--space-5)] border-b-[1px] border-b-border py-3 [border-bottom-style:solid] max-[640px]:gap-[var(--space-2)_var(--space-4)] [&_a.active]:font-semibold [&_a.active]:[text-decoration-thickness:2px] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center"
                aria-label="Điều hướng quản trị"
            >
                <NavLink end to="/admin">
                    Tổng quan
                </NavLink>
                <NavLink to="/admin/users">Người dùng</NavLink>
                <NavLink to="/admin/moderation">Báo cáo chờ xử lý</NavLink>
                <NavLink to="/admin/books">Tra cứu sách</NavLink>
                <NavLink to="/admin/library">Thư viện dùng chung</NavLink>
                <NavLink to="/admin/categories">Danh mục</NavLink>
                <NavLink to="/admin/markers">Bộ marker</NavLink>
                <NavLink to="/admin/jobs">Tác vụ</NavLink>
                <NavLink to="/admin/audit-logs">Nhật ký quản trị</NavLink>
            </nav>
            <Outlet />
        </div>
    );
}
export function AdminLayout() {
    const { user } = useAuth();
    if (user?.role !== 'ADMIN')
        return (
            <>
                <h1>Bạn không có quyền quản trị</h1>
                <p>Khu vực này dành cho quản trị viên.</p>
                <Link to="/books">Về sách của tôi</Link>
            </>
        );
    return <AdminGate key={user.id} actor={user.id} />;
}
