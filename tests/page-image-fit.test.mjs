import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageImageSize } from '../src/features/scene/model/page-image-fit.ts';

test('an imported A4 background stays proportional after changing the book to landscape', () => {
    const original = { width: 1600, height: 2263 };
    for (const pageAspect of [297 / 210, 210 / 297, 1, 0.2, 5]) {
        const size = pageImageSize(original.width, original.height, pageAspect);
        assert.ok(Math.abs(size.height / size.width - original.height / original.width) < 1e-12);
        assert.ok(size.width <= 1 && size.height <= pageAspect + 1e-12);
        assert.ok(Math.abs(size.width - 1) < 1e-12 || Math.abs(size.height - pageAspect) < 1e-12);
    }
});

test('landscape, portrait and square backgrounds fit without clipping or stretching', () => {
    assert.deepEqual(pageImageSize(1200, 600, 1.5), { width: 1, height: 0.5 });
    assert.deepEqual(pageImageSize(600, 1200, 1), { width: 0.5, height: 1 });
    assert.deepEqual(pageImageSize(800, 800, 0.5), { width: 0.5, height: 0.5 });
    assert.deepEqual(pageImageSize(800, 1200, 1.5), { width: 1, height: 1.5 });
});

test('invalid decoded dimensions cannot create invalid geometry', () => {
    for (const args of [
        [0, 1, 1],
        [1, -1, 1],
        [1, 1, NaN],
        [Infinity, 1, 1],
    ])
        assert.throws(() => pageImageSize(...args));
});
