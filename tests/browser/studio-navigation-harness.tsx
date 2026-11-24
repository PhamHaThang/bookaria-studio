import axios from 'axios';
import { type ReactNode, StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, Link, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { PublicHeader } from '../../src/app/PublicHeader';
import { AppProviders } from '../../src/app/providers';
import { StudioLayout } from '../../src/app/StudioLayout';
import { auth } from '../../src/features/auth';
import { AuthDialog, LegacyAuthRoute } from '../../src/features/auth/ui/AuthDialog';
import { AssetsPage } from '../../src/pages/AssetsPage';
import { BooksPage } from '../../src/pages/BooksPage';
import { ExploreAssetsPage } from '../../src/pages/ExploreAssetsPage';
import { ProfilePage } from '../../src/pages/ProfilePage';
import { StatsBooksPage } from '../../src/pages/StatsBooksPage';
import { StudioOverviewPage } from '../../src/pages/StudioOverviewPage';
import { TrashPage } from '../../src/pages/TrashPage';
import { apiClient } from '../../src/shared/api/client';
import { AssetSchema, BookSummarySchema, MeSchema } from '../../src/shared/contracts/dto.schema';
import { FloatingThemeSwitcher } from '../../src/shared/ui/ThemeSwitcher';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const user = MeSchema.parse({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'author@example.test',
    displayName: 'Tác giả kiểm thử',
    avatarUrl: null,
    organization: null,
    bio: null,
    role: 'AUTHOR',
    emailVerified: !params.has('unverified'),
    storage: { usedBytes: 10485760, quotaBytes: 524288000 },
    createdAt: '2026-11-20T00:00:00Z',
});
auth.store.setState(
    params.has('anonymous')
        ? { status: 'anonymous', user: null }
        : { status: 'authenticated', user },
);
const book = BookSummarySchema.parse({
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Sách thử nghiệm',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: false,
    pageCount: 1,
    updatedAt: '2026-11-20T00:00:00Z',
});
const assets = Array.from({ length: 9 }, (_, index) =>
    AssetSchema.parse({
        id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
        type: 'IMAGE',
        name: `Ảnh thử nghiệm ${index + 1}`,
        url: new URL('/tests/browser/page.png', location.origin).href,
        thumbnailUrl: null,
        meta: {},
        status: 'READY',
        sizeBytes: 1024,
        format: 'png',
        tags: [],
        license: null,
        authorName: null,
        sourceUrl: null,
        scope: 'mine',
        categoryId: null,
        createdAt: '2026-11-20T00:00:00Z',
    }),
);
// These layout tests never contact the live API.
let emailVerified = user.emailVerified;
window.addEventListener('verify-fixture-email', () => {
    emailVerified = true;
});
apiClient.defaults.adapter = async (config) => {
    let data: unknown;
    if (config.url === '/me') data = { data: { ...user, emailVerified } };
    else if (config.url === '/auth/resend-verification') {
        if (params.has('mock-resend-http')) return axios.getAdapter('xhr')(config);
        return { data: null, config, status: 204, statusText: 'No Content', headers: {} };
    } else if (config.url === '/me/notifications')
        data = { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } };
    else if (config.url === '/books' || config.url === '/books/trash' || config.url === '/assets') {
        const rows =
            config.url === '/books'
                ? !config.params?.status || config.params.status === 'DRAFT'
                    ? [book]
                    : []
                : config.url === '/assets'
                  ? !config.params?.type || config.params.type === 'IMAGE'
                      ? assets
                      : []
                  : [];
        const limit = config.params?.limit || 12;
        data = {
            data: rows.slice(0, limit),
            meta: {
                page: 1,
                limit,
                total: rows.length,
                totalPages: Math.ceil(rows.length / limit),
            },
        };
    } else if (config.url === '/asset-categories' || config.url === '/assets/model-generations')
        data = { data: [] };
    else if (config.url === '/studio/reading-stats')
        data = {
            data: {
                opensLast7Days: 0,
                opensPrevious7Days: 0,
                opensByDay: Array.from({ length: 14 }, (_, index) => ({
                    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
                    opens: 0,
                })),
                topBooks: [],
            },
        };
    else throw new Error(`Unexpected layout fixture request: ${config.url}`);
    return { data, config, status: 200, statusText: 'OK', headers: {} };
};
const labels: Record<string, string> = {
    '/studio': 'Tổng quan Studio',
    '/books': 'Sách của tôi',
    '/assets': 'Tài nguyên',
    '/stats': 'Thống kê',
    '/books/trash': 'Thùng rác',
    '/books/demo/edit': 'Editor thử nghiệm',
};
function Page() {
    const { pathname } = useLocation();
    return (
        <section>
            <h1>{labels[pathname]}</h1>
            <Link to="/books/demo/edit">Mở editor thử nghiệm</Link>
            <div className="min-h-[120dvh]" />
            <button type="button">Cuối trang thử nghiệm</button>
        </section>
    );
}
function Shell() {
    const { pathname } = useLocation();
    // biome-ignore lint/correctness/useExhaustiveDependencies: Match the production SiteLayout route scroll reset.
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return (
        <div className="site-shell flex min-h-dvh flex-col bg-background">
            <PublicHeader />
            <Outlet />
            <FloatingThemeSwitcher />
            <AuthDialog />
        </div>
    );
}
const router = createMemoryRouter(
    [
        {
            element: <Shell />,
            children: [
                { path: '/', element: <main>Bookaria</main> },
                { path: '/resources', element: <ExploreAssetsPage /> },
                { path: '/profile', element: <ProfilePage /> },
                { path: '/verify-email', element: <LegacyAuthRoute mode="verify" /> },
                {
                    element: <StudioLayout />,
                    children: Object.keys(labels).map((path) => ({
                        path,
                        element: new URLSearchParams(location.search).has('real') ? (
                            (
                                {
                                    '/studio': <StudioOverviewPage />,
                                    '/books': <BooksPage />,
                                    '/assets': <AssetsPage />,
                                    '/stats': <StatsBooksPage />,
                                    '/books/trash': <TrashPage />,
                                } as Record<string, ReactNode>
                            )[path] || <Page />
                        ) : (
                            <Page />
                        ),
                    })),
                },
            ],
        },
    ],
    { initialEntries: [params.get('path') || '/books'] },
);
const root = document.getElementById('root');
if (!root) throw new Error('Missing layout test root');
const app = (
    <AppProviders>
        <RouterProvider router={router} />
    </AppProviders>
);
createRoot(root).render(params.has('strict') ? <StrictMode>{app}</StrictMode> : app);
