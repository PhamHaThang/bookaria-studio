import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createAuthClient } from '../src/features/auth/model/auth-client';
import { safeReturnPath, validateNewPassword } from '../src/features/auth/model/form';

const user = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'a@example.com',
    displayName: 'An',
    role: 'AUTHOR',
    emailVerified: false,
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t, behavior = {}) {
    const count = { refresh: 0, me: 0, logout: 0, login: 0 };
    let current = 'old';
    const server = createServer(async (req, res) => {
        for await (const _chunk of req) {
            /* Drain the request body before replying. */
        }
        const send = (status, data) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(status === 204 ? undefined : JSON.stringify(data));
        };
        if (req.url === '/auth/login') {
            count.login++;
            if (behavior.badLogin)
                return send(401, {
                    error: { code: 'INVALID_CREDENTIALS', message: 'Sai thông tin đăng nhập.' },
                });
            return send(200, { data: { accessToken: current, expiresIn: 900, user } });
        }
        if (req.url === '/auth/refresh') {
            count.refresh++;
            await wait(behavior.refreshDelay || 20);
            if (behavior.refreshFailure)
                return send(behavior.refreshFailure, {
                    error: { code: 'UNAUTHENTICATED', message: 'Không còn phiên.' },
                });
            current = 'new';
            return send(200, { data: { accessToken: current, expiresIn: 900 } });
        }
        if (req.url === '/me') {
            count.me++;
            if (behavior.meStatus)
                return send(behavior.meStatus, {
                    error: {
                        code: behavior.meStatus === 423 ? 'ACCOUNT_LOCKED' : 'FORBIDDEN',
                        message: 'Không được phép.',
                    },
                });
            if (behavior.expired && req.headers.authorization === 'Bearer old')
                return send(401, { error: { code: 'TOKEN_EXPIRED' } });
            return send(200, {
                data: {
                    ...user,
                    avatarUrl: null,
                    organization: null,
                    bio: null,
                    storage: { usedBytes: 0, quotaBytes: 1000000 },
                    createdAt: '2026-10-21T00:00:00.000Z',
                },
            });
        }
        if (req.url === '/auth/logout') {
            count.logout++;
            return send(behavior.logoutFailure || 204, { error: { message: 'Máy chủ bận.' } });
        }
        if (req.url === '/auth/reset-password') return send(204);
        send(404, { error: { message: 'Missing fixture route' } });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(
        () =>
            new Promise((resolve) => {
                server.close(resolve);
                server.closeAllConnections();
            }),
    );
    return { auth: createAuthClient(`http://127.0.0.1:${server.address().port}`), count };
}
const login = (auth) => auth.login({ email: user.email, password: 'password123', remember: false });

test('two bootstrap calls share one refresh and fetch /me because refresh has no user', async (t) => {
    const { auth, count } = await fixture(t);
    await Promise.all([auth.restore(), auth.restore()]);
    assert.equal(count.refresh, 1);
    assert.equal(count.me, 1);
    assert.equal(auth.store.getState().user.id, user.id);
});
test('no refresh cookie is an ordinary anonymous visitor', async (t) => {
    const { auth } = await fixture(t, { refreshFailure: 401 });
    await auth.restore();
    assert.equal(auth.store.getState().status, 'anonymous');
    assert.equal(auth.store.getState().message, null);
});
test('temporary bootstrap failure remains retryable rather than pretending logout', async (t) => {
    const behavior = { refreshFailure: 503 };
    const { auth } = await fixture(t, behavior);
    await auth.restore();
    assert.equal(auth.store.getState().status, 'error');
    behavior.refreshFailure = 0;
    await auth.restore();
    assert.equal(auth.store.getState().status, 'authenticated');
});
test('parallel expired requests trigger only one refresh and both retry', async (t) => {
    const { auth, count } = await fixture(t, { expired: true });
    await login(auth);
    const result = await Promise.all([auth.api.get('/me'), auth.api.get('/me')]);
    assert.equal(result.length, 2);
    assert.equal(count.refresh, 1);
    assert.equal(count.me, 4);
});
test('rejected refresh clears session without a retry loop', async (t) => {
    const { auth, count } = await fixture(t, { expired: true, refreshFailure: 401 });
    await login(auth);
    await assert.rejects(auth.api.get('/me'));
    assert.equal(count.refresh, 1);
    assert.equal(auth.store.getState().token, null);
});
test('a second 401 ends the session after one retry', async (t) => {
    const { auth, count } = await fixture(t, { meStatus: 401 });
    await login(auth);
    await assert.rejects(auth.api.get('/me'));
    assert.equal(count.refresh, 1);
    assert.equal(count.me, 2);
    assert.equal(auth.store.getState().status, 'anonymous');
});
test('423 clears session without refreshing', async (t) => {
    const { auth, count } = await fixture(t, { meStatus: 423 });
    await login(auth);
    await assert.rejects(auth.api.get('/me'));
    assert.equal(count.refresh, 0);
    assert.equal(auth.store.getState().user, null);
});
test('403 preserves the session and does not refresh', async (t) => {
    const { auth, count } = await fixture(t, { meStatus: 403 });
    await login(auth);
    await assert.rejects(auth.api.get('/me'));
    assert.equal(count.refresh, 0);
    assert.equal(auth.store.getState().status, 'authenticated');
});
test('wrong login password does not invoke refresh interceptor', async (t) => {
    const { auth, count } = await fixture(t, { badLogin: true });
    await assert.rejects(login(auth));
    assert.equal(count.refresh, 0);
});
test('logout waits for refresh and a late response cannot restore the session', async (t) => {
    const { auth, count } = await fixture(t, { expired: true, refreshDelay: 80 });
    await login(auth);
    const pending = auth.api.get('/me').catch(() => undefined);
    while (!count.refresh) await wait(2);
    await auth.logout();
    await pending;
    assert.equal(count.logout, 1);
    assert.equal(auth.store.getState().token, null);
    assert.equal(auth.store.getState().status, 'anonymous');
});
test('failed server logout preserves the session for retry', async (t) => {
    const { auth } = await fixture(t, { logoutFailure: 503 });
    await login(auth);
    await assert.rejects(auth.logout());
    assert.equal(auth.store.getState().status, 'authenticated');
    assert.equal(auth.store.getState().signingOut, false);
});
test('reset password accepts empty 204 and clears local auth', async (t) => {
    const { auth } = await fixture(t);
    await login(auth);
    await auth.resetPassword('token', 'password123');
    assert.equal(auth.store.getState().status, 'anonymous');
});
test('new passwords enforce UTF-8 byte limit and confirmation', () => {
    assert.equal(validateNewPassword('ế'.repeat(24), 'ế'.repeat(24)), null);
    assert.equal(
        validateNewPassword('ế'.repeat(25), 'ế'.repeat(25)),
        'Mật khẩu quá dài, vui lòng rút ngắn lại.',
    );
    assert.equal(validateNewPassword('a'.repeat(72), 'a'.repeat(72)), null);
    assert.equal(
        validateNewPassword('a'.repeat(73), 'a'.repeat(73)),
        'Mật khẩu quá dài, vui lòng rút ngắn lại.',
    );
    assert.ok(validateNewPassword('password123', 'other'));
});
test('return path stays within protected Studio, account and Admin routes', () => {
    for (const path of ['https://example.com', '//example.com', '/login', '/books\\evil'])
        assert.equal(safeReturnPath(path), '/books');
    assert.equal(safeReturnPath('/books/example'), '/books/example');
    assert.equal(safeReturnPath('/assets/upload'), '/assets/upload');
    assert.equal(safeReturnPath('/assets?scope=library'), '/assets?scope=library');
    assert.equal(safeReturnPath('/profile'), '/profile');
    assert.equal(safeReturnPath('/change-password'), '/change-password');
    assert.equal(safeReturnPath('/change-password-evil'), '/books');
    assert.equal(safeReturnPath('/admin'), '/admin');
    assert.equal(safeReturnPath('/admin/users?status=ACTIVE'), '/admin/users?status=ACTIVE');
    assert.equal(safeReturnPath('/admin/profile'), '/admin/profile');
    assert.equal(safeReturnPath('/administrator'), '/books');
    assert.equal(safeReturnPath('/admin\\evil'), '/books');
    assert.equal(safeReturnPath('/assets-evil'), '/books');
    assert.equal(safeReturnPath('/assets\\evil'), '/books');
});
