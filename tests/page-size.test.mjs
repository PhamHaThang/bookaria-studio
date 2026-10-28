import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    bookPageSize,
    customBookSize,
    imageBookSize,
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

test('explicit image ratio keeps the physical width for portrait, landscape and square images', () => {
    assert.deepEqual(imageBookSize({ width: 600, height: 900 }, 148), {
        widthMm: 148,
        heightMm: 222,
    });
    assert.deepEqual(imageBookSize({ width: 1200, height: 600 }, 210), {
        widthMm: 210,
        heightMm: 105,
    });
    assert.deepEqual(imageBookSize({ width: 300, height: 300 }, '180.5'), {
        widthMm: 180.5,
        heightMm: 180.5,
    });
    assert.deepEqual(
        imageBookSize({ width: 4000, height: 6000 }, 148),
        imageBookSize({ width: 600, height: 900 }, 148),
    );
});

test('image ratio action rejects unsupported panoramic ratios and invalid widths without changing the image', () => {
    for (const image of [
        { width: 1000, height: 100 },
        { width: 100, height: 1000 },
        { width: 0, height: 500 },
        { width: Infinity, height: 500 },
    ])
        assert.throws(() => imageBookSize(image, 210));
    for (const width of ['', 0, 1001, 'bad', 180.55])
        assert.throws(() => imageBookSize({ width: 400, height: 600 }, width));
    assert.deepEqual(imageBookSize({ width: 1000, height: 200 }, 210), {
        widthMm: 210,
        heightMm: 42,
    });
    assert.deepEqual(imageBookSize({ width: 200, height: 1000 }, 210), {
        widthMm: 210,
        heightMm: 1050,
    });
});

test('image ratio at the lower bound stays valid after millimetre rounding', () => {
    const result = imageBookSize({ width: 1000, height: 200 }, 147.7);
    assert.deepEqual(result, { widthMm: 147.7, heightMm: 29.6 });
    assert.doesNotThrow(() => customBookSize(result.widthMm, result.heightMm));
});
