import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import {
    layoutSelectionTools,
    projectSelectionBounds,
} from '../src/features/scene/model/selection-tools.ts';

const viewport = { width: 1000, height: 600 };
function camera() {
    const value = new PerspectiveCamera(40, viewport.width / viewport.height, 0.01, 100);
    value.position.set(0, 0, 3);
    value.lookAt(0, 0, 0);
    value.updateMatrixWorld();
    return value;
}
const box = (min, max) => new Box3(new Vector3(...min), new Vector3(...max));

test('floating tools hide for empty, offscreen or behind-camera selections', () => {
    const view = camera();
    for (const selection of [
        new Box3(),
        box([100, 0, 0], [101, 1, 1]),
        box([0, 0, 4], [1, 1, 5]),
    ]) {
        assert.equal(projectSelectionBounds(selection, view, viewport), null);
    }
});

test('selection screen bounds track camera pan and zoom', () => {
    const view = camera(),
        selection = box([-0.2, -0.2, 0], [0.2, 0.2, 0.2]);
    const before = projectSelectionBounds(selection, view, viewport);
    assert.ok(Math.abs((before.left + before.right) / 2 - 500) < 1e-5);
    view.position.z = 2;
    const zoomed = projectSelectionBounds(selection, view, viewport);
    assert.ok(zoomed.right - zoomed.left > before.right - before.left);
    view.position.x = 0.3;
    const panned = projectSelectionBounds(selection, view, viewport);
    assert.ok(panned.left < zoomed.left);
});

test('boxes intersecting the near plane give finite bounded coordinates', () => {
    for (const selection of [
        box([-0.1, -0.1, 2.98], [0.1, 0.1, 3.1]),
        box([-5, -5, -1], [5, 5, 5]),
    ]) {
        const result = projectSelectionBounds(selection, camera(), viewport);
        assert.ok(result);
        assert.ok(Object.values(result).every(Number.isFinite));
        assert.ok(result.left >= 0 && result.right <= viewport.width);
        assert.ok(result.top >= 0 && result.bottom <= viewport.height);
    }
});

test('small selections keep each tool rail 180px from the selection centre', () => {
    const positions = layoutSelectionTools(
        { left: 490, right: 510, top: 280, bottom: 320 },
        viewport,
        { width: 48, height: 136 },
        { width: 48, height: 238 },
    );
    assert.equal(500 - (positions.left.x + 48), 180);
    assert.equal(positions.right.x - 500, 180);
});

test('large and edge selections keep tool rails in the desktop canvas and clear of chrome', () => {
    for (const size of [
        { width: 868, height: 496 },
        { width: 700, height: 360 },
    ]) {
        for (const bounds of [
            { left: 0, right: size.width, top: 0, bottom: size.height },
            { left: size.width - 20, right: size.width, top: 0, bottom: 10 },
            { left: 0, right: 20, top: size.height - 10, bottom: size.height },
        ]) {
            const left = { width: 48, height: 136 },
                right = { width: 48, height: 234 };
            const positions = layoutSelectionTools(bounds, size, left, right);
            for (const [side, dimensions] of [
                ['left', left],
                ['right', right],
            ]) {
                const p = positions[side];
                assert.ok(p.x >= 84 && p.x + dimensions.width <= size.width - 12);
                assert.ok(
                    p.y >= 76 &&
                        p.y + dimensions.height <= size.height - (size.height < 400 ? 48 : 64),
                );
            }
            assert.ok(positions.left.x + left.width + 16 <= positions.right.x);
            assert.ok(
                positions.right.y >= 140 || positions.right.x + right.width <= size.width - 140,
            );
        }
    }
});
