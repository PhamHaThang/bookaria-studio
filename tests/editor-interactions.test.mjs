import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Quaternion, Vector3 } from 'three';
import {
    commitHistory,
    createHistory,
    redoHistory,
    undoHistory,
} from '../src/features/scene/model/history.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { objectFromGizmo, withPaperSnap } from '../src/features/scene/model/transforms.ts';
import { SceneSchema } from '../src/shared/contracts/scene.schema.ts';

function localMove(rotation, direction) {
    const pinned = withPaperSnap(newObject('text', 'local-axis-test'), true);
    pinned.transform.rotation = rotation.map((radian) => (radian * 180) / Math.PI);
    const quaternion = new Quaternion().setFromEuler(new Euler(...rotation));
    const displacement = new Vector3(...direction).applyQuaternion(quaternion);
    const value = { ...pinned.transform, position: displacement.toArray() };
    return { pinned, value, displacement };
}

test('local X and Y translation can lift a rotated paper-pinned object without clamping height', () => {
    for (const [rotation, direction, axis] of [
        [[0, Math.PI / 2, 0], [0.3, 0, 0], 'X'],
        [[Math.PI / 2, 0, 0], [0, 0.3, 0], 'Y'],
    ]) {
        const { pinned, value, displacement } = localMove(rotation, direction);
        const next = objectFromGizmo(pinned, value, true, axis, 'local');
        assert.equal(next.snapToPaper, false);
        assert.ok(Math.abs(next.transform.position[2] - displacement.z) < 1e-5);
        assert.deepEqual(next.transform.rotation, pinned.transform.rotation);
        assert.deepEqual(pinned.transform.position, [0, 0, 0]);
        assert.ok(
            SceneSchema.safeParse({ schemaVersion: 1, objects: [next], interactions: [] }).success,
        );
    }
});

test('world XY retains paper placement, while a real local plane lift is preserved', () => {
    const { pinned, value } = localMove([Math.PI / 4, 0, 0], [0.2, 0.3, 0]);
    const world = objectFromGizmo(pinned, value, true, 'XY');
    const local = objectFromGizmo(pinned, value, true, 'XY', 'local');
    assert.equal(world.snapToPaper, true);
    assert.equal(world.transform.position[2], 0);
    assert.equal(local.snapToPaper, false);
    assert.ok(local.transform.position[2] > 0.2);
});

test('local rotation or click without translation keeps the paper constraint', () => {
    const { pinned } = localMove([0, 0, 0], [0, 0, 0]);
    const rotated = objectFromGizmo(
        pinned,
        { ...pinned.transform, rotation: [30, 45, 15] },
        false,
        'X',
        'local',
    );
    const click = objectFromGizmo(
        pinned,
        { ...pinned.transform, position: [0, 0, 0.0000001] },
        true,
        'X',
        'local',
    );
    assert.equal(rotated.snapToPaper, true);
    assert.equal(click.snapToPaper, true);
    assert.equal(click.transform.position[2], 0);
});

test('undo and redo retain height and paper mode together after local-axis lifting', () => {
    const { pinned, value } = localMove([0, Math.PI / 2, 0], [0.3, 0, 0]);
    const before = { schemaVersion: 1, objects: [pinned], interactions: [] };
    const lifted = objectFromGizmo(pinned, value, true, 'X', 'local');
    const history = commitHistory(createHistory(before), { ...before, objects: [lifted] });
    assert.deepEqual(undoHistory(history).present, before);
    assert.deepEqual(redoHistory(undoHistory(history)).present.objects[0], lifted);
});
