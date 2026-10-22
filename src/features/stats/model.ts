import { StatsRangeSchema } from '../../shared/contracts/api/books.schema';

export const statsKey = (userId: string, bookId: string, range: string) =>
    ['stats', userId, bookId, range] as const;
export function readStatsRange(params: URLSearchParams) {
    const parsed = StatsRangeSchema.safeParse(params.get('range'));
    return parsed.success ? parsed.data : '30d';
}
export const rangeLabels = { '7d': '7 ngày', '30d': '30 ngày', '90d': '90 ngày' };
