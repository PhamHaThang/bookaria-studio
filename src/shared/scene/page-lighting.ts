import { DirectionalLight, Group, HemisphereLight } from 'three';
import type { LightingPreset } from '../contracts/enums.schema';

/** Same page-space rig in Studio and Viewer. Presets change tint only. */
export const PAGE_LIGHTING_COLORS: Readonly<Record<LightingPreset, number>> = Object.freeze({
    neutral: 0xffffff,
    warm: 0xffe2bc,
    cool: 0xdceaff,
});

export function createPageLighting(preset: LightingPreset = 'neutral') {
    const group = new Group();
    group.name = 'page-lighting';
    const fill = new HemisphereLight(0xffffff, 0x57665c, 2.2);
    fill.name = 'page-lighting-fill';
    const key = new DirectionalLight(0xffffff, 2.5);
    key.name = 'page-lighting-key';
    key.position.set(2, 3, 4);
    group.add(fill, key, key.target);
    function setPreset(value: LightingPreset) {
        key.color.setHex(PAGE_LIGHTING_COLORS[value]);
    }
    setPreset(preset);
    return { group, fill, key, setPreset };
}
