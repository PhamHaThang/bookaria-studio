import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { createSceneApi } from '../src/features/scene/api/scene-api.ts';
import {
    addObject,
    duplicateObject,
    moveObject,
    newObject,
    previewPosition,
    removeObject,
    replaceObjectAsset,
    settingsPatch,
    validatedScene,
} from '../src/features/scene/model/objects.ts';
import { isSceneConflict, reconcileSave } from '../src/features/scene/model/save-state.ts';
import { ContractError } from '../src/shared/api/contract.ts';
import {
    findSceneReferenceIssues,
    PageSettingsSchema,
    SceneSchema,
} from '../src/shared/contracts/scene.schema.ts';

const id = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222';
const empty = () => SceneSchema.parse({ schemaVersion: 1, objects: [], interactions: [] });
const asset = (type, overrides = {}) => ({
    id,
    type,
    status: 'READY',
    name: 'Asset thử',
    ...overrides,
});
test('all seven authoring object types use backend defaults and valid stable ids', () => {
    for (const type of ['model', 'image', 'audio', 'video', 'text', 'label', 'hotspot']) {
        const kinds = { model: 'MODEL', image: 'IMAGE', audio: 'AUDIO', video: 'VIDEO' };
        const object = newObject(
            type,
            `test-${type}`,
            kinds[type] ? asset(kinds[type]) : undefined,
        );
        assert.equal(validatedScene(addObject(empty(), object)).objects[0].type, type);
        if (type === 'model') assert.deepEqual(object.transform.rotation, [90, 0, 0]);
    }
    assert.throws(() => newObject('text', 'invalid id'));
});
test('asset objects reject wrong kind and pending assets before entering a draft', () => {
    assert.throws(() => newObject('model', 'model', asset('IMAGE')), /đúng loại/);
    assert.throws(
        () => newObject('audio', 'audio', asset('AUDIO', { status: 'PROCESSING' })),
        /sẵn sàng/,
    );
    assert.throws(() => newObject('image', 'image'));
});
test('duplicate preserves grouping and object properties but gets a fresh id without cloning interactions', () => {
    const text = { ...newObject('text', 't1'), groupId: 'group-a', billboard: true };
    const scene = addObject(empty(), text);
    scene.interactions = [
        {
            id: 'rule',
            enabled: false,
            trigger: { type: 'onTap', objectId: 't1' },
            actions: [
                { type: 'toggleVisible', objectId: 't1', durationMs: 300, delayMsSchema: 100 },
            ],
            onRetrigger: 'restart',
        },
    ];
    const next = duplicateObject(scene, 't1', 't2');
    assert.equal(next.objects[1].id, 't2');
    assert.equal(next.objects[1].groupId, 'group-a');
    assert.equal(next.objects[1].billboard, true);
    assert.deepEqual(next.interactions, scene.interactions);
    assert.equal(scene.objects.length, 1);
    assert.throws(() => duplicateObject(scene, 't1', 't1'), /tồn tại/);
});
test('delete retains rules and shared reference checker flags the dangling target', () => {
    const scene = addObject(empty(), newObject('text', 't1'));
    scene.interactions = [
        {
            id: 'rule',
            enabled: true,
            trigger: { type: 'onTap', objectId: 't1' },
            actions: [
                {
                    type: 'setVisible',
                    objectId: 't1',
                    value: false,
                    durationMs: 0,
                    delayMsSchema: 0,
                },
            ],
            onRetrigger: 'ignore',
        },
    ];
    const next = removeObject(scene, 't1');
    assert.deepEqual(next.interactions, scene.interactions);
    assert.equal(next.objects.length, 0);
    assert.equal(findSceneReferenceIssues(next).length, 2);
    assert.equal(validatedScene(next).interactions.length, 1);
});
test('locked objects cannot be removed, duplicated, moved or reassigned', () => {
    const scene = addObject(empty(), { ...newObject('model', 'm1', asset('MODEL')), locked: true });
    assert.throws(() => removeObject(scene, 'm1'), /Mở khóa/);
    assert.throws(() => duplicateObject(scene, 'm1', 'm2'), /Mở khóa/);
    assert.equal(moveObject(scene, 'm1', 1), scene);
    assert.throws(
        () => replaceObjectAsset(scene.objects[0], asset('MODEL', { id: other })),
        /Mở khóa/,
    );
});
test('reordering preserves all ids and interactions without mutating the original draft', () => {
    const scene = addObject(addObject(empty(), newObject('text', 'a')), newObject('hotspot', 'b'));
    const next = moveObject(scene, 'b', -1);
    assert.deepEqual(
        next.objects.map((object) => object.id),
        ['b', 'a'],
    );
    assert.deepEqual(
        scene.objects.map((object) => object.id),
        ['a', 'b'],
    );
    assert.deepEqual(next.interactions, scene.interactions);
    assert.equal(moveObject(scene, 'a', -1), scene);
});
test('hard object limit applies to both add and duplicate', () => {
    const scene = empty();
    scene.objects = Array.from({ length: 60 }, (_, i) => newObject('text', `text-${i}`));
    assert.throws(() => addObject(scene, newObject('text', 'extra')), /60/);
    assert.throws(() => duplicateObject(scene, 'text-0', 'copy'), /60/);
});
test('asset replacement preserves transform, checks readiness and resets obsolete model animation', () => {
    const model = {
        ...newObject('model', 'm1', asset('MODEL')),
        animation: { clip: 'walk', loop: true, autoplay: true },
    };
    const next = replaceObjectAsset(model, asset('MODEL', { id: other }));
    assert.equal(next.assetId, other);
    assert.equal(next.animation, undefined);
    assert.deepEqual(next.transform, model.transform);
    assert.throws(() => replaceObjectAsset(model, asset('AUDIO')));
    assert.throws(() => replaceObjectAsset(newObject('text', 'text'), asset('IMAGE')));
});
test('invalid temporary number/text values never serialize into a saveable scene', () => {
    const scene = addObject(empty(), newObject('text', 'text'));
    scene.objects[0].transform.position[0] = Number.NaN;
    assert.throws(() => validatedScene(scene));
    scene.objects[0].transform.position[0] = -0.25;
    scene.objects[0].transform.scale[2] = 0;
    assert.throws(() => validatedScene(scene));
    scene.objects[0].transform.scale[2] = 1;
    scene.objects[0].text = '';
    assert.throws(() => validatedScene(scene));
});
test('schematic maps centre and positive-up coordinates and ignores invalid/off-page positions', () => {
    const object = newObject('hotspot', 'h');
    assert.deepEqual(previewPosition(object, 1.5), { left: 50, top: 50 });
    object.transform.position = [0.25, 0.375, 3];
    assert.deepEqual(previewPosition(object, 1.5), { left: 75, top: 25 });
    object.transform.position[0] = 2;
    assert.equal(previewPosition(object, 1.5), null);
    object.transform.position[0] = Number.NaN;
    assert.equal(previewPosition(object, 1.5), null);
});
test('page settings patch only sends changed fields, including explicit null removal', () => {
    const before = PageSettingsSchema.parse({ backgroundAudioAssetId: id });
    assert.deepEqual(settingsPatch(before, { ...before, lighting: 'warm' }), { lighting: 'warm' });
    assert.deepEqual(settingsPatch(before, { ...before, backgroundAudioAssetId: null }), {
        backgroundAudioAssetId: null,
    });
    assert.deepEqual(settingsPatch(before, before), {});
});
test('scene API validates revision and scene before making a request and checks committed revision', async () => {
    const calls = [];
    let result = {
        status: 200,
        data: { data: { revision: 2, updatedAt: '2026-10-22T00:00:00Z', warnings: [] } },
    };
    const api = createSceneApi({
        patch: async (...args) => {
            calls.push(args);
            return result;
        },
    });
    await assert.rejects(api.save(id, { revision: -1, scene: empty() }));
    assert.equal(calls.length, 0);
    assert.equal((await api.save(id, { revision: 1, scene: empty() })).revision, 2);
    assert.equal(calls[0][1].revision, 1);
    result = { ...result, data: { data: { revision: 1, updatedAt: '2026-10-22T00:00:00Z' } } };
    await assert.rejects(api.save(id, { revision: 1, scene: empty() }), ContractError);
    result = { status: 202, data: { data: { revision: 2, updatedAt: '2026-10-22T00:00:00Z' } } };
    await assert.rejects(api.save(id, { revision: 1, scene: empty() }), ContractError);
});
test('revision conflicts are distinguished from a publishing job or malformed 409', () => {
    const error = (code) =>
        new AxiosError('conflict', undefined, undefined, undefined, {
            status: 409,
            data: { error: { code, message: 'x', requestId: 'test' } },
        });
    assert.equal(isSceneConflict(error('REVISION_CONFLICT')), true);
    assert.equal(isSceneConflict(error('JOB_IN_PROGRESS')), false);
    assert.equal(isSceneConflict(new Error('other')), false);
});
test('lost write response reconciliation never silently accepts different remote content', () => {
    const scene = addObject(empty(), newObject('text', 'a')),
        attempt = { scene, revision: 2 };
    assert.equal(reconcileSave(attempt, { scene, revision: 3 }), 'saved');
    assert.equal(reconcileSave(attempt, { scene: empty(), revision: 2 }), 'retry');
    assert.equal(reconcileSave(attempt, { scene: empty(), revision: 3 }), 'conflict');
    assert.throws(() => reconcileSave(attempt, { scene, revision: 1 }), /phiên bản cũ/);
});
