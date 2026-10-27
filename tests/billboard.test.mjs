import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    Euler,
    Group,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Vector3,
} from 'three';
import { createBillboard } from '../src/shared/scene/billboard.ts';

const close = (actual, expected) =>
    actual.forEach((n, i) => {
        assert.ok(Math.abs(n - expected[i]) < 1e-9, `${i}: ${n} != ${expected[i]}`);
    });
function fixture() {
    const parent = new Group();
    const root = new Group();
    root.position.set(0.3, -0.2, 0.7);
    root.rotation.set(0.2, 0.5, -0.3);
    root.scale.set(0.4, 0.8, 0.6);
    parent.add(root);
    const billboard = createBillboard(root);
    const camera = new PerspectiveCamera();
    camera.position.set(2, -1, 3);
    camera.lookAt(0, 0, 0);
    return { parent, root, camera, billboard };
}
function facesCamera({ root, camera, billboard }) {
    close(
        billboard.content.getWorldPosition(new Vector3()).toArray(),
        root.getWorldPosition(new Vector3()).toArray(),
    );
    close(
        billboard.content.getWorldScale(new Vector3()).toArray(),
        root.getWorldScale(new Vector3()).toArray(),
    );
    assert.ok(
        billboard.content
            .getWorldQuaternion(new Quaternion())
            .angleTo(camera.getWorldQuaternion(new Quaternion())) < 1e-6,
    );
    const view = new Matrix4().multiplyMatrices(
        camera.matrixWorldInverse,
        billboard.content.matrixWorld,
    );
    close(new Vector3().setFromMatrixColumn(view, 0).normalize().toArray(), [1, 0, 0]);
    close(new Vector3().setFromMatrixColumn(view, 1).normalize().toArray(), [0, 1, 0]);
}

test('disabled billboard leaves the authored transform and content unchanged', () => {
    const f = fixture();
    f.root.updateMatrixWorld(true);
    const original = f.root.matrixWorld.clone();
    f.billboard.update(f.camera, false);
    close(f.billboard.content.matrixWorld.elements, original.elements);
});
test('billboard tracks camera orbit without changing saved position, rotation or scale', () => {
    const f = fixture();
    const transform = [
        f.root.position.toArray(),
        f.root.quaternion.toArray(),
        f.root.scale.toArray(),
    ];
    for (const position of [
        [2, 1, 3],
        [-2, -1, 0.8],
        [0, 4, 0.2],
    ]) {
        f.camera.position.fromArray(position);
        f.camera.lookAt(0, 0, 0);
        f.billboard.update(f.camera, true);
        facesCamera(f);
    }
    assert.deepEqual(
        [f.root.position.toArray(), f.root.quaternion.toArray(), f.root.scale.toArray()],
        transform,
    );
});
test('billboard compensates rotated and nonuniformly scaled parents including manual AR matrices', () => {
    const f = fixture();
    f.parent.matrixAutoUpdate = false;
    f.parent.matrix.compose(
        new Vector3(1, 2, 3),
        new Quaternion().setFromEuler(new Euler(0.8, -0.3, 0.6)),
        new Vector3(1.2, 0.7, 1.8),
    );
    const anchor = f.parent.matrix.clone();
    f.billboard.update(f.camera, true);
    facesCamera(f);
    close(f.parent.matrix.elements, anchor.elements);
});
test('turning billboard off restores the authored orientation after moving the object', () => {
    const f = fixture();
    f.billboard.update(f.camera, true);
    f.root.position.x += 0.5;
    f.root.rotation.z += 0.3;
    f.root.scale.y *= 1.5;
    f.billboard.update(f.camera, true);
    facesCamera(f);
    f.billboard.update(f.camera, false);
    close(f.billboard.content.matrixWorld.elements, f.root.matrixWorld.elements);
    close(f.billboard.content.matrix.elements, new Matrix4().elements);
});

