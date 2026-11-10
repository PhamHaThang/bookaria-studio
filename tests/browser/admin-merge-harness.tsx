import { AxiosError } from 'axios';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AdminLayout } from '../../src/app/AdminLayout';
import { AppProviders } from '../../src/app/providers';
import { adminApi } from '../../src/features/admin/client';
import { useAdminMutation } from '../../src/features/admin/use-admin-mutation';
import { auth } from '../../src/features/auth';
import { AdminAuditPage } from '../../src/pages/AdminAuditPage';
import { AdminBookDetailPage } from '../../src/pages/AdminBookDetailPage';
import { AdminBooksPage, AdminModerationPage } from '../../src/pages/AdminBooksPage';
import { AdminCategoriesPage } from '../../src/pages/AdminCategoriesPage';
import { AdminDashboardPage } from '../../src/pages/AdminDashboardPage';
import { AdminJobsPage } from '../../src/pages/AdminJobsPage';
import { AdminLibraryPage } from '../../src/pages/AdminLibraryPage';
import { AdminMarkersPage } from '../../src/pages/AdminMarkersPage';
import { AdminUsersPage } from '../../src/pages/AdminUsersPage';
import { apiClient } from '../../src/shared/api/client';
import { AdminUserSchema } from '../../src/shared/contracts/dto.schema';
import '../../src/index.css';

const id = (n: number) => `66666666-6666-4666-8666-${String(n).padStart(12, '0')}`;
const time = '2026-11-10T00:00:00.000Z';
const author = AdminUserSchema.parse({
    id: id(2),
    email: 'author@example.test',
    displayName: 'Tác giả kiểm thử',
    avatarUrl: null,
    organization: null,
    bio: null,
    role: 'AUTHOR',
    status: 'ACTIVE',
    emailVerified: true,
    storage: { usedBytes: 0, quotaBytes: 1073741824 },
    bookCount: 1,
    lastLoginAt: null,
    createdAt: time,
    updatedAt: time,
});
const admin = {
    ...author,
    id: id(1),
    email: 'admin@example.test',
    displayName: 'Quản trị kiểm thử',
    role: 'ADMIN' as const,
};
auth.store.setState({ status: 'authenticated', user: admin });
const params = new URLSearchParams(location.search);
const state = {
    writes: [] as { path: string; data: unknown }[],
    reads: [] as string[],
    fail: params.has('fail'),
    release: () => {},
    successes: 0,
    switchActor() {
        auth.store.setState({ user: { ...admin, id: id(3) } });
    },
};
Object.assign(window, { adminReview: state });
const book = {
    id: id(10),
    title: 'Sách kiểm duyệt',
    coverUrl: null,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    takenDown: false,
    pageCount: 1,
    updatedAt: time,
    author: { id: author.id, displayName: author.displayName },
    reportCount: 1,
};
const marker = {
    id: id(20),
    number: 1,
    imageUrl: `${location.origin}/tests/browser/page.png`,
    markerScore: 80,
    isActive: true,
    validatedAt: time,
};

// No request in this fixture reaches the live API or changes production data.
apiClient.defaults.adapter = async (config) => {
    let data: unknown;
    let status = 200;
    const path = config.url || '';
    const payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    if (config.method !== 'get') {
        state.writes.push({ path, data: payload });
        await new Promise<void>((resolve) => {
            state.release = resolve;
        });
        if (state.fail) throw new AxiosError('Không nhận được phản hồi', 'ERR_NETWORK', config);
        if (path === '/admin/users') {
            status = 201;
            data = { data: { ...author, ...payload, id: id(4) } };
        } else if (path.startsWith('/admin/users/'))
            data = {
                data: {
                    user: {
                        id: author.id,
                        role: author.role,
                        status: payload.status || author.status,
                        storageQuotaBytes: 1073741824,
                    },
                },
            };
        else if (path.startsWith('/admin/bookaria-markers/'))
            data = { data: { ...marker, ...payload } };
        else throw new Error(`Unexpected fixture write: ${path}`);
    } else {
        state.reads.push(path);
        const page = (items: unknown[], total = items.length) => ({
            data: items,
            meta: {
                page: Number(config.params?.page || 1),
                limit: Number(config.params?.limit || 12),
                total,
                totalPages: total ? Math.ceil(total / Number(config.params?.limit || 12)) : 0,
            },
        });
        if (path === '/admin/dashboard')
            data = {
                data: {
                    users: 2,
                    publishedBooks: 1,
                    storageUsedBytes: 0,
                    failedJobs24h: 0,
                    openReports: 1,
                    publishedPerDay: ['04', '05', '06', '07', '08', '09', '10'].map((day) => ({
                        date: `2026-11-${day}`,
                        count: 0,
                    })),
                    auditActionsToday: [],
                },
            };
        else if (path === '/admin/users') data = page([author], 30);
        else if (path.startsWith('/admin/users/')) data = { data: { ...author, books: [] } };
        else if (path === '/admin/books') data = page([book]);
        else if (path.startsWith('/admin/books/'))
            data = {
                data: {
                    book: {
                        ...book,
                        description: null,
                        takenDownReason: null,
                        pages: [
                            {
                                id: id(11),
                                orderIndex: 0,
                                title: 'Trang marker',
                                thumbnailUrl: `${location.origin}/tests/browser/page.png`,
                                markerMode: 'CUSTOM_MARKER',
                                markerNumber: null,
                                markerScore: null,
                                markerWarnings: ['REANALYZE_REQUIRED'],
                                objectCount: 1,
                            },
                        ],
                    },
                    reports: [],
                },
            };
        else if (path === '/admin/moderation')
            data = page([
                {
                    book,
                    reportCount: 1,
                    reasons: ['OTHER'],
                    lastReportedAt: time,
                },
            ]);
        else if (path === '/asset-categories') data = { data: [] };
        else if (path === '/admin/bookaria-markers') data = page([marker]);
        else if (
            ['/admin/jobs', '/admin/audit-logs', '/admin/library/assets', '/assets'].includes(path)
        )
            data = page([]);
        else throw new Error(`Unexpected fixture read: ${path}`);
    }
    return { status, data, config, headers: {}, statusText: 'OK' };
};

function MutationProbe() {
    const write = useAdminMutation({
        mutationFn: () =>
            adminApi.createUser({
                email: 'probe@example.test',
                displayName: 'Probe',
                password: 'password123',
            }),
        onSuccess() {
            state.successes++;
        },
    });
    return (
        <button
            type="button"
            onClick={() => {
                write.mutate();
                write.mutate();
            }}
        >
            Gửi probe hai lần
        </button>
    );
}

const router = createMemoryRouter(
    [
        { path: '/probe', element: <MutationProbe /> },
        {
            path: '/admin',
            element: <AdminLayout />,
            children: [
                { index: true, element: <AdminDashboardPage /> },
                { path: 'users', element: <AdminUsersPage /> },
                { path: 'books', element: <AdminBooksPage /> },
                { path: 'books/:bookId', element: <AdminBookDetailPage /> },
                { path: 'moderation', element: <AdminModerationPage /> },
                { path: 'library', element: <AdminLibraryPage /> },
                { path: 'categories', element: <AdminCategoriesPage /> },
                { path: 'markers', element: <AdminMarkersPage /> },
                { path: 'jobs', element: <AdminJobsPage /> },
                { path: 'audit-logs', element: <AdminAuditPage /> },
            ],
        },
    ],
    { initialEntries: [params.get('path') || '/admin/users'] },
);
createRoot(document.getElementById('root')!).render(
    <AppProviders>
        <RouterProvider router={router} />
    </AppProviders>,
);
