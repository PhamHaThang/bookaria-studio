import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { expectStatus, readData, readPage } from '../../../shared/api/contract';
import {
    CreateBookBodySchema,
    CreateBookResultSchema,
    ListBooksQuerySchema,
    TrashBookItemSchema,
    UpdateBookBodySchema,
} from '../../../shared/contracts/api/books.schema';
import { IdSchema, PaginationQuerySchema } from '../../../shared/contracts/common.schema';
import { BookDetailSchema, BookSummarySchema } from '../../../shared/contracts/dto.schema';

export function createBooksApi(http: AxiosInstance) {
    return {
        async list(query: z.input<typeof ListBooksQuerySchema>, signal?: AbortSignal) {
            return readPage(
                await http.get('/books', { params: ListBooksQuerySchema.parse(query), signal }),
                BookSummarySchema,
            );
        },
        async trash(query: z.input<typeof PaginationQuerySchema>, signal?: AbortSignal) {
            return readPage(
                await http.get('/books/trash', {
                    params: PaginationQuerySchema.parse(query),
                    signal,
                }),
                TrashBookItemSchema,
            );
        },
        async detail(id: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/books/${IdSchema.parse(id)}`, { signal }),
                BookDetailSchema,
            );
        },
        async create(body: z.input<typeof CreateBookBodySchema>) {
            const response = await http.post('/books', CreateBookBodySchema.parse(body));
            expectStatus(response, 201);
            return readData(response, CreateBookResultSchema);
        },
        async update(id: string, body: z.input<typeof UpdateBookBodySchema>) {
            return readData(
                await http.patch(`/books/${IdSchema.parse(id)}`, UpdateBookBodySchema.parse(body)),
                BookSummarySchema,
            );
        },
        async remove(id: string) {
            expectStatus(await http.delete(`/books/${IdSchema.parse(id)}`), 204);
        },
        async restore(id: string) {
            return readData(
                await http.post(`/books/${IdSchema.parse(id)}/restore`),
                BookSummarySchema,
            );
        },
    };
}
export type BooksApi = ReturnType<typeof createBooksApi>;
