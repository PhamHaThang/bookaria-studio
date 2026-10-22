import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createAssetsApi } from '../src/features/assets/api/assets-api.ts';
import { uploadFormData } from '../src/features/assets/api/upload-file.ts';
import { assetInUse } from '../src/features/assets/model/errors.ts';
import {
    completeAssetForm,
    updateAssetForm,
    uploadRequest,
} from '../src/features/assets/model/form.ts';
import { readAssetSearch, updateAssetSearch } from '../src/features/assets/model/search.ts';
import { runAssetUpload } from '../src/features/assets/model/upload.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const jobId = '22222222-2222-4222-8222-222222222222';
const asset = {
    id,
    type: 'IMAGE',
    name: 'Ảnh',
    status: 'READY',
    sizeBytes: 100,
    format: 'png',
    url: 'https://example.com/image.png',
    thumbnailUrl: null,
    meta: { width: 10, height: 10 },
    tags: [],
    license: null,
    authorName: null,
    sourceUrl: null,
    scope: 'mine',
    categoryId: null,
    createdAt: '2026-10-22T00:00:00Z',
};
const signature = {
    assetId: id,
    uploadUrl: 'https://api.cloudinary.com/v1_1/review/image/upload',
    fields: {
        public_id: 'review/file',
        api_key: 'review-key',
        timestamp: 1,
        signature: 'review-signature',
        overwrite: 'false',
    },
    expiresAt: '2099-01-01T00:00:00Z',
};
function fixture(body, status = 200) {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return { data: body, status, statusText: '', headers: {}, config };
        },
    });
    return { api: createAssetsApi(http), calls };
}
function form(values) {
    const result = new FormData();
    for (const [key, value] of Object.entries(values)) result.set(key, value);
    return result;
}
function pipeline(overrides = {}) {
    const calls = [];
    let saved = null;
    const options = {
        api: {
            signature: async () => {
                calls.push('signature');
                return signature;
            },
            complete: async (_id, metadata) => {
                calls.push(['complete', metadata]);
                return { processing: false, asset };
            },
        },
        transfer: async () => {
            calls.push('file');
        },
        file: new File(['sample'], 'anh.png', { type: 'image/png' }),
        metadata: { name: 'Bài học', tags: ['mẫu'] },
        signal: new AbortController().signal,
        checkpoint: null,
        onCheckpoint: (value) => {
            saved = value;
        },
        onStage: () => {},
        onProgress: () => {},
        ...overrides,
    };
    return { options, calls, checkpoint: () => saved };
}

