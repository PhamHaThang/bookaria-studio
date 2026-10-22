import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { expectStatus, readData } from '../../../shared/api/contract';
import {
    CreatePreviewBodySchema,
    JobStartedSchema,
} from '../../../shared/contracts/api/publish.schema';
import { IdSchema } from '../../../shared/contracts/common.schema';

export function createPreviewApi(http: AxiosInstance) {
    return {
        async create(bookId: string, body: z.input<typeof CreatePreviewBodySchema>) {
            const response = await http.post(
                `/books/${IdSchema.parse(bookId)}/previews`,
                CreatePreviewBodySchema.parse(body),
            );
            expectStatus(response, 202);
            return readData(response, JobStartedSchema);
        },
    };
}
