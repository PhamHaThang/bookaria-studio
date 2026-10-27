import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scaleConstraint, scaleFromGesture } from '../src/features/scene/model/scale-gesture.ts';

const before = [0.7, 0.4, 0.9];
function close(actual, expected) {
    for (let i = 0; i < 3; i++)
        assert.ok(Math.abs(actual[i] - expected[i]) < 1e-9, `${actual} != ${expected}`);
}

test('2D scaling preserves Z, individual handles stretch one axis and Shift keeps XY proportions', () => {
    close(scaleFromGesture(before, [1, 0, 0], [2, 0, 0], 'X', true, false, null), [1.4, 0.4, 0.9]);
    close(scaleFromGesture(before, [1, 0, 0], [2, 0, 0], 'X', true, true, null), [1.4, 0.8, 0.9]);
    close(
        scaleFromGesture(before, [0, 1, 0], [0, 0.5, 0], 'Y', true, true, null),
        [0.35, 0.2, 0.9],
    );
    close(scaleFromGesture(before, [0, 0, 1], [0, 0, 2], 'Z', true, false, null), before);
});

test('paired handles apply one projected factor and preserve the existing ratio', () => {
    close(scaleFromGesture(before, [1, 1, 0], [2, 3, 0], 'XY', true, false, null), [1.75, 1, 0.9]);
    close(
        scaleFromGesture(before, [1, 0, 2], [2, 0, 4], 'XZ', false, false, null),
        [1.4, 0.4, 1.8],
    );
});

test('Shift on 3D scaling applies the same factor to all three axes', () => {
    close(
        scaleFromGesture(before, [1, 0, 0], [1.5, 0, 0], 'X', false, true, null),
        [1.05, 0.6, 1.35],
    );
    assert.equal(scaleConstraint('X', true, true), 'XY');
    assert.equal(scaleConstraint('XY', true, true), 'XY');
    assert.equal(scaleConstraint('XY', false, true), 'XYZ');
});

test('snapping rounds a relative factor without changing intrinsic proportions', () => {
    close(
        scaleFromGesture(before, [1, 1, 0], [1.127, 1.127, 0], 'XY', true, false, 0.05),
        [0.805, 0.46, 0.9],
    );
    close(scaleFromGesture(before, [1, 0, 0], [1, 0, 0], 'X', true, true, 0.05), before);
});

test('crossing the pivot clamps without mirroring or breaking the ratio', () => {
    close(
        scaleFromGesture([0.2, 0.4, 0.9], [1, 1, 0], [-1, -1, 0], 'XY', true, false, null),
        [0.001, 0.002, 0.9],
    );
});

test('a centre grab has a finite fallback and a rebased gesture starts without a jump', () => {
    close(
        scaleFromGesture(before, [0, 0, 0], [1, 1, 0], 'XYZ', false, false, null, 1.3),
        [0.91, 0.52, 1.17],
    );
    const rebased = [1.4, 0.4, 0.9],
        point = [2, 0, 0];
    close(scaleFromGesture(rebased, point, point, 'X', true, true, null), rebased);
    close(scaleFromGesture(rebased, point, [2.2, 0, 0], 'X', true, true, null), [1.54, 0.44, 0.9]);
});
