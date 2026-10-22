import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewApi } from '../src/features/preview/api/preview-api.ts';
import {
    makePreviewPayload,
    previewUrl,
    viewerOrigin,
} from '../src/features/preview/model/preview.ts';
import { SceneSchema } from '../src/shared/contracts/scene.schema.ts';

const id = '11111111-1111-4111-8111-111111111111',
    assetId = '22222222-2222-4222-8222-222222222222';
const settings = {
    backgroundAudioAssetId: null,
    narrationAssetId: null,
    backgroundLoop: true,
    lighting: 'neutral',
};
const page = { id, title: 'Trang thử', image: { url: 'https://example.com/page.png' }, settings };
const book = { id, title: 'Sách', pageAspect: 297 / 210 };
test('viewer origin and token reject non-HTTP, credentials, paths and invalid tokens', () => {
    assert.equal(viewerOrigin('http://viewer.localhost:5174'), 'http://viewer.localhost:5174');
    for (const input of [
        'javascript:alert(1)',
        'https://user:pass@example.com',
        'https://example.com/sub',
        'https://example.com/?q=1',
    ])
        assert.throws(() => viewerOrigin(input));
    assert.throws(() => previewUrl('https://example.com', '../bad'));
    assert.equal(
        previewUrl('http://viewer.localhost:5174', 'a'.repeat(32)),
        `http://viewer.localhost:5174/preview/${'a'.repeat(32)}`,
    );
});
test('preview API uses backend request schema, expected status and response validation', async () => {
    const calls = [];
    const api = createPreviewApi({
        post: async (...args) => {
            calls.push(args);
            return { status: 202, data: { data: { jobId: id } } };
        },
    });
    assert.deepEqual(await api.create(id, { scope: 'PAGE', pageId: id }), { jobId: id });
    assert.equal(calls[0][0], `/books/${id}/previews`);
    await assert.rejects(api.create(id, { scope: 'PAGE' }));
    const invalid = createPreviewApi({
        post: async () => ({ status: 200, data: { data: { jobId: id } } }),
    });
    await assert.rejects(invalid.create(id, { scope: 'BOOK' }));
});
test('unsaved scene snapshots include audio-only uses and saved settings without mutating input', async () => {
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'rule',
                trigger: { type: 'onPageEnter' },
                actions: [{ type: 'playAudio', assetId }],
            },
        ],
    });
    const original = JSON.stringify(scene),
        called = [];
    const abort = new AbortController();
    const payload = await makePreviewPayload(
        page,
        book,
        scene,
        async (id) => {
            called.push(id);
            return {
                id,
                status: 'READY',
                name: 'Audio',
                type: 'AUDIO',
                url: 'https://example.com/audio.mp3',
                sizeBytes: 123,
                meta: {},
            };
        },
        abort.signal,
    );
    assert.deepEqual(called, [assetId]);
    assert.equal(payload.assets[assetId].size, 123);
    assert.equal(payload.page.marker.mode, 'NONE');
    assert.equal(payload.page.settings.lighting, 'neutral');
    assert.equal(JSON.stringify(scene), original);
});
test('draft preview refuses dangling rules and pending resources; aborted reads do not create a payload', async () => {
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'r',
                trigger: { type: 'onTap', objectId: 'deleted' },
                actions: [{ type: 'wait', ms: 0 }],
            },
        ],
    });
    const abort = new AbortController();
    await assert.rejects(
        makePreviewPayload(
            page,
            book,
            scene,
            async () => {
                throw new Error('must not fetch');
            },
            abort.signal,
        ),
    );
    scene.interactions[0].trigger = { type: 'onPageEnter' };
    scene.interactions[0].actions = [
        { type: 'playAudio', assetId, volume: 1, loop: false, delayMsSchema: 0 },
    ];
    await assert.rejects(
        makePreviewPayload(
            page,
            book,
            scene,
            async () => ({ id: assetId, status: 'PROCESSING', name: 'Audio' }),
            abort.signal,
        ),
        /chưa sẵn sàng/,
    );
    abort.abort();
    await assert.rejects(
        makePreviewPayload(
            page,
            book,
            scene,
            async () => ({ id: assetId, status: 'READY', name: 'Audio' }),
            abort.signal,
        ),
    );
});
