import { useStore } from 'zustand';
import { createAuthClient } from './auth-client';

export const auth = createAuthClient(import.meta.env.VITE_API_BASE_URL || '/api/v1');
export function useAuth() {
    return useStore(auth.store);
}
