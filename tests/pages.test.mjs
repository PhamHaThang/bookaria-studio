import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { uploadRequest } from '../src/features/assets/model/form.ts';
import { createPagesApi } from '../src/features/pages/api/pages-api.ts';
import { prepareMarkerUpload } from '../src/features/pages/model/marker-upload.ts';
import { movedPageIds, uncertainWrite } from '../src/features/pages/model/operations.ts';
import { placementFromForm } from '../src/features/pages/model/placement.ts';
import { ContractError } from '../src/shared/api/contract.ts';
import { markerToMm } from '../src/shared/contracts/marker.schema.ts';

const id = '11111111-1111-4111-8111-111111111111',
    second = '22222222-2222-4222-8222-222222222222';
const summary = {
    id,
    orderIndex: 0,
    title: null,
    thumbnailUrl: 'https://example.com/image.png',
    markerMode: 'NONE',
    markerNumber: null,
    markerScore: null,
    markerWarnings: [],
    objectCount: 0,
};
function fixture(status, data) {
    const calls = [];
    const send = async (...args) => {
        calls.push(args);
        return { status, data: { data } };
    };
    return {
        calls,
        api: createPagesApi({ get: send, post: send, patch: send, put: send, delete: send }),
    };
}
test('page creation distinguishes append, beginning and insert-after and accepts the no-marker fallback', async () => {
    for (const afterPageId of [undefined, null, second]) {
        const f = fixture(201, {
            page: { id, orderIndex: 0, markerMode: 'NONE', markerNumber: null },
            warnings: ['NO_MARKER_AVAILABLE'],
        });
        const result = await f.api.add(id, { imageAssetId: second, afterPageId });
        assert.equal(f.calls[0][1].afterPageId, afterPageId);
        assert.deepEqual(result.warnings, ['NO_MARKER_AVAILABLE']);
    }
});
test('non-idempotent page writes reject malformed or unexpected success responses', async () => {
    await assert.rejects(
        fixture(200, { page: summary }).api.add(id, { imageAssetId: second }),
        ContractError,
    );
    await assert.rejects(fixture(201, summary).api.duplicate(id), ContractError);
    assert.equal((await fixture(201, { page: summary }).api.duplicate(id)).page.id, id);
    await assert.rejects(fixture(200, {}).api.remove(id), ContractError);
    await fixture(204, undefined).api.remove(id);
});
test('marker modes use distinct status and result schemas, and custom image replacement preserves job id', async () => {
    const custom = {
        markerMode: 'CUSTOM_MARKER',
        markerNumber: null,
        markerScore: null,
        jobId: second,
    };
    assert.equal(
        (
            await fixture(202, custom).api.setMarker(id, {
                mode: 'CUSTOM_MARKER',
                markerMindPublicId: 'own/page.mind',
            })
        ).processing,
        true,
    );
    await assert.rejects(
        fixture(200, custom).api.setMarker(id, {
            mode: 'CUSTOM_MARKER',
            markerMindPublicId: 'own/page.mind',
        }),
        ContractError,
    );
    const bookaria = {
        markerMode: 'BOOKARIA_MARKER',
        markerNumber: 12,
        transform: { x: 0, y: 0, size: 0.2 },
    };
    assert.equal(
        (await fixture(200, bookaria).api.setMarker(id, { mode: 'BOOKARIA_MARKER' })).processing,
        false,
    );
    assert.equal(
        (
            await fixture(200, { page: summary, jobId: second }).api.replaceImage(id, {
                imageAssetId: second,
                markerMindPublicId: 'own/new.mind',
            })
        ).jobId,
        second,
    );
});
test('reorder preserves the complete set and rejects duplicates before sending', async () => {
    const pages = [{ id }, { id: second }, { id: '33333333-3333-4333-8333-333333333333' }];
    assert.deepEqual(movedPageIds(pages, second, -1), [second, id, pages[2].id]);
    assert.equal(movedPageIds(pages, id, -1), null);
    assert.equal(movedPageIds(pages, pages[2].id, 1), null);
    assert.equal(movedPageIds(pages, 'missing', 1), null);
    const f = fixture(200, { pages: [] });
    await assert.rejects(f.api.reorder(id, [id, id]));
    assert.equal(f.calls.length, 0);
});
test('uncertain POST outcomes require reconciliation; explicit 4xx errors can be corrected', () => {
    assert.equal(uncertainWrite(new ContractError()), true);
    assert.equal(uncertainWrite(new AxiosError('network')), true);
    for (const status of [400, 403, 409, 422, 429, 500, 503])
        assert.equal(
            uncertainWrite(new AxiosError('failure', undefined, undefined, undefined, { status })),
            status >= 500,
        );
});
test('page image policy accepts JPG/PNG only up to 10 MB', () => {
    assert.equal(
        uploadRequest({ name: 'page.PNG', type: '', size: 10 * 1024 * 1024 }, 'PAGE_IMAGE')
            .mimeType,
        'image/png',
    );
    for (const file of [
        { name: 'p.webp', type: 'image/webp', size: 12 },
        { name: 'p.png', type: 'image/png', size: 0 },
        { name: 'p.jpg', type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 },
    ])
        assert.throws(() => uploadRequest(file, 'PAGE_IMAGE'));
});
test('millimetre coordinates round trip for all paper formats and enforce print margins', () => {
    for (const format of ['A4', 'A5', 'SQUARE', 'CUSTOM']) {
        const page = { format, aspect: 1.4, widthMm: format === 'CUSTOM' ? 300 : undefined },
            form = new FormData();
        form.set('centerX', '60');
        form.set('centerY', '60');
        form.set('size', '40');
        const mm = markerToMm(placementFromForm(form, page), page);
        assert.ok(Math.abs(mm.centerXMm - 60) < 1e-8);
        assert.ok(Math.abs(mm.centerYMm - 60) < 1e-8);
        assert.ok(Math.abs(mm.sizeMm - 40) < 1e-8);
        form.set('size', '34');
        assert.throws(() => placementFromForm(form, page), /35 mm/);
        form.set('size', '40');
        form.set('centerX', '20');
        assert.throws(() => placementFromForm(form, page), /12 mm/);
        form.set('centerX', '');
        assert.throws(() => placementFromForm(form, page), /Nhập đủ/);
    }
});

