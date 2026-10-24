import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    authLocation,
    legacyAuthLocation,
    protectedLogin,
    readAuthMode,
    withoutAuth,
} from '../src/features/auth/model/dialog';

const library = { pathname: '/library', search: '?q=truy%E1%BB%87n&sort=newest', hash: '#results' };
test('auth switches and close preserve library filters and anchor', () => {
    const login = authLocation(library, 'login');
    assert.equal(readAuthMode(login.search), 'login');
    const register = authLocation(login, 'register');
    assert.equal(readAuthMode(register.search), 'register');
    assert.deepEqual(withoutAuth(register), library);
});
test('protected intent keeps query and anchor and rejects unsafe destinations', () => {
    const login = protectedLogin({ pathname: '/admin/users', search: '?page=2', hash: '#users' });
    assert.equal(login.pathname, '/');
    const switched = authLocation(login, 'register');
    assert.equal(new URLSearchParams(switched.search).get('next'), '/admin/users?page=2#users');
    for (const unsafe of [
        'https://evil.example',
        '//evil.example',
        '/bookshelf',
        '/books\\evil',
        '/profiled',
    ])
        assert.equal(
            new URLSearchParams(authLocation(library, 'login', unsafe).search).get('next'),
            '/books',
        );
});
test('email URLs retain tokens only for verification/reset and remove them on close', () => {
    const verify = legacyAuthLocation(
        { pathname: '/verify-email', search: '?token=test-secret', hash: '' },
        'verify',
    );
    assert.equal(new URLSearchParams(verify.search).get('token'), 'test-secret');
    assert.equal(
        new URLSearchParams(authLocation(verify, 'check-email').search).has('token'),
        false,
    );
    assert.deepEqual(withoutAuth(verify), { pathname: '/', search: '', hash: '' });
    const reset = legacyAuthLocation(
        { pathname: '/reset-password', search: '?token=reset-secret', hash: '' },
        'reset',
    );
    assert.equal(new URLSearchParams(reset.search).get('token'), 'reset-secret');
    assert.equal(new URLSearchParams(authLocation(reset, 'login').search).has('token'), false);
});
test('legacy links preserve safe explicit return and plain login stays on home', () => {
    const direct = legacyAuthLocation({ pathname: '/login', search: '', hash: '' }, 'login');
    assert.deepEqual(withoutAuth(direct), { pathname: '/', search: '', hash: '' });
    assert.equal(new URLSearchParams(direct.search).has('next'), false);
    const old = legacyAuthLocation(
        { pathname: '/login', search: '', hash: '' },
        'login',
        '/books/trash',
    );
    assert.equal(new URLSearchParams(old.search).get('next'), '/books/trash');
    assert.equal(readAuthMode('?auth=unknown'), null);
    assert.equal(readAuthMode(''), null);
});
