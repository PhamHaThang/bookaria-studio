import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import {
    createFittedAssetObject,
    fitAssetTransform,
} from '../src/features/scene/model/asset-insertion.ts';
import {
    addObject,
    duplicateObject,
    replaceObjectAsset,
    validatedScene,
} from '../src/features/scene/model/objects.ts';

const box = (min, max) => new Box3(new Vector3(...min), new Vector3(...max));
const asset = (type, meta = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    type,
    status: 'READY',
    name: 'Asset',
    meta,
});
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const placed = (bounds, t) =>
    bounds
        .clone()
        .applyMatrix4(
            new Matrix4().compose(
                new Vector3(...t.position),
                new Quaternion().setFromEuler(new Euler(...t.rotation.map(MathUtils.degToRad))),
                new Vector3(...t.scale),
            ),
        );

test('offset models keep uniform placement on paper and respect the 0.001 scale floor', () => {
    for (const size of [0.0001, 1, 10000])
        for (const aspect of [0.4, 1, 297 / 210, 3]) {
            const bounds = box(
                [10 * size, -20 * size, 30 * size],
                [12 * size, -15 * size, 31 * size],
            );
            const original = bounds.clone(),
                transform = fitAssetTransform(bounds, aspect, [90, 0, 0], true);
            const result = placed(bounds, transform),
                extent = result.getSize(new Vector3()),
                center = result.getCenter(new Vector3());
            close(transform.scale[0], transform.scale[1]);
            close(transform.scale[1], transform.scale[2]);
            close(center.x, 0);
            close(center.y, 0);
            close(result.min.z, 0);
            assert.ok(transform.scale[0] >= 0.001);
            if (size === 10000) assert.equal(transform.scale[0], 0.001);
            else
                assert.ok(
                    extent.x <= 0.4 + 1e-8 &&
                        extent.y <= aspect * 0.4 + 1e-8 &&
                        extent.z <= Math.min(1, aspect) * 0.4 + 1e-8,
                );
            assert.ok(bounds.equals(original));
        }
});

test('image and video insertions keep unit scale across page sizes and missing or portrait/landscape metadata', async () => {
    for (const type of ['image', 'video'])
        for (const [width, height] of [
            [4000, 2000],
            [1000, 6000],
            [undefined, undefined],
        ])
            for (const aspect of [0.3, 297 / 210, 3]) {
                const object = await createFittedAssetObject(
                    type,
                    'fitted',
                    asset(type.toUpperCase(), { width, height }),
                    aspect,
                    new AbortController().signal,
                );
                const t = object.transform;
                assert.deepEqual(t.scale, [1, 1, 1]);
                close(t.position[0], 0);
                close(t.position[1], 0);
                close(t.position[2], 0);
                const scene = addObject(
                    { schemaVersion: 1, objects: [], interactions: [] },
                    object,
                );
                assert.deepEqual(
                    validatedScene(JSON.parse(JSON.stringify(scene))).objects[0].transform,
                    t,
                );
                assert.deepEqual(duplicateObject(scene, object.id, 'copy').objects[1].transform, t);
                assert.deepEqual(
                    replaceObjectAsset(object, asset(type.toUpperCase(), { width: 1, height: 1 }))
                        .transform,
                    t,
                );
            }
});

test('invalid, empty and degenerate geometry fails without emitting invalid transforms', () => {
    for (const bounds of [new Box3(), box([0, 0, 0], [0, 0, 0]), box([0, 0, 0], [Infinity, 1, 1])])
        assert.throws(() => fitAssetTransform(bounds, 1, [90, 0, 0], true));
    for (const aspect of [0, -1, Infinity, NaN])
        assert.throws(() => fitAssetTransform(box([0, 0, 0], [1, 1, 1]), aspect, [90, 0, 0], true));
});

test('audio keeps its handle size and canceled or unready insertions never enter the draft', async () => {
    const object = await createFittedAssetObject(
        'audio',
        'sound',
        asset('AUDIO'),
        1,
        new AbortController().signal,
    );
    assert.deepEqual(object.transform.scale, [1, 1, 1]);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        createFittedAssetObject('model', 'cancel', asset('MODEL'), 1, controller.signal),
        { name: 'AbortError' },
    );
    await assert.rejects(
        createFittedAssetObject(
            'model',
            'pending',
            { ...asset('MODEL'), status: 'PROCESSING' },
            1,
            new AbortController().signal,
        ),
        /sẵn sàng/,
    );
});
