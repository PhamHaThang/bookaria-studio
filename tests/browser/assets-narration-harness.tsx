import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { auth } from '../../src/features/auth';
import { NavigationGuard } from '../../src/features/scene/ui/NavigationGuard';
import { AssetsPage } from '../../src/pages/AssetsPage';
import { apiClient } from '../../src/shared/api/client';
import { AssetSchema, MeSchema } from '../../src/shared/contracts/dto.schema';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';
import { Toaster } from '../../src/shared/ui/primitives/sonner';
import { TooltipProvider } from '../../src/shared/ui/primitives/tooltip';
import '../../src/index.css';

const params = new URLSearchParams(location.search);
const AssetPicker = lazy(() =>
    import('../../src/features/scene/ui/AssetPicker').then((module) => ({
        default: module.AssetPicker,
    })),
);
const state = {
    writes: [] as { url: string; body: Record<string, unknown> }[],
    assets: params.has('images')
        ? ['portrait', 'landscape'].map((shape, index) =>
              AssetSchema.parse({
                  id: `44444444-4444-4444-8444-44444444444${index}`,
                  type: 'IMAGE',
                  name: shape,
                  url: `${location.origin}/fixtures/${shape}.png`,
                  thumbnailUrl: `${location.origin}/derived/v1/${'a'.repeat(64)}/${index === 0 ? 'thumbnail' : 'asset-preview'}.jpg`,
                  meta: {},
                  status: 'READY',
                  sizeBytes: 1000,
                  format: 'png',
                  tags: [],
                  license: null,
                  authorName: null,
                  sourceUrl: null,
                  scope: 'mine',
                  categoryId: null,
                  createdAt: new Date().toISOString(),
              }),
          )
        : ([] as ReturnType<typeof AssetSchema.parse>[]),
    failComplete: params.has('failComplete'),
    chosen: '',
};
Object.assign(window, { __narration: state });
auth.store.setState({
    status: 'authenticated',
    user: MeSchema.parse({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'tts@example.test',
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

// All writes are mocked; this fixture never contacts the live API.
apiClient.defaults.adapter = async (config) => {
    if (config.method === 'post')
        state.writes.push({ url: config.url || '', body: JSON.parse(config.data) });
    const response = (data: unknown, raw = false) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: raw ? data : { data },
    });
    if (config.url === '/assets') {
        return response(
            {
                data: state.assets,
                meta: {
                    page: 1,
                    limit: 20,
                    total: state.assets.length,
                    totalPages: state.assets.length ? 1 : 0,
                },
            },
            true,
        );
    }
    if (config.url === '/asset-categories') return response([]);
    if (config.url === '/assets/55555555-5555-4555-8555-555555555555')
        return response(state.assets[0]);
    if (config.url === '/assets/narration/voices')
        return response([
            { id: 'maichi', name: 'Mai Chi' },
            { id: 'giahuy', name: 'Gia Huy' },
            { id: 'baotrang', name: 'Bảo Trang' },
            { id: 'hamy', name: 'Hà My' },
            { id: 'huuduc', name: 'Hữu Đức' },
            { id: 'kimoanh', name: 'Kim Oanh' },
            { id: 'quangminh', name: 'Quang Minh' },
            { id: 'tiendat', name: 'Tiến Đạt' },
        ]);
    if (config.url === '/assets/narration/generate') {
        await new Promise<void>((resolve, reject) => {
            const abort = () => {
                clearTimeout(timer);
                reject(new Error('Canceled'));
            };
            const timer = setTimeout(
                () => {
                    config.signal?.removeEventListener?.('abort', abort);
                    resolve();
                },
                params.has('delay') ? 2000 : 50,
            );
            config.signal?.addEventListener?.('abort', abort, { once: true });
        });
        const bytes = await (await fetch('/tests/browser/narration.mp3')).arrayBuffer();
        return response(new Blob([bytes], { type: 'audio/mpeg' }), true);
    }
    const assetId = '55555555-5555-4555-8555-555555555555';
    if (config.url === '/assets/upload-signature')
        return response({
            assetId,
            uploadUrl: 'https://account.r2.cloudflarestorage.com/bookaria-test/narration',
            method: 'PUT',
            objectKey: 'narration',
            headers: { 'Content-Type': 'audio/mpeg', 'If-None-Match': '*' },
            expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
    if (config.url === `/assets/${assetId}/complete`) {
        if (state.failComplete) {
            state.failComplete = false;
            throw new AxiosError('Retry complete', undefined, config, undefined, {
                status: 500,
                statusText: 'Error',
                headers: {},
                config,
                data: {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Chưa lưu được âm thanh. Hãy thử lại.',
                        requestId: 'test',
                    },
                },
            });
        }
        const body = JSON.parse(config.data);
        const asset = AssetSchema.parse({
            id: assetId,
            type: 'AUDIO',
            name: body.name,
            url: `${location.origin}/tests/browser/narration.mp3`,
            thumbnailUrl: null,
            meta: {},
            status: 'READY',
            sizeBytes: 3168,
            format: 'mp3',
            tags: body.tags,
            license: null,
            authorName: null,
            sourceUrl: null,
            scope: 'mine',
            categoryId: null,
            createdAt: new Date().toISOString(),
        });
        state.assets = [asset];
        return response({ asset });
    }
    throw new Error(`Unexpected fixture request ${config.url}`);
};

function EditorLibrary() {
    const [open, setOpen] = useState(true);
    return (
        <>
            <NavigationGuard dirty={false} saving={false} />
            <h1>Thư viện editor kiểm thử</h1>
            <button type="button" onClick={() => setOpen(true)}>
                Mở thư viện âm thanh
            </button>
            {open && (
                <Suspense fallback={<p>Đang tải thư viện…</p>}>
                    <AssetPicker
                        type="AUDIO"
                        onClose={() => setOpen(false)}
                        onChoose={(asset) => {
                            state.chosen = asset.id;
                            setOpen(false);
                        }}
                    />
                </Suspense>
            )}
        </>
    );
}

const router = createMemoryRouter(
    [
        {
            path: '/assets',
            element: (
                <main className="mx-auto max-w-7xl p-6 sm:p-10">
                    {params.has('picker') ? <EditorLibrary /> : <AssetsPage />}
                </main>
            ),
        },
    ],
    {
        initialEntries: [`/assets${params.has('all') ? '' : '?type=AUDIO'}`],
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
