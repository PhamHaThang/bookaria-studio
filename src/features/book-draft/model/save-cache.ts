import type { QueryClient } from '@tanstack/react-query';
import type { SaveBookDraftResult } from '@/shared/contracts/api/book-draft.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import { assetKeys } from '../../assets/model/assets';
import { bookKeys } from '../../books/model/books';
import { pageKeys } from '../../pages/model/pages';

/** The save response is authoritative; keep the active editor mounted while other views become stale. */
export function rememberBookDraftSave(
    cache: QueryClient,
    userId: string,
    bookId: string,
    result: SaveBookDraftResult,
) {
    for (const page of result.pages) cache.setQueryData(pageKeys.detail(userId, page.id), page);
    cache.setQueryData(pageKeys.list(userId, bookId), result.snapshot.pages);
    cache.setQueryData<BookDetail>(bookKeys.detail(userId, bookId), (current) =>
        current
            ? {
                  ...current,
                  ...result.snapshot.geometry,
                  pages: result.snapshot.pages,
                  pageCount: result.snapshot.pages.length,
              }
            : current,
    );
    // Refetch on entering a relevant screen, rather than immediately fetching the editor's data again.
    void cache.invalidateQueries({ queryKey: bookKeys.all, refetchType: 'none' });
    void cache.invalidateQueries({ queryKey: assetKeys.all, refetchType: 'none' });
}
