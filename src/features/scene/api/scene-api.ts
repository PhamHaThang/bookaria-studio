import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ContractError, expectStatus, readData } from '../../../shared/api/contract';
import {
    InteractionAiBodySchema,
    InteractionAiResultSchema,
} from '../../../shared/contracts/api/interaction-ai.schema';
import {
    SaveSceneBodySchema,
    SaveSceneResultSchema,
} from '../../../shared/contracts/api/pages.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';

export function createSceneApi(http: AxiosInstance) {
    return {
        async propose(
            pageId: string,
            body: z.input<typeof InteractionAiBodySchema>,
            signal?: AbortSignal,
        ) {
            const response = await http.post(
                `/pages/${IdSchema.parse(pageId)}/interaction-proposals`,
                InteractionAiBodySchema.parse(body),
                { signal, timeout: 250_000 },
            );
            expectStatus(response, 200);
            const result = readData(response, InteractionAiResultSchema);
            if (result.revision !== body.revision) throw new ContractError();
            return result;
        },
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
