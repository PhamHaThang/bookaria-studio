import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageAfterRemoval } from '../src/features/pages/model/page-after-removal.ts';

const pages = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
test('deleting the open middle page opens the following page', () => {
    assert.equal(
        pageAfterRemoval(
            pages,
            pages.filter((p) => p.id !== 'c'),
            'c',
        ),
        'd',
    );
});
test('deleting the last page opens the preceding page', () => {
    assert.equal(pageAfterRemoval(pages, pages.slice(0, -1), 'd'), 'c');
});
test('deleting all pages leaves no selected page', () => {
    assert.equal(pageAfterRemoval(pages, [], 'a'), undefined);
});
test('an outdated page link falls back to the first available page', () => {
    assert.equal(pageAfterRemoval(pages, pages.slice(1), 'missing'), 'b');
});
