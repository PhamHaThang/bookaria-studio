import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';
import { createAnnotationText } from '../src/shared/scene/annotation-text.ts';
import { createBillboard } from '../src/shared/scene/billboard.ts';
import { disposeTextVisual } from '../src/shared/scene/text-renderer.ts';

function canvasFixture() {
    const calls = [];
    const context = new Proxy(
        {
            measureText: (text) => ({ width: text.length * 32 }),
            fillText: (...args) => {
                calls.push(args);
            },
        },
        { get: (target, key) => target[key] ?? (() => {}) },
    );
    return { canvas: { width: 0, height: 0, getContext: () => context }, context, calls };
}
function fixture(
    shape = 'line',
    description = 'Mô tả dài có khoảng trắng và tiếng Việt vẫn giữ trên một dòng',
    target = [-0.3, 0.15, 0],
    connectorSide,
) {
    const spec = SceneObjectSchema.parse({
        id: 'annotation',
        type: 'label',
        text: 'Chi tiết',
        target,
        transform: {},
        billboard: true,
        presentation: {
            kind: 'annotation',
            shape,
            description,
            anchorAtTarget: true,
            connectorSide,
        },
    });
    const drawing = canvasFixture();
    const visual = createAnnotationText(
        drawing.canvas,
        drawing.context,
        spec.presentation,
        spec.text,
        spec.style.color,
        'sans-serif',
        false,
        spec.style.size,
        spec.target,
    );
    return { spec, visual, ...drawing };
}

test('line annotations collapse descriptions and expand without wrapping or replacing GPU resources', () => {
    const f = fixture(),
        card = f.visual.group.getObjectByName('annotation-label');
    const geometry = card.geometry,
        texture = card.material.map;
    assert.equal(f.visual.group.userData.annotationExpanded, false);
    assert.ok(!f.calls.some(([text]) => text === f.spec.presentation.description));
    const compactWidth = f.canvas.width;
    f.calls.length = 0;
    f.visual.setExpanded(true);
    assert.deepEqual(
        f.calls.map(([text]) => text),
        [f.spec.text, f.spec.presentation.description],
    );
    assert.ok(f.canvas.width > compactWidth);
    assert.equal(card.geometry, geometry);
    assert.equal(card.material.map, texture);
    const count = f.calls.length;
    f.visual.setExpanded(true);
    assert.equal(f.calls.length, count, 'unchanged selection must not repaint');
    f.visual.toggleDescription();
    assert.equal(f.visual.group.userData.annotationExpanded, false);
    assert.equal(f.canvas.width, compactWidth);
    disposeTextVisual(f.visual.group);
});

test('only explicit newlines split an expanded description', () => {
    const f = fixture('line', 'Dòng thứ nhất rất dài có nhiều khoảng trắng\nDòng thứ hai');
    f.calls.length = 0;
    f.visual.setExpanded(true);
    assert.deepEqual(
        f.calls.map(([text]) => text),
        [f.spec.text, 'Dòng thứ nhất rất dài có nhiều khoảng trắng', 'Dòng thứ hai'],
    );
    disposeTextVisual(f.visual.group);
});

test('expansion, orbit and pan preserve the placement endpoint and camera-facing label', () => {
    const f = fixture(),
        root = new Group(),
        billboard = createBillboard(root);
    root.position.set(0.2, -0.1, 0.4);
    root.scale.set(0.7, 1.2, 0.9);
    billboard.content.add(f.visual.group);
    const marker = f.visual.group.getObjectByName('annotation-marker');
    const camera = new PerspectiveCamera(40, 1, 0.01, 100);
    for (const expanded of [false, true, false]) {
        f.visual.setExpanded(expanded);
        for (const position of [
            [1, -2, 3],
            [-2, 1, 2],
            [2, 0, 4],
        ]) {
            camera.position.fromArray(position);
            camera.up.set(0, 0, 1);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();
            billboard.update(camera, true, true);
            root.updateMatrixWorld(true);
            assert.ok(marker.getWorldPosition(new Vector3()).distanceTo(root.position) < 1e-6);
            const card = root.getObjectByName('annotation-label');
            const normal = new Vector3(0, 0, 1).transformDirection(card.matrixWorld);
            assert.ok(
                normal.dot(new Vector3(0, 0, 1).applyQuaternion(camera.quaternion)) > 0.999999,
            );
        }
    }
    disposeTextVisual(f.visual.group);
});

