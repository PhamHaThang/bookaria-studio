import { lazy, Suspense } from 'react';
import {
    createBrowserRouter,
    createRoutesFromElements,
    Link,
    Navigate,
    Outlet,
    Route,
    RouterProvider,
} from 'react-router-dom';
import { AdminLayout } from '../features/admin/AdminLayout';
import {
    AuthForm,
    AuthLayout,
    CheckEmail,
    GuestOnly,
    RequireSession,
    SessionBoundary,
    VerifyEmail,
} from '../features/auth';
import { PublicLayout } from './PublicLayout';
import { StudioLayout } from './StudioLayout';

const AdminJobsPage = lazy(() =>
    import('../pages/AdminJobsPage').then((module) => ({ default: module.AdminJobsPage })),
);
const AdminAuditPage = lazy(() =>
    import('../pages/AdminAuditPage').then((module) => ({ default: module.AdminAuditPage })),
);
const AdminAuditDetailPage = lazy(() =>
    import('../pages/AdminAuditDetailPage').then((module) => ({
        default: module.AdminAuditDetailPage,
    })),
);

const AdminDashboardPage = lazy(() =>
    import('../pages/AdminDashboardPage').then((module) => ({
        default: module.AdminDashboardPage,
    })),
);
const AdminUsersPage = lazy(() =>
    import('../pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminUserCreatePage = lazy(() =>
    import('../pages/AdminUserCreatePage').then((module) => ({
        default: module.AdminUserCreatePage,
    })),
);
const AdminUserDetailPage = lazy(() =>
    import('../pages/AdminUserDetailPage').then((module) => ({
        default: module.AdminUserDetailPage,
    })),
);
const AdminBooksPage = lazy(() =>
    import('../pages/AdminBooksPage').then((module) => ({ default: module.AdminBooksPage })),
);
const AdminModerationPage = lazy(() =>
    import('../pages/AdminBooksPage').then((module) => ({ default: module.AdminModerationPage })),
);
const AdminBookDetailPage = lazy(() =>
    import('../pages/AdminBookDetailPage').then((module) => ({
        default: module.AdminBookDetailPage,
    })),
);

const AdminLibraryPage = lazy(() =>
    import('../pages/AdminLibraryPage').then((module) => ({ default: module.AdminLibraryPage })),
);
const AdminLibraryNewPage = lazy(() =>
    import('../pages/AdminLibraryNewPage').then((module) => ({
        default: module.AdminLibraryNewPage,
    })),
);
const AdminLibraryDetailPage = lazy(() =>
    import('../pages/AdminLibraryDetailPage').then((module) => ({
        default: module.AdminLibraryDetailPage,
    })),
);
const AdminCategoriesPage = lazy(() =>
    import('../pages/AdminCategoriesPage').then((module) => ({
        default: module.AdminCategoriesPage,
    })),
);
const AdminCategoryEditPage = lazy(() =>
    import('../pages/AdminCategoriesPage').then((module) => ({
        default: module.AdminCategoryEditPage,
    })),
);
const AdminMarkersPage = lazy(() =>
    import('../pages/AdminMarkersPage').then((module) => ({ default: module.AdminMarkersPage })),
);
const AdminMarkerCreatePage = lazy(() =>
    import('../pages/AdminMarkersPage').then((module) => ({
        default: module.AdminMarkerCreatePage,
    })),
);

const ExplorePage = lazy(() =>
    import('../pages/ExplorePage').then((module) => ({ default: module.ExplorePage })),
);
const AuthorPage = lazy(() =>
    import('../pages/AuthorPage').then((module) => ({ default: module.AuthorPage })),
);

const StatsBooksPage = lazy(() =>
    import('../pages/StatsBooksPage').then((module) => ({ default: module.StatsBooksPage })),
);
const BookStatsPage = lazy(() =>
    import('../pages/BookStatsPage').then((module) => ({ default: module.BookStatsPage })),
);
const NotificationsPage = lazy(() =>
    import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);

const BooksPage = lazy(() =>
    import('../pages/BooksPage').then((module) => ({ default: module.BooksPage })),
);
const BookCreatePage = lazy(() =>
    import('../pages/BookCreatePage').then((module) => ({ default: module.BookCreatePage })),
);
const BookDetailPage = lazy(() =>
    import('../pages/BookDetailPage').then((module) => ({ default: module.BookDetailPage })),
);
const PageDetailPage = lazy(() =>
    import('../pages/PageDetailPage').then((module) => ({ default: module.PageDetailPage })),
);
const ProfilePage = lazy(() =>
    import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const AssetsPage = lazy(() =>
    import('../pages/AssetsPage').then((module) => ({ default: module.AssetsPage })),
);
const AssetUploadPage = lazy(() =>
    import('../pages/AssetUploadPage').then((module) => ({ default: module.AssetUploadPage })),
);
const AssetDetailPage = lazy(() =>
    import('../pages/AssetDetailPage').then((module) => ({ default: module.AssetDetailPage })),
);
const StyleGuidePage = import.meta.env.DEV
    ? lazy(() =>
          import('../pages/StyleGuidePage').then((module) => ({ default: module.StyleGuidePage })),
      )
    : null;

function RouterLayout() {
    return (
        <>
            <a
                className="skip-link fixed top-[-100px] left-4 z-var(--layer-skip-link) bg-surface p-3 [&:focus]:top-3"
                href="#main"
            >
                Đến nội dung chính
            </a>
            <Outlet />
        </>
    );
}

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<RouterLayout />}>
            <Route element={<PublicLayout />}>
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/authors/:authorId" element={<AuthorPage />} />
            </Route>
            {StyleGuidePage && (
                <Route
                    path="/style-guide"
                    element={
                        <Suspense
                            fallback={
                                <main
                                    id="main"
                                    className="session-state mx-auto my-[12vh] max-w-130 p-8 text-center"
                                    role="status"
                                >
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
                    <Route path="/reset-password" element={<AuthForm key="reset" mode="reset" />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route element={<RequireSession />}>
                        <Route path="/check-email" element={<CheckEmail />} />
                    </Route>
                </Route>
                <Route element={<RequireSession />}>
                    <Route element={<StudioLayout />}>
                        <Route path="/admin" element={<AdminLayout />}>
                            <Route index element={<AdminDashboardPage />} />
                            <Route path="jobs" element={<AdminJobsPage />} />
                            <Route path="audit-logs" element={<AdminAuditPage />} />
                            <Route path="audit-logs/:logId" element={<AdminAuditDetailPage />} />
                            <Route path="library" element={<AdminLibraryPage />} />
                            <Route path="library/new" element={<AdminLibraryNewPage />} />
                            <Route path="library/:assetId" element={<AdminLibraryDetailPage />} />
                            <Route path="categories" element={<AdminCategoriesPage />} />
                            <Route path="categories/new" element={<AdminCategoryEditPage />} />
                            <Route
                                path="categories/:categoryId"
                                element={<AdminCategoryEditPage />}
                            />
                            <Route path="markers" element={<AdminMarkersPage />} />
                            <Route path="markers/new" element={<AdminMarkerCreatePage />} />
                            <Route path="users" element={<AdminUsersPage />} />
                            <Route path="users/new" element={<AdminUserCreatePage />} />
                            <Route path="users/:userId" element={<AdminUserDetailPage />} />
                            <Route path="moderation" element={<AdminModerationPage />} />
                            <Route path="books" element={<AdminBooksPage />} />
                            <Route path="books/:bookId" element={<AdminBookDetailPage />} />
                        </Route>
                        <Route path="/books" element={<BooksPage key="active" />} />
                        <Route path="/stats" element={<StatsBooksPage />} />
                        <Route path="/books/:bookId/stats" element={<BookStatsPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/books/trash" element={<BooksPage key="trash" trash />} />
                        <Route path="/books/new" element={<BookCreatePage />} />
                        <Route path="/books/:bookId" element={<BookDetailPage />} />
                        <Route path="/books/:bookId/pages/:pageId" element={<PageDetailPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/assets" element={<AssetsPage />} />
                        <Route path="/assets/upload" element={<AssetUploadPage />} />
                        <Route path="/assets/:assetId" element={<AssetDetailPage />} />
                    </Route>
                </Route>
                <Route
                    path="*"
                    element={
                        <main
                            id="main"
                            className="session-state mx-auto my-[12vh] max-w-130 p-8 text-center"
                        >
                            <h1>Không tìm thấy trang</h1>
                            <Link to="/books">Về Studio</Link>
                        </main>
                    }
                />
            </Route>
        </Route>,
    ),
);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
