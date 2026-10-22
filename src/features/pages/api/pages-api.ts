import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { expectStatus, readData } from '../../../shared/api/contract';
import {
    AddPageBodySchema,
    AddPageResultSchema,
    BookariaMarkerResultSchema,
    CustomMarkerResultSchema,
    MarkerInfoSchema,
    ReorderPagesBodySchema,
    ReorderPagesResultSchema,
    ReplacePageImageBodySchema,
    ReplacePageImageResultSchema,
    UpdateMarkerBodySchema,
    UpdatePageBodySchema,
} from '../../../shared/contracts/api/pages.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';
import { JobSchema, PageSchema, PageSummarySchema } from '../../../shared/contracts/dto.schema';

export function createPagesApi(http: AxiosInstance) {
    return {
        async list(bookId: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/books/${IdSchema.parse(bookId)}/pages`, { signal }),
                PageSummarySchema.array(),
            );
        },
        async detail(pageId: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/pages/${IdSchema.parse(pageId)}`, { signal }),
                PageSchema,
            );
        },
        async add(bookId: string, body: z.input<typeof AddPageBodySchema>) {
            const response = await http.post(
                `/books/${IdSchema.parse(bookId)}/pages`,
                AddPageBodySchema.parse(body),
            );
            expectStatus(response, 201);
            return readData(response, AddPageResultSchema);
        },
        async reorder(bookId: string, pageIds: string[]) {
            const response = await http.patch(
                `/books/${IdSchema.parse(bookId)}/pages/reorder`,
                ReorderPagesBodySchema.parse({ pageIds }),
            );
            return readData(response, ReorderPagesResultSchema);
        },
        async update(pageId: string, body: z.input<typeof UpdatePageBodySchema>) {
            return readData(
                await http.patch(
                    `/pages/${IdSchema.parse(pageId)}`,
                    UpdatePageBodySchema.parse(body),
                ),
                PageSummarySchema,
            );
        },
        async duplicate(pageId: string) {
            const response = await http.post(`/pages/${IdSchema.parse(pageId)}/duplicate`);
            expectStatus(response, 201);
            return readData(response, z.object({ page: PageSummarySchema }));
        },
        async remove(pageId: string) {
            expectStatus(await http.delete(`/pages/${IdSchema.parse(pageId)}`), 204);
        },
        async replaceImage(pageId: string, body: z.input<typeof ReplacePageImageBodySchema>) {
            return readData(
                await http.put(
                    `/pages/${IdSchema.parse(pageId)}/image`,
                    ReplacePageImageBodySchema.parse(body),
                ),
                ReplacePageImageResultSchema,
            );
        },
        async marker(pageId: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/pages/${IdSchema.parse(pageId)}/marker`, { signal }),
                MarkerInfoSchema,
            );
        },
        async setMarker(pageId: string, body: z.input<typeof UpdateMarkerBodySchema>) {
            const parsed = UpdateMarkerBodySchema.parse(body);
            const response = await http.put(`/pages/${IdSchema.parse(pageId)}/marker`, parsed);
            if (parsed.mode === 'BOOKARIA_MARKER') {
                expectStatus(response, 200);
                return {
                    processing: false as const,
                    ...readData(response, BookariaMarkerResultSchema),
                };
            }
            expectStatus(response, 202);
            return { processing: true as const, ...readData(response, CustomMarkerResultSchema) };
        },
        async rescore(pageId: string) {
            const response = await http.post(`/pages/${IdSchema.parse(pageId)}/marker/rescore`);
            expectStatus(response, 202);
            return readData(response, z.object({ jobId: IdSchema }));
        },
        async job(id: string, signal?: AbortSignal) {
            return readData(await http.get(`/jobs/${IdSchema.parse(id)}`, { signal }), JobSchema);
        },
    };
}
export type PagesApi = ReturnType<typeof createPagesApi>;
