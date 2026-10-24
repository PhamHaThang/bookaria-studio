import { safeReturnPath } from './form';

export const authModes = ['login', 'register', 'forgot', 'reset', 'verify', 'check-email'] as const;
export type AuthMode = (typeof authModes)[number];
type PageLocation = { pathname: string; search: string; hash: string };

export function readAuthMode(search: string): AuthMode | null {
    const value = new URLSearchParams(search).get('auth');
    return authModes.find((mode) => mode === value) ?? null;
}

export function withoutAuth(location: PageLocation): PageLocation {
    const params = new URLSearchParams(location.search);
    for (const key of ['auth', 'next', 'token']) params.delete(key);
    return { ...location, search: params.size ? `?${params}` : '' };
}

export function authLocation(location: PageLocation, mode: AuthMode, next?: string): PageLocation {
    const params = new URLSearchParams(location.search);
    params.set('auth', mode);
    if (mode !== 'reset' && mode !== 'verify') params.delete('token');
    if (next !== undefined) params.set('next', safeReturnPath(next));
    return { pathname: location.pathname, search: `?${params}`, hash: location.hash };
}

export function protectedLogin(location: PageLocation): PageLocation {
    const background = withoutAuth(location);
    return authLocation(
        { pathname: '/', search: '', hash: '' },
        'login',
        `${background.pathname}${background.search}${background.hash}`,
    );
}

export function legacyAuthLocation(
    location: PageLocation,
    mode: AuthMode,
    from?: unknown,
): PageLocation {
    const params = new URLSearchParams(location.search);
    const next = params.get('next') ?? (typeof from === 'string' ? from : undefined);
    const token = params.get('token');
    const target = authLocation({ pathname: '/', search: '', hash: '' }, mode, next);
    if (token && (mode === 'reset' || mode === 'verify')) {
        const search = new URLSearchParams(target.search);
        search.set('token', token);
        target.search = `?${search}`;
    }
    return target;
}
