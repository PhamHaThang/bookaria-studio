import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import {
    annotationLabelOffset,
    beginAnnotationLabelDrag,
} from '../src/features/scene/model/annotation-label-drag.ts';
import { createBillboard } from '../src/shared/scene/billboard.ts';

test('dragging follows the grabbed label point through camera rotation and nonuniform object scale', () => {
    const rect = { left: 120, top: 90, width: 900, height: 600 };
    const root = new Group(),
        group = new Group(),
        billboard = createBillboard(root);
    root.position.set(0.2, -0.1, 0.3);
    root.rotation.set(0.3, 0.5, 0.2);
    root.scale.set(0.7, 1.4, 0.6);
    billboard.content.add(group);
    group.position.set(0.3, 0, 0);
    const original = root.position.clone(),
        originalOffset = [0.1, -0.05];
    for (const position of [
        [1, -2, 3],
        [-2, 1, 2],
    ]) {
        const camera = new PerspectiveCamera(40, rect.width / rect.height, 0.01, 100);
        camera.position.fromArray(position);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        billboard.update(camera, true, true);
        group.updateWorldMatrix(true, true);
        const grabbed = group.localToWorld(new Vector3(0.2, -0.02, 0));
        const start = beginAnnotationLabelDrag(group, grabbed, originalOffset);
        const project = (world) => {
            const point = world.clone().project(camera);
            return [
                rect.left + ((point.x + 1) * rect.width) / 2,
                rect.top + ((1 - point.y) * rect.height) / 2,
            ];
        };
        const unchanged = annotationLabelOffset(start, camera, rect, ...project(grabbed));
        assert.ok(
            unchanged.every((value, index) => Math.abs(value - originalOffset[index]) < 1e-6),
        );
        const target = group.localToWorld(new Vector3(0.35, 0.08, 0));
        const result = annotationLabelOffset(start, camera, rect, ...project(target));
        assert.ok(Math.abs(result[0] - 0.25) < 1e-6);
        assert.ok(Math.abs(result[1] - 0.05) < 1e-6);
        assert.deepEqual(root.position.toArray(), original.toArray());
        assert.deepEqual(originalOffset, [0.1, -0.05]);
        assert.equal(
            annotationLabelOffset(start, camera, { ...rect, width: 0 }, 10, 10),
            undefined,
        );
    }
});
