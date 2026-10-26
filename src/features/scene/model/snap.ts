export const SNAP_FIELDS = [
    { key: 'translation', label: 'Di chuyển (đơn vị)', min: 0.00001, max: 100 },
    { key: 'rotation', label: 'Xoay (°)', min: 0.1, max: 180 },
    { key: 'scale', label: 'Kích thước (%)', min: 0.1, max: 100 },
] as const;

export type SnapSteps = Record<(typeof SNAP_FIELDS)[number]['key'], number>;
export const DEFAULT_SNAP_STEPS: SnapSteps = { translation: 0.025, rotation: 15, scale: 5 };

export function parseSnapStep(key: keyof SnapSteps, text: string): number | null {
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text.trim())) return null;
    const value = Number(text.trim().replace(',', '.'));
    const field = SNAP_FIELDS.find((item) => item.key === key);
    return field && Number.isFinite(value) && value >= field.min && value <= field.max
        ? value
        : null;
}

export function transformSnapSteps(steps: SnapSteps) {
    return {
        translation: steps.translation,
        rotation: (steps.rotation * Math.PI) / 180,
        scale: steps.scale / 100,
    };
}
