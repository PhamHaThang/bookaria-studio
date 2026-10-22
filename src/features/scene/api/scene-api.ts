import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ContractError, expectStatus, readData } from '../../../shared/api/contract';
import {
    SaveSceneBodySchema,
    SaveSceneResultSchema,
} from '../../../shared/contracts/api/pages.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';

export function createSceneApi(http: AxiosInstance) {
    return {
        async save(pageId: string, body: z.input<typeof SaveSceneBodySchema>) {
            const response = await http.patch(
                `/pages/${IdSchema.parse(pageId)}/scene`,
                SaveSceneBodySchema.parse(body),
            );
            expectStatus(response, 200);
            const result = readData(response, SaveSceneResultSchema);
            if (result.revision !== body.revision + 1) throw new ContractError();
            return result;
        },
    };
}
