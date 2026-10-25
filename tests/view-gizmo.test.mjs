import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { rotateSceneView, setAxisView, VIEW_AXES } from '../src/features/scene/model/view-gizmo.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test('all six axis views preserve a panned target and zoom, including the polar views', () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3(0.75, -0.6, 0.35);
    camera.position.copy(target).add(new Vector3(2, -1, 3));
    const distance = camera.position.distanceTo(target);
    const originalTarget = target.clone();
    for (const axis of VIEW_AXES) {
        setAxisView(camera, target, axis.id);
        near(camera.position.distanceTo(target), distance);
        const direction = camera.position.clone().sub(target).normalize();
        near(direction.dot(new Vector3(...axis.vector)), 1);
        const forward = camera.getWorldDirection(new Vector3());
        near(forward.dot(direction), -1);
        assert.ok(camera.quaternion.toArray().every(Number.isFinite));
        assert.deepEqual(target.toArray(), originalTarget.toArray());
    }
});

test('gizmo dragging retains zoom and target, respects polar limits and rejects invalid motion', () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3(-0.2, 0.4, 0.3);
    camera.position.copy(target).add(new Vector3(0, 0, 3));
    const initial = camera.position.clone();
    rotateSceneView(camera, target, 30, 20);
    assert.ok(initial.distanceTo(camera.position) > 0.1);
    near(camera.position.distanceTo(target), 3);
    assert.deepEqual(target.toArray(), [-0.2, 0.4, 0.3]);
    for (const dy of [-1e6, 1e6]) {
        rotateSceneView(camera, target, 0, dy, 0.1, Math.PI - 0.1);
        const direction = camera.position.clone().sub(target).normalize();
        assert.ok(Math.abs(direction.y) <= Math.cos(0.1) + 1e-9);
        assert.ok(camera.quaternion.toArray().every(Number.isFinite));
        near(camera.position.distanceTo(target), 3);
    }
    const previous = camera.position.clone();
    rotateSceneView(camera, target, Number.NaN, 0);
    assert.deepEqual(camera.position.toArray(), previous.toArray());
});
