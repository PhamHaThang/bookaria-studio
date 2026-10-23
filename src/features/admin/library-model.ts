import {
    LibraryAssetsQuerySchema,
    type UpdateLibraryAssetBody,
} from '../../shared/contracts/api/admin.schema';
import type { Asset, AssetCategory } from '../../shared/contracts/dto.schema';
import { readAdminQueueSearch } from './model';
export const libraryKeys = {
    list: (actor: string, query: unknown) => ['admin', actor, 'library', query] as const,
    markers: (actor: string, query: unknown) => ['admin', actor, 'markers', query] as const,
};
export function readLibrarySearch(params: URLSearchParams) {
    const type = LibraryAssetsQuerySchema.shape.type.safeParse(params.get('type') || undefined),
        categoryId = LibraryAssetsQuerySchema.shape.categoryId.safeParse(
            params.get('categoryId') || undefined,
        );
    return LibraryAssetsQuerySchema.parse({
        ...readAdminQueueSearch(params),
        q: (params.get('q') || '').trim().slice(0, 100) || undefined,
        type: type.success ? type.data : undefined,
        categoryId: categoryId.success ? categoryId.data : undefined,
    });
}
export function excludedParents(categories: AssetCategory[], id: string) {
    const excluded = new Set([id]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of categories)
            if (item.parentId && excluded.has(item.parentId) && !excluded.has(item.id)) {
                excluded.add(item.id);
                changed = true;
            }
    }
    return excluded;
}
export function libraryFields(data: FormData) {
    return {
        name: String(data.get('name') || '').trim(),
        categoryId: String(data.get('categoryId') || '') || null,
        license: String(data.get('license') || '').trim(),
        authorName: String(data.get('authorName') || '').trim(),
        sourceUrl: String(data.get('sourceUrl') || '').trim() || null,
        tags: String(data.get('tags') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
    };
}
export function libraryChanges(
    asset: Asset,
    next: ReturnType<typeof libraryFields>,
): UpdateLibraryAssetBody {
    return Object.fromEntries(
        Object.entries(next).filter(
            ([key, value]) =>
                JSON.stringify(asset[key as keyof typeof next]) !== JSON.stringify(value),
        ),
    );
}
