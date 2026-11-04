import { apiClient } from '../../shared/api/client';

export * from './api';
export * from './client';
export * from './model';

import { createAdminOperationsApi } from './operations-api';
export const adminOperationsApi = createAdminOperationsApi(apiClient);

export * from './components/UserCreateModal';
export * from './components/UserDeleteModal';
export * from './components/UserDetailModal';
export * from './components/UserLockModal';
export * from './components/UserUpdateModal';
