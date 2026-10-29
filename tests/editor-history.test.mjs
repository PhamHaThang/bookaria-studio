import assert from 'node:assert/strict';
import test from 'node:test';
import {
    commitHistory,
    createHistory,
    historyLimit,
    redoHistory,
    undoHistory,
} from '../src/features/scene/model/history.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import {
    objectFromGizmo,
    safeTransform,
    withObjectPosition,
    withPaperSnap,
} from '../src/features/scene/model/transforms.ts';

const scene = () => ({
    schemaVersion: 1,
    objects: [newObject('text', 'text-test')],
    interactions: [],
});
test('undo and redo restore both objects and interaction references without aliasing the caller', () => {
    const original = scene(),
        first = createHistory(original);
    original.objects[0].text = 'Changed outside history';
    const edited = structuredClone(first.present);
    edited.objects[0].text = 'New text';
    edited.interactions = [
        {
            id: 'tap',
            enabled: true,
            trigger: { type: 'onTap', objectId: 'text-test' },
            actions: [],
            onRetrigger: 'ignore',
        },
    ];
    const next = commitHistory(first, edited);
    edited.objects[0].text = 'Changed after commit';
    assert.equal(next.present.objects[0].text, 'New text');
    assert.deepEqual(undoHistory(next).present, first.present);
    assert.deepEqual(redoHistory(undoHistory(next)).present, next.present);
});
test('a new edit after undo clears the redo branch; unchanged writes consume no undo step', () => {
    let h = createHistory(scene());
    h = commitHistory(h, { ...h.present, objects: [] });
    h = undoHistory(h);
    assert.equal(commitHistory(h, structuredClone(h.present)), h);
    h = commitHistory(h, {
        ...h.present,
        interactions: [],
        objects: [{ ...h.present.objects[0], text: 'A different branch' }],
    });
    assert.equal(h.future.length, 0);
});
test('history stays bounded across long editing sessions', () => {
    let h = createHistory(scene());
    for (let i = 0; i < 200; i++)
        h = commitHistory(h, {
            ...h.present,
            objects: [{ ...h.present.objects[0], text: String(i) }],
        });
    assert.equal(h.past.length, historyLimit);
});
test('canvas transform keeps schema degrees, clamps positive scale and snaps only translation to paper', () => {
    const t = { position: [0.1234567, -0.2, 1], rotation: [90, 180, -45], scale: [0, -1, 2] };
    assert.deepEqual(safeTransform(t, true, true), {
        position: [0.1234567, -0.2, 0],
        rotation: [90, 180, -45],
        scale: [0.001, 0.001, 2],
    });
    assert.equal(safeTransform(t, true, false).position[2], 1);
    assert.equal(safeTransform({ ...t, position: [NaN, 0, 0] }, false, true), null);
});

test('lifting Z, XZ, YZ or the free handle unpins existing objects without losing height', () => {
    const pinned = withPaperSnap(newObject('text', 'lifted'), true);
    for (const axis of ['Z', 'XZ', 'YZ', 'XYZ']) {
        const value = { ...pinned.transform, position: [0.1, -0.2, 0.35] };
        const lifted = objectFromGizmo(pinned, value, true, axis);
        assert.equal(lifted.snapToPaper, false);
        assert.deepEqual(lifted.transform.position, [0.1, -0.2, 0.35]);
        const xy = objectFromGizmo(lifted, { ...value, position: [0.2, 0.1, 0.35] }, true, 'X');
        assert.equal(xy.transform.position[2], 0.35);
    }
    assert.equal(pinned.snapToPaper, true);
    assert.equal(pinned.transform.position[2], 0);
});

test('XY remains on paper, and clicking a Z handle without lifting does not unpin', () => {
    const pinned = withPaperSnap(newObject('text', 'pinned'), true);
    const moved = objectFromGizmo(
        pinned,
        { ...pinned.transform, position: [0.2, 0.1, 0.1] },
        true,
        'XY',
    );
    assert.deepEqual(moved.transform.position, [0.2, 0.1, 0]);
    assert.equal(moved.snapToPaper, true);
    assert.equal(objectFromGizmo(pinned, pinned.transform, true, 'Z').snapToPaper, true);
});

