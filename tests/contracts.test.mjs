import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { createAuthApi } from '../src/features/auth/api/auth-api.ts';
import { ContractError } from '../src/shared/api/contract.ts';
import { errorMessage } from '../src/shared/api/errors.ts';

const user = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'an@example.com',
    displayName: 'An',
    role: 'AUTHOR',
    emailVerified: false,
};
function client(responder) {
    return axios.create({
        adapter: async (config) => ({
            data: responder(config),
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        }),
    });
}
test('shared request schema normalizes email and supplies the remember default', async () => {
    let sent;
    const raw = client((config) => {
        sent = JSON.parse(config.data);
        return { data: { accessToken: 'token', expiresIn: 900, user } };
    });
    const api = createAuthApi(raw, raw);
    await api.login({ email: '  AN@Example.COM ', password: 'password123', remember: false });
    assert.equal(sent.email, 'an@example.com');
    assert.equal(sent.remember, false);
});
test('invalid auth request is rejected before sending HTTP', async () => {
    let calls = 0;
    const raw = client(() => {
        calls++;
        return {};
    });
    await assert.rejects(
        createAuthApi(raw, raw).register({
            email: 'not-email',
            password: 'short',
            displayName: '',
        }),
    );
    assert.equal(calls, 0);
});
test('malformed auth response is rejected instead of entering the session', async () => {
    const raw = client(() => ({ data: { accessToken: 'token', expiresIn: '900', user } }));
    await assert.rejects(
        createAuthApi(raw, raw).login({
            email: user.email,
            password: 'password123',
            remember: false,
        }),
        ContractError,
    );
});
test('/me must satisfy the full backend MeSchema, not a partial hand-written user', async () => {
    const raw = client(() => ({ data: user }));
    await assert.rejects(createAuthApi(raw, raw).profile(), ContractError);
});
test('204 endpoints reject unexpected response statuses', async () => {
    const raw = client(() => ({}));
    await assert.rejects(createAuthApi(raw, raw).logout(), ContractError);
});
test('email actions reject malformed success responses', async () => {
    const raw = client(() => ({ data: {} }));
    const api = createAuthApi(raw, raw);
    await assert.rejects(api.verifyEmail('token'), ContractError);
    await assert.rejects(api.forgotPassword(user.email), ContractError);
});
test('email actions accept their documented success responses', async () => {
    const raw = client((config) =>
        config.url === '/auth/verify-email'
            ? { data: { emailVerified: true } }
            : { data: { sent: true } },
    );
    const api = createAuthApi(raw, raw);
    await api.verifyEmail('token');
    await api.forgotPassword(user.email);
});
test('error formatter validates backend errors before using message or details', () => {
    const error = new axios.AxiosError('bad', undefined, undefined, undefined, {
        data: {
            error: {
                code: 'RATE_LIMITED',
                message: 'Too fast',
                requestId: 'test',
                details: { retryAfterSeconds: 35 },
            },
        },
        status: 429,
        statusText: '',
        headers: {},
        config: {},
    });
    assert.match(errorMessage(error), /35/);
    error.response.data.error.details = { retryAfterSeconds: 'untrusted' };
    assert.doesNotMatch(errorMessage(error), /untrusted/);
});
test('contract sync detects backend drift and edited generated files without changing unrelated files', async () => {
    const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const temp = await mkdtemp(path.join(tmpdir(), 'bookaria-contract-'));
    try {
        const frontend = path.join(temp, 'studio');
        const backend = path.join(temp, 'backend');
        await mkdir(path.join(frontend, 'scripts'), { recursive: true });
        await mkdir(path.join(backend, 'src'), { recursive: true });
        await cp(
            path.join(project, 'scripts/sync-contract.mjs'),
            path.join(frontend, 'scripts/sync-contract.mjs'),
        );
        await cp(path.join(project, 'src/shared/contracts'), path.join(backend, 'src/schema'), {
            recursive: true,
        });
        const { zod } = JSON.parse(
            await readFile(
                path.join(project, 'src/shared/contracts/contract-manifest.json'),
                'utf8',
            ),
        );
        await writeFile(
            path.join(frontend, 'package.json'),
            JSON.stringify({ dependencies: { zod } }),
        );
        await writeFile(
            path.join(backend, 'package.json'),
            JSON.stringify({ dependencies: { zod } }),
        );
        await writeFile(path.join(frontend, 'keep.txt'), 'unrelated');
        const script = path.join(frontend, 'scripts/sync-contract.mjs');
        const args = ['--backend', backend];
        const run = (...extra) =>
            execFileSync(process.execPath, [script, ...args, ...extra], { stdio: 'pipe' });
        const failed = (...extra) =>
            spawnSync(process.execPath, [script, ...args, ...extra]).status;
        run();
        run('--check');
        run('--verify');
        const dto = path.join(backend, 'src/schema/dto.schema.ts');
        await writeFile(dto, `${await readFile(dto, 'utf8')}\n// schema change\n`);
        assert.notEqual(failed('--check'), 0);
        run();
        run('--check');
        const generated = path.join(frontend, 'src/shared/contracts/dto.schema.ts');
        await writeFile(generated, 'unexpected local edits');
        assert.notEqual(failed('--verify'), 0);
        assert.notEqual(failed(), 0);
        assert.equal(await readFile(generated, 'utf8'), 'unexpected local edits');
        assert.equal(await readFile(path.join(frontend, 'keep.txt'), 'utf8'), 'unrelated');
        await assert.rejects(readFile(path.join(frontend, 'src/shared/contracts/openapi.ts')));
        await assert.rejects(readFile(path.join(frontend, 'src/shared/contracts/index.ts')));
    } finally {
        await rm(temp, { recursive: true, force: true });
    }
});
