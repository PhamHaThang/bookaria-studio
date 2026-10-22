import { lazy, Suspense } from 'react';
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
import { StudioLayout } from './StudioLayout';

const BooksPage = lazy(() =>
    import('../pages/BooksPage').then((module) => ({ default: module.BooksPage })),
);
const BookCreatePage = lazy(() =>
    import('../pages/BookCreatePage').then((module) => ({ default: module.BookCreatePage })),
);
const BookDetailPage = lazy(() =>
    import('../pages/BookDetailPage').then((module) => ({ default: module.BookDetailPage })),
);
const ProfilePage = lazy(() =>
    import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const StyleGuidePage = import.meta.env.DEV
    ? lazy(() =>
          import('../pages/StyleGuidePage').then((module) => ({ default: module.StyleGuidePage })),
      )
    : null;

export function AppRouter() {
    return (
        <>
            <a className="skip-link" href="#main">
                Đến nội dung chính
            </a>
            <Routes>
                {StyleGuidePage && (
                    <Route
                        path="/style-guide"
                        element={
                            <Suspense
                                fallback={
                                    <main id="main" className="session-state" role="status">
                                        Đang mở bộ giao diện…
                                    </main>
                                }
                            >
                                <StyleGuidePage />
                            </Suspense>
                        }
                    />
                )}
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
                        <Route element={<StudioLayout />}>
                            <Route path="/books" element={<BooksPage key="active" />} />
                            <Route path="/books/trash" element={<BooksPage key="trash" trash />} />
                            <Route path="/books/new" element={<BookCreatePage />} />
                            <Route path="/books/:bookId" element={<BookDetailPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                        </Route>
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
