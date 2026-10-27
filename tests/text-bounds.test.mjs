import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintedTextBounds } from '../src/shared/scene/text-bounds.ts';

function pixels(width, height, ink) {
    const data = new Uint8ClampedArray(width * height * 4);
    // RGB in transparent texels must not enlarge the selection.
    data.fill(230);
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    for (const [x, y, alpha = 255] of ink) data[(y * width + x) * 4 + 3] = alpha;
    return { getImageData: () => ({ data }) };
}

test('text bounds include faint antialiased accents and a small transparent margin', () => {
    const context = pixels(100, 80, [
        [30, 20, 1],
        [65, 60],
    ]);
    assert.deepEqual(paintedTextBounds(context, 100, 80), {
        left: 26,
        top: 16,
        width: 44,
        height: 49,
    });
});

test('padding is clipped to the source canvas at every edge', () => {
    assert.deepEqual(
        paintedTextBounds(
            pixels(100, 80, [
                [0, 0],
                [99, 79],
            ]),
            100,
            80,
        ),
        { left: 0, top: 0, width: 100, height: 80 },
    );
});

test('empty legacy text keeps a small finite selection target at its authored origin', () => {
    assert.deepEqual(paintedTextBounds(pixels(100, 80, []), 100, 80), {
        left: 46,
        top: 36,
        width: 8,
        height: 8,
    });
});
