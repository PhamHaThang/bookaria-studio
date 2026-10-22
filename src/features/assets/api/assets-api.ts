import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ContractError, expectStatus, readData, readPage } from '../../../shared/api/contract';
import {
    AssetCategoryListSchema,
    CompleteAssetBodySchema,
    CompleteAssetProcessingSchema,
    CompleteAssetReadySchema,
    ListAssetsQuerySchema,
    UpdateAssetBodySchema,
    UploadSignatureBodySchema,
    UploadSignatureSchema,
} from '../../../shared/contracts/api/assets.schema';
import { AssetUsageSchema } from '../../../shared/contracts/asset.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';
import { AssetSchema } from '../../../shared/contracts/dto.schema';

type ListInput = Omit<z.input<typeof ListAssetsQuerySchema>, 'hasAnimation'> & {
    hasAnimation?: string | boolean;
};

export function createAssetsApi(http: AxiosInstance) {
    return {
        async list(input: ListInput, signal?: AbortSignal) {
            const params = ListAssetsQuerySchema.parse({
                ...input,
                hasAnimation:
                    typeof input.hasAnimation === 'boolean'
                        ? String(input.hasAnimation)
                        : input.hasAnimation,
            });
            return readPage(await http.get('/assets', { params, signal }), AssetSchema);
        },
        async categories(signal?: AbortSignal) {
            return readData(
                await http.get('/asset-categories', { signal }),
                AssetCategoryListSchema,
            );
        },
        async detail(id: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/assets/${IdSchema.parse(id)}`, { signal }),
                AssetSchema,
            );
        },
        async update(id: string, body: z.input<typeof UpdateAssetBodySchema>) {
            return readData(
                await http.patch(
                    `/assets/${IdSchema.parse(id)}`,
                    UpdateAssetBodySchema.parse(body),
                ),
                AssetSchema,
            );
        },
        async usages(id: string, signal?: AbortSignal) {
            return readData(
                await http.get(`/assets/${IdSchema.parse(id)}/usages`, { signal }),
                AssetUsageSchema.array(),
            );
        },
        async remove(id: string) {
            expectStatus(await http.delete(`/assets/${IdSchema.parse(id)}`), 204);
        },
        async signature(body: z.input<typeof UploadSignatureBodySchema>, signal?: AbortSignal) {
            return readData(
                await http.post('/assets/upload-signature', UploadSignatureBodySchema.parse(body), {
                    signal,
                }),
                UploadSignatureSchema,
            );
        },
        async complete(
            id: string,
            body: z.input<typeof CompleteAssetBodySchema>,
            signal?: AbortSignal,
        ) {
            const response = await http.post(
                `/assets/${IdSchema.parse(id)}/complete`,
                CompleteAssetBodySchema.parse(body),
                { signal },
            );
            if (response.status === 200)
                return {
                    processing: false as const,
                    ...readData(response, CompleteAssetReadySchema),
                };
            if (response.status === 202)
                return {
                    processing: true as const,
                    ...readData(response, CompleteAssetProcessingSchema),
                };
            throw new ContractError();
        },
    };
}
export type AssetsApi = ReturnType<typeof createAssetsApi>;
