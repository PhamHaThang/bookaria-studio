import { type AxiosInstance, isAxiosError } from 'axios';
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
import {
    isNarrationMp3,
    NARRATION_MAX_BYTES,
    NarrationBodySchema,
    NarrationVoicesSchema,
} from '../../../shared/contracts/api/narration.schema';
import { AssetUsageSchema } from '../../../shared/contracts/asset.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';
import { AssetSchema } from '../../../shared/contracts/dto.schema';

type ListInput = Omit<z.input<typeof ListAssetsQuerySchema>, 'hasAnimation'> & {
    hasAnimation?: string | boolean;
};

export function createAssetsApi(http: AxiosInstance) {
    return {
        async narrationVoices(signal?: AbortSignal) {
            return readData(
                await http.get('/assets/narration/voices', { signal }),
                NarrationVoicesSchema,
            );
        },
        async generateNarration(body: z.input<typeof NarrationBodySchema>, signal: AbortSignal) {
            try {
                const response = await http.post(
                    '/assets/narration/generate',
                    NarrationBodySchema.parse(body),
                    { signal, timeout: 190000, responseType: 'blob' },
                );
                expectStatus(response, 200);
                const blob = response.data;
                if (
                    !(blob instanceof Blob) ||
                    blob.type !== 'audio/mpeg' ||
                    blob.size < 576 ||
                    blob.size > NARRATION_MAX_BYTES
                )
                    throw new ContractError();
                if (!isNarrationMp3(new Uint8Array(await blob.arrayBuffer())))
                    throw new ContractError();
                return new File([blob], 'loi-thuyet-minh.mp3', { type: 'audio/mpeg' });
            } catch (cause) {
                if (isAxiosError(cause) && cause.response?.data instanceof Blob) {
                    try {
                        cause.response.data = JSON.parse(await cause.response.data.text());
                    } catch {
                        /* Keep the original request error. */
                    }
                }
                throw cause;
            }
        },
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
                { signal, timeout: 120_000 },
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
