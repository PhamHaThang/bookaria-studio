import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import {
    beginLocalDepthDrag,
    localDepthPosition,
} from '../src/features/scene/model/local-depth.ts';

function fixture() {
    const camera = new PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(1, -2, 3);
    const object = new Group();
    object.position.set(0.2, 0.1, 0);
    object.lookAt(camera.position);
    return { camera, object, start: beginLocalDepthDrag(camera, object, 800) };
}
test('depth drag follows captured local Z, reverses exactly and leaves authored objects untouched', () => {
    const { object, start } = fixture();
    const original = object.position.toArray();
    const position = localDepthPosition(start, -80);
    const delta = position.clone().sub(start.position);
    assert.ok(delta.dot(start.axis) > 0);
    assert.ok(delta.clone().cross(start.axis).length() < 1e-9);
    assert.deepEqual(localDepthPosition(start, 0).toArray(), original);
    assert.deepEqual(object.position.toArray(), original);
});
test('screen displacement is independent of pointer event count and respects snap steps', () => {
    const { start } = fixture();
    for (let i = 0; i < 10; i++) localDepthPosition(start, -i * 8);
    const result = localDepthPosition(start, -80, 0.025);
    const offset = result.sub(start.position).dot(start.axis);
    assert.ok(Math.abs(offset / 0.025 - Math.round(offset / 0.025)) < 1e-9);
});
test('depth handle cannot cross camera or disappear past the far range', () => {
    const { start } = fixture();
    const near = localDepthPosition(start, -1e9).sub(start.position).dot(start.axis);
    const far = localDepthPosition(start, 1e9).sub(start.position).dot(start.axis);
    assert.ok(Math.abs(start.distance - near - start.minDistance) < 1e-9);
    assert.ok(Math.abs(start.distance - far - start.maxDistance) < 1e-9);
});
test('depth drag rejects an invalid viewport, camera proximity or invalid pointer input', () => {
    const { camera, object, start } = fixture();
    assert.equal(beginLocalDepthDrag(camera, object, 0), null);
    assert.equal(localDepthPosition(start, Number.NaN), null);
    assert.equal(localDepthPosition(start, 5, -1), null);
    object.position.copy(camera.position);
    object.quaternion.copy(new Quaternion());
    assert.equal(beginLocalDepthDrag(camera, object, 800), null);
    assert.ok(
        start.axis.distanceTo(new Vector3(0, 0, 1).applyQuaternion(fixture().object.quaternion)) <
            1e-9,
    );
});

test('a card at the near limit can start another drag to move away again', () => {
    const { camera, object, start } = fixture();
    object.position.copy(localDepthPosition(start, -1e9));
    const next = beginLocalDepthDrag(camera, object, 800);
    assert.ok(next);
    const away = localDepthPosition(next, 40);
    assert.ok(away.distanceTo(camera.position) > object.position.distanceTo(camera.position));
});
