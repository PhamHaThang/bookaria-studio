import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    Bone,
    Box3,
    BoxGeometry,
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
    Vector3,
} from 'three';
import { createModelSelectionBounds } from '../src/features/scene/model/model-selection-bounds.ts';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function triangle() {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute([-1, 1, 0, 1, 1, 0, 0, 3, 0, 0, -99, 0], 3),
    );
    geometry.setIndex([0, 1, 2]);
    geometry.boundingBox = new Box3(new Vector3(-100, -100, -100), new Vector3(100, 100, 100));
    return new Mesh(geometry, new MeshBasicMaterial());
}
function dispose(root) {
    root.traverse((node) => {
        if (node.isMesh) {
            node.geometry.dispose();
            for (const material of Array.isArray(node.material) ? node.material : [node.material])
                material.dispose();
        }
    });
}

test('model bottom follows rendered indexed vertices, ignoring stale boxes, hidden meshes and transparent helpers', () => {
    const root = new Group(),
        body = triangle(),
        hidden = new Mesh(new BoxGeometry(100, 100, 100), new MeshBasicMaterial()),
        transparent = new Mesh(
            new BoxGeometry(100, 100, 100),
            new MeshBasicMaterial({ transparent: true, opacity: 0 }),
        );
    hidden.position.y = -100;
    hidden.visible = false;
    transparent.position.y = -200;
    root.add(body, hidden, transparent);
    root.rotation.x = Math.PI / 2;
    root.scale.setScalar(0.5);
    root.position.z = 0.3;
    const read = createModelSelectionBounds(root),
        bounds = read();
    close(bounds.min.z, 0.8);
    close(bounds.max.z, 1.8);
    close(bounds.min.x, -0.5);
    close(bounds.max.x, 0.5);
    assert.ok(body.geometry.boundingBox.min.y === -100, 'Source geometry was modified');
    dispose(root);
});

test('bounds cache avoids vertex scans until geometry, transform or visibility actually changes', () => {
    const mesh = triangle();
    let reads = 0;
    const get = mesh.getVertexPosition;
    mesh.getVertexPosition = function (...args) {
        reads++;
        return get.apply(this, args);
    };
    const read = createModelSelectionBounds(mesh);
    close(read().min.y, 1);
    const initial = reads;
    read();
    read();
    assert.equal(reads, initial);
    mesh.position.y = 2;
    close(read().min.y, 3);
    assert.ok(reads > initial);
    mesh.geometry.attributes.position.setY(0, 0);
    mesh.geometry.attributes.position.needsUpdate = true;
    close(read().min.y, 2);
    mesh.geometry.setDrawRange(0, 0);
    assert.equal(read().isEmpty(), true);
    mesh.geometry.setDrawRange(0, 3);
    mesh.visible = false;
    assert.equal(read().isEmpty(), true);
    dispose(mesh);
});

test('multi-material groups only contribute vertices that are actually drawn', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute([-1, 1, 0, 1, 1, 0, 0, 3, 0, -1, -9, 0, 1, -9, 0, 0, -8, 0], 3),
    );
    geometry.addGroup(0, 3, 0);
    geometry.addGroup(3, 3, 1);
    const front = new MeshBasicMaterial(),
        hidden = new MeshBasicMaterial({ visible: false }),
        mesh = new Mesh(geometry, [front, hidden]),
        read = createModelSelectionBounds(mesh);
    close(read().min.y, 1);
    hidden.visible = true;
    close(read().min.y, -9);
    hidden.transparent = true;
    hidden.opacity = 0;
    close(read().min.y, 1);
    dispose(mesh);
});

test('selection bottom updates with skin and morph poses rather than cached bind-pose bounds', () => {
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
    mesh.rotation.x = Math.PI / 2;
    const read = createModelSelectionBounds(mesh);
    close(read().min.z, -2);
    bone.position.y = 10;
    close(read().min.z, 8);
    mesh.skeleton.dispose();
    dispose(mesh);
    const morphGeometry = new BoxGeometry(2, 2, 2),
        delta = new Float32Array(morphGeometry.attributes.position.array.length);
    for (let i = 1; i < delta.length; i += 3) delta[i] = 5;
    morphGeometry.morphTargetsRelative = true;
    morphGeometry.morphAttributes.position = [new Float32BufferAttribute(delta, 3)];
    const morph = new Mesh(morphGeometry, new MeshBasicMaterial()),
        readMorph = createModelSelectionBounds(morph);
    close(readMorph().min.y, -1);
    morph.morphTargetInfluences[0] = 1;
    close(readMorph().min.y, 4);
    dispose(morph);
});
