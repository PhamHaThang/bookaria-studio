import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { ContractError, expectStatus, readData } from '../../shared/api/contract';
import {
    BookStatsSchema,
    StatsQuerySchema,
    StudioReadingStatsSchema,
} from '../../shared/contracts/api/books.schema';
import { IdSchema } from '../../shared/contracts/common.schema';

export function createStatsApi(http: AxiosInstance) {
    return {
        async studioReading(signal?: AbortSignal) {
            const response = await http.get('/studio/reading-stats', { signal });
            expectStatus(response, 200);
            return readData(response, StudioReadingStatsSchema);
        },
        async book(id: string, input: z.input<typeof StatsQuerySchema>, signal?: AbortSignal) {
            const query = StatsQuerySchema.parse(input);
            const response = await http.get(`/books/${IdSchema.parse(id)}/stats`, {
                params: query,
                signal,
            });
            expectStatus(response, 200);
            const stats = readData(response, BookStatsSchema);
            if (stats.range !== query.range) throw new ContractError();
            return stats;
        },
    };
}
