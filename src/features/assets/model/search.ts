import { ListAssetsQuerySchema } from '../../../shared/contracts/api/assets.schema';
import { IdSchema, PaginationQuerySchema } from '../../../shared/contracts/common.schema';
import { AssetTypeSchema } from '../../../shared/contracts/enums.schema';

export function readAssetSearch(params: URLSearchParams) {
    const type = AssetTypeSchema.safeParse(params.get('type'));
    const category = IdSchema.safeParse(params.get('categoryId'));
    const page = PaginationQuerySchema.shape.page.safeParse(params.get('page') ?? undefined);
    return ListAssetsQuerySchema.parse({
        scope: params.get('scope') === 'library' ? 'library' : 'mine',
        type: type.success ? type.data : undefined,
        categoryId: category.success ? category.data : undefined,
        page: page.success ? page.data : 1,
        limit: 12,
        q: params.get('q')?.trim().slice(0, 100) || undefined,
        tag: params.get('tag')?.trim().slice(0, 30) || undefined,
        hasAnimation: ['true', 'false'].includes(params.get('hasAnimation') || '')
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
    if (!('page' in changes)) next.delete('page');
    return next;
}
