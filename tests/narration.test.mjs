import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { createAssetsApi } from '../src/features/assets/api/assets-api.ts';
import { ContractError } from '../src/shared/api/contract.ts';
import { errorMessage } from '../src/shared/api/errors.ts';
import { NarrationBodySchema } from '../src/shared/contracts/api/narration.schema.ts';

const body = { text: 'Xin chào.', voice: 'maichi' };
const signal = new AbortController().signal;
const bytes = readFileSync(new URL('./browser/narration.mp3', import.meta.url));
const mp3 = () => new Blob([bytes], { type: 'audio/mpeg' });

test('generated MP3 uses the normal local file flow and a timeout long enough for CPU speech', async () => {
    let call;
    const api = createAssetsApi({
        post: async (...args) => {
            call = args;
            return { status: 200, data: mp3() };
        },
    });
    const file = await api.generateNarration(body, signal);
    assert.equal(file.name, 'loi-thuyet-minh.mp3');
    assert.equal(file.type, 'audio/mpeg');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    assert.deepEqual(call, [
        '/assets/narration/generate',
        NarrationBodySchema.parse(body),
        { signal, timeout: 190000, responseType: 'blob' },
    ]);
});

test('invalid input and corrupt audio never become narration files', async () => {
    let calls = 0;
    const api = createAssetsApi({
        post: async () => {
            calls++;
            return { status: 200, data: new Blob(['broken']) };
        },
    });
    await assert.rejects(api.generateNarration({ ...body, voice: '../voice' }, signal));
    for (const options of [
        { speed: 2 },
        { speed: true },
        { pause: 'invalid' },
        { temperature: 2 },
        { voiceStrength: 2 },
    ])
        await assert.rejects(api.generateNarration({ ...body, ...options }, signal));
    assert.equal(calls, 0);
    await assert.rejects(api.generateNarration(body, signal), ContractError);
    const corrupt = createAssetsApi({
        post: async () => ({
            status: 200,
            data: new Blob([Buffer.alloc(bytes.length)], { type: 'audio/mpeg' }),
        }),
    });
    await assert.rejects(corrupt.generateNarration(body, signal), ContractError);
});

test('truncated MP3 and the old WAV response are rejected', async () => {
    for (const data of [
        new Blob([bytes.subarray(0, bytes.length - 1)], { type: 'audio/mpeg' }),
        new Blob([bytes], { type: 'audio/wav' }),
    ]) {
        const api = createAssetsApi({ post: async () => ({ status: 200, data }) });
        await assert.rejects(api.generateNarration(body, signal), ContractError);
    }
});

test('binary API failures still show the server error to the author', async () => {
    const message = 'Dịch vụ tạo lời đọc chưa được cấu hình.';
    const error = new AxiosError('503', undefined, undefined, undefined, {
        status: 503,
        data: new Blob([
            JSON.stringify({ error: { code: 'AI_UNAVAILABLE', message, requestId: 'test' } }),
        ]),
    });
    const api = createAssetsApi({
        post: async () => {
            throw error;
        },
    });
    await assert.rejects(api.generateNarration(body, signal), (cause) => {
        assert.equal(errorMessage(cause), message);
        return true;
    });
});
