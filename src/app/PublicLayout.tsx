import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import '../features/discovery/public.css';
import { BookariaLogo } from '../shared/ui/BookariaLogo';

export function PublicLayout() {
    return (
        <div className="public-shell">
            <header className="studio-topbar public-topbar">
                <Link className="brand" to="/explore">
                    <BookariaLogo />
                </Link>
                <nav aria-label="Điều hướng công khai">
                    <NavLink to="/explore">Thư viện</NavLink>
                    <Link to="/books">Studio</Link>
                    <Link to="/login">Đăng nhập</Link>
                </nav>
            </header>
            <main id="main" className="public-main">
                <Suspense fallback={<p role="status">Đang mở trang…</p>}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
