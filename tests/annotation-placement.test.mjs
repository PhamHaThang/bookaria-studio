import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { placeAnnotation } from '../src/features/scene/model/annotation-placement.ts';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';
import { createAnnotationText } from '../src/shared/scene/annotation-text.ts';
import { createBillboard } from '../src/shared/scene/billboard.ts';
import { disposeTextVisual } from '../src/shared/scene/text-renderer.ts';

function fixture(shape = 'line', anchored = true) {
    const object = SceneObjectSchema.parse({
        id: 'callout',
        type: 'label',
        text: 'Chi tiết',
        target: [-0.3, 0.15, 0],
        transform: { scale: [1.2, 0.8, 1] },
        billboard: true,
        snapToPaper: true,
        presentation: { kind: 'annotation', shape, description: '' },
    });
    const placement = { position: [0.2, -0.15, 0.3], rotation: [15, 25, 10] };
    const placed = anchored ? placeAnnotation(object, placement) : object;
    const canvas = { width: 0, height: 0 };
    const context = new Proxy(
        { measureText: (text) => ({ width: text.length * 32 }) },
        {
            get: (target, key) => target[key] ?? (() => {}),
        },
    );
    const visual = createAnnotationText(
        canvas,
        context,
        placed.presentation,
        placed.text,
        '#252525',
        'sans-serif',
        false,
        placed.style.size,
        placed.target,
    );
    const root = new Group();
    root.position.fromArray(placement.position);
    root.scale.fromArray(placed.transform.scale);
    const billboard = createBillboard(root);
    billboard.content.add(visual.group);
    return { object, placed, placement, visual, root, billboard };
}

test('surface placement is immutable and disables snapping back to paper', () => {
    const { object, placed, placement, visual } = fixture();
    assert.equal(placed.snapToPaper, false);
    assert.equal(placed.presentation.anchorAtTarget, true);
    assert.deepEqual(placed.transform.position, placement.position);
    assert.deepEqual(placed.transform.rotation, placement.rotation);
    placed.transform.position[0] = 9;
    assert.equal(placement.position[0], 0.2);
    assert.deepEqual(object.transform.position, [0, 0, 0]);
    assert.equal(object.snapToPaper, true);
    assert.equal(object.presentation.anchorAtTarget, undefined);
    disposeTextVisual(visual.group);
});

test('surface callout marker stays at the clicked point through orbit, pan and nonuniform scaling', () => {
    const { placement, visual, root, billboard } = fixture();
    const marker = visual.group.getObjectByName('annotation-marker');
    assert.ok(marker);
    const camera = new PerspectiveCamera(40, 1, 0.01, 100);
    for (const position of [
        [1, -2, 3],
        [-2, 1, 2],
        [2, 0, 4],
    ]) {
        camera.up.set(0, 0, 1);
        camera.position.fromArray(position);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        billboard.update(camera, true, true);
        root.updateMatrixWorld(true);
        assert.ok(
            marker.getWorldPosition(new Vector3()).distanceTo(new Vector3(...placement.position)) <
                1e-6,
        );
    }
    disposeTextVisual(visual.group);
});

test('legacy labels retain the original leader endpoint and circle labels stay centred on the anchor', () => {
    const legacy = fixture('line', false);
    assert.deepEqual(legacy.visual.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(
        legacy.visual.group.getObjectByName('annotation-marker').position.toArray(),
        legacy.object.target,
    );
    disposeTextVisual(legacy.visual.group);
    const circle = fixture('circle');
    assert.deepEqual(circle.visual.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(
        circle.visual.group.getObjectByName('annotation-label').position.toArray(),
        [0, 0, 0],
    );
    disposeTextVisual(circle.visual.group);
});
