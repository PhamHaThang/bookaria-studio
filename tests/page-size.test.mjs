import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    bookPageSize,
    customBookSize,
    pdfPageSizeMm,
} from '../src/features/books/model/page-size.ts';

test('PDF points convert to actual millimetres for portrait and rotated landscape viewports', () => {
    assert.deepEqual(pdfPageSizeMm((210 * 72) / 25.4, (297 * 72) / 25.4), {
        widthMm: 210,
        heightMm: 297,
    });
    assert.deepEqual(pdfPageSizeMm((297 * 72) / 25.4, (210 * 72) / 25.4), {
        widthMm: 297,
        heightMm: 210,
    });
    assert.throws(() => pdfPageSizeMm(NaN, 300));
    assert.throws(() => pdfPageSizeMm(300, 0));
});
test('physical dimensions produce the actual width and stable stored ratio', () => {
    assert.deepEqual(customBookSize('180', '270'), { pageWidthMm: 180, pageAspect: 1.5 });
    assert.deepEqual(customBookSize(297, 210), {
        pageWidthMm: 297,
        pageAspect: Number((210 / 297).toFixed(4)),
    });
    for (const [width, height] of [
        ['', '300'],
        ['NaN', '300'],
        [0, 10],
        [1001, 1001],
        [210.01, 297],
        [210, 0],
        [100, 501],
        [100, 19],
    ])
        assert.throws(() => customBookSize(width, height));
});
test('existing books restore real sizes with a fallback for legacy custom books', () => {
    assert.deepEqual(bookPageSize({ pageFormat: 'CUSTOM', pageWidthMm: 180, pageAspect: 1.5 }), {
        widthMm: 180,
        heightMm: 270,
    });
    assert.deepEqual(bookPageSize({ pageFormat: 'CUSTOM', pageAspect: 1.5 }), {
        widthMm: 210,
        heightMm: 315,
    });
    assert.deepEqual(bookPageSize({ pageFormat: 'A5', pageAspect: 1.4189 }), {
        widthMm: 148,
        heightMm: 210,
    });
    assert.deepEqual(bookPageSize(), { widthMm: 210, heightMm: 297 });
});
