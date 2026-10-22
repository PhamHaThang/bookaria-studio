import { BookOpen, FolderOpen, Library, LogOut, Palette, Trash2, UserRound } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { auth, useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Avatar } from '../shared/ui/Avatar';
import { Feedback } from '../shared/ui/Feedback';

export function StudioLayout() {
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
    return (
        <div className="studio-shell">
            <header className="studio-topbar">
                <Link className="brand" to="/books">
                    <BookOpen size={25} aria-hidden="true" />
                    Bookaria<span>Studio</span>
                </Link>
                <div className="account-actions">
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
                    <NavLink to="/books" end>
                        <Library size={19} aria-hidden="true" />
                        Sách của tôi
                    </NavLink>
                    <NavLink to="/books/trash">
                        <Trash2 size={19} aria-hidden="true" />
                        Thùng rác
                    </NavLink>
                    <NavLink to="/assets">
                        <FolderOpen size={19} aria-hidden="true" />
                        Tài nguyên
                    </NavLink>
                    <NavLink to="/profile">
                        <UserRound size={19} aria-hidden="true" />
                        Hồ sơ
                    </NavLink>
                    {import.meta.env.DEV && (
                        <NavLink to="/style-guide">
                            <Palette size={19} aria-hidden="true" />
                            Giao diện mẫu
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