test('each gizmo translation step keeps the card parallel to the screen before release', () => {
    const f = fixture();
    let previous;
    for (let i = 0; i < 12; i++) {
        f.root.position.set(-0.8 + i * 0.15, 0.1 + i * 0.05, 0.2 + i * 0.02);
        f.billboard.update(f.camera, true);
        facesCamera(f);
        const orientation = f.billboard.content.getWorldQuaternion(new Quaternion());
        if (previous)
            assert.ok(
                previous.angleTo(orientation) < 1e-6,
                'Moving the card must not tilt it away from the screen',
            );
        previous = orientation;
    }
});
test('camera panning keeps the card rectangular and parallel to the screen', () => {
    const f = fixture();
    const orientation = f.camera.quaternion.clone();
    let previous;
    for (let i = 0; i < 8; i++) {
        f.camera.position.x += 0.2;
        f.camera.position.y += 0.1;
        f.billboard.update(f.camera, true);
        facesCamera(f);
        close(f.camera.quaternion.toArray(), orientation.toArray());
        const facing = f.billboard.content.getWorldQuaternion(new Quaternion());
        if (previous) assert.ok(previous.angleTo(facing) < 1e-6, 'Pan must not tilt the card');
        previous = facing;
    }
});
test('orthographic camera uses parallel facing; coincident perspective camera stays finite', () => {
    const f = fixture();
    f.camera = new OrthographicCamera();
    f.camera.position.set(4, 2, 3);
    f.camera.lookAt(0, 0, 0);
    f.billboard.update(f.camera, true);
    assert.ok(
        f.billboard.content
            .getWorldQuaternion(new Quaternion())
            .angleTo(f.camera.getWorldQuaternion(new Quaternion())) < 1e-6,
    );
    f.camera = new PerspectiveCamera();
    f.camera.position.copy(f.root.position);
    f.billboard.update(f.camera, true);
    assert.ok(f.billboard.content.matrixWorld.elements.every(Number.isFinite));
});

test('flat text stays above paper when camera facing is disabled; 3D depth can still be restored', () => {
    const f = fixture();
    const material = new MeshBasicMaterial({ transparent: true });
    const mesh = new Mesh(new PlaneGeometry(), material);
    mesh.renderOrder = 7;
    f.billboard.content.add(mesh);
    f.billboard.update(f.camera, true, true);
    assert.equal(material.depthTest, false);
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.renderOrder, 100);
    f.billboard.update(f.camera, false, true);
    assert.equal(material.depthTest, false);
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.renderOrder, 100);
    f.billboard.update(f.camera, false, false);
    assert.equal(material.depthTest, true);
    assert.equal(material.depthWrite, true);
    assert.equal(mesh.renderOrder, 7);
    mesh.geometry.dispose();
    material.dispose();
});
test('late-loaded text receives overlay settings; solid 3D objects keep depth testing', () => {
    const f = fixture();
    f.billboard.update(f.camera, true, true);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(new PlaneGeometry(), material);
    f.billboard.content.add(mesh);
    f.billboard.update(f.camera, true, true);
    assert.equal(material.depthTest, false);
    f.billboard.update(f.camera, true, false);
    assert.equal(material.depthTest, true);
    assert.equal(material.depthWrite, true);
    mesh.geometry.dispose();
    material.dispose();
});

test('captured billboard rotation keeps the displayed pose when disabled instead of returning to zero', () => {
    const f = fixture();
    f.root.rotation.set(0, 0, 0);
    f.billboard.update(f.camera, true);
    const before = f.billboard.content.getWorldQuaternion(new Quaternion());
    const position = f.root.position.toArray();
    const scale = f.root.scale.toArray();
    const angles = f.billboard.getDisplayedRotation();
    assert.ok(angles.some((value) => Math.abs(value) > 1));
    f.root.rotation.set(...angles.map((value) => (value * Math.PI) / 180));
    f.billboard.update(f.camera, false);
    assert.ok(f.billboard.content.getWorldQuaternion(new Quaternion()).angleTo(before) < 1e-6);
    assert.deepEqual(f.root.position.toArray(), position);
    assert.deepEqual(f.root.scale.toArray(), scale);
});
test('captured rotation is relative to the authored parent', () => {
    const f = fixture();
    f.parent.rotation.set(0.3, -0.2, 0.4);
    f.parent.scale.setScalar(1.3);
    f.billboard.update(f.camera, true);
    const before = f.billboard.content.getWorldQuaternion(new Quaternion());
    const angles = f.billboard.getDisplayedRotation();
    f.root.rotation.set(...angles.map((value) => (value * Math.PI) / 180));
    f.billboard.update(f.camera, false);
    assert.ok(f.billboard.content.getWorldQuaternion(new Quaternion()).angleTo(before) < 1e-6);
});

test('flat text loaded with camera facing already off remains legible above the page', () => {
    const f = fixture();
    const material = new MeshBasicMaterial({ transparent: true });
    const mesh = new Mesh(new PlaneGeometry(), material);
    f.billboard.content.add(mesh);
    f.billboard.update(f.camera, false, true);
    assert.equal(material.depthTest, false);
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.renderOrder, 100);
    f.billboard.update(f.camera, true, true);
    const angles = f.billboard.getDisplayedRotation();
    f.root.rotation.set(...angles.map((value) => (value * Math.PI) / 180));
    f.billboard.update(f.camera, false, true);
    assert.equal(material.depthTest, false);
    assert.equal(material.depthWrite, false);
    mesh.geometry.dispose();
    material.dispose();
});
