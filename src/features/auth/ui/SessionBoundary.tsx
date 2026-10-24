import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { auth, useAuth } from '../model/session';

export function SessionBoundary() {
    const { status, message } = useAuth();
    useEffect(() => {
        void auth.restore();
    }, []);
    if (status === 'loading')
        return (
            <main
                className="session-state mx-auto my-[12vh] max-w-130 p-8 text-center"
                role="status"
            >
                Đang kiểm tra phiên đăng nhập…
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
            </main>
        );
    return <Outlet />;
}
export function RequireSession() {
    const { user } = useAuth();
    const location = useLocation();
    return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
export function GuestOnly() {
    const { user } = useAuth();
    return user ? <Navigate to="/books" replace /> : <Outlet />;
}
