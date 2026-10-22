import { apiClient } from '../../../shared/api/client';
import { createProfileApi } from '../api/profile-api';

export const profileApi = createProfileApi(apiClient);
export const profileKey = (id: string) => ['me', id] as const;
