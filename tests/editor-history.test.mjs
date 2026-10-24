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
import { safeTransform } from '../src/features/scene/model/transforms.ts';

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
        position: [0.12346, -0.2, 0],
        rotation: [90, 180, -45],
        scale: [0.001, 0.001, 2],
    });
    assert.equal(safeTransform(t, true, false).position[2], 1);
    assert.equal(safeTransform({ ...t, position: [NaN, 0, 0] }, false, true), null);
});
