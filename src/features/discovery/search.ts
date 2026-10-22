import { PublicBooksQuerySchema } from '../../shared/contracts/api/public.schema';

export function readDiscoverySearch(params: URLSearchParams) {
    const read = <K extends keyof typeof PublicBooksQuerySchema.shape>(key: K) => {
        const raw = params.get(key);
        const parsed = PublicBooksQuerySchema.shape[key].safeParse(raw?.trim() || undefined);
        return parsed.success ? parsed.data : undefined;
    };
    return PublicBooksQuerySchema.parse({
        q: params.get('q')?.trim().slice(0, 100) || undefined,
        topic: params.get('topic')?.trim().slice(0, 50) || undefined,
        age: read('age'),
        language: read('language'),
        sort: read('sort'),
        page: read('page'),
        limit: 12,
    });
}

export function updateDiscoverySearch(
    current: URLSearchParams,
    changes: Record<string, string | undefined>,
) {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined && value !== '') next.set(key, value);
        else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    return next;
}
