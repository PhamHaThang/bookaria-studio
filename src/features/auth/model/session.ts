import { useStore } from 'zustand';
import { apiBaseUrl, apiClient } from '../../../shared/api/client';
import { createHttpClient } from '../../../shared/api/http';
import { createAuthClient } from './auth-client';

export const auth = createAuthClient(apiBaseUrl, createHttpClient(apiBaseUrl), apiClient);
export function useAuth() {
    return useStore(auth.store);
}
