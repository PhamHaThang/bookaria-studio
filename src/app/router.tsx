import { Link, Navigate, Route, Routes } from 'react-router-dom';
import {
    AuthForm,
    AuthLayout,
    CheckEmail,
    GuestOnly,
    RequireSession,
    SessionBoundary,
    VerifyEmail,
} from '../features/auth';
import { WorkspacePage } from '../pages/WorkspacePage';

export function AppRouter() {
    return (
        <>
            <a className="skip-link" href="#main">
                Đến nội dung chính
            </a>
            <Routes>
                <Route element={<SessionBoundary />}>
                    <Route path="/" element={<Navigate to="/books" replace />} />
                    <Route element={<AuthLayout />}>
                        <Route element={<GuestOnly />}>
                            <Route path="/login" element={<AuthForm key="login" mode="login" />} />
                            <Route
                                path="/register"
                                element={<AuthForm key="register" mode="register" />}
                            />
                        </Route>
                        <Route
                            path="/forgot-password"
                            element={<AuthForm key="forgot" mode="forgot" />}
                        />
                        <Route
                            path="/reset-password"
                            element={<AuthForm key="reset" mode="reset" />}
                        />
                        <Route path="/verify-email" element={<VerifyEmail />} />
                        <Route element={<RequireSession />}>
                            <Route path="/check-email" element={<CheckEmail />} />
                        </Route>
                    </Route>
                    <Route element={<RequireSession />}>
                        <Route path="/books" element={<WorkspacePage />} />
                    </Route>
                    <Route
                        path="*"
                        element={
                            <main id="main" className="session-state">
                                <h1>Không tìm thấy trang</h1>
                                <Link to="/books">Về Studio</Link>
                            </main>
                        }
                    />
                </Route>
            </Routes>
        </>
    );
}
