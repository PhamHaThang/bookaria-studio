import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatTransformValue,
    mmToPageUnits,
    pageUnitsToMm,
} from '../src/features/scene/model/scene-units.ts';
import {
    defaultSnapStepsForPage,
    parseSnapStep,
    snapDisplayFactor,
    transformSnapSteps,
} from '../src/features/scene/model/snap.ts';

import { safeTransform } from '../src/features/scene/model/transforms.ts';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10);

test('physical positions round-trip without changing normalized coordinates for every page width', () => {
    for (const width of [210, 148, 180, 297, 0.1, 1000]) {
        for (const value of [0, -0.5, 0.1, 0.075, 2.7, 0.000001]) {
            close(mmToPageUnits(pageUnitsToMm(value, width), width), value);
        }
    }
    assert.equal(pageUnitsToMm(0.1, 210), 21);
    assert.equal(pageUnitsToMm(-0.5, 148), -74);
    // Every axis uses page width, including Z; page height is not a scale factor.
    assert.deepEqual(
        [0.1, -0.2, 0.5].map((value) => pageUnitsToMm(value, 180)),
        [18, -36, 90],
    );
    close(mmToPageUnits(10, 210), 1 / 21);
});

test('gizmo feedback uses mm while rotation and authored scale retain their own units', () => {
    assert.equal(formatTransformValue('translate', 0.1, 210), '21 mm');
    assert.equal(formatTransformValue('translate', -0.125, 148), '-18.5 mm');
    assert.equal(formatTransformValue('translate', 0.000001, 210), '0 mm');
    assert.equal(formatTransformValue('rotate', 15.1234, 210), '15.1°');
    assert.equal(formatTransformValue('scale', 1.2274, 210), '1.227');
    assert.equal(formatTransformValue('scale', 0.001, 148), '0.001');
});

test('five millimetre snap works on A4, A5 and custom books without changing rotation or scale', () => {
    for (const width of [210, 148, 180, 0.1, 1000]) {
        const steps = defaultSnapStepsForPage(width);
        close(pageUnitsToMm(steps.translation, width), 5);
        const increments = transformSnapSteps(steps);
        close(increments.translation, 5 / width);
        close(increments.rotation, Math.PI / 12);
        assert.equal(increments.scale, 0.05);
        close(
            parseSnapStep('translation', '2,5', snapDisplayFactor('translation', width)),
            2.5 / width,
        );
        // Preserve the user's physical snap when the book width changes.
        close(pageUnitsToMm(mmToPageUnits(pageUnitsToMm(steps.translation, width), 148), 148), 5);
    }
    assert.equal(parseSnapStep('scale', '0,05', snapDisplayFactor('scale', 210)), 5);
    assert.equal(parseSnapStep('rotation', '15', snapDisplayFactor('rotation', 210)), 15);
    assert.equal(parseSnapStep('scale', '1.1', snapDisplayFactor('scale', 210)), null);
    assert.equal(parseSnapStep('translation', '0', snapDisplayFactor('translation', 210)), null);
    assert.equal(parseSnapStep('translation', '', snapDisplayFactor('translation', 210)), null);
    assert.equal(
        parseSnapStep('translation', '21001', snapDisplayFactor('translation', 210)),
        null,
    );
});

test('gizmo rounding preserves millimetre snap precision on the largest supported page width', () => {
    for (const width of [148, 210, 180.3, 1000]) {
        for (const distance of [-25, 1, 2.5, 5, 25]) {
            const transform = safeTransform(
                {
                    position: [distance / width, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                },
                false,
                true,
            );
            assert.ok(Math.abs(pageUnitsToMm(transform.position[0], width) - distance) < 0.00001);
            assert.equal(
                formatTransformValue('translate', transform.position[0], width),
                `${distance} mm`,
            );
        }
    }
});
