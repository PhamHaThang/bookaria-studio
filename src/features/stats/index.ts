import { apiClient } from '../../shared/api/client';
import { createStatsApi } from './api';

export const statsApi = createStatsApi(apiClient);
export { rangeLabels, readStatsRange, statsKey } from './model';
