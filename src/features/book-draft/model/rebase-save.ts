import type { BookDraftSnapshot } from '@/shared/contracts/api/book-draft.schema';
import type { Page } from '@/shared/contracts/dto.schema';
import { fingerprint, type WorkingBook } from './draft-model';

/** Merge a save acknowledgment without replacing edits made while its request was in flight. */
export function rebaseSavedBook(
    current: WorkingBook,
    sent: WorkingBook,
    snapshot: BookDraftSnapshot,
    canonical: Record<string, Page>,
): WorkingBook {
    const saved = new Map(snapshot.pages.map((page) => [page.id, page]));
    const sentSummaries = new Map(sent.pages.map((page) => [page.id, page]));
    const overrides: Record<string, Page> = {};
    const pages = current.pages
        .map((summary) => {
            const server = saved.get(summary.id),
                submitted = sent.overrides[summary.id],
                local = current.overrides[summary.id],
                base = canonical[summary.id];
            if (!server) {
                if (local) overrides[summary.id] = local;
                return summary;
            }
            const title =
                summary.title === sentSummaries.get(summary.id)?.title
                    ? server.title
                    : summary.title;
            if (!local || !submitted || !base) {
                if (local) overrides[summary.id] = local;
                return { ...server, title };
            }
            const scene =
                fingerprint(local.scene) === fingerprint(submitted.scene)
                    ? base.scene
                    : local.scene;
            const settings =
                fingerprint(local.settings) === fingerprint(submitted.settings)
                    ? base.settings
                    : local.settings;
            const image =
                fingerprint(local.image) === fingerprint(submitted.image) ||
                (!local.image.assetId &&
                    current.blankPages[summary.id] &&
                    sent.blankPages[summary.id])
                    ? base.image
                    : local.image;
            overrides[summary.id] = {
                ...base,
                title,
                scene,
                settings,
                image,
                objectCount: scene.objects.length,
                thumbnailUrl: image.url,
                assets: { ...base.assets, ...local.assets },
            };
            return { ...server, title, thumbnailUrl: image.url, objectCount: scene.objects.length };
        })
        .map((page, orderIndex) => ({ ...page, orderIndex }));
    return {
        pages,
        overrides,
        minds: Object.fromEntries(
            Object.entries(current.minds).filter(
                ([id, mind]) => !saved.has(id) || mind !== sent.minds[id],
            ),
        ),
        blankPages: Object.fromEntries(
            Object.entries(current.blankPages).filter(
                ([id]) => !saved.has(id) || !overrides[id]?.image.assetId,
            ),
        ),
    };
}
