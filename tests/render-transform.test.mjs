import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    Bone,
    BoxGeometry,
    Float32BufferAttribute,
    Group,
    MeshBasicMaterial,
    Skeleton,
    SkinnedMesh,
    Uint16BufferAttribute,
} from 'three';
import { createModelSelectionBounds } from '../src/features/scene/model/model-selection-bounds.ts';
import { visibleModelBounds } from '../src/features/scene/model/preview-fit.ts';
import { applyRenderTransform } from '../src/features/scene/model/render-transform.ts';
import { TransformSchema } from '../src/shared/contracts/scene.schema.ts';

function fixture() {
    const geometry = new BoxGeometry(2, 4, 2),
        count = geometry.attributes.position.count;
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()),
        bone = new Bone(),
        root = new Group();
    mesh.add(bone);
    mesh.bind(new Skeleton([bone]));
    root.add(mesh);
    return {
        root,
        read: createModelSelectionBounds(root),
        dispose() {
            geometry.dispose();
            mesh.material.dispose();
            mesh.skeleton.dispose();
        },
    };
}
const valid = () => ({ position: [0.1, 0.2, 0.3], rotation: [90, 0, 0], scale: [1, 1, 1] });

test('zero scale reproduces non-finite skinned vertices when sent directly to Three.js', () => {
    const f = fixture();
    try {
        f.root.scale.x = 0;
        assert.throws(() => visibleModelBounds(f.root), /tọa độ không hợp lệ/);
    } finally {
        f.dispose();
    }
});

test('editing an axis through zero, empty and negative values preserves a valid skinned pose and can recover', () => {
    const f = fixture();
    try {
        const transform = valid();
        assert.equal(applyRenderTransform(f.root, transform), true);
        const before = f.read().clone(),
            matrix = f.root.matrix.clone();
        for (const scale of [
            [0, 1, 1],
            [1, 0, 1],
            [1, 1, 0],
            [-1, 1, 1],
            [NaN, 1, 1],
        ]) {
            const draft = { ...transform, scale };
            assert.equal(applyRenderTransform(f.root, draft), false);
            assert.deepEqual(f.root.matrix, matrix);
            assert.deepEqual(f.read(), before);
            assert.equal(
                TransformSchema.safeParse(draft).success,
                false,
                'Invalid draft must still block saving',
            );
        }
        assert.equal(
            applyRenderTransform(f.root, {
                ...transform,
                position: [0.8, 0.2, 0.3],
                scale: [0.1, 1, 1],
            }),
            true,
        );
        assert.ok(f.read().min.x > before.min.x);
        assert.ok(f.read().max.x < before.max.x + 1);
    } finally {
        f.dispose();
    }
});

test('incomplete positions and rotations preserve the last rendered transform without mutating the draft', () => {
    const root = new Group(),
        transform = valid();
    applyRenderTransform(root, transform);
    const before = root.matrix.clone();
    for (const draft of [
        { ...transform, position: [NaN, 0, 0] },
        { ...transform, rotation: [0, Infinity, 0] },
    ]) {
        const saved = structuredClone(draft);
        assert.equal(applyRenderTransform(root, draft), false);
        assert.deepEqual(root.matrix, before);
        assert.deepEqual(draft, saved);
    }
    assert.equal(
        applyRenderTransform(root, { ...transform, position: [0, 0, 0], rotation: [0, 0, 0] }),
        true,
    );
    assert.deepEqual(root.position.toArray(), [0, 0, 0]);
});

test('scales that overflow or underflow the inverse matrix are not sent to the renderer', () => {
    const root = new Group();
    for (const value of [1e-200, 1e200])
        assert.equal(
            applyRenderTransform(root, { ...valid(), scale: [value, value, value] }),
            false,
        );
});
