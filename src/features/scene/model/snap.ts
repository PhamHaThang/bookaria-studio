export const SNAP_FIELDS = [
    { key: 'translation', label: 'Di chuyển (mm)', min: 0.00001, max: 100 },
    { key: 'rotation', label: 'Xoay (°)', min: 0.1, max: 180 },
    { key: 'scale', label: 'Tỉ lệ (hệ số)', min: 0.1, max: 100 },
] as const;

export type SnapSteps = Record<(typeof SNAP_FIELDS)[number]['key'], number>;
export const DEFAULT_SNAP_STEPS: SnapSteps = { translation: 0.025, rotation: 15, scale: 5 };

/** Display units only; stored steps still use page units, degrees and percent. */
export function snapDisplayFactor(key: keyof SnapSteps, widthMm: number) {
    return key === 'translation' ? widthMm : key === 'scale' ? 0.01 : 1;
}

export function defaultSnapStepsForPage(widthMm: number): SnapSteps {
    return { ...DEFAULT_SNAP_STEPS, translation: 5 / widthMm };
}

export function parseSnapStep(
    key: keyof SnapSteps,
    text: string,
    displayFactor = 1,
): number | null {
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text.trim())) return null;
    const value = Number(text.trim().replace(',', '.')) / displayFactor;
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