test('numeric height edits, re-pinning and undo keep snapping and height consistent', () => {
    const original = withPaperSnap(newObject('text', 'numeric-height'), true);
    const lifted = withObjectPosition(original, [0.1, 0.2, 0.5]);
    assert.equal(lifted.snapToPaper, false);
    const pinned = withPaperSnap(lifted, true);
    assert.equal(pinned.snapToPaper, true);
    assert.deepEqual(pinned.transform.position, [0.1, 0.2, 0]);
    const first = createHistory({ schemaVersion: 1, objects: [lifted], interactions: [] });
    const history = commitHistory(first, { ...first.present, objects: [pinned] });
    assert.deepEqual(undoHistory(history).present.objects[0], lifted);
    assert.deepEqual(redoHistory(undoHistory(history)).present.objects[0], pinned);
    const invalid = withObjectPosition(original, [0, 0, Number.NaN]);
    assert.ok(Number.isNaN(invalid.transform.position[2]));
    assert.equal(objectFromGizmo(original, invalid.transform, true, 'Z'), null);
});

test('a previously elevated object keeps its stored height on its next XY drag', () => {
    const old = {
        ...newObject('text', 'old-height'),
        snapToPaper: true,
        transform: { position: [0, 0, 0.4], rotation: [0, 0, 0], scale: [1, 1, 1] },
    };
    const result = objectFromGizmo(
        old,
        { ...old.transform, position: [0.1, 0.2, 0.4] },
        true,
        'XY',
    );
    assert.equal(result.snapToPaper, false);
    assert.equal(result.transform.position[2], 0.4);
    const rotated = objectFromGizmo(old, { ...old.transform, rotation: [45, 0, 0] }, false, 'X');
    assert.equal(rotated.snapToPaper, true);
    assert.equal(rotated.transform.position[2], 0.4);
});

test('new objects move freely in 3D and stay unpinned when returning to zero height', () => {
    const original = newObject('text', 'free-height');
    assert.equal(original.snapToPaper, false);
    const lifted = objectFromGizmo(
        original,
        { ...original.transform, position: [0.1, 0.2, 0.4] },
        true,
        'Z',
    );
    assert.equal(lifted.snapToPaper, false);
    const moved = objectFromGizmo(
        lifted,
        { ...lifted.transform, position: [0.3, 0.2, 0.4] },
        true,
        'XY',
    );
    assert.deepEqual(moved.transform.position, [0.3, 0.2, 0.4]);
    assert.equal(moved.snapToPaper, false);
    const onPaper = withObjectPosition(moved, [0.3, 0.2, 0]);
    assert.equal(onPaper.snapToPaper, false);
    const pinned = withPaperSnap(moved, true);
    const released = withPaperSnap(pinned, false);
    assert.equal(released.snapToPaper, false);
    assert.deepEqual(released.transform.position, [0.3, 0.2, 0]);
    const history = commitHistory(
        createHistory({ schemaVersion: 1, objects: [original], interactions: [] }),
        { schemaVersion: 1, objects: [moved], interactions: [] },
    );
    assert.deepEqual(undoHistory(history).present.objects[0], original);
    assert.deepEqual(redoHistory(undoHistory(history)).present.objects[0], moved);
});

test('translation outside the page and rotation preserve precise and legacy small asset scales', () => {
    for (const scale of [
        [0.00123456789, 0.00234567891, 0.00345678912],
        [0.000004321, 0.000012345, 0.000006789],
    ]) {
        const original = newObject('model', 'precise-model', {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'MODEL',
            status: 'READY',
            name: 'Model',
        });
        original.transform.scale = scale;
        original.transform.rotation = [12.123456789, 24.234567891, 36.345678912];
        const moved = objectFromGizmo(
            original,
            {
                position: [2, -3, 0.2],
                rotation: [12.12345, 24.23456, 36.34567],
                scale: scale.map((n) => n + 1e-12),
            },
            true,
            'XYZ',
            'world',
            false,
        );
        assert.deepEqual(moved.transform.scale, scale);
        assert.deepEqual(moved.transform.rotation, original.transform.rotation);
        assert.deepEqual(moved.transform.position, [2, -3, 0.2]);
        const rotated = objectFromGizmo(
            moved,
            { ...moved.transform, rotation: [90, 45, 0], scale: scale.map((n) => n + 1e-12) },
            false,
            'Z',
            'world',
            false,
        );
        assert.deepEqual(rotated.transform.scale, scale);
        assert.deepEqual(rotated.transform.rotation, [90, 45, 0]);
        const scaled = objectFromGizmo(
            rotated,
            { ...rotated.transform, scale: [0.00001, 0.00002, 0.00003] },
            false,
            'XYZ',
            'local',
            true,
        );
        assert.deepEqual(scaled.transform.scale, [0.001, 0.001, 0.001]);
    }
});
