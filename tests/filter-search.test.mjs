import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateFilterSearch } from '../src/shared/lib/filter-search.ts';

test('live typing preserves the section and other filters while resetting pagination', () => {
    const current = new URLSearchParams('view=assets&type=MODEL&categoryId=group&page=5');
    const result = updateFilterSearch(current, { q: '  mèo  ' });
    assert.deepEqual(Object.fromEntries(result), {
        view: 'assets',
        type: 'MODEL',
        categoryId: 'group',
        q: 'mèo',
    });
    assert.equal(current.get('page'), '5');
    assert.equal(current.has('q'), false);
});

test('clearing a keyword keeps the selected book status and order', () => {
    assert.deepEqual(
        Object.fromEntries(
            updateFilterSearch(new URLSearchParams('q=old&status=DRAFT&sort=title&page=2'), {
                q: ' ',
            }),
        ),
        { status: 'DRAFT', sort: 'title' },
    );
});

test('changing a select keeps a committed keyword and unrelated authentication state', () => {
    assert.deepEqual(
        Object.fromEntries(
            updateFilterSearch(new URLSearchParams('q=An&role=AUTHOR&page=4&auth=login'), {
                role: 'ADMIN',
            }),
        ),
        { q: 'An', role: 'ADMIN', auth: 'login' },
    );
});

test('explicit pagination is preserved and blank optional filters are removed', () => {
    assert.deepEqual(
        Object.fromEntries(
            updateFilterSearch(new URLSearchParams('age=0&language=vi'), {
                language: undefined,
                page: '2',
            }),
        ),
        { age: '0', page: '2' },
    );
});
