import { Link, Outlet } from 'react-router-dom';
import { BookariaLogo } from '../../../shared/ui/BookariaLogo';

export function AuthLayout() {
    return (
        <div className="auth-page">
            <header className="brand-row">
                <Link className="brand" to="/login">
                    <BookariaLogo />
                    <span>Studio</span>
                </Link>
            </header>
            <main id="main" className="auth-panel">
                <Outlet />
            </main>
            <footer className="auth-footer">
                Không gian sáng tạo sách tương tác AR.{' '}
                <Link to="/explore">Khám phá thư viện công khai</Link>
            </footer>
        </div>
    );
}