test('asset list validates pagination and serializes an already parsed animation filter', async () => {
    const { api, calls } = fixture({
        data: [asset],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    });
    const result = await api.list({ scope: 'mine', hasAnimation: true, q: ' ảnh ', limit: 12 });
    assert.equal(result.data[0].id, id);
    assert.equal(calls[0].params.hasAnimation, true);
    assert.equal(calls[0].params.q, 'ảnh');
});
test('asset list refuses malformed metadata and unsafe asset URLs', async () => {
    await assert.rejects(
        fixture({ data: [asset], meta: { total: 'bad' } }).api.list({}),
        ContractError,
    );
    await assert.rejects(
        fixture({ data: { ...asset, url: 'javascript:alert(1)' } }).api.detail(id),
        ContractError,
    );
});
test('invalid UUID and metadata do not reach HTTP', async () => {
    const { api, calls } = fixture({ data: asset });
    await assert.rejects(api.detail('bad'));
    await assert.rejects(api.update(id, { name: ' ' }));
    await assert.rejects(api.update(id, { sourceUrl: 'javascript:alert(1)' }));
    assert.equal(calls.length, 0);
});
test('asset detail, categories, usages and update use the expected DTO contracts', async () => {
    const detail = fixture({ data: asset });
    assert.equal((await detail.api.detail(id)).scope, 'mine');
    await detail.api.update(id, { name: ' Tên mới ', tags: ['mới'] });
    assert.equal(JSON.parse(detail.calls[1].data).name, 'Tên mới');
    const categories = fixture({
        data: [{ id, name: 'Thiên nhiên', parentId: null, sortOrder: 1 }],
    });
    assert.equal((await categories.api.categories())[0].id, id);
    assert.equal(categories.calls[0].url, '/asset-categories');
    const usage = { bookId: id, pageId: jobId, bookTitle: 'Sách', pageNumber: 1 };
    assert.deepEqual(await fixture({ data: [usage] }).api.usages(id), [usage]);
});
test('delete accepts only the documented empty 204', async () => {
    await fixture(undefined, 204).api.remove(id);
    await assert.rejects(fixture({ data: asset }, 200).api.remove(id), ContractError);
});
test('upload signature validates outgoing input and incoming signed fields', async () => {
    const { api, calls } = fixture({ data: signature });
    assert.equal(
        (
            await api.signature({
                purpose: 'ASSET',
                fileName: 'a.png',
                mimeType: 'image/png',
                sizeBytes: 1,
            })
        ).assetId,
        id,
    );
    await assert.rejects(
        api.signature({ purpose: 'ASSET', fileName: '', mimeType: 'image/png', sizeBytes: 0 }),
    );
    assert.equal(calls.length, 1);
    await assert.rejects(
        fixture({ data: { ...signature, fields: {} } }).api.signature({
            purpose: 'ASSET',
            fileName: 'a.png',
            mimeType: 'image/png',
            sizeBytes: 1,
        }),
        ContractError,
    );
});
test('complete distinguishes full 200 from partial 202 and rejects other shapes/statuses', async () => {
    assert.equal((await fixture({ data: { asset } }, 200).api.complete(id, {})).processing, false);
    const partial = { id, type: 'MODEL', status: 'PROCESSING', sizeBytes: 100 };
    const result = await fixture({ data: { asset: partial, jobId } }, 202).api.complete(id, {});
    assert.equal(result.processing, true);
    assert.equal(result.jobId, jobId);
    await assert.rejects(
        fixture({ data: { asset: partial } }, 200).api.complete(id, {}),
        ContractError,
    );
    await assert.rejects(
        fixture({ data: { asset: partial } }, 202).api.complete(id, {}),
        ContractError,
    );
    await assert.rejects(fixture({ data: { asset } }, 201).api.complete(id, {}), ContractError);
});
test('file validation applies shared backend limits and empty MIME fallback', () => {
    assert.equal(
        uploadRequest({ name: 'MODEL.GLB', type: '', size: 10 }).mimeType,
        'model/gltf-binary',
    );
    assert.equal(uploadRequest({ name: 'ảnh.PNG', type: '', size: 10 }).mimeType, 'image/png');
    assert.throws(() => uploadRequest({ name: 'a.png', type: 'image/png', size: 0 }), /trống/);
    assert.throws(
        () => uploadRequest({ name: 'a.png', type: 'image/png', size: 10 * 1024 ** 2 + 1 }),
        /giới hạn/,
    );
    assert.throws(
        () => uploadRequest({ name: 'a.mp4', type: 'video/mp4', size: 100 * 1024 ** 2 + 1 }),
        /giới hạn/,
    );
    assert.throws(
        () => uploadRequest({ name: 'a.svg', type: 'image/svg+xml', size: 10 }),
        /Chọn GLB/,
    );
});
test('upload form normalizes tags while enforcing backend field limits', () => {
    const result = completeAssetForm(form({ name: ' Mẫu ', tags: ' Mèo, mèo,  tự nhiên, ' }));
    assert.deepEqual(result, { name: 'Mẫu', tags: ['mèo', 'tự nhiên'] });
    assert.throws(() => completeAssetForm(form({ tags: 'a'.repeat(31) })));
    assert.throws(() =>
        completeAssetForm(
            form({ tags: Array.from({ length: 21 }, (_, i) => `tag${i}`).join(',') }),
        ),
    );
    assert.deepEqual(
        updateAssetForm(
            form({ name: 'Ảnh', tags: '', sourceUrl: '', license: '', authorName: '' }),
        ),
        { name: 'Ảnh', tags: [], sourceUrl: null, license: null, authorName: null },
    );
});
test('URL filters fall back safely and preserve scope/filter values across pages', () => {
    const query = readAssetSearch(
        new URLSearchParams('scope=evil&type=bad&page=-1&categoryId=bad&hasAnimation=oops'),
    );
    assert.equal(query.scope, 'mine');
    assert.equal(query.type, undefined);
    assert.equal(query.page, 1);
    assert.equal(query.hasAnimation, undefined);
    const current = new URLSearchParams('scope=library&type=MODEL&q=meo&page=3');
    const next = updateAssetSearch(current, { q: 'mèo' });
    assert.equal(next.get('scope'), 'library');
    assert.equal(next.has('page'), false);
    assert.equal(current.get('page'), '3');
    assert.equal(updateAssetSearch(current, { page: '2' }).get('type'), 'MODEL');
});
test('multipart includes all signed fields unchanged and the actual selected file', () => {
    const file = new File(['a'], 'a.png', { type: 'image/png' });
    const data = uploadFormData(signature, file);
    assert.equal(data.get('timestamp'), '1');
    assert.equal(data.get('overwrite'), 'false');
    assert.equal(data.get('signature'), 'review-signature');
    assert.equal(data.get('file').name, 'a.png');
    assert.throws(() =>
        uploadFormData(
            { ...signature, fields: { ...signature.fields, bad: { nested: true } } },
            file,
        ),
    );
});
test('upload pipeline runs signature then transfer then completion', async () => {
    const fixture = pipeline();
    const result = await runAssetUpload(fixture.options);
    assert.equal(result.asset.id, id);
    assert.deepEqual(fixture.calls, ['signature', 'file', ['complete', fixture.options.metadata]]);
    assert.equal(fixture.checkpoint().uploaded, true);
});
test('failed completion retries the same id and metadata without another file upload', async () => {
    let attempts = 0;
    const fixture = pipeline();
    fixture.options.api.complete = async (assetId, metadata) => {
        attempts++;
        assert.equal(assetId, id);
        assert.deepEqual(metadata, fixture.options.metadata);
        if (attempts === 1) throw new Error('network');
        return { processing: false, asset };
    };
    await assert.rejects(runAssetUpload(fixture.options));
    await runAssetUpload({ ...fixture.options, checkpoint: fixture.checkpoint() });
    assert.equal(attempts, 2);
    assert.deepEqual(fixture.calls, ['signature', 'file']);
});
test('failed file transfer never calls complete and an expired unused signature is renewed', async () => {
    const fixture = pipeline({
        transfer: async () => {
            throw new Error('offline');
        },
    });
    await assert.rejects(runAssetUpload(fixture.options));
    assert.equal(fixture.checkpoint().uploaded, false);
    assert.deepEqual(fixture.calls, ['signature']);
    const retry = pipeline({
        checkpoint: {
            signature: { ...signature, expiresAt: '2020-01-01T00:00:00Z' },
            uploaded: false,
        },
    });
    await runAssetUpload(retry.options);
    assert.equal(retry.calls[0], 'signature');
});
test('completed transfer keeps its id even after the signature expires', async () => {
    const fixture = pipeline({
        checkpoint: {
            signature: { ...signature, expiresAt: '2020-01-01T00:00:00Z' },
            uploaded: true,
        },
    });
    await runAssetUpload(fixture.options);
    assert.deepEqual(fixture.calls, [['complete', fixture.options.metadata]]);
});
test('cancelled transfer never starts completion and cancelled entry never signs', async () => {
    const active = new AbortController();
    const fixture = pipeline({
        signal: active.signal,
        transfer: async () => {
            active.abort();
        },
    });
    await assert.rejects(runAssetUpload(fixture.options));
    assert.deepEqual(fixture.calls, ['signature']);
    const stopped = pipeline({ signal: AbortSignal.abort() });
    await assert.rejects(runAssetUpload(stopped.options));
    assert.equal(stopped.calls.length, 0);
});
test('invalid files are rejected before creating an upload intent', async () => {
    const fixture = pipeline({ file: new File(['svg'], 'a.svg', { type: 'image/svg+xml' }) });
    await assert.rejects(runAssetUpload(fixture.options));
    assert.equal(fixture.calls.length, 0);
});
test('asset in use details expose only validated book/page links', () => {
    const usage = { bookId: id, pageId: jobId, bookTitle: 'Sách', pageNumber: 2 };
    const error = new axios.AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        data: {
            error: {
                code: 'ASSET_IN_USE',
                message: 'Đang dùng',
                requestId: 'review-request',
                details: { usages: [usage] },
            },
        },
        status: 409,
    });
    assert.deepEqual(assetInUse(error), [usage]);
    error.response.data.error.details.usages[0].pageId = 'bad';
    assert.deepEqual(assetInUse(error), []);
    assert.deepEqual(assetInUse(new Error('other')), []);
});
