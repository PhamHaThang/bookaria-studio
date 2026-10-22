import {
    BookSortSchema,
    type ListBooksQuery,
    ListBooksQuerySchema,
} from '../../../shared/contracts/api/books.schema';
import { PaginationQuerySchema } from '../../../shared/contracts/common.schema';
import { BookStatusSchema } from '../../../shared/contracts/enums.schema';

export function readBookSearch(params: URLSearchParams): ListBooksQuery {
    const page = PaginationQuerySchema.shape.page.safeParse(params.get('page') ?? undefined);
    const sort = BookSortSchema.safeParse(params.get('sort') ?? '-updatedAt');
    const status = BookStatusSchema.safeParse(params.get('status'));
    return ListBooksQuerySchema.parse({
        q: params.get('q')?.trim().slice(0, 100) || undefined,
        page: page.success ? page.data : 1,
        limit: 12,
        sort: sort.success ? sort.data : '-updatedAt',
        status: status.success ? status.data : undefined,
    });
}
export function updateBookSearch(
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
export const bookStatusLabels = {
    DRAFT: 'Bản nháp',
    PUBLISHED: 'Đã xuất bản',
    CHANGED: 'Có thay đổi',
};
