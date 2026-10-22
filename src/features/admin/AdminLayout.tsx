import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { errorMessage } from '../../shared/api/errors';
import { Feedback } from '../../shared/ui/Feedback';
import { useAuth } from '../auth';
import { adminApi, adminKeys } from './index';
import { AdminReload } from './ui';
import './admin.css';

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
        <div className="admin-area">
            <nav className="admin-nav" aria-label="Điều hướng quản trị">
                <NavLink end to="/admin">
                    Tổng quan
                </NavLink>
                <NavLink to="/admin/users">Người dùng</NavLink>
                <NavLink to="/admin/moderation">Báo cáo chờ xử lý</NavLink>
                <NavLink to="/admin/books">Tra cứu sách</NavLink>
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
