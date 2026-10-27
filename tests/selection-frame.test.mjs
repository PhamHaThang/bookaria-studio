import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    Box3,
    BoxGeometry,
    Group,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    SphereGeometry,
    Vector3,
} from 'three';
import {
    paddedSelectionBounds,
    planarSelectionFrame,
} from '../src/features/scene/model/selection-frame.ts';
import { projectSelectionBounds } from '../src/features/scene/model/selection-tools.ts';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';

const assetId = '11111111-1111-4111-8111-111111111111';
function spec(type, presentation) {
    return SceneObjectSchema.parse({
        id: 'object',
        type,
        transform: {},
        text: 'Nội dung',
        ...(['image', 'video', 'model', 'audio'].includes(type) ? { assetId } : {}),
        presentation,
    });
}
const mesh = (name, geometry = new PlaneGeometry(0.6, 0.3)) => {
    const result = new Mesh(geometry, new MeshBasicMaterial());
    result.name = name;
    return result;
};
function dispose(root) {
    root.traverse((item) => {
        if (item.isMesh) {
            item.geometry.dispose();
            item.material.dispose();
        }
    });
}

test('flat text, cards, bubbles, images, videos, hotspots and legacy labels use their visible plane', () => {
    for (const object of [
        spec('text'),
        spec('text', { kind: 'screen' }),
        spec('text', { kind: 'bubble' }),
        spec('image'),
        spec('video'),
        spec('audio'),
        spec('hotspot'),
        spec('label'),
    ]) {
        const content = new Group(),
            nested = new Group(),
            plane = mesh('content');
        content.add(nested);
        nested.add(plane);
        const frame = planarSelectionFrame(object, content);
        assert.ok(frame.bounds.equals(plane.geometry.boundingBox));
        assert.ok(frame.matrix.equals(plane.matrixWorld));
        assert.ok(plane.geometry.boundingBox);
        dispose(content);
    }
});

test('model, extruded text and hidden objects keep the generic selection path', () => {
    for (const object of [
        spec('model'),
        spec('text', { kind: 'extruded' }),
        { ...spec('image'), visible: false },
        { ...spec('image'), editorHidden: true },
    ]) {
        const content = new Group();
        content.add(mesh('content'));
        assert.equal(planarSelectionFrame(object, content), undefined);
        dispose(content);
    }
});

test('annotation full frame includes the label, marker and leader without depth', () => {
    const content = new Group(),
        card = mesh('annotation-label'),
        description = mesh('annotation-description'),
        marker = mesh('annotation-marker', new SphereGeometry(0.02)),
        leader = mesh('annotation-leader', new BoxGeometry(0.02, 3, 0.02));
    card.position.set(0.8, 0.3, 0);
    marker.position.set(-0.5, -0.4, 0);
    description.position.set(2, 1, 0);
    description.visible = false;
    content.add(marker, leader, card, description);
    content.position.set(1, 2, 3);
    content.rotation.set(0.3, 0.5, 0.2);
    content.scale.set(0.7, 1.4, 0.8);
    const object = spec('label', { kind: 'annotation', shape: 'line' });
    const collapsed = planarSelectionFrame(object, content);
    assert.ok(collapsed.bounds.min.x < -0.51);
    assert.ok(collapsed.bounds.max.x > 1.09 && collapsed.bounds.max.x < 1.11);
    assert.ok(collapsed.bounds.min.y < -1.49 && collapsed.bounds.max.y > 1.49);
    assert.equal(collapsed.bounds.min.z, 0);
    assert.equal(collapsed.bounds.max.z, 0);
    assert.equal(collapsed.matrix, content.matrixWorld);
    description.visible = true;
    const expanded = planarSelectionFrame(object, content);
    assert.ok(expanded.bounds.max.x > 2.29);
    assert.equal(expanded.bounds.min.z, 0);
    assert.equal(expanded.bounds.max.z, 0);
    description.visible = false;
    assert.ok(planarSelectionFrame(object, content).bounds.max.x < 1.11);
    dispose(content);
});

