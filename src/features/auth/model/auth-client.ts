import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { errorMessage } from '../../../shared/api/errors';
import { createHttpClient } from '../../../shared/api/http';
import type {
    AuthResponse,
    LoginBody,
    RegisterBody,
} from '../../../shared/contracts/api/auth.schema';
import type { Me } from '../../../shared/contracts/dto.schema';
import { createAuthApi } from '../api/auth-api';
import { createAuthStore } from './auth.store';

type AuthConfig = InternalAxiosRequestConfig & { retried?: boolean; epoch?: number };

export function createAuthClient(
    baseURL = '/api/v1',
    raw: AxiosInstance = createHttpClient(baseURL),
    api: AxiosInstance = createHttpClient(baseURL),
) {
    const store = createAuthStore();
    const endpoints = createAuthApi(raw, api);
    let epoch = 0;
    let refreshFlight: Promise<string> | null = null;
    let restoreFlight: Promise<void> | null = null;
    const changedSession = () => new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');

    function clear(message: string | null = null) {
        epoch++;
        store.setState({
            status: 'anonymous',
            user: null,
            token: null,
            message,
            signingOut: false,
        });
    }
    function refresh(): Promise<string> {
        if (store.getState().signingOut) return Promise.reject(changedSession());
        if (refreshFlight) return refreshFlight;
        const started = epoch;
        refreshFlight = endpoints
            .refresh()
            .then((data) => {
                if (started !== epoch) throw changedSession();
                store.setState({ token: data.accessToken });
                return data.accessToken;
            })
            .catch((error: unknown) => {
                if (
                    started === epoch &&
                    axios.isAxiosError(error) &&
                    [401, 423].includes(error.response?.status ?? 0)
                ) {
                    clear(
                        error.response?.status === 423
                            ? errorMessage(error)
                            : 'Phiên đã hết hạn. Vui lòng đăng nhập lại.',
                    );
                }
                throw error;
            })
            .finally(() => {
                refreshFlight = null;
            });
        return refreshFlight;
    }
    api.interceptors.request.use((config: AuthConfig) => {
        config.epoch ??= epoch;
        if (config.epoch !== epoch || store.getState().signingOut) throw changedSession();
        const token = store.getState().token;
        if (token) config.headers.set('Authorization', `Bearer ${token}`);
        return config;
    });
    api.interceptors.response.use(
        (response) => {
            if ((response.config as AuthConfig).epoch !== epoch) throw changedSession();
            return response;
        },
        async (error: unknown) => {
            if (!axios.isAxiosError(error)) throw error;
            const config = error.config as AuthConfig | undefined;
            if (!config || config.epoch !== epoch || store.getState().signingOut) throw error;
            if (error.response?.status === 423) {
                clear(errorMessage(error));
                throw error;
            }
            if (error.response?.status !== 401 || !store.getState().token) throw error;
            if (config.retried) {
                clear('Phiên không còn hợp lệ. Vui lòng đăng nhập lại.');
                throw error;
            }
            config.retried = true;
            const current = store.getState().token;
            if (config.headers.get('Authorization') === `Bearer ${current}`) await refresh();
            return api.request(config);
        },
    );

    async function profile(): Promise<Me> {
        const user = await endpoints.profile();
        store.setState({ user, status: 'authenticated' });
        return user;
    }
    function restore(): Promise<void> {
        if (restoreFlight) return restoreFlight;
        if (store.getState().status === 'authenticated' || store.getState().status === 'anonymous')
            return Promise.resolve();
        const started = epoch;
        store.setState({ status: 'loading', message: null });
        restoreFlight = (async () => {
            try {
                await refresh();
                await profile();
            } catch (error) {
                if (store.getState().status === 'anonymous') {
                    if (axios.isAxiosError(error) && error.response?.status === 401)
                        store.setState({ message: null });
                    return;
                }
                if (started === epoch)
                    store.setState({ status: 'error', message: errorMessage(error) });
            }
        })().finally(() => {
            restoreFlight = null;
        });
        return restoreFlight;
    }
    async function authenticate(request: () => Promise<AuthResponse>) {
        if (refreshFlight) await refreshFlight.catch(() => undefined);
        const started = ++epoch;
        const data = await request();
        if (started !== epoch) throw changedSession();
        store.setState({
            status: 'authenticated',
            user: data.user,
            token: data.accessToken,
            message: null,
            signingOut: false,
        });
        return data.user;
    }
    async function logout() {
        epoch++;
        store.setState({ signingOut: true });
        try {
            if (refreshFlight) await refreshFlight.catch(() => undefined);
            await endpoints.logout();
            clear();
        } finally {
            store.setState({ signingOut: false });
        }
    }
    return {
        store,
        api,
        restore,
        profile,
        logout,
        login: (body: LoginBody) => authenticate(() => endpoints.login(body)),
        register: (body: RegisterBody) => authenticate(() => endpoints.register(body)),
        forgotPassword: endpoints.forgotPassword,
        verifyEmail: endpoints.verifyEmail,
        resendVerification: endpoints.resendVerification,
        resetPassword: async (token: string, newPassword: string) => {
            await endpoints.resetPassword(token, newPassword);
            clear(); // The backend revokes all sessions; 204 has no JSON body to parse.
        },
    };
}
