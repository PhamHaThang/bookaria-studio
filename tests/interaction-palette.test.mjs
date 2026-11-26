import assert from 'node:assert/strict';
import test from 'node:test';
import {
    actionPalette,
    assignActionObject,
    paletteAction,
    paletteUnavailable,
} from '../src/features/scene/model/interaction-palette.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { ActionSchema } from '../src/shared/contracts/scene.schema.ts';

const image = newObject('text', 'image'),
    other = newObject('text', 'other');
const audio = newObject('audio', 'audio', {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'AUDIO',
    status: 'READY',
});
const video = newObject('video', 'video', {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'VIDEO',
    status: 'READY',
});
const model = newObject('model', 'model', {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'MODEL',
    status: 'READY',
});
const assets = { [model.assetId]: { type: 'MODEL', meta: { animations: ['Roar'] } } };
test('palette presets use only executable action types and preserve transform dimensions', () => {
    for (const item of actionPalette) {
        const action = paletteAction(item.id, image, [image, audio, video, model], assets);
        if (action.type === 'openUrl') action.url = 'https://example.com';
        assert.equal(ActionSchema.safeParse(action).success, true, item.id);
        if (item.id === 'rotate') {
            assert.equal(action.position, undefined);
            assert.deepEqual(action.rotation, image.transform.rotation);
        }
        if (item.id === 'scale') {
            assert.equal(action.position, undefined);
            assert.deepEqual(action.scale, image.transform.scale);
        }
    }
});
test('dragging a target creates references and rejects incompatible media without changing scene objects', () => {
    const original = structuredClone([image, audio, video, model]);
    const action = assignActionObject(paletteAction('show', image, [image], assets), other, assets);
    assert.equal(action.objectId, other.id);
    assert.throws(
        () => assignActionObject(paletteAction('playVideo', video, [video], assets), image, assets),
        /không phù hợp/,
    );
    assert.equal(
        assignActionObject(paletteAction('playAudio', audio, [audio], assets), audio, assets)
            .assetId,
        audio.assetId,
    );
    assert.throws(
        () => assignActionObject(paletteAction('playAudio', audio, [audio], assets), image, assets),
        /âm thanh/,
    );
    assert.deepEqual([image, audio, video, model], original);
});
test('only animated models enable animation and invalid targets are explained', () => {
    assert.ok(paletteUnavailable('playAnimation', [model], {}));
    assert.equal(paletteUnavailable('playAnimation', [model], assets), undefined);
    assert.ok(paletteUnavailable('playVideo', [image], assets));
    assert.throws(
        () => assignActionObject(paletteAction('playAnimation', model, [model], assets), model, {}),
        /chưa có hoạt cảnh/,
    );
});
