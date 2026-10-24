import {
    Bell,
    BookOpen,
    ChartColumn,
    FolderOpen,
    Library,
    LogOut,
    Palette,
    Plus,
    ShieldCheck,
    Trash2,
    UserRound,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { auth, useAuth } from '../features/auth';
import { NotificationLink } from '../features/notifications/NotificationLink';
import { errorMessage } from '../shared/api/errors';
import { Avatar } from '../shared/ui/Avatar';
import { Feedback } from '../shared/ui/Feedback';
import './insights.css';

export function StudioLayout() {
    const location = useLocation();
    const editing = /^\/books\/[^/]+\/pages\/[^/]+$/.test(location.pathname);
    const { user, signingOut } = useAuth();
    const [error, setError] = useState<string | null>(null);
    async function logout() {
        setError(null);
        try {
            await auth.logout();
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    if (editing)
        return (
            <main id="main" className="studio-editor-root">
                <Suspense fallback={<p role="status">Đang mở editor…</p>}>
                    <Outlet />
                </Suspense>
            </main>
        );
    return (
        <div className={editing ? 'studio-editing studio-shell' : 'studio-shell'}>
            <header className="studio-topbar">
                <Link className="brand" to="/books">
                    <BookOpen size={25} aria-hidden="true" />
                    Bookaria<span>Studio</span>
                </Link>
                <div className="account-actions">
                    <NotificationLink userId={user?.id || ''} />
                    <Link className="account-link" to="/profile">
                        <Avatar url={user?.avatarUrl || null} />
                        <span>{user?.displayName}</span>
                    </Link>
                    <button
                        className="text-button"
                        type="button"
                        disabled={signingOut}
                        onClick={logout}
                    >
                        <LogOut size={17} aria-hidden="true" />
                        {signingOut ? 'Đang thoát…' : 'Đăng xuất'}
                    </button>
                </div>
            </header>
            <div className="studio-body">
                <nav className="studio-nav" aria-label="Điều hướng Studio">
                    <Link className="nav-create" to="/books/new" title="Tạo sách mới">
                        <Plus size={19} />
                        <span>Tạo sách mới</span>
                    </Link>
                    <NavLink title="Thư viện công khai" to="/explore">
                        <BookOpen size={19} aria-hidden="true" />
                        <span>Thư viện công khai</span>
                    </NavLink>
                    <NavLink title="Sách của tôi" to="/books" end>
                        <Library size={19} aria-hidden="true" />
                        <span>Sách của tôi</span>
                    </NavLink>
                    <NavLink title="Thùng rác" to="/books/trash">
                        <Trash2 size={19} aria-hidden="true" />
                        <span>Thùng rác</span>
                    </NavLink>
                    <NavLink title="Tài nguyên" to="/assets">
                        <FolderOpen size={19} aria-hidden="true" />
                        <span>Tài nguyên</span>
                    </NavLink>
                    <NavLink title="Thống kê" to="/stats">
                        <ChartColumn size={19} aria-hidden="true" />
                        <span>Thống kê</span>
                    </NavLink>
                    <NavLink title="Thông báo" to="/notifications">
                        <Bell size={19} aria-hidden="true" />
                        <span>Thông báo</span>
                    </NavLink>
                    <NavLink title="Hồ sơ" to="/profile">
                        <UserRound size={19} aria-hidden="true" />
                        <span>Hồ sơ</span>
                    </NavLink>
                    {user?.role === 'ADMIN' && (
                        <NavLink title="Quản trị" to="/admin">
                            <ShieldCheck size={19} aria-hidden="true" />
                            <span>Quản trị</span>
                        </NavLink>
                    )}
                    {import.meta.env.DEV && (
                        <NavLink title="Giao diện mẫu" to="/style-guide">
                            <Palette size={19} aria-hidden="true" />
                            <span>Giao diện mẫu</span>
                        </NavLink>
                    )}
                </nav>
                <main id="main" className="studio-main">
                    <Feedback error={error} />
                    {!user?.emailVerified && (
                        <div className="email-notice">
                            <span>Xác minh email để có thể xuất bản sách.</span>
                            <Link to="/check-email">Xác minh email</Link>
                        </div>
                    )}
                    <Suspense fallback={<p role="status">Đang mở trang…</p>}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}
