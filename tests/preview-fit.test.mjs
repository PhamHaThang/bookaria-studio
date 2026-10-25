import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    Bone,
    Box3,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Skeleton,
    SkinnedMesh,
    Sphere,
    Uint16BufferAttribute,
    Vector3,
} from 'three';
import {
    applyPreviewPlacement,
    fitPreviewCamera,
    normalizePreviewModel,
    visibleModelBounds,
} from '../src/features/scene/model/preview-fit.ts';

function inside(bounds, camera) {
    for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
                const n = new Vector3(x, y, z).project(camera);
                assert(
                    Math.abs(n.x) < 1 && Math.abs(n.y) < 1 && n.z > -1 && n.z < 1,
                    `Clipped corner: ${n.toArray()}`,
                );
            }
}
test('frames tall, wide, deep and off-center boxes at narrow and wide viewport aspects', () => {
    for (const size of [
        [1, 100, 1],
        [100, 1, 1],
        [1, 1, 100],
        [1000000, 800000, 700000],
        [0.00001, 0.00002, 0.00001],
    ])
        for (const aspect of [0.3, 0.7, 1, 2, 4]) {
            const center = new Vector3(100, -200, 300),
                half = new Vector3(...size).multiplyScalar(0.5),
                bounds = new Box3(center.clone().sub(half), center.clone().add(half)),
                camera = new PerspectiveCamera(38, aspect);
            const fit = fitPreviewCamera(bounds, camera);
            assert(fit.target.distanceTo(center) < 1e-8);
            inside(bounds, camera);
        }
});
test('normalization handles huge/tiny translated meshes without altering authored transforms', () => {
    for (const scale of [0.000001, 1000000]) {
        const root = new Group(),
            mesh = new Mesh(new BoxGeometry(2, 3, 4));
        root.add(mesh);
        root.scale.setScalar(scale);
        root.position.set(150, -70, 90);
        const position = root.position.clone(),
            beforeScale = root.scale.clone();
        const wrapper = normalizePreviewModel(root),
            bounds = new Box3().setFromObject(wrapper),
            size = bounds.getSize(new Vector3());
        assert(Math.abs(Math.max(...size.toArray()) - 1.2) < 1e-5);
        assert(root.position.equals(position) && root.scale.equals(beforeScale));
        assert(Math.abs(bounds.min.y) < 1e-5);
        mesh.geometry.dispose();
    }
});
test('a resized preview and oblique camera direction still fit every corner', () => {
    const bounds = new Box3(new Vector3(-10, -1, -2), new Vector3(10, 1, 2)),
        camera = new PerspectiveCamera(38, 2);
    fitPreviewCamera(bounds, camera);
    camera.aspect = 0.45;
    fitPreviewCamera(bounds, camera, new Vector3(-1, 1, -2));
    inside(bounds, camera);
    fitPreviewCamera(bounds, camera, new Vector3(0, 1, 0));
    inside(bounds, camera);
    assert(camera.up.equals(new Vector3(0, 1, 0)));
});
test('rejects empty, zero or non-finite model bounds and invalid viewports', () => {
    assert.throws(() => fitPreviewCamera(new Box3(), new PerspectiveCamera()));
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    assert.throws(() => fitPreviewCamera(box, new PerspectiveCamera(38, 0)));
    assert.throws(() => normalizePreviewModel(new Group()));
});

