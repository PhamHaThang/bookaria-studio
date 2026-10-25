import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
    flattenAssetPages,
    removeAssetFromCache,
} from '../src/features/assets/model/asset-pages.ts';

const asset = (id, status = 'READY') => ({ id, name: id, status });
const page = (data, index = 1, total = 4) => ({
    data,
    meta: { page: index, limit: 2, total, totalPages: Math.ceil(total / 2) },
});
test('append preserves existing order and deduplicates overlapping API pages with latest asset status', () => {
    const a = asset('a'),
        b = asset('b', 'PROCESSING'),
        ready = asset('b');
    const result = flattenAssetPages([page([a, b]), page([ready, asset('c')], 2)]);
    assert.deepEqual(
        result.map((x) => x.id),
        ['a', 'b', 'c'],
    );
    assert.equal(result[1].status, 'READY');
    assert.equal(result[0], a);
});
test('removal updates ordinary pagination without mutating the cached response', () => {
    const original = page([asset('a'), asset('b')], 1, 3),
        next = removeAssetFromCache(original, 'b');
    assert.deepEqual(
        next.data.map((x) => x.id),
        ['a'],
    );
    assert.equal(next.meta.total, 2);
    assert.equal(next.meta.totalPages, 1);
    assert.equal(original.data.length, 2);
    assert.equal(original.meta.total, 3);
});
test('removal from accumulated pages updates every total once and preserves page params', () => {
    const original = {
        pages: [page([asset('a'), asset('b')]), page([asset('b'), asset('c')], 2)],
        pageParams: [1, 2],
    };
    const next = removeAssetFromCache(original, 'b');
    assert.deepEqual(
        flattenAssetPages(next.pages).map((x) => x.id),
        ['a', 'c'],
    );
    assert(next.pages.every((p) => p.meta.total === 3 && p.meta.totalPages === 2));
    assert.deepEqual(next.pageParams, [1, 2]);
    assert.equal(original.pages[0].data.length, 2);
});
test('unknown asset, missing data and empty results leave unrelated filters intact', () => {
    const regular = page([]),
        infinite = { pages: [regular], pageParams: [1] };
    assert.equal(removeAssetFromCache(undefined, 'x'), undefined);
    assert.equal(removeAssetFromCache(regular, 'x'), regular);
    assert.equal(removeAssetFromCache(infinite, 'x'), infinite);
});
test('query-cache prefix update supports mixed paginated and load-more data without corrupting either shape', () => {
    const cache = new QueryClient(),
        prefix = ['assets', 'user', 'list'],
        regular = [...prefix, { page: 1 }],
        infinite = [...prefix, { pagination: 'load-more' }];
    cache.setQueryData(regular, page([asset('a'), asset('b')]));
    cache.setQueryData(infinite, {
        pages: [page([asset('a'), asset('b')]), page([asset('c')], 2)],
        pageParams: [1, 2],
    });
    cache.setQueriesData({ queryKey: prefix }, (data) => removeAssetFromCache(data, 'a'));
    assert.equal(cache.getQueryData(regular).data.length, 1);
    assert.equal(cache.getQueryData(infinite).pages.length, 2);
    assert.deepEqual(cache.getQueryData(infinite).pageParams, [1, 2]);
    assert.equal(cache.getQueryData(infinite).pages[1].meta.total, 3);
    cache.clear();
});
