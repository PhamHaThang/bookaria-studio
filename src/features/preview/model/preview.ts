import type { Asset, BookDetail, Page } from '../../../shared/contracts/dto.schema';
import { type Manifest, ManifestSchema } from '../../../shared/contracts/manifest.schema';
import {
    PublishedSceneSchema,
    type Scene,
    SceneSchema,
    sceneAssetIds,
    WorkflowVariablesSchema,
} from '../../../shared/contracts/scene.schema';
import { interactionProblems, playableInteractions } from '../../scene/model/interaction-health';
import { memoryDefinitions } from '../../scene/model/memory-variables';
import { interactionFailure, PreviewDataError } from './preview-problem';

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
    options: { allowInvalidInteractions?: boolean } = {},
) {
    signal.throwIfAborted();
    const draft = SceneSchema.parse(scene);
    const memory = WorkflowVariablesSchema.safeParse(
        memoryDefinitions(book.workflowVariables || [], [draft]),
    );
    if (!memory.success)
        throw new PreviewDataError(
            `Thông tin ghi nhớ chưa hợp lệ: ${memory.error.issues[0]?.message || 'Kiểm tra tên và giá trị.'} Mở Ghi nhớ để sửa.`,
            { kind: 'memory' },
        );
    const workflowVariables = memory.data;
    const prepared = options.allowInvalidInteractions
        ? playableInteractions(draft)
        : { scene: draft, problems: [] };
    if (!options.allowInvalidInteractions) {
        const problem = interactionProblems(draft)[0];
        if (problem) throw interactionFailure(problem);
    }
    const parsed = PublishedSceneSchema.parse(prepared.scene);
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
        workflowVariables,
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
    return {
        title: manifest.title,
        page: manifest.pages[0],
        assets: manifest.assets,
        workflowVariables: manifest.workflowVariables || [],
        problems: prepared.problems,
    };
}
export type PreviewPayload = Awaited<ReturnType<typeof makePreviewPayload>>;
