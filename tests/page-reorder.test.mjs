import assert from 'node:assert/strict';
import test from 'node:test';
import { droppedPageIds } from '../src/features/scene/model/page-reorder.ts';

const pages = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
test('drop uses the target edge in both directions, including first and last slots', () => {
    assert.deepEqual(droppedPageIds(pages, 'a', { id: 'c', after: true }), ['b', 'c', 'a', 'd']);
    assert.deepEqual(droppedPageIds(pages, 'a', { id: 'c', after: false }), ['b', 'a', 'c', 'd']);
    assert.deepEqual(droppedPageIds(pages, 'd', { id: 'b', after: false }), ['a', 'd', 'b', 'c']);
    assert.deepEqual(droppedPageIds(pages, 'd', { id: 'a', after: false }), ['d', 'a', 'b', 'c']);
    assert.deepEqual(droppedPageIds(pages, 'a', { id: 'd', after: true }), ['b', 'c', 'd', 'a']);
});
test('dropping in the same slot, on itself, or with missing ids does not write', () => {
    for (const [id, target] of [
        ['a', { id: 'b', after: false }],
        ['b', { id: 'a', after: true }],
        ['a', { id: 'a', after: true }],
        ['missing', { id: 'b', after: true }],
        ['a', { id: 'missing', after: true }],
    ])
        assert.equal(droppedPageIds(pages, id, target), null);
    assert.equal(droppedPageIds([], 'a', { id: 'b', after: true }), null);
    assert.equal(droppedPageIds([{ id: 'a' }, { id: 'a' }], 'a', { id: 'a', after: true }), null);
});
test('every valid insertion preserves ids, unaffected-page order and input data', () => {
    const before = structuredClone(pages);
    for (const source of pages)
        for (const target of pages)
            for (const after of [false, true]) {
                const ids = droppedPageIds(pages, source.id, { id: target.id, after });
                if (!ids) continue;
                assert.deepEqual([...ids].sort(), pages.map((p) => p.id).sort());
                assert.deepEqual(
                    ids.filter((id) => id !== source.id),
                    pages.filter((p) => p.id !== source.id).map((p) => p.id),
                );
            }
    assert.deepEqual(pages, before);
});
