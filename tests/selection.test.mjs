import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import {
    commitHistory,
    createHistory,
    redoHistory,
    undoHistory,
} from '../src/features/scene/model/history.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import {
    duplicateSelection,
    removeSelection,
    setSelectionFlag,
    updateSelection,
} from '../src/features/scene/model/selection.ts';
import {
    selectionFrustum,
    transformSelection,
} from '../src/features/scene/model/selection-transform.ts';
import { findSceneReferenceIssues, SceneSchema } from '../src/shared/contracts/scene.schema.ts';

const text = (id, position = [0, 0, 0]) => ({
    ...newObject('text', id),
    transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
});
const scene = (...objects) => ({ schemaVersion: 1, objects, interactions: [] });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00003, `${a} != ${b}`);

test('selection toggles, additive rectangles and replacement never create duplicate ids', () => {
    assert.deepEqual(updateSelection(['a', 'b'], ['b', 'c', 'c'], 'toggle'), ['a', 'c']);
    assert.deepEqual(updateSelection(['a'], ['a', 'b'], 'add'), ['a', 'b']);
    assert.deepEqual(updateSelection(['a', 'b'], [], 'replace'), []);
    assert.deepEqual(updateSelection(['a', 'b'], ['c', 'c'], 'replace'), ['c']);
});

test('bulk operations reject a locked member atomically and preserve unrelated objects', () => {
    const original = scene(text('a'), { ...text('b'), locked: true }, text('c'));
    assert.throws(() => duplicateSelection(original, ['a', 'b'], () => 'copy'), /Mở khóa/);
    assert.throws(() => removeSelection(original, ['a', 'b']), /Mở khóa/);
    assert.throws(() => setSelectionFlag(original, ['a', 'b'], 'editorHidden', true), /Mở khóa/);
    const unlocked = setSelectionFlag(original, ['a', 'b'], 'locked', false);
    assert.equal(unlocked.objects[1].locked, false);
    const hidden = setSelectionFlag(unlocked, ['a', 'b'], 'editorHidden', true);
    assert.deepEqual(
        hidden.objects.map((o) => o.editorHidden),
        [true, true, false],
    );
    assert.deepEqual(
        original.objects.map((o) => o.locked),
        [false, true, false],
    );
    assert.equal(hidden.objects[2], original.objects[2]);
});

test('duplicate checks the whole group limit, remaps group ids and does not clone interactions', () => {
    const original = scene({ ...text('a'), groupId: 'g' }, { ...text('b'), groupId: 'g' });
    original.interactions = [
        {
            id: 'rule',
            enabled: true,
            trigger: { type: 'onTap', objectId: 'a' },
            actions: [{ type: 'openUrl', url: 'https://example.com', delayMsSchema: 0 }],
            onRetrigger: 'ignore',
        },
    ];
    let count = 0;
    const copy = duplicateSelection(original, ['b', 'a'], () => `copy-${++count}`);
    assert.equal(copy.scene.objects.length, 4);
    assert.deepEqual(copy.ids, ['copy-1', 'copy-3']);
    assert.equal(copy.scene.objects[2].groupId, copy.scene.objects[3].groupId);
    assert.notEqual(copy.scene.objects[2].groupId, 'g');
    assert.deepEqual(copy.scene.interactions, original.interactions);
    const full = scene(...Array.from({ length: 59 }, (_, i) => text(`item-${i}`)));
    assert.throws(() => duplicateSelection(full, ['item-0', 'item-1'], () => 'copy'), /tối đa 60/);
    assert.equal(full.objects.length, 59);
    SceneSchema.parse(copy.scene);
});

