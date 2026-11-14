import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { auth } from '../../src/features/auth';
import { BookDraftRoute } from '../../src/features/book-draft/ui/BookDraftProvider';
import { useBookDraft } from '../../src/features/book-draft/ui/book-draft-context';
import { newObject } from '../../src/features/scene/model/objects';
import { BookEditorPage } from '../../src/pages/BookEditorPage';
import { PageDetailPage } from '../../src/pages/PageDetailPage';
import { apiClient } from '../../src/shared/api/client';
import {
    AssetSchema,
    BookDetailSchema,
    MeSchema,
    PageSchema,
    PageSummarySchema,
} from '../../src/shared/contracts/dto.schema';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';
import { Toaster } from '../../src/shared/ui/primitives/sonner';
import { TooltipProvider } from '../../src/shared/ui/primitives/tooltip';
import '../../src/index.css';

const bookId = '22222222-2222-4222-8222-222222222222';
const params = new URLSearchParams(location.search);
const count = Number(params.get('pages') ?? 1);
const repair = params.has('repair');
const markerLayout = params.has('marker');
const transformEditing = params.has('transform');
const transformAsset = AssetSchema.parse({
    id: '44444444-4444-4444-8444-444444444444',
    type: 'MODEL',
    name: 'Mô hình có xương',
    url: `${location.origin}/tests/browser/skinned-transform.gltf`,
    thumbnailUrl: null,
    meta: {},
    status: 'READY',
    sizeBytes: 1000,
    format: 'gltf',
    tags: [],
    license: null,
    authorName: null,
    sourceUrl: null,
    scope: 'mine',
    categoryId: null,
    createdAt: new Date().toISOString(),
});
const markerReport = {
    analysis: {
        policyVersion: 'mindar-pictarize-v1',
        distribution: 0.79,
        uniqueness: 0.75,
        dimension: 1,
        sourceWidth: 1600,
        sourceHeight: 1600,
    },
    features: 0,
    coverage: 0,
    heatmapUrl: `${location.origin}/tests/browser/page.png`,
    similarPages: [],
    hints: [
        'Không tìm thấy điểm đặc trưng. Hãy chọn ảnh có chi tiết và tương phản rõ.',
        'Điểm đặc trưng tập trung ở ít vùng; hạn chế khoảng trống lớn, nhất là ở rìa ảnh.',
        'Nhiều điểm đặc trưng giống nhau; tránh họa tiết lặp và bố cục đối xứng.',
    ],
};
const repairScene = {
    schemaVersion: 1,
    objects: [
        { ...newObject('text', 'source'), name: 'Nút khám phá', text: 'Khám phá' },
        { ...newObject('text', 'target'), name: 'Thông tin', text: 'Nội dung thông tin' },
    ],
    interactions: [
        {
            id: 'broken-flow',
            name: 'Hiện thông tin',
            trigger: { type: 'onTap', objectId: 'source' },
            actions: [{ type: 'setVisible', objectId: 'target', value: true }],
        },
        {
            id: 'healthy-flow',
            name: 'Luồng hợp lệ',
            trigger: { type: 'onPageEnter' },
            actions: [
                { type: 'setState', key: 'score', operation: 'increment', value: 1 },
                {
                    type: 'askQuestion',
                    question: {
                        questionId: 'proof',
                        title: 'Luồng hợp lệ vẫn chạy',
                        choices: [
                            { id: 'yes', text: 'Tiếp tục' },
                            { id: 'no', text: 'Xem lại' },
                        ],
                        correctChoiceId: 'yes',
                    },
                },
            ],
        },
    ],
};
const initial = Array.from({ length: count }, (_, i) =>
    PageSchema.parse({
        id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, '0')}`,
        bookId,
        orderIndex: i,
        title: `Nội dung ${i + 1}`,
        thumbnailUrl: `${location.origin}/tests/browser/page.png`,
        markerMode: markerLayout ? 'CUSTOM_MARKER' : 'NONE',
        markerNumber: null,
        markerScore: null,
        markerWarnings: [],
        objectCount: 0,
        image: { url: `${location.origin}/tests/browser/page.png`, width: 640, height: 960 },
        markerReport: markerLayout ? markerReport : null,
        bookariaMarker: null,
        settings: {},
        scene: transformEditing
            ? { schemaVersion: 1, objects: [newObject('model', 'skinned', transformAsset)] }
            : repair
              ? repairScene
              : { schemaVersion: 1, objects: [] },
        revision: 0,
        assets: transformEditing ? { [transformAsset.id]: transformAsset } : {},
        updatedAt: new Date().toISOString(),
    }),
);
const remote = new Map(initial.map((page) => [page.id, page]));
let snapshot = {
    bookId,
    revision: 'a'.repeat(64),
    geometry: { pageFormat: 'A4', pageAspect: Math.SQRT2, pageWidthMm: 210 },
    pages: initial.map((page) => PageSummarySchema.parse(page)),
    pageRevisions: Object.fromEntries(initial.map((page) => [page.id, page.revision])),
    workflowVariables: repair
        ? [{ key: 'custom_score', name: 'Điểm số', type: 'number' as const, initialValue: 0 }]
        : [],
};
const book = BookDetailSchema.parse({
    id: bookId,
    title: 'Sách kiểm thử editor',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: false,
    pageCount: initial.length,
    updatedAt: new Date().toISOString(),
    description: null,
    ageMin: null,
    ageMax: null,
    language: 'vi',
    topic: null,
    ...snapshot.geometry,
    slug: null,
    currentVersion: null,
    workflowVariables: snapshot.workflowVariables,
    pages: snapshot.pages,
});
auth.store.setState({
    status: 'authenticated',
    user: MeSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'editor@example.test',
        displayName: 'Kiểm thử',
        avatarUrl: null,
        organization: null,
        bio: null,
        role: 'AUTHOR',
        emailVerified: true,
        storage: { usedBytes: 0, quotaBytes: 100000000 },
        createdAt: new Date().toISOString(),
    }),
});

// This fixture never sends requests to the live API or changes a real book.
apiClient.defaults.adapter = async (config) => {
    let data: unknown;
    if (config.url === `/books/${bookId}/draft` && config.method === 'put') {
        const body = JSON.parse(config.data);
        for (const change of body.changes) {
            const previous = remote.get(change.id);
            if (!previous) throw new Error('Unexpected new page save in fixture.');
            remote.set(change.id, { ...previous, ...change });
        }
        const pages = body.order.map((id: string, orderIndex: number) => ({
            ...remote.get(id),
            orderIndex,
        }));
        snapshot = {
            ...snapshot,
            revision: (snapshot.revision[0] === 'a' ? 'b' : 'a').repeat(64),
            pages: pages.map((page: unknown) => PageSummarySchema.parse(page)),
            pageRevisions: Object.fromEntries(
                pages.map((page: { id: string; revision: number }) => [page.id, page.revision]),
            ),
        };
        data = { snapshot, pages, warnings: [], jobs: [] };
    } else if (transformEditing && config.url === `/assets/${transformAsset.id}`)
        data = transformAsset;
    else if (config.url === `/books/${bookId}/draft`) data = snapshot;
    else if (config.url === `/books/${bookId}`)
        data = { ...book, pages: snapshot.pages, pageCount: snapshot.pages.length };
    else if (config.url?.startsWith('/pages/')) data = remote.get(config.url.split('/')[2]);
    else throw new Error(`Unexpected fixture API request: ${config.method} ${config.url}`);
    return { status: 200, statusText: 'OK', headers: {}, config, data: { data } };
};

function Probe({ children }: { children: React.ReactNode }) {
    const { store } = useBookDraft();
    Object.assign(window, { __editorPages: { store, router } });
    return children;
}
const first =
    params.get('start') === 'edit' ? undefined : initial[Number(params.get('start') ?? 0)];
const router = createMemoryRouter(
    [
        {
            path: '/books/:bookId',
            element: <BookDraftRoute />,
            children: [
                {
                    path: 'edit',
                    element: (
                        <Probe>
                            <BookEditorPage />
                        </Probe>
                    ),
                },
                {
                    path: 'pages/:pageId',
                    element: (
                        <Probe>
                            <PageDetailPage />
                        </Probe>
                    ),
                },
            ],
        },
        { path: '/books', element: <p>Sách của tôi</p> },
    ],
    {
        initialEntries: [
            first
                ? `/books/${bookId}/pages/${first.id}${markerLayout ? '?marker=1' : ''}`
                : `/books/${bookId}/edit`,
        ],
    },
);
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root') as HTMLElement).render(
    <ThemeProvider>
        <QueryClientProvider client={client}>
            <TooltipProvider>
                <RouterProvider router={router} />
                <Toaster />
            </TooltipProvider>
        </QueryClientProvider>
    </ThemeProvider>,
);
