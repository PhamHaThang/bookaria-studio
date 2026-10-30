import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newObject } from '../src/features/scene/model/objects.ts';
import { textVisualColors } from '../src/features/scene/model/text-visual-colors.ts';
import { createColorChangeSession, isHexColor } from '../src/shared/lib/color-change-session.ts';

test('color dragging previews immediately, coalesces intermediate colors and flushes the exact final value', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
    const values = [],
        groups = [];
    const session = createColorChangeSession({
        onChange: (value) => values.push(value),
        onBegin: () => groups.push('begin'),
        onEnd: (committed) => groups.push(committed),
    });
    session.change('#111111');
    assert.deepEqual(values, ['#111111']);
    for (let i = 0; i < 80; i++) session.change(`#${i.toString(16).padStart(6, '0')}`);
    assert.equal(values.length, 1);
    t.mock.timers.tick(50);
    assert.equal(values.at(-1), '#00004f');
    session.change('#224466');
    session.finish();
    assert.equal(values.at(-1), '#224466');
    assert.equal(values.length, 3);
    assert.deepEqual(groups, ['begin', true]);
    t.mock.timers.tick(500);
    assert.equal(values.length, 3);
});
test('cancel releases the edit group and prevents a delayed color from reaching a different field', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
    const values = [],
        ends = [];
    const session = createColorChangeSession({
        onChange: (value) => values.push(value),
        onEnd: (value) => ends.push(value),
    });
    session.change('#111111');
    session.change('#222222');
    session.cancel();
    t.mock.timers.tick(500);
    assert.deepEqual(values, ['#111111']);
    assert.deepEqual(ends, [false]);
    session.change('#333333');
    session.finish();
    assert.deepEqual(values, ['#111111', '#333333']);
    assert.deepEqual(ends, [false, true]);
});
test('confirmation and blur publish a final value once and preserve separate edit sessions', (t) => {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
    const values = [],
        ends = [];
    const session = createColorChangeSession({
        onChange: (value) => values.push(value),
        onEnd: (value) => ends.push(value),
    });
    session.begin();
    session.change('#123456');
    session.change('#123456');
    session.finish();
    session.finish();
    assert.deepEqual(values, ['#123456']);
    assert.deepEqual(ends, [true]);
    session.change('#abcdef');
    session.finish();
    assert.deepEqual(values, ['#123456', '#abcdef']);
});
test('palette updates cannot send an incomplete hexadecimal string to a Three.js material', () => {
    for (const value of ['#112233', '#aAbBcC']) assert.equal(isHexColor(value), true);
    for (const value of ['#12', '#12345', '112233', '#zzzzzz', ''])
        assert.equal(isHexColor(value), false);
    const object = newObject('text', 'text');
    object.style.color = '#12';
    assert.equal(textVisualColors(object).color, '#252525');
});
