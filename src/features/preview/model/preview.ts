import type { Asset, BookDetail, Page } from '../../../shared/contracts/dto.schema';
import { type Manifest, ManifestSchema } from '../../../shared/contracts/manifest.schema';
import {
    PublishedSceneSchema,
    type Scene,
    sceneAssetIds,
} from '../../../shared/contracts/scene.schema';

export function viewerOrigin(value: string) {
    const url = new URL(value);
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    )
        throw new Error('VITE_VIEWER_ORIGIN phải là origin HTTP/HTTPS của Viewer.');
    return url.origin;
}
export function previewUrl(origin: string, token: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new Error('Token xem trước không hợp lệ.');
    return new URL(`/preview/${token}`, viewerOrigin(origin)).href;
}
export async function makePreviewPayload(
    page: Page,
    book: BookDetail,
    scene: Scene,
    detail: (id: string, signal: AbortSignal) => Promise<Asset>,
    signal: AbortSignal,
) {
    const parsed = PublishedSceneSchema.parse(scene);
    const ids = sceneAssetIds(parsed, page.settings);
    const assets: Manifest['assets'] = {};
    for (let offset = 0; offset < ids.length; offset += 8) {
        const batch = await Promise.all(
            ids.slice(offset, offset + 8).map((id) => detail(id, signal)),
        );
        signal.throwIfAborted();
        for (const asset of batch) {
            if (asset.status !== 'READY')
                throw new Error(`Tài nguyên “${asset.name}” chưa sẵn sàng.`);
            assets[asset.id] = {
                type: asset.type,
                url: asset.url,
                size: asset.sizeBytes,
                meta: asset.meta,
            };
        }
    }
    const manifest = ManifestSchema.parse({
        schemaVersion: 1,
        bookId: book.id,
        version: 1,
        title: book.title,
        trackerEngine: 'mindar',
        generatedAt: new Date().toISOString(),
        targetGroups: [],
        pages: [
            {
                pageId: page.id,
                title: page.title,
                aspect: book.pageAspect,
                imageUrl: page.image.url,
                thumbnailUrl: page.image.url,
                marker: { mode: 'NONE' },
                scene: parsed,
                settings: page.settings,
            },
        ],
        assets,
        credits: [],
    });
    return { title: manifest.title, page: manifest.pages[0], assets: manifest.assets };
}
export type PreviewPayload = Awaited<ReturnType<typeof makePreviewPayload>>;
