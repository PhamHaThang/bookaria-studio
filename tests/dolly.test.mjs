import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { beginDolly, dragDolly } from '../src/features/scene/model/dolly.ts';

function fixture() {
    const camera = new PerspectiveCamera(40, 1.5, 0.01, 100);
    camera.up.set(0, 0, 1);
    const target = new Vector3(0.2, -0.18, 0);
    camera.position.copy(target).add(new Vector3(2, -2, 3));
    camera.lookAt(target);
    return { camera, target, start: beginDolly(camera, target, new Vector2(0.45, -0.2)) };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('drag zoom uses vertical distance, preserving orientation and the pointer anchor', () => {
    const { camera, target, start } = fixture();
    const rotation = camera.quaternion.clone();
    for (const delta of [-150, 150]) {
        assert.ok(dragDolly(camera, target, start, delta, 600, 0.15, 15));
        near(camera.position.distanceTo(target), start.distance * Math.exp(delta / 200));
        assert.deepEqual(camera.quaternion.toArray(), rotation.toArray());
        const projected = start.anchor.clone().project(camera);
        near(projected.x, 0.45);
        near(projected.y, -0.2);
    }
});

test('zoom is independent of event count and dragging back restores camera and target', () => {
    const direct = fixture(),
        sampled = fixture();
    dragDolly(direct.camera, direct.target, direct.start, -200, 600, 0.15, 15);
    for (let dy = -1; dy >= -200; dy--)
        dragDolly(sampled.camera, sampled.target, sampled.start, dy, 600, 0.15, 15);
    near(direct.camera.position.distanceTo(sampled.camera.position), 0);
    near(direct.target.distanceTo(sampled.target), 0);
    dragDolly(sampled.camera, sampled.target, sampled.start, 0, 600, 0.15, 15);
    near(sampled.camera.position.distanceTo(sampled.start.position), 0);
    near(sampled.target.distanceTo(sampled.start.target), 0);
});

test('extreme zoom is clamped without crossing or flipping the target', () => {
    const { camera, target, start } = fixture();
    const direction = start.position.clone().sub(start.target).normalize();
    for (const [dy, expected] of [
        [-1e6, 0.15],
        [1e6, 15],
    ]) {
        dragDolly(camera, target, start, dy, 600, 0.15, 15);
        near(camera.position.distanceTo(target), expected);
        near(camera.position.clone().sub(target).normalize().dot(direction), 1);
        assert.ok(camera.position.toArray().every(Number.isFinite));
    }
    const before = camera.position.clone();
    assert.equal(dragDolly(camera, target, start, Number.NaN, 600, 0.15, 15), false);
    assert.deepEqual(camera.position.toArray(), before.toArray());
});
