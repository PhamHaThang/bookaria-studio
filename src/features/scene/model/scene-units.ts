/** Scene coordinates stay normalized to the physical page width on every axis. */
export function pageUnitsToMm(value: number, widthMm: number) {
    return value * widthMm;
}

export function mmToPageUnits(value: number, widthMm: number) {
    return value / widthMm;
}

export function formatTransformValue(
    mode: 'translate' | 'rotate' | 'scale',
    value: number,
    widthMm: number,
) {
    const displayed = mode === 'translate' ? pageUnitsToMm(value, widthMm) : value;
    const text = String(Number(displayed.toFixed(mode === 'rotate' ? 1 : 3)));
    return `${text}${mode === 'translate' ? ' mm' : mode === 'rotate' ? '°' : ''}`;
}
