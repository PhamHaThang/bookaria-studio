import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { expectStatus, readData } from '../../../shared/api/contract';
import {
    JobStartedSchema,
    ListBookVersionsQuerySchema,
    PrintLayoutSchema,
    PrintPdfBodySchema,
    PublishBodySchema,
    PublishCheckSchema,
    ShareInfoSchema,
    VersionPageSchema,
} from '../../../shared/contracts/api/publish.schema';
import { IdSchema, SlugSchema } from '../../../shared/contracts/common.schema';
import { BookSummarySchema, PublicBookSchema } from '../../../shared/contracts/dto.schema';

export function createPublicationApi(http: AxiosInstance) {
    const path = (id: string) => `/books/${IdSchema.parse(id)}`;
    return {
        async check(id: string, signal?: AbortSignal) {
            return readData(
                await http.get(`${path(id)}/publish-check`, { signal }),
                PublishCheckSchema,
            );
        },
        async versions(
            id: string,
            query: z.input<typeof ListBookVersionsQuerySchema> = {},
            signal?: AbortSignal,
        ) {
            const params = ListBookVersionsQuerySchema.parse(query);
            return readData(
                await http.get(`${path(id)}/versions`, { params, signal }),
                VersionPageSchema,
            );
        },
        async share(id: string, signal?: AbortSignal) {
            return readData(await http.get(`${path(id)}/share`, { signal }), ShareInfoSchema);
        },
        async publish(id: string, body: z.input<typeof PublishBodySchema>) {
            const parsed = PublishBodySchema.parse(body);
            if (parsed.visibility === 'PRIVATE')
                throw new Error('Chọn công khai hoặc không niêm yết để xuất bản.');
            const response = await http.post(`${path(id)}/publish`, parsed);
            expectStatus(response, 202);
            return readData(response, JobStartedSchema);
        },
        async unpublish(id: string) {
            return readData(await http.post(`${path(id)}/unpublish`), BookSummarySchema);
        },
        async printLayout(id: string, signal?: AbortSignal) {
            return readData(
                await http.get(`${path(id)}/print-layout`, { signal }),
                PrintLayoutSchema,
            );
        },
        async print(id: string, body: z.input<typeof PrintPdfBodySchema>) {
            const response = await http.post(
                `${path(id)}/print-pdf`,
                PrintPdfBodySchema.parse(body),
            );
            expectStatus(response, 202);
            return readData(response, JobStartedSchema);
        },
        async publicBook(slug: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/public/books/${SlugSchema.parse(slug)}`, {
                    signal,
                    headers: { 'Cache-Control': 'no-cache' },
                }),
                PublicBookSchema,
            );
        },
    };
}
