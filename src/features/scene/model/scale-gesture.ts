type Vec3 = [number, number, number];
const axes = ['X', 'Y', 'Z'] as const;

export function scaleConstraint(axis: string, planar: boolean, shift: boolean) {
    if (shift) return planar ? 'XY' : 'XYZ';
    return planar ? axis.replaceAll('Z', '') : axis;
}

/** Scale from a fixed grab vector; paired axes share a factor and never flatten or mirror. */
export function scaleFromGesture(
    initial: Vec3,
    start: Vec3,
    end: Vec3,
    axis: string,
    planar: boolean,
    shift: boolean,
    snap: number | null,
    fallbackFactor = 1,
): Vec3 {
    const driver = axes
        .map((name, index) => (axis.includes(name) && (!planar || index !== 2) ? index : -1))
        .filter((index) => index >= 0);
    const affected = axes
        .map((name, index) => (scaleConstraint(axis, planar, shift).includes(name) ? index : -1))
        .filter((index) => index >= 0);
    if (!driver.length || !affected.length) return [...initial];
    const denominator = driver.reduce((sum, i) => sum + start[i] ** 2, 0);
    const dot = driver.reduce((sum, i) => sum + start[i] * end[i], 0);
    let factor =
        denominator > 1e-10
            ? axis === 'XYZ'
                ? Math.sqrt(driver.reduce((sum, i) => sum + end[i] ** 2, 0) / denominator) *
                  (dot < 0 ? -1 : 1)
                : dot / denominator
            : fallbackFactor;
    if (!Number.isFinite(factor)) return [...initial];
    if (snap && snap > 0) factor = 1 + Math.round((factor - 1) / snap) * snap;
    const minimum = Math.max(...affected.map((i) => 0.001 / initial[i]));
    factor = Math.max(minimum, factor);
    return initial.map((value, index) =>
        affected.includes(index) ? value * factor : value,
    ) as Vec3;
}
