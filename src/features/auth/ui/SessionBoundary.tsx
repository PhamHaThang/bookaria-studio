import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { Feedback } from '../../../shared/ui/Feedback';
import { protectedLogin, requireEmailVerification } from '../model/dialog';
import { auth, useAuth } from '../model/session';

export function SessionBoundary() {
    const { status, message } = useAuth();
    useEffect(() => {
        void auth.restore();
    }, []);
    if (status === 'loading')
        return (
            <main id="main">
                <LoadingScreen fullScreen message="Đang kiểm tra phiên đăng nhập…" />
            </main>
        );
    if (status === 'error')
        return (
            <main className="session-state mx-auto my-[12vh] max-w-130 p-8 text-center">
                <h1>Chưa kết nối được</h1>
                <Feedback error={message} />
                <Button
                    fullWidth
                    type="button"
                    onClick={() => {
                        void auth.restore();
                    }}
                >
                    Thử kết nối lại
                </Button>
                <Link to="/">Về trang chủ</Link>
            </main>
        );
    return <Outlet />;
}
export function RequireSession() {
    const { user } = useAuth();
    const location = useLocation();
    return user ? <Outlet /> : <Navigate to={protectedLogin(location)} replace />;
}

export function RequireVerifiedEmail() {
    const { user } = useAuth();
    const location = useLocation();
    if (user && !user.emailVerified)
        return <Navigate to={requireEmailVerification(location)} replace />;
    return <Outlet />;
}
