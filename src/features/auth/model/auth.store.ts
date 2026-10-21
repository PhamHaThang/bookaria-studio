import { createStore } from 'zustand/vanilla';
import type { AuthUser } from '../../../shared/contracts/api/auth.schema';

interface AuthState {
    status: 'loading' | 'anonymous' | 'authenticated' | 'error';
    user: AuthUser | null;
    token: string | null;
    message: string | null;
    signingOut: boolean;
}
export function createAuthStore() {
    return createStore<AuthState>(() => ({
        status: 'loading',
        user: null,
        token: null,
        message: null,
        signingOut: false,
    }));
}