test('circle description opens beside the anchor and hides on collapse', () => {
    const previous = globalThis.document,
        drawing = canvasFixture();
    globalThis.document = { createElement: () => drawing.canvas };
    try {
        const f = fixture('circle'),
            tooltip = f.visual.group.getObjectByName('annotation-description');
        assert.equal(tooltip.visible, false);
        assert.equal(tooltip.scale.lengthSq(), 0);
        f.visual.toggleDescription();
        assert.equal(tooltip.visible, true);
        assert.ok(tooltip.position.x > 0);
        assert.deepEqual(drawing.calls.at(-1)[0], f.spec.presentation.description);
        f.visual.setExpanded(false);
        assert.equal(tooltip.visible, false);
        assert.equal(tooltip.scale.lengthSq(), 0);
        assert.deepEqual(
            f.visual.group.getObjectByName('annotation-label').position.toArray(),
            [0, 0, 0],
        );
        disposeTextVisual(f.visual.group);
    } finally {
        if (previous === undefined) delete globalThis.document;
        else globalThis.document = previous;
    }
});

test('horizontal leader stays level with both side-edge centre and marker when description expands', () => {
    for (const x of [-0.3, 0.3]) {
        const f = fixture('line', 'Mô tả dòng thứ nhất\nMô tả dòng thứ hai', [x, 0, 0]);
        const card = f.visual.group.getObjectByName('annotation-label');
        const leader = f.visual.group.getObjectByName('annotation-leader');
        const marker = f.visual.group.getObjectByName('annotation-marker');
        for (const expanded of [false, true, false]) {
            f.visual.setExpanded(expanded);
            f.visual.group.updateMatrixWorld(true);
            const ends = [-0.5, 0.5].map((y) => leader.localToWorld(new Vector3(0, y, 0)));
            const markerPoint = marker.getWorldPosition(new Vector3());
            const cardCentre = card.getWorldPosition(new Vector3());
            assert.ok(ends.every((point) => Math.abs(point.y - markerPoint.y) < 1e-6));
            assert.ok(Math.abs(cardCentre.y - markerPoint.y) < 1e-6);
            assert.ok(ends.some((point) => point.distanceTo(markerPoint) < 1e-6));
        }
        disposeTextVisual(f.visual.group);
    }
});

test('dragged label offsets update the connector without repainting text or moving the marker', () => {
    const f = fixture(),
        card = f.visual.group.getObjectByName('annotation-label');
    const marker = f.visual.group.getObjectByName('annotation-marker');
    f.visual.setExpanded(true);
    const position = card.position.clone(),
        anchor = marker.position.clone();
    const geometry = card.geometry,
        version = card.material.map.version,
        drawCount = f.calls.length;
    for (const offset of [
        [0.2, -0.1],
        [-0.5, 0.3],
        [0, 0],
    ]) {
        f.visual.setAnnotationOffset(offset);
        assert.ok(card.position.distanceTo(position.clone().add(new Vector3(...offset, 0))) < 1e-6);
        assert.deepEqual(marker.position.toArray(), anchor.toArray());
        assert.equal(card.geometry, geometry);
        assert.equal(card.material.map.version, version);
        assert.equal(f.calls.length, drawCount);
    }
    disposeTextVisual(f.visual.group);
});

test('chosen connector stays at its edge midpoint through dragging, expansion and side changes', () => {
    const f = fixture('line', 'Mô tả chú thích', [-0.3, 0, 0], 'left');
    const card = f.visual.group.getObjectByName('annotation-label');
    const leader = f.visual.group.getObjectByName('annotation-leader');
    const marker = f.visual.group.getObjectByName('annotation-marker');
    f.visual.group.updateMatrixWorld(true);
    const anchor = marker.getWorldPosition(new Vector3());
    const edges = { left: [-1, 0], right: [1, 0], top: [0, 1], bottom: [0, -1] };
    for (const expanded of [false, true, false]) {
        f.visual.setExpanded(expanded);
        for (const offset of [
            [0, 0],
            [0.2, -0.4],
            [-0.5, 0.6],
        ]) {
            f.visual.setAnnotationOffset(offset);
            const position = card.position.clone(),
                geometry = card.geometry,
                texture = card.material.map;
            const version = texture.version,
                drawCount = f.calls.length;
            for (const [side, [x, y]] of Object.entries(edges)) {
                f.visual.setAnnotationConnectorSide(side);
                f.visual.group.updateMatrixWorld(true);
                const connection = card.localToWorld(
                    new Vector3(
                        (x * card.geometry.parameters.width) / 2,
                        (y * card.geometry.parameters.height) / 2,
                        0,
                    ),
                );
                const ends = [-0.5, 0.5].map((y) => leader.localToWorld(new Vector3(0, y, 0)));
                assert.ok(
                    ends.some((point) => point.distanceTo(connection) < 1e-6),
                    side,
                );
                assert.ok(
                    ends.some((point) => point.distanceTo(anchor) < 1e-6),
                    side,
                );
                assert.deepEqual(card.position.toArray(), position.toArray());
                assert.ok(marker.getWorldPosition(new Vector3()).distanceTo(anchor) < 1e-6);
                assert.equal(card.geometry, geometry);
                assert.equal(card.material.map, texture);
                assert.equal(texture.version, version);
                assert.equal(f.calls.length, drawCount);
            }
        }
    }
    disposeTextVisual(f.visual.group);
});