function markerFixture(overrides = {}) {
    const calls = [],
        controller = new AbortController();
    let checkpoint = null;
    const options = {
        source: 'https://example.com/page.png',
        signal: controller.signal,
        checkpoint: null,
        onCheckpoint: (value) => {
            checkpoint = value;
        },
        onProgress: () => {},
        onStage: () => {},
        compile: async () => {
            calls.push('compile');
            return new File(['binary'], 'page.mind', { type: 'application/octet-stream' });
        },
        api: {
            signature: async (body) => {
                calls.push(['sign', body]);
                return {
                    expiresAt: '2099-01-01T00:00:00Z',
                    fields: { public_id: 'owned/page.mind' },
                };
            },
        },
        transfer: async () => {
            calls.push('raw');
        },
        ...overrides,
    };
    return { options, calls, controller, checkpoint: () => checkpoint };
}
test('custom marker compiles, signs MARKER_MIND, uploads raw once and reuses after attachment failure', async () => {
    const f = markerFixture();
    assert.equal(await prepareMarkerUpload(f.options), 'owned/page.mind');
    assert.deepEqual(
        f.calls.map((call) => (Array.isArray(call) ? call[0] : call)),
        ['compile', 'sign', 'raw'],
    );
    assert.equal(f.calls[1][1].purpose, 'MARKER_MIND');
    f.calls.length = 0;
    assert.equal(
        await prepareMarkerUpload({ ...f.options, checkpoint: f.checkpoint() }),
        'owned/page.mind',
    );
    assert.deepEqual(f.calls, []);
});
test('failed raw upload retries cached compilation and renews an expired signature', async () => {
    const f = markerFixture({
        transfer: async () => {
            throw new Error('offline');
        },
    });
    await assert.rejects(prepareMarkerUpload(f.options), /offline/);
    const checkpoint = f.checkpoint();
    checkpoint.signature.expiresAt = '2000-01-01T00:00:00Z';
    f.calls.length = 0;
    await prepareMarkerUpload({
        ...f.options,
        checkpoint,
        transfer: async () => {
            f.calls.push('raw');
        },
    });
    assert.deepEqual(
        f.calls.map((call) => (Array.isArray(call) ? call[0] : call)),
        ['sign', 'raw'],
    );
});
test('different source recompiles; abort and oversized generated data never sign or upload', async () => {
    const f = markerFixture();
    await prepareMarkerUpload(f.options);
    f.calls.length = 0;
    await prepareMarkerUpload({
        ...f.options,
        checkpoint: f.checkpoint(),
        source: 'https://example.com/other.png',
    });
    assert.equal(f.calls[0], 'compile');
    f.controller.abort();
    await assert.rejects(prepareMarkerUpload(f.options), { name: 'AbortError' });
    const tooBig = markerFixture({
        compile: async () => new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'page.mind'),
    });
    await assert.rejects(prepareMarkerUpload(tooBig.options), /5 MB/);
    assert.equal(tooBig.calls.length, 0);
});
test('vendored official MindAR files match their integrity manifest', async () => {
    const root = new URL('../public/vendor/mindar-1.2.5/', import.meta.url);
    const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
    assert.equal(manifest.version, '1.2.5');
    for (const [file, hash] of Object.entries(manifest.files))
        assert.equal(
            createHash('sha256')
                .update(await readFile(new URL(file, root)))
                .digest('hex'),
            hash,
            file,
        );
});
