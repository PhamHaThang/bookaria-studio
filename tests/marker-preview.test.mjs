import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    constrainMarkerPosition,
    resizeMarkerAtCenter,
} from '../src/features/pages/model/marker-preview.ts';
import { placementFromForm } from '../src/features/pages/model/placement.ts';

function assertPrintable(value, page) {
    assert.ok(value);
    const form = new FormData();
    form.set('centerX', value.centerXMm.toFixed(1));
    form.set('centerY', value.centerYMm.toFixed(1));
    form.set('size', value.sizeMm.toFixed(1));
    assert.doesNotThrow(() => placementFromForm(form, page));
}

test('visual marker placement respects print margins after input rounding at all four edges', () => {
    for (const page of [
        { format: 'A4', aspect: 297 / 210 },
        { format: 'A5', aspect: 210 / 148 },
        { format: 'CUSTOM', aspect: 0.731, widthMm: 197.3 },
    ]) {
        for (const sizeMm of [35, 45.1, 61.7, 1000]) {
            for (const centerXMm of [-1000, 1000])
                for (const centerYMm of [-1000, 1000]) {
                    assertPrintable(
                        constrainMarkerPosition({ centerXMm, centerYMm, sizeMm }, page),
                        page,
                    );
                }
        }
    }
});

test('resizing keeps the marker centre fixed, preserves a square and stops at the safe area', () => {
    const page = { format: 'A4', aspect: 297 / 210 };
    const initial = { centerXMm: 60, centerYMm: 80, sizeMm: 45 };
    const enlarged = resizeMarkerAtCenter(initial, 200, page);
    assert.deepEqual(enlarged, { centerXMm: 60, centerYMm: 80, sizeMm: 96 });
    assertPrintable(enlarged, page);
    assert.equal(resizeMarkerAtCenter(initial, -200, page).sizeMm, 35);
});

test('a page too small for the marker has no valid draggable placement', () => {
    assert.equal(
        constrainMarkerPosition(
            { centerXMm: 10, centerYMm: 10, sizeMm: 45 },
            { format: 'CUSTOM', widthMm: 50, aspect: 1 },
        ),
        null,
    );
});
