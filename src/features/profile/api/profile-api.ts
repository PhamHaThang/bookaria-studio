import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { expectStatus, readData } from '../../../shared/api/contract';
import {
    ChangePasswordBodySchema,
    MeUpdateBodySchema,
} from '../../../shared/contracts/api/me.schema';
import { MeSchema } from '../../../shared/contracts/dto.schema';

export function createProfileApi(http: AxiosInstance) {
    return {
        async get(signal?: AbortSignal) {
            return readData(await http.get('/me', { signal }), MeSchema);
        },
        async update(body: z.input<typeof MeUpdateBodySchema>) {
            return readData(await http.patch('/me', MeUpdateBodySchema.parse(body)), MeSchema);
        },
        async changePassword(body: z.input<typeof ChangePasswordBodySchema>) {
            expectStatus(await http.put('/me/password', ChangePasswordBodySchema.parse(body)), 204);
        },
    };
}