test('circle full frame contains both numbered label and its visible description', () => {
    const content = new Group(),
        label = mesh('annotation-label'),
        description = mesh('annotation-description');
    description.position.set(2, 1, 0);
    description.visible = false;
    content.add(label, description);
    const object = spec('label', { kind: 'annotation', shape: 'circle' });
    const collapsed = planarSelectionFrame(object, content);
    assert.ok(collapsed.bounds.equals(label.geometry.boundingBox));
    description.visible = true;
    const expanded = planarSelectionFrame(object, content);
    assert.ok(expanded.bounds.min.x < -0.29 && expanded.bounds.max.x > 2.29);
    assert.ok(expanded.bounds.min.y < -0.14 && expanded.bounds.max.y > 1.14);
    assert.equal(expanded.bounds.min.z, 0);
    assert.equal(expanded.bounds.max.z, 0);
    dispose(content);
});

test('2D tool bounds project the actual rotated plane instead of its larger world-axis box', () => {
    const viewport = { width: 1000, height: 600 },
        camera = new PerspectiveCamera(40, viewport.width / viewport.height, 0.01, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(1, -2, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const plane = mesh('card');
    plane.position.set(0.1, 0, 0.1);
    plane.quaternion.copy(camera.quaternion);
    plane.scale.set(0.7, 1.2, 1);
    plane.updateMatrixWorld(true);
    plane.geometry.computeBoundingBox();
    const actual = projectSelectionBounds(
        plane.geometry.boundingBox,
        camera,
        viewport,
        plane.matrixWorld,
    );
    const points = [];
    for (const x of [-0.3, 0.3])
        for (const y of [-0.15, 0.15])
            points.push(new Vector3(x, y, 0).applyMatrix4(plane.matrixWorld).project(camera));
    const expected = {
        left: Math.min(...points.map((p) => (p.x + 1) * 500)),
        right: Math.max(...points.map((p) => (p.x + 1) * 500)),
        top: Math.min(...points.map((p) => (1 - p.y) * 300)),
        bottom: Math.max(...points.map((p) => (1 - p.y) * 300)),
    };
    for (const key of Object.keys(expected))
        assert.ok(Math.abs(actual[key] - expected[key]) < 1e-4, key);
    const behind = new Matrix4().makeTranslation(
        ...camera.position
            .clone()
            .add(new Vector3(0, 0, 1).applyQuaternion(camera.quaternion))
            .toArray(),
    );
    assert.equal(
        projectSelectionBounds(plane.geometry.boundingBox, camera, viewport, behind),
        null,
    );
    dispose(plane);
});

test('selection padding remains three screen pixels across zoom and scale without adding 2D depth', () => {
    const viewport = { width: 1000, height: 600 };
    const source = new Box3(new Vector3(-0.3, -0.15, 0), new Vector3(0.3, 0.15, 0));
    const original = source.clone();
    for (const distance of [1, 3, 6])
        for (const scale of [0.4, 1]) {
            const camera = new PerspectiveCamera(40, viewport.width / viewport.height, 0.01, 100);
            camera.position.set(0, 0, distance);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            const matrix = new Matrix4().makeScale(scale, scale, scale);
            const padded = paddedSelectionBounds(source, matrix, camera, viewport.height, true);
            const before = projectSelectionBounds(source, camera, viewport, matrix),
                after = projectSelectionBounds(padded, camera, viewport, matrix);
            for (const gap of [
                before.left - after.left,
                after.right - before.right,
                before.top - after.top,
                after.bottom - before.bottom,
            ])
                assert.ok(Math.abs(gap - 3) < 1e-6);
            assert.equal(padded.min.z, 0);
            assert.equal(padded.max.z, 0);
            assert.ok(source.equals(original));
        }
});
