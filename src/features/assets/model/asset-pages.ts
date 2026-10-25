import type { InfiniteData } from '@tanstack/react-query';
import type { Asset } from '../../../shared/contracts/dto.schema';
import type { AssetsApi } from '../api/assets-api';

export type AssetPage = Awaited<ReturnType<AssetsApi['list']>>;
export type AssetPagesCache = AssetPage | InfiniteData<AssetPage, number>;
export function flattenAssetPages(pages: AssetPage[]) {
    const items = new Map<string, Asset>();
    for (const page of pages) for (const asset of page.data) items.set(asset.id, asset);
    return [...items.values()];
}
export function removeAssetFromCache(
    current: AssetPagesCache | undefined,
    id: string,
): AssetPagesCache | undefined {
    if (!current) return current;
    const pages = 'pages' in current ? current.pages : [current];
    if (!pages.some((page) => page.data.some((item) => item.id === id))) return current;
    const updated = pages.map((page) => {
        const total = Math.max(0, page.meta.total - 1);
        return {
            ...page,
            data: page.data.filter((item) => item.id !== id),
            meta: { ...page.meta, total, totalPages: Math.ceil(total / page.meta.limit) },
        };
    });
    return 'pages' in current ? { ...current, pages: updated } : updated[0];
}
