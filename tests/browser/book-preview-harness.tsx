import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../../src/index.css';
import { LocalPreviewPanel } from '../../src/features/preview/ui/LocalPreviewPanel';
import { BookDetailSchema, PageSchema } from '../../src/shared/contracts/dto.schema';
import { PageSettingsSchema, SceneSchema } from '../../src/shared/contracts/scene.schema';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';
import { TooltipProvider } from '../../src/shared/ui/primitives/tooltip';

const firstId = '11111111-1111-4111-8111-111111111111',
    secondId = '33333333-3333-4333-8333-333333333333',
    bookId = '22222222-2222-4222-8222-222222222222';
const firstScene = SceneSchema.parse({
    schemaVersion: 1,
    objects: [],
    interactions: [
        {
            id: 'next',
            trigger: { type: 'onPageEnter' },
            actions: [{ type: 'navigate', navigation: { target: 'next' } }],
        },
        {
            id: 'leave',
            trigger: { type: 'onPageLeave' },
            actions: [{ type: 'setState', key: 'completed', operation: 'set', value: true }],
        },
    ],
});
const ask = (questionId: string, title: string) => ({
    type: 'askQuestion',
    question: {
        questionId,
        title,
        choices: [
            { id: 'yes', text: 'Tiếp tục' },
            { id: 'no', text: 'Xem lại' },
        ],
        correctChoiceId: 'yes',
    },
});
const secondScene = SceneSchema.parse({
    schemaVersion: 1,
    objects: [],
    interactions: [
        {
            id: 'read-progress',
            trigger: { type: 'onPageEnter' },
            actions: [
                {
                    type: 'condition',
                    test: { type: 'variable', key: 'completed', operator: 'eq', value: true },
                },
                ask('success', 'Tiến trình đã truyền sang trang 2'),
                ask('failure', 'Chưa nhận được trạng thái từ trang 1'),
            ],
            editorLayout: [
                { id: 'start', x: 0, y: 0 },
                { id: 'check', x: 300, y: 0 },
                { id: 'yes', x: 600, y: -100 },
                { id: 'no', x: 600, y: 100 },
            ],
            workflow: {
                version: 1,
                edges: [
                    { source: 'start', target: 'check', port: 'next' },
                    { source: 'check', target: 'yes', port: 'true' },
                    { source: 'check', target: 'no', port: 'false' },
                ],
            },
        },
    ],
});
function page(id: string, orderIndex: number, scene: unknown) {
    return PageSchema.parse({
        id,
        bookId,
        orderIndex,
        title: `Trang ${orderIndex + 1}`,
        thumbnailUrl: `${location.origin}/tests/browser/page.png`,
        markerMode: 'NONE',
        markerNumber: null,
        markerScore: null,
        markerWarnings: [],
        objectCount: 0,
        image: { url: `${location.origin}/tests/browser/page.png`, width: 1, height: 1 },
        markerReport: null,
        bookariaMarker: null,
        settings: PageSettingsSchema.parse({}),
        scene,
        revision: 0,
        assets: {},
        updatedAt: new Date().toISOString(),
    });
}
const first = page(firstId, 0, firstScene),
    second = page(secondId, 1, secondScene);
Object.assign(window, { __previewSecondPage: second });
const book = BookDetailSchema.parse({
    id: bookId,
    title: 'Sách kiểm thử điều hướng',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: false,
    pageCount: 2,
    updatedAt: new Date().toISOString(),
    description: null,
    ageMin: null,
    ageMax: null,
    language: 'vi',
    topic: null,
    pageFormat: 'A4',
    pageAspect: Math.SQRT2,
    pageWidthMm: 210,
    slug: null,
    currentVersion: null,
    pages: [first, second],
});
createRoot(document.getElementById('root') as HTMLElement).render(
    <ThemeProvider>
        <TooltipProvider>
            <QueryClientProvider client={new QueryClient()}>
                <BrowserRouter>
                    <main className="h-dvh overflow-hidden">
                        <LocalPreviewPanel
                            active
                            page={first}
                            book={book}
                            scene={firstScene}
                            unsaved
                        />
                    </main>
                </BrowserRouter>
            </QueryClientProvider>
        </TooltipProvider>
    </ThemeProvider>,
);
