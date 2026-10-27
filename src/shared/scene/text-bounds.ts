/** Measure visible ink once, leaving a few transparent pixels for antialiasing and texture filtering. */
export function paintedTextBounds(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding = 4,
) {
    const { data } = context.getImageData(0, 0, width, height);
    let left = width,
        top = height,
        right = -1,
        bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] === 0) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }
    // Empty legacy text still needs a finite, centred selection target.
    if (right < left)
        return {
            left: width / 2 - padding,
            top: height / 2 - padding,
            width: padding * 2,
            height: padding * 2,
        };
    const x = Math.max(0, left - padding),
        y = Math.max(0, top - padding);
    return {
        left: x,
        top: y,
        width: Math.min(width, right + padding + 1) - x,
        height: Math.min(height, bottom + padding + 1) - y,
    };
}
