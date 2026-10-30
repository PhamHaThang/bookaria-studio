import type { AxiosInstance } from 'axios';
import { apiClient } from '@/shared/api/client';
import { expectStatus, readData } from '@/shared/api/contract';
import {
    BookDraftSnapshotSchema,
    type SaveBookDraftBody,
    SaveBookDraftBodySchema,
    SaveBookDraftResultSchema,
} from '@/shared/contracts/api/book-draft.schema';
import { PageImageLayoutSchema } from '@/shared/contracts/api/pages.schema';
import { IdSchema } from '@/shared/contracts/common.schema';
export function createBookDraftApi(http: AxiosInstance) {
    return {
        async read(bookId: string, signal?: AbortSignal) {
            const response = await http.get(`/books/${IdSchema.parse(bookId)}/draft`, { signal });
            expectStatus(response, 200);
            return readData(response, BookDraftSnapshotSchema);
        },
        async save(bookId: string, body: SaveBookDraftBody) {
            const response = await http.put(
                `/books/${IdSchema.parse(bookId)}/draft`,
                SaveBookDraftBodySchema.parse(body),
            );
            expectStatus(response, 200);
            return readData(response, SaveBookDraftResultSchema);
        },
        async imageLayout(bookId: string, imageAssetId: string, aspect: number) {
            const response = await http.post(
                `/books/${IdSchema.parse(bookId)}/draft/image-layout`,
                { imageAssetId: IdSchema.parse(imageAssetId), aspect },
            );
            expectStatus(response, 200);
            return readData(response, PageImageLayoutSchema);
        },
    };
}
export const bookDraftApi = createBookDraftApi(apiClient);
