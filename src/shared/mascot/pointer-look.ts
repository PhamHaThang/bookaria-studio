/** Scale gaze to the workspace, so a corner mascot does not saturate over most of the page. */
export function pointerLook(
    x: number,
    y: number,
    box: { left: number; top: number; width: number; height: number },
    viewport: { width: number; height: number },
): [number, number] {
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const horizontal = Math.max(1, viewport.width / 2, dx < 0 ? centerX : viewport.width - centerX);
    const vertical = Math.max(1, viewport.height / 2, dy < 0 ? centerY : viewport.height - centerY);
    return [Math.max(-1, Math.min(1, dx / horizontal)), Math.max(-1, Math.min(1, -dy / vertical))];
}
