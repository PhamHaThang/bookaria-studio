import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newObject } from '../src/features/scene/model/objects.ts';
import { createSceneNodeKey } from '../src/features/scene/model/scene-node-key.ts';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';

const asset = {
    id: '10000000-0000-4000-8000-000000000001',
    type: 'MODEL',
    status: 'READY',
    name: 'Model',
    url: 'https://fake.test/model.glb',
    thumbnailUrl: null,
    meta: { triangles: 10, animations: [], bounds: { min: [0, 0, 0], max: [1, 1, 1] } },
    tags: [],
};
test('saving equivalent object JSON in schema order keeps the same render key', () => {
    const key = createSceneNodeKey(),
        object = newObject('text', 'text');
    const reordered = {
        ...object,
        style: Object.fromEntries(Object.entries(object.style).reverse()),
    };
    assert.equal(key(reordered), key(SceneObjectSchema.parse(reordered)));
    assert.equal(key({ ...reordered, presentation: undefined }), key(reordered));
});
test('model metadata refreshed on save does not rebuild an unchanged GLB', () => {
    const key = createSceneNodeKey(),
        model = newObject('model', 'model', asset);
    const saved = {
        ...asset,
        meta: {
            ...asset.meta,
            bounds: { max: [1, 1, 1], min: [0, 0, 0] },
            warnings: ['Updated'],
            downloadBytes: 1000,
        },
    };
    assert.equal(key(model, asset), key(SceneObjectSchema.parse(model), saved));
    assert.notEqual(
        key(model, asset),
        key(model, { ...saved, url: 'https://fake.test/replacement.glb' }),
    );
});
test('transforms, names and visibility continue to update without rebuilding resources', () => {
    const key = createSceneNodeKey(),
        model = newObject('model', 'model', asset);
    assert.equal(
        key(model, asset),
        key(
            {
                ...model,
                transform: { ...model.transform, position: [1, 2, 3] },
                name: 'Renamed',
                visible: false,
                locked: true,
                billboard: true,
            },
            asset,
        ),
    );
});
test('real text, style and screen-image changes still invalidate the render key', () => {
    const key = createSceneNodeKey(),
        text = newObject('text', 'text');
    assert.notEqual(key(text), key({ ...text, text: 'Changed' }));
    assert.equal(key(text), key({ ...text, style: { ...text.style, color: '#ff0000' } }));
    assert.notEqual(
        key(text),
        key({ ...text, style: { ...text.style, size: text.style.size * 2 } }),
    );
    assert.notEqual(
        key(text, undefined, 'https://fake.test/a.png'),
        key(text, undefined, 'https://fake.test/b.png'),
    );
});
test('audio synchronization keeps playback while duration and video geometry remain significant', () => {
    const key = createSceneNodeKey(),
        audioAsset = { ...asset, type: 'AUDIO', meta: { durationSec: 12 } },
        audio = newObject('audio', 'audio', audioAsset);
    assert.equal(
        key(audio, audioAsset),
        key(
            {
                ...audio,
                volume: 0.2,
                loop: !audio.loop,
                autoplay: !audio.autoplay,
                audioKind: 'VOICE',
            },
            audioAsset,
        ),
    );
    assert.notEqual(
        key(audio, audioAsset),
        key(audio, { ...audioAsset, meta: { durationSec: 24 } }),
    );
    const videoAsset = { ...asset, type: 'VIDEO', meta: { width: 160, height: 90 } },
        video = newObject('video', 'video', videoAsset);
    assert.notEqual(
        key(video, videoAsset),
        key(video, { ...videoAsset, meta: { width: 90, height: 160 } }),
    );
});
test('annotation positioning stays live without rebuilding its text card', () => {
    const key = createSceneNodeKey(),
        annotation = {
            ...newObject('label', 'note'),
            presentation: {
                kind: 'annotation',
                shape: 'line',
                labelOffset: [1, 0],
                connectorSide: 'left',
            },
        };
    assert.equal(
        key(annotation),
        key({
            ...annotation,
            presentation: {
                ...annotation.presentation,
                labelOffset: [2, 1],
                connectorSide: 'right',
            },
        }),
    );
});

test('text palettes update in place while border geometry and text presentation remain significant', () => {
    const key = createSceneNodeKey();
    for (const kind of ['screen', 'bubble', 'annotation', 'extruded']) {
        const object = SceneObjectSchema.parse({
            ...newObject('text', `text-${kind}`),
            presentation: { kind },
        });
        const presentation = { ...object.presentation };
        if ('background' in presentation) presentation.background = '#88aa44';
        if (kind === 'screen') presentation.buttonBackground = '#337799';
        if (kind === 'annotation') {
            presentation.descriptionColor = '#112233';
            presentation.descriptionBackground = '#445566';
        }
        if (presentation.border) presentation.border = { ...presentation.border, color: '#336699' };
        assert.equal(
            key(object),
            key({ ...object, style: { ...object.style, color: '#aa2244' }, presentation }),
            kind,
        );
        if (presentation.border)
            assert.notEqual(
                key(object),
                key({
                    ...object,
                    presentation: {
                        ...presentation,
                        border: { ...presentation.border, width: presentation.border.width + 1 },
                    },
                }),
            );
        assert.notEqual(key(object), key({ ...object, text: 'Changed content' }));
    }
});