test('bulk delete retains reference rules and undo restores all removed objects in one step', () => {
    const original = scene(text('a'), text('b'), text('c'));
    original.interactions = [
        {
            id: 'rule',
            enabled: true,
            trigger: { type: 'onTap', objectId: 'a' },
            actions: [
                {
                    type: 'setVisible',
                    objectId: 'c',
                    value: false,
                    durationMs: 0,
                    delayMsSchema: 0,
                },
            ],
            onRetrigger: 'ignore',
        },
    ];
    const deleted = removeSelection(original, ['a', 'c']);
    assert.deepEqual(deleted.interactions, original.interactions);
    assert.equal(findSceneReferenceIssues(deleted).length, 2);
    assert.deepEqual(
        deleted.objects.map((o) => o.id),
        ['b'],
    );
    const history = commitHistory(createHistory(original), deleted);
    assert.equal(history.past.length, 1);
    assert.deepEqual(undoHistory(history).present, original);
    assert.deepEqual(redoHistory(undoHistory(history)).present, deleted);
    assert.throws(() => removeSelection(original, ['missing']), /không còn/);
});

test('group translation preserves relative offsets, lifts paper-pinned objects and round trips schema', () => {
    const before = [{ ...text('a', [-0.3, 0, 0]), snapToPaper: true }, text('b', [0.3, 0.1, 0.2])];
    const moved = transformSelection(
        before,
        new Matrix4().makeTranslation(0.2, -0.1, 0.4),
        true,
        'Z',
    );
    assert.deepEqual(moved[0].transform.position, [-0.1, -0.1, 0.4]);
    assert.deepEqual(moved[1].transform.position, [0.5, 0, 0.6]);
    assert.equal(moved[0].snapToPaper, false);
    assert.deepEqual(before[0].transform.position, [-0.3, 0, 0]);
    assert.deepEqual(SceneSchema.parse(scene(...moved)).objects, moved);
});

test('rotation and uniform scaling act around a common pivot without altering intrinsic proportions', () => {
    const a = text('a', [-1, 0, 0]),
        b = text('b', [1, 0, 0]);
    a.transform.rotation = [30, 25, 10];
    a.transform.scale = [0.2, 0.4, 0.8];
    const delta = new Matrix4().compose(
        new Vector3(0, 1, 0),
        new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2)),
        new Vector3(2, 2, 2),
    );
    const result = transformSelection([a, b], delta, false, 'Z');
    result[0].transform.position.forEach((n, i) => {
        near(n, [0, -1, 0][i]);
    });
    result[1].transform.position.forEach((n, i) => {
        near(n, [0, 3, 0][i]);
    });
    result[0].transform.scale.forEach((n, i) => {
        near(n, a.transform.scale[i] * 2);
    });
    const expected = new Quaternion()
        .setFromEuler(new Euler(0, 0, Math.PI / 2))
        .multiply(
            new Quaternion().setFromEuler(
                new Euler(...a.transform.rotation.map((n) => (n * Math.PI) / 180)),
            ),
        );
    const actual = new Quaternion().setFromEuler(
        new Euler(...result[0].transform.rotation.map((n) => (n * Math.PI) / 180)),
    );
    near(actual.angleTo(expected), 0);
    assert.equal(transformSelection([{ ...a, locked: true }, b], delta, false, 'Z'), null);
    assert.equal(transformSelection([{ ...a, editorHidden: true }, b], delta, false, 'Z'), null);
    assert.equal(transformSelection([a], new Matrix4().makeScale(-1, -1, -1), false, 'XYZ'), null);
});

test('marquee frustum selects intersecting objects and excludes objects behind/outside the camera', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 20);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const view = selectionFrustum(
        camera,
        { left: 40, right: 60, top: 40, bottom: 60 },
        { width: 100, height: 100 },
    );
    const box = (x, z) =>
        new Box3(new Vector3(x - 0.05, -0.05, z - 0.05), new Vector3(x + 0.05, 0.05, z + 0.05));
    assert.equal(view.intersectsBox(box(0, 0)), true);
    assert.equal(view.intersectsBox(box(2, 0)), false);
    assert.equal(view.intersectsBox(box(0, 5)), false);
    assert.equal(
        selectionFrustum(
            camera,
            { left: 50, right: 50, top: 40, bottom: 60 },
            { width: 100, height: 100 },
        ),
        null,
    );
});
