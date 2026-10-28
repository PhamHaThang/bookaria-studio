import {
    MARKER_RULES,
    type PageGeometry,
    pageWidthMm,
} from '../../../shared/contracts/marker.schema';

export interface MarkerPrintPosition {
    centerXMm: number;
    centerYMm: number;
    sizeMm: number;
}

/** Clamp in physical page units, independent of preview zoom or aspect ratio. */
export function constrainMarkerPosition(
    value: MarkerPrintPosition,
    page: PageGeometry,
): MarkerPrintPosition | null {
    const width = pageWidthMm(page.format, page.widthMm),
        height = width * page.aspect;
    const margin = MARKER_RULES.minEdgeMarginMm;
    const maximum = Math.min(width, height) - 2 * margin;
    if (maximum < MARKER_RULES.minSizeMm || !Object.values(value).every(Number.isFinite))
        return null;
    // Keep values on the input's 0.1 mm grid, including at the safe-area boundary.
    let sizeMm = Math.max(
        MARKER_RULES.minSizeMm,
        Math.min(Math.floor(maximum * 10) / 10, Math.round(value.sizeMm * 10) / 10),
    );
    const bounds = (size: number) => {
        const edge = margin + size / 2;
        return {
            min: Math.ceil((edge - 1e-8) * 10) / 10,
            maxX: Math.floor((width - edge + 1e-8) * 10) / 10,
            maxY: Math.floor((height - edge + 1e-8) * 10) / 10,
        };
    };
    let limits = bounds(sizeMm);
    if (limits.min > Math.min(limits.maxX, limits.maxY)) {
        sizeMm = Math.round((sizeMm - 0.1) * 10) / 10;
        limits = bounds(sizeMm);
    }
    if (sizeMm < MARKER_RULES.minSizeMm) return null;
    return {
        centerXMm: Math.max(
            limits.min,
            Math.min(limits.maxX, Math.round(value.centerXMm * 10) / 10),
        ),
        centerYMm: Math.max(
            limits.min,
            Math.min(limits.maxY, Math.round(value.centerYMm * 10) / 10),
        ),
        sizeMm,
    };
}

export function resizeMarkerAtCenter(
    value: MarkerPrintPosition,
    sizeMm: number,
    page: PageGeometry,
) {
    const width = pageWidthMm(page.format, page.widthMm),
        height = width * page.aspect;
    const maximum =
        2 *
        (Math.min(
            value.centerXMm,
            width - value.centerXMm,
            value.centerYMm,
            height - value.centerYMm,
        ) -
            MARKER_RULES.minEdgeMarginMm);
    return constrainMarkerPosition({ ...value, sizeMm: Math.min(sizeMm, maximum) }, page);
}
