import { ListAssetsQuerySchema } from '../../../shared/contracts/api/assets.schema';
import { IdSchema, PaginationQuerySchema } from '../../../shared/contracts/common.schema';
import { AssetTypeSchema } from '../../../shared/contracts/enums.schema';

export function readAssetSearch(params: URLSearchParams) {
    const scope = params.get('scope') === 'library' ? 'library' : 'mine';
    const type = AssetTypeSchema.safeParse(params.get('type'));
    const category = IdSchema.safeParse(params.get('categoryId'));
    const page = PaginationQuerySchema.shape.page.safeParse(params.get('page') ?? undefined);
    return ListAssetsQuerySchema.parse({
        scope,
        type: type.success ? type.data : undefined,
        categoryId: scope === 'library' && category.success ? category.data : undefined,
        page: page.success ? page.data : 1,
        limit: 12,
        q: params.get('q')?.trim().slice(0, 100) || undefined,
        hasAnimation:
            type.success &&
            type.data === 'MODEL' &&
            ['true', 'false'].includes(params.get('hasAnimation') || '')
                ? params.get('hasAnimation')
                : undefined,
    });
}
export function updateAssetSearch(
    current: URLSearchParams,
    changes: Record<string, string | undefined>,
) {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
    }
    if ('scope' in changes) {
        next.delete('categoryId');
    }
    if (
        next.get('type') !== 'MODEL' ||
        (current.get('type') !== 'MODEL' && !('hasAnimation' in changes))
    )
        next.delete('hasAnimation');
    next.delete('tag');
    if (!('page' in changes)) next.delete('page');
    return next;
}

/** Keep old shared-library links useful after moving the catalog into Explore. */
export function libraryAssetLocation(current: URLSearchParams) {
    const query = readAssetSearch(
        new URLSearchParams({ ...Object.fromEntries(current), scope: 'library' }),
    );
    const params = new URLSearchParams({ view: 'assets' });
    if (query.type) params.set('type', query.type);
    if (query.q) params.set('q', query.q);
    if (query.categoryId) params.set('categoryId', query.categoryId);
    if (query.hasAnimation !== undefined) params.set('hasAnimation', String(query.hasAnimation));
    if (query.page > 1) params.set('page', String(query.page));
    return `/library?${params}`;
}
