import { lazy, Suspense } from 'react';
import {
    createBrowserRouter,
    createRoutesFromElements,
    Navigate,
    Outlet,
    Route,
    RouterProvider,
    useLocation,
} from 'react-router-dom';
import { RequireSession, SessionBoundary } from '../features/auth';
import { AuthDialog, LegacyAuthRoute } from '../features/auth/ui/AuthDialog';
import { AdminLayout, AdminNotFoundPage } from './AdminLayout';
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

const HomePage = lazy(() =>
    import('../pages/HomePage').then((module) => ({ default: module.HomePage })),
);
const HelpPage = lazy(() =>
    import('../pages/HelpPage').then((module) => ({ default: module.HelpPage })),
);
const NotFoundPage = lazy(() =>
    import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
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
                className="skip-link fixed top-[-100px] left-4 z-[var(--layer-skip-link)] bg-surface p-3 [&:focus]:top-3"
                href="#main"
            >
                Đến nội dung chính
            </a>
            <Outlet />
            <AuthDialog />
        </>
    );
}

function LegacyExploreRedirect() {
    const { search, hash } = useLocation();
    return <Navigate to={{ pathname: '/library', search, hash }} replace />;
}

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<RouterLayout />}>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/library" element={<ExplorePage />} />
                <Route path="/explore" element={<LegacyExploreRedirect />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="*" element={<NotFoundPage />} />
                <Route path="/authors/:authorId" element={<AuthorPage />} />
                <Route path="/login" element={<LegacyAuthRoute mode="login" />} />
                <Route path="/register" element={<LegacyAuthRoute mode="register" />} />
                <Route path="/forgot-password" element={<LegacyAuthRoute mode="forgot" />} />
                <Route path="/reset-password" element={<LegacyAuthRoute mode="reset" />} />
                <Route path="/verify-email" element={<LegacyAuthRoute mode="verify" />} />
                <Route path="/check-email" element={<LegacyAuthRoute mode="check-email" />} />
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
                <Route element={<RequireSession />}>
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
                        <Route path="categories/:categoryId" element={<AdminCategoryEditPage />} />
                        <Route path="markers" element={<AdminMarkersPage />} />
                        <Route path="markers/new" element={<AdminMarkerCreatePage />} />
                        <Route path="users" element={<AdminUsersPage />} />
                        <Route path="users/new" element={<AdminUserCreatePage />} />
                        <Route path="users/:userId" element={<AdminUserDetailPage />} />
                        <Route path="moderation" element={<AdminModerationPage />} />
                        <Route path="books" element={<AdminBooksPage />} />
                        <Route path="books/:bookId" element={<AdminBookDetailPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="*" element={<AdminNotFoundPage />} />
                    </Route>
                    <Route element={<StudioLayout />}>
                        <Route path="/books" element={<BooksPage key="active" />} />
                        <Route path="/stats" element={<StatsBooksPage />} />
                        <Route path="/books/:bookId/stats" element={<BookStatsPage />} />
                        <Route
                            path="/notifications"
                            element={<Navigate to="/books?notifications=open" replace />}
                        />
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
            </Route>
        </Route>,
    ),
);

export function AppRouter() {
    return <RouterProvider router={router} />;
}
