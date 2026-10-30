import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ContractError, expectStatus, readData, readPage } from '../../shared/api/contract';
import {
    CreateBookariaMarkerBodySchema,
    CreateCategoryBodySchema,
    CreateLibraryAssetBodySchema,
    LibraryAssetsQuerySchema,
    MarkerTestResultSchema,
    UpdateBookariaMarkerBodySchema,
    UpdateCategoryBodySchema,
    UpdateLibraryAssetBodySchema,
} from '../../shared/contracts/api/admin.schema';
import { IdSchema, PaginationQuerySchema } from '../../shared/contracts/common.schema';
import {
    AssetCategorySchema,
    AssetSchema,
    BookariaMarkerSchema,
} from '../../shared/contracts/dto.schema';

export function createAdminLibraryApi(http: AxiosInstance) {
    const same = <T extends { id: string }>(value: T, id?: string): T => {
        if (id && value.id.toLowerCase() !== id.toLowerCase()) throw new ContractError();
        return value;
    };
    const shared = (asset: z.infer<typeof AssetSchema>, id?: string) => {
        if (asset.scope !== 'library') throw new ContractError();
        return same(asset, id);
    };
    return {
        async testMarker(file: File, signal: AbortSignal, onProgress: (percent: number) => void) {
            const res = await http.post('/admin/bookaria-markers/test', file, {
                signal,
                timeout: 60_000,
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                onUploadProgress: ({ loaded, total }) => {
                    if (total) onProgress(Math.min(100, Math.round((loaded * 100) / total)));
                },
            });
            expectStatus(res, 200);
            return readData(res, MarkerTestResultSchema);
        },
        async library(input: z.input<typeof LibraryAssetsQuerySchema>, signal?: AbortSignal) {
            const res = await http.get('/admin/library/assets', {
                params: LibraryAssetsQuerySchema.parse(input),
                signal,
            });
            expectStatus(res, 200);
            const result = readPage(res, AssetSchema);
            result.data.forEach((asset) => {
                shared(asset);
            });
            return result;
        },
        async promote(input: z.input<typeof CreateLibraryAssetBodySchema>) {
            const body = CreateLibraryAssetBodySchema.parse(input),
                res = await http.post('/admin/library/assets', body);
            expectStatus(res, 201);
            return shared(readData(res, AssetSchema), body.assetId);
        },
        async update(id: string, input: z.input<typeof UpdateLibraryAssetBodySchema>) {
            const res = await http.patch(
                `/admin/library/assets/${IdSchema.parse(id)}`,
                UpdateLibraryAssetBodySchema.parse(input),
            );
            expectStatus(res, 200);
            return shared(readData(res, AssetSchema), id);
        },
        async remove(id: string) {
            expectStatus(await http.delete(`/admin/library/assets/${IdSchema.parse(id)}`), 204);
        },
        async createCategory(input: z.input<typeof CreateCategoryBodySchema>) {
            const res = await http.post(
                '/admin/asset-categories',
                CreateCategoryBodySchema.parse(input),
            );
            expectStatus(res, 201);
            return readData(res, AssetCategorySchema);
        },
        async updateCategory(id: string, input: z.input<typeof UpdateCategoryBodySchema>) {
            const res = await http.patch(
                `/admin/asset-categories/${IdSchema.parse(id)}`,
                UpdateCategoryBodySchema.parse(input),
            );
            expectStatus(res, 200);
            return same(readData(res, AssetCategorySchema), id);
        },
        async removeCategory(id: string) {
            expectStatus(await http.delete(`/admin/asset-categories/${IdSchema.parse(id)}`), 204);
        },
        async markers(input: z.input<typeof PaginationQuerySchema>, signal?: AbortSignal) {
            const res = await http.get('/admin/bookaria-markers', {
                params: PaginationQuerySchema.parse(input),
                signal,
            });
            expectStatus(res, 200);
            return readPage(res, BookariaMarkerSchema);
        },
        async createMarker(input: z.input<typeof CreateBookariaMarkerBodySchema>) {
            const res = await http.post(
                '/admin/bookaria-markers',
                CreateBookariaMarkerBodySchema.parse(input),
            );
            expectStatus(res, 201);
            return readData(res, BookariaMarkerSchema);
        },
        async setMarker(id: string, input: z.input<typeof UpdateBookariaMarkerBodySchema>) {
            const res = await http.patch(
                `/admin/bookaria-markers/${IdSchema.parse(id)}`,
                UpdateBookariaMarkerBodySchema.parse(input),
            );
            expectStatus(res, 200);
            return same(readData(res, BookariaMarkerSchema), id);
        },
    };
}