function unitBounds(root) {
    const b = visibleModelBounds(root),
        size = b.getSize(new Vector3());
    assert(Math.abs(Math.max(...size.toArray()) - 1.2) < 1e-5);
    assert(Math.abs(b.min.y) < 1e-5);
    assert(Math.abs(b.getCenter(new Vector3()).x) < 1e-5);
    return b;
}
test('normalizes real vertices when exporter bounds and culling sphere are wrong', () => {
    const mesh = new Mesh(new BoxGeometry(10, 20, 30));
    mesh.geometry.translate(10000, 20000, -30000);
    mesh.geometry.boundingBox = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    mesh.geometry.boundingSphere = new Sphere(new Vector3(), 1);
    const wrapper = normalizePreviewModel(mesh);
    unitBounds(wrapper);
    assert.equal(mesh.frustumCulled, false);
    assert(
        mesh.geometry.boundingSphere.center.distanceTo(new Vector3(10000, 20000, -30000)) < 1e-6,
    );
    mesh.geometry.dispose();
});
test('excludes hidden geometry and invisible materials from framing', () => {
    const root = new Group(),
        mesh = new Mesh(new BoxGeometry(1, 2, 3)),
        hidden = new Mesh(new BoxGeometry(10000, 10000, 10000));
    hidden.visible = false;
    root.add(mesh, hidden);
    const wrapper = normalizePreviewModel(root);
    unitBounds(wrapper);
    mesh.geometry.dispose();
    hidden.geometry.dispose();
});
test('measures a skinned pose before the first render and after normalization', () => {
    const geometry = new BoxGeometry(2, 4, 2),
        count = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()),
        bone = new Bone();
    mesh.add(bone);
    mesh.bind(new Skeleton([bone]));
    bone.position.y = 1000;
    assert(Math.abs(visibleModelBounds(mesh).getCenter(new Vector3()).y - 1000) < 1e-6);
    const wrapper = normalizePreviewModel(mesh);
    unitBounds(wrapper);
    geometry.dispose();
    mesh.material.dispose();
    mesh.skeleton.dispose();
});
test('uses current morph deformation, not the neutral bounding box', () => {
    const geometry = new BoxGeometry(2, 2, 2),
        source = geometry.attributes.position.array,
        delta = new Float32Array(source.length);
    for (let i = 1; i < delta.length; i += 3) delta[i] = 500;
    geometry.morphTargetsRelative = true;
    geometry.morphAttributes.position = [new Float32BufferAttribute(delta, 3)];
    const mesh = new Mesh(geometry);
    mesh.morphTargetInfluences[0] = 1;
    assert(Math.abs(visibleModelBounds(mesh).getCenter(new Vector3()).y - 500) < 1e-6);
    unitBounds(normalizePreviewModel(mesh));
    geometry.dispose();
});
test('includes every rendered instance in normalization', () => {
    const geometry = new BoxGeometry(2, 2, 2),
        mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), 2);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(-1000, 0, 0));
    mesh.setMatrixAt(1, new Matrix4().makeTranslation(1000, 0, 0));
    assert.equal(visibleModelBounds(mesh).getSize(new Vector3()).x, 2002);
    unitBounds(normalizePreviewModel(mesh));
    geometry.dispose();
    mesh.material.dispose();
});
test('manual scale and XYZ offsets work without altering authored model transforms', () => {
    const mesh = new Mesh(new BoxGeometry(10, 20, 10)),
        wrapper = normalizePreviewModel(mesh),
        base = { scale: wrapper.scale.x, position: wrapper.position.clone() },
        original = mesh.position.clone();
    applyPreviewPlacement(wrapper, base, { scale: 0.5, x: 0.2, y: 0.1, z: -0.3 });
    const b = visibleModelBounds(wrapper);
    assert(Math.abs(b.getSize(new Vector3()).y - 0.6) < 1e-6);
    assert(Math.abs(b.min.y - 0.1) < 1e-6);
    assert(Math.abs(b.getCenter(new Vector3()).x - 0.2) < 1e-6);
    assert(Math.abs(b.getCenter(new Vector3()).z + 0.3) < 1e-6);
    assert(mesh.position.equals(original));
    applyPreviewPlacement(wrapper, base, { scale: 1, x: 0, y: 0, z: 0 });
    unitBounds(wrapper);
    assert.throws(() => applyPreviewPlacement(wrapper, base, { scale: 0, x: 0, y: 0, z: 0 }));
    geometryCleanup();
    function geometryCleanup() {
        mesh.geometry.dispose();
    }
});
