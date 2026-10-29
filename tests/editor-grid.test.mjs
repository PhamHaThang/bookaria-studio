import assert from 'node:assert/strict';
import test from 'node:test';
import { Color } from 'three';
import {
    createEditorGrid,
    DEFAULT_EDITOR_GRID,
    editorGridLayout,
} from '../src/features/scene/model/editor-grid.ts';

test('grid cells retain their physical size and origin on every supported page width', () => {
    for (const width of [0.1, 148, 180, 210, 1000]) {
        for (const aspect of [0.2, 297 / 210, 5]) {
            for (const spacing of [1, 2, 5, 10, 20, 50, 100]) {
                const layout = editorGridLayout(width, aspect, spacing);
                assert.ok(Math.abs((layout.size / layout.divisions) * width - spacing) < 1e-8);
                assert.equal(layout.divisions % 2, 0);
                assert.ok(layout.size >= Math.max(4, aspect + 1));
                assert.ok(layout.divisions <= 6000);
            }
        }
    }
    for (const spacing of [0, -1, NaN, Infinity, 0.1, 1001]) {
        assert.throws(() => editorGridLayout(210, 297 / 210, spacing), RangeError);
    }
});

test('visibility and opacity update without rebuilding geometry; spacing frees the previous buffer', () => {
    const initial = { ...DEFAULT_EDITOR_GRID };
    const controller = createEditorGrid(210, 297 / 210, initial, {
        center: new Color('#b3b3b3'),
        line: new Color('#d6d6d6'),
    });
    const { grid } = controller;
    const geometry = grid.geometry;
    const material = grid.material;
    let geometryDisposals = 0;
    geometry.addEventListener('dispose', () => geometryDisposals++);
    const next = { ...initial, visible: false, opacity: 0.3 };
    controller.update(next, 210, 297 / 210);
    assert.equal(grid.geometry, geometry);
    assert.equal(grid.material, material);
    assert.equal(grid.visible, false);
    assert.equal(material.opacity, 0.3);
    assert.equal(material.depthWrite, false);
    assert.equal(grid.position.z, -0.008);
    controller.update({ ...next, visible: true, spacingMm: 10 }, 210, 297 / 210);
    assert.notEqual(grid.geometry, geometry);
    assert.equal(geometryDisposals, 1);
    assert.equal(grid.material, material);
    assert.equal(grid.visible, true);
    controller.dispose();
});

test('page size changes preserve millimetre cells and disposal releases the last resources once', () => {
    const controller = createEditorGrid(210, 297 / 210, DEFAULT_EDITOR_GRID, {
        center: new Color('#b3b3b3'),
        line: new Color('#d6d6d6'),
    });
    const old = controller.grid.geometry;
    controller.update(DEFAULT_EDITOR_GRID, 148, 5);
    const geometry = controller.grid.geometry;
    assert.notEqual(geometry, old);
    const box = geometry;
    box.computeBoundingBox();
    assert.ok(box.boundingBox.max.x - box.boundingBox.min.x >= 6);
    let geometryDisposals = 0,
        materialDisposals = 0;
    geometry.addEventListener('dispose', () => geometryDisposals++);
    controller.grid.material.addEventListener('dispose', () => materialDisposals++);
    controller.dispose();
    controller.dispose();
    controller.update({ ...DEFAULT_EDITOR_GRID, spacingMm: 5 }, 210, 297 / 210);
    assert.equal(geometryDisposals, 1);
    assert.equal(materialDisposals, 1);
});
