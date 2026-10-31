import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import {
    framePreviewViewport,
    previewInsets,
} from '../src/features/preview/model/preview-viewport.ts';

function camera() {
    const value = new PerspectiveCamera(40, 1208 / 684, 0.01, 100);
    value.position.set(0.7, -0.9, 3);
    value.up.set(0, 0, 1);
    value.lookAt(0, -0.18, 0);
    value.updateMatrixWorld();
    return value;
}
function project(camera, rect, point) {
    const v = new Vector3(...point).project(camera);
    return [rect.left + ((v.x + 1) * rect.width) / 2, rect.top + ((1 - v.y) * rect.height) / 2];
}
function samePixels(before, after, source, target) {
    for (const point of [
        [0, 0, 0],
        [-0.2, 0.15, 0.07],
        [0.2, -0.15, 0.12],
        [0.24, 0.32, 0.24],
        [1, 2, 1],
        [-1, 1, -0.5],
    ]) {
        const a = project(before, source, point),
            b = project(after, target, point);
        assert.ok(
            a.every((n, i) => Math.abs(n - b[i]) < 1e-8),
            JSON.stringify({ point, a, b }),
        );
    }
}
test('removing the sidebar preserves every object pixel at different depths without moving the camera', () => {
    const source = { left: 72, top: 76, width: 1208, height: 684 },
        target = { left: 0, top: 76, width: 1280, height: 684 };
    const before = camera(),
        after = before.clone();
    framePreviewViewport(after, target, previewInsets(source, target));
    samePixels(before, after, source, target);
    assert.deepEqual(after.position.toArray(), before.position.toArray());
    assert.deepEqual(after.quaternion.toArray(), before.quaternion.toArray());
});
test('viewport framing survives resize and reopening without accumulating offsets', () => {
    const source = { left: 72, top: 76, width: 1208, height: 684 },
        target = { left: 0, top: 76, width: 1280, height: 684 };
    const insets = previewInsets(source, target),
        resized = { left: 0, top: 76, width: 1600, height: 784 };
    const expected = camera();
    expected.aspect = (resized.width - 72) / resized.height;
    expected.updateProjectionMatrix();
    const actual = camera();
    const virtual = framePreviewViewport(actual, resized, insets);
    samePixels(expected, actual, { ...resized, left: 72, width: resized.width - 72 }, resized);
    assert.deepEqual(previewInsets(virtual, resized), insets);
    framePreviewViewport(actual, resized, previewInsets(virtual, resized));
    samePixels(expected, actual, virtual, resized);
});
test('centred previews and changed top/bottom chrome retain the expected projection', () => {
    const target = { left: 0, top: 76, width: 1280, height: 684 };
    const actual = camera(),
        expected = camera();
    expected.aspect = 1280 / 684;
    expected.updateProjectionMatrix();
    framePreviewViewport(actual, target);
    samePixels(expected, actual, target, target);
    const source = { left: 72, top: 90, width: 1208, height: 640 };
    expected.aspect = source.width / source.height;
    expected.updateProjectionMatrix();
    framePreviewViewport(actual, target, previewInsets(source, target));
    samePixels(expected, actual, source, target);
    assert.equal(previewInsets({ ...source, width: 0 }, target), undefined);
    assert.equal(previewInsets({ ...source, left: NaN }, target), undefined);
});
