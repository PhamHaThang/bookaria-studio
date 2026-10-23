import { apiClient } from '../../shared/api/client';
import { createAdminApi } from './api';
export const adminApi = createAdminApi(apiClient);
export * from './model';

import { createAdminOperationsApi } from './operations-api';
export const adminOperationsApi = createAdminOperationsApi(apiClient);
