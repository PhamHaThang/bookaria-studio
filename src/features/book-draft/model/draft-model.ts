import { z } from 'zod';
import { UploadSignatureSchema } from '@/shared/contracts/api/assets.schema';
import type {
    BookDraftPageChange,
    BookDraftSnapshot,
} from '@/shared/contracts/api/book-draft.schema';
import {
    BookDraftSnapshotSchema,
    SaveBookDraftBodySchema,
} from '@/shared/contracts/api/book-draft.schema';
import { AssetRefSchema } from '@/shared/contracts/asset.schema';
import { IdSchema } from '@/shared/contracts/common.schema';
import {
    AssetSchema,
    type Page,
    PageSchema,
    type PageSummary,
    PageSummarySchema,
} from '@/shared/contracts/dto.schema';
import { SceneSchema } from '@/shared/contracts/scene.schema';

export type WorkingBook = {
    pages: PageSummary[];
    overrides: Record<string, Page>;
    minds: Record<string, string>;
    blankPages: Record<string, boolean>;
};
export const WorkingBookSchema = z.object({
    pages: z.array(PageSummarySchema),
    overrides: z.record(IdSchema, PageSchema),
    minds: z.record(IdSchema, z.string()),
    blankPages: z.record(IdSchema, z.boolean()).prefault({}),
});
export const DraftRecordSchema = z.object({
    pending: SaveBookDraftBodySchema.nullable().prefault(null),
    version: z.literal(1),
    userId: IdSchema,
    bookId: IdSchema,
    savedAt: z.string(),
    base: BookDraftSnapshotSchema,
    working: WorkingBookSchema,
    pendingWorking: WorkingBookSchema.nullable().prefault(null),
    blankSource: AssetSchema.nullable().prefault(null),
    blankUpload: z
        .object({ signature: UploadSignatureSchema, uploaded: z.boolean() })
        .nullable()
        .prefault(null),

    basePages: z.record(IdSchema, PageSchema),
    assets: z.record(IdSchema, AssetRefSchema),
    temporaryImages: z.array(IdSchema),
});
export type DraftRecord = z.infer<typeof DraftRecordSchema>;
const cached = new WeakMap<object, string>();
export function fingerprint(value: unknown): string {
    if (value && typeof value === 'object') {
        const found = cached.get(value);
        if (found !== undefined) return found;
        const result = Array.isArray(value)
            ? `[${value.map(fingerprint).join(',')}]`
            : `{${Object.entries(value)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, item]) => `${JSON.stringify(key)}:${fingerprint(item)}`)
                  .join(',')}}`;
        cached.set(value, result);
        return result;
    }
    return JSON.stringify(value) ?? 'null';
}
export function freshWorking(snapshot: BookDraftSnapshot): WorkingBook {
    return { pages: snapshot.pages, overrides: {}, minds: {}, blankPages: {} };
}
export function draftChanges(
    base: BookDraftSnapshot,
    working: WorkingBook,
    loaded: Record<string, Page>,
) {
    const summaries = new Map(base.pages.map((page) => [page.id, page]));
    const changes: BookDraftPageChange[] = [];
    for (const summary of working.pages) {
        const original = summaries.get(summary.id),
            page = working.overrides[summary.id],
            old = loaded[summary.id];
        const change: BookDraftPageChange = { id: summary.id };
        if (!original || summary.title !== original.title) change.title = summary.title;
        if (page) {
            if (!original || (old && fingerprint(page.scene) !== fingerprint(old.scene)))
                change.scene = page.scene;
            if (!original || (old && fingerprint(page.settings) !== fingerprint(old.settings)))
                change.settings = page.settings;
            if (!original || (old && page.image.assetId !== old.image.assetId)) {
                if (!page.image.assetId && !working.blankPages[summary.id])
                    throw new Error('Ảnh nền trang chưa sẵn sàng.');
                if (page.image.assetId) change.imageAssetId = page.image.assetId;
                if (working.minds[summary.id])
                    change.markerMindPublicId = working.minds[summary.id];
            }
        }
        if (Object.keys(change).length > 1) changes.push(change);
    }
    return changes;
}
export function workingDirty(
    base: BookDraftSnapshot,
    working: WorkingBook,
    loaded: Record<string, Page>,
) {
    return (
        base.pages.length !== working.pages.length ||
        base.pages.some((page, index) => page.id !== working.pages[index]?.id) ||
        draftChanges(base, working, loaded).length > 0
    );
}
/** An unfinished numeric input never replaces the last valid local scene checkpoint. */
export function safeCheckpoint(working: WorkingBook, previous: Record<string, Page>) {
    return {
        ...working,
        overrides: Object.fromEntries(
            Object.entries(working.overrides).map(([id, page]) => {
                const parsed = SceneSchema.safeParse(page.scene);
                return [
                    id,
                    parsed.success
                        ? page
                        : {
                              ...page,
                              scene:
                                  previous[id]?.scene ??
                                  SceneSchema.parse({ schemaVersion: 1, objects: [] }),
                          },
                ];
            }),
        ),
    };
}
