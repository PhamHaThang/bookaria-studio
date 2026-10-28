import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DirectionalLight, MeshBasicMaterial, Scene } from 'three';
import { createPageLighting } from '../src/shared/scene/page-lighting.ts';

test('page lighting changes tint without changing light strength, direction or allocating new lights', () => {
    const rig = createPageLighting();
    const members = [...rig.group.children];
    for (const [preset, expected] of [
        ['warm', 0xffe2bc],
        ['cool', 0xdceaff],
        ['neutral', 0xffffff],
    ]) {
        rig.setPreset(preset);
        assert.equal(rig.key.color.getHex(), expected);
        assert.equal(rig.key.intensity, 2.5);
        assert.deepEqual(rig.key.position.toArray(), [2, 3, 4]);
        assert.deepEqual(rig.key.target.position.toArray(), [0, 0, 0]);
        assert.equal(rig.fill.intensity, 2.2);
        assert.equal(rig.fill.color.getHex(), 0xffffff);
        assert.equal(rig.fill.groundColor.getHex(), 0x57665c);
        assert.deepEqual(rig.group.children, members);
        assert.equal(rig.key.castShadow, false);
    }
});

test('page lighting does not recolor imported lights or unlit page/card materials', () => {
    const scene = new Scene(),
        importedLight = new DirectionalLight(0x123456, 8);
    const paper = new MeshBasicMaterial({ color: 0xeeeeee });
    const rig = createPageLighting('warm');
    scene.add(rig.group, importedLight);
    rig.setPreset('cool');
    assert.equal(importedLight.color.getHex(), 0x123456);
    assert.equal(importedLight.intensity, 8);
    assert.equal(paper.color.getHex(), 0xeeeeee);
    paper.dispose();
});
