import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_SNAP_STEPS,
    parseSnapStep,
    transformSnapSteps,
} from '../src/features/scene/model/snap.ts';

test('snap input accepts Vietnamese and decimal-point notation and rejects unusable steps', () => {
    assert.equal(parseSnapStep('translation', ' 0,05 '), 0.05);
    assert.equal(parseSnapStep('scale', '.5'), 0.5);
    for (const text of ['', ' ', '0', '-1', 'Infinity', 'NaN', '0x10', '1,2,3', '1.2.3']) {
        assert.equal(parseSnapStep('translation', text), null);
    }
    assert.equal(parseSnapStep('rotation', '181'), null);
    assert.equal(parseSnapStep('rotation', '180'), 180);
    assert.equal(parseSnapStep('scale', '101'), null);
    assert.equal(parseSnapStep('translation', '0.000001'), null);
});

test('snap settings convert degrees and percent to Three.js increments', () => {
    const original = { ...DEFAULT_SNAP_STEPS };
    assert.deepEqual(transformSnapSteps(DEFAULT_SNAP_STEPS), {
        translation: 0.025,
        rotation: Math.PI / 12,
        scale: 0.05,
    });
    assert.deepEqual(transformSnapSteps({ translation: 0.1, rotation: 30, scale: 20 }), {
        translation: 0.1,
        rotation: Math.PI / 6,
        scale: 0.2,
    });
    assert.deepEqual(DEFAULT_SNAP_STEPS, original);
});
