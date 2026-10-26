import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    rotateSceneView,
    setAxisView,
    VIEW_AXES,
    VIEW_POLE_EPSILON,
} from '../src/features/scene/model/view-gizmo.ts';

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

function orbitFixture(up = new Vector3(0, 0, 1)) {
    const listeners = new Map();
    const document = { addEventListener() {}, removeEventListener() {} };
    const element = {
        style: {},
        clientWidth: 900,
        clientHeight: 600,
        addEventListener(type, handler) {
            listeners.set(type, handler);
        },
        removeEventListener(type) {
            listeners.delete(type);
        },
        getRootNode() {
            return document;
        },
        setPointerCapture() {},
        releasePointerCapture() {},
    };
    const camera = new PerspectiveCamera(40, 1.5, 0.01, 100);
    camera.up.copy(up);
    camera.position.set(2, -2, 3);
    const orbit = new OrbitControls(camera, element);
    orbit.target.set(0.25, -0.18, 0.1);
    orbit.minPolarAngle = VIEW_POLE_EPSILON;
    orbit.maxPolarAngle = Math.PI - VIEW_POLE_EPSILON;
    orbit.rotateSpeed = 0.65;
    orbit.update();
    const emit = (type, x, y) =>
        listeners.get(type)?.({
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: x,
            clientY: y,
            ctrlKey: false,
            shiftKey: false,
            metaKey: false,
            preventDefault() {},
        });
    return { camera, orbit, emit, element };
}

test('axis presets remain stable through actual OrbitControls updates for Y-up and Z-up cameras', () => {
    for (const up of [new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
        const { camera, orbit } = orbitFixture(up);
        const distance = camera.position.distanceTo(orbit.target);
        for (const axis of VIEW_AXES) {
            setAxisView(camera, orbit.target, axis.id);
            const rotation = camera.quaternion.clone();
            for (let i = 0; i < 20; i++) orbit.update();
            near(camera.position.distanceTo(orbit.target), distance);
            near(camera.quaternion.angleTo(rotation), 0);
            assert.ok(camera.quaternion.toArray().every(Number.isFinite));
            near(
                camera.position
                    .clone()
                    .sub(orbit.target)
                    .normalize()
                    .dot(new Vector3(...axis.vector)),
                1,
            );
        }
        orbit.dispose();
    }
});

test('Z-up yaw rotates over paper XY at constant height; vertical dragging raises the camera', () => {
    const { camera, orbit } = orbitFixture();
    const before = camera.position.clone(),
        target = orbit.target.clone();
    const radius = before.distanceTo(target);
    rotateSceneView(camera, target, 50, 0);
    near(camera.position.z, before.z);
    near(camera.position.distanceTo(target), radius);
    assert.ok(camera.position.distanceTo(before) > 0.1);
    const yawed = camera.position.clone();
    rotateSceneView(camera, target, 0, 15);
    assert.ok(camera.position.z > yawed.z);
    near(camera.position.distanceTo(target), radius);
    assert.deepEqual(orbit.target.toArray(), target.toArray());
    orbit.dispose();
});

test('gizmo and real OrbitControls mouse handlers produce the same Z-up rotation per pixel', () => {
    for (const [dx, dy] of [
        [60, 0],
        [0, 40],
        [-35, -20],
    ]) {
        const { camera, orbit, emit, element } = orbitFixture();
        const gizmoCamera = camera.clone();
        rotateSceneView(
            gizmoCamera,
            orbit.target,
            dx,
            dy,
            orbit.minPolarAngle,
            orbit.maxPolarAngle,
            (2 * Math.PI * orbit.rotateSpeed) / element.clientHeight,
        );
        emit('pointerdown', 100, 100);
        emit('pointermove', 100 + dx, 100 + dy);
        emit('pointerup', 100 + dx, 100 + dy);
        near(camera.position.distanceTo(gizmoCamera.position), 0);
        near(camera.quaternion.angleTo(gizmoCamera.quaternion), 0);
        orbit.dispose();
    }
});

test('paper front keeps +Y upright and both Z poles stay finite without a camera flip', () => {
    const { camera, orbit } = orbitFixture();
    for (const axis of ['+z', '-z']) {
        setAxisView(camera, orbit.target, axis);
        orbit.update();
        if (axis === '+z') {
            const screenUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            assert.ok(screenUp.y > 0.999);
        }
        for (const dy of [-1e6, 1e6, 0, -1e6]) {
            rotateSceneView(camera, orbit.target, 10, dy, orbit.minPolarAngle, orbit.maxPolarAngle);
            const rotation = camera.quaternion.clone();
            orbit.update();
            near(rotation.angleTo(camera.quaternion), 0);
            assert.ok(camera.position.toArray().every(Number.isFinite));
            assert.ok(camera.quaternion.toArray().every(Number.isFinite));
            assert.deepEqual(camera.up.toArray(), [0, 0, 1]);
        }
    }
    orbit.dispose();
});
