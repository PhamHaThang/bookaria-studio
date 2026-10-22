import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageUploadRequest, saveUploadedImage } from '../src/features/assets/model/image.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const asset = { id, type: 'IMAGE', status: 'READY' };
const signature = { assetId: id, expiresAt: '2099-01-01T00:00:00Z' };
function fixture(overrides = {}) {
    const calls = [];
    let checkpoint = null;
    let ready = null;
    const options = {
        api: {
            signature: async (body) => {
                calls.push(['signature', body]);
                return signature;
            },
            complete: async () => {
                calls.push(['complete']);
                return { processing: false, asset };
            },
        },
        transfer: async () => {
            calls.push(['file']);
        },
        file: new File(['image'], 'cover.png', { type: 'image/png' }),
        metadata: { tags: [] },
        purpose: 'ASSET',
        signal: new AbortController().signal,
        checkpoint: null,
        readyAsset: null,
        onCheckpoint: (value) => {
            checkpoint = value;
        },
        onReady: (value) => {
            ready = value;
        },
        onStage: () => {},
        onProgress: () => {},
        onSaving: () => {},
        save: async (value) => {
            calls.push(['save', value]);
        },
        ...overrides,
    };
    return { options, calls, checkpoint: () => checkpoint, ready: () => ready };
}

test('avatar uses AVATAR and enforces 2 MB while book covers allow 10 MB', () => {
    const file = { name: 'photo.png', type: 'image/png', size: 3 * 1024 * 1024 };
    assert.throws(() => imageUploadRequest(file, 'AVATAR'), /2 MB/);
    assert.equal(imageUploadRequest(file, 'ASSET').purpose, 'ASSET');
    assert.equal(
        imageUploadRequest({ ...file, size: 2 * 1024 * 1024 }, 'AVATAR').purpose,
        'AVATAR',
    );
    assert.throws(() => imageUploadRequest({ ...file, size: 11 * 1024 * 1024 }, 'ASSET'), /10 MB/);
});
test('image fields reject audio, models, SVG, empty files and unsupported files before sending', () => {
    for (const file of [
        { name: 'tone.wav', type: 'audio/wav', size: 12 },
        { name: 'model.glb', type: 'model/gltf-binary', size: 12 },
        { name: 'image.svg', type: 'image/svg+xml', size: 12 },
        { name: 'empty.png', type: 'image/png', size: 0 },
        { name: 'image.exe', type: '', size: 12 },
    ])
        assert.throws(() => imageUploadRequest(file, 'ASSET'));
    assert.equal(
        imageUploadRequest({ name: 'PHOTO.WEBP', type: '', size: 12 }, 'AVATAR').mimeType,
        'image/webp',
    );
});
test('avatar pipeline sends the correct purpose and attaches only after complete', async () => {
    const f = fixture({ purpose: 'AVATAR' });
    await saveUploadedImage(f.options);
    assert.equal(f.calls[0][1].purpose, 'AVATAR');
    assert.deepEqual(
        f.calls.map((call) => call[0]),
        ['signature', 'file', 'complete', 'save'],
    );
    assert.deepEqual(f.calls.at(-1), ['save', id]);
});
test('failed attachment retries the ready asset without signing, transferring or completing again', async () => {
    const f = fixture({
        save: async () => {
            throw new Error('save failed');
        },
    });
    await assert.rejects(saveUploadedImage(f.options), /save failed/);
    assert.equal(f.ready().id, id);
    f.calls.length = 0;
    await saveUploadedImage({
        ...f.options,
        checkpoint: f.checkpoint(),
        readyAsset: f.ready(),
        save: async (value) => {
            f.calls.push(['save', value]);
        },
    });
    assert.deepEqual(f.calls, [['save', id]]);
});
test('failed completion preserves the uploaded file for retry and does not attach early', async () => {
    const f = fixture();
    const complete = f.options.api.complete;
    f.options.api.complete = async () => {
        throw new Error('complete failed');
    };
    await assert.rejects(saveUploadedImage(f.options), /complete failed/);
    assert.equal(f.ready(), null);
    assert.equal(
        f.calls.some((call) => call[0] === 'save'),
        false,
    );
    f.calls.length = 0;
    f.options.api.complete = complete;
    await saveUploadedImage({ ...f.options, checkpoint: f.checkpoint() });
    assert.deepEqual(
        f.calls.map((call) => call[0]),
        ['complete', 'save'],
    );
});
test('a failed file transfer never calls complete or updates the book/profile', async () => {
    const f = fixture({
        transfer: async () => {
            throw new Error('network failed');
        },
    });
    await assert.rejects(saveUploadedImage(f.options), /network failed/);
    assert.equal(
        f.calls.some((call) => ['complete', 'save'].includes(call[0])),
        false,
    );
});
test('unexpected processing or non-image completion is rejected without attachment', async () => {
    for (const result of [
        { processing: true, asset },
        { processing: false, asset: { ...asset, type: 'VIDEO' } },
        { processing: false, asset: { ...asset, status: 'PROCESSING' } },
    ]) {
        const f = fixture();
        f.options.api.complete = async () => result;
        await assert.rejects(saveUploadedImage(f.options), ContractError);
        assert.equal(
            f.calls.some((call) => call[0] === 'save'),
            false,
        );
    }
});
test('canceling before work prevents requests, and canceling before attachment prevents save', async () => {
    const before = new AbortController();
    before.abort();
    const f = fixture({ signal: before.signal });
    await assert.rejects(saveUploadedImage(f.options));
    assert.equal(f.calls.length, 0);
    const active = new AbortController();
    const g = fixture({ signal: active.signal, onReady: () => active.abort() });
    await assert.rejects(saveUploadedImage(g.options));
    assert.equal(
        g.calls.some((call) => call[0] === 'save'),
        false,
    );
});
