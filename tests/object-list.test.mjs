import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    findSceneObjects,
    objectListSelection,
    sceneObjectLabel,
    toggleObjectListSelection,
} from '../src/features/scene/model/object-list.ts';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';

const text = (id, overrides = {}) =>
    SceneObjectSchema.parse({ id, type: 'text', text: 'Tiếng Việt', transform: {}, ...overrides });
test('object search matches Vietnamese names and presentation types without accents', () => {
    const objects = [
        text('a', { name: 'Lời kể của bé' }),
        text('b', { name: 'Tiêu đề', presentation: { kind: 'screen' } }),
        text('c', { presentation: { kind: 'bubble' } }),
    ];
    assert.deepEqual(
        findSceneObjects(objects, 'LOI KE').map((o) => o.id),
        ['a'],
    );
    assert.deepEqual(
        findSceneObjects(objects, 'the thong tin').map((o) => o.id),
        ['b'],
    );
    assert.deepEqual(
        findSceneObjects(objects, 'bong bong').map((o) => o.id),
        ['c'],
    );
    assert.equal(findSceneObjects(objects, '   '), objects);
    assert.deepEqual(findSceneObjects(objects, 'không có kết quả'), []);
    assert.equal(sceneObjectLabel(objects[1]), 'Thẻ thông tin');
});
test('select-all only includes editable visible results and reports mixed state', () => {
    const objects = [
        text('a'),
        text('b', { locked: true }),
        text('c', { editorHidden: true }),
        text('d'),
    ];
    assert.deepEqual(objectListSelection(objects, ['a', 'b']), {
        ids: ['a', 'd'],
        checked: 'indeterminate',
    });
    assert.equal(objectListSelection(objects, ['a', 'd', 'foreign']).checked, true);
    assert.equal(objectListSelection(objects, []).checked, false);
    assert.deepEqual(objectListSelection([objects[1], objects[2]], ['b']), {
        ids: [],
        checked: false,
    });
});
test('bulk selection adds or removes filtered results while preserving unrelated selection', () => {
    const selected = ['outside', 'b'];
    assert.deepEqual(toggleObjectListSelection(selected, ['a', 'b'], true), ['outside', 'b', 'a']);
    assert.deepEqual(toggleObjectListSelection(selected, ['a', 'b'], false), ['outside']);
    assert.deepEqual(selected, ['outside', 'b']);
});
