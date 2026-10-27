import { type Box3, type Camera, Frustum, Matrix4, Vector4 } from 'three';

export type ScreenBounds = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

/** Clip the box at the near plane before projecting, including boxes around the camera. */
export function projectSelectionBounds(
    box: Box3,
    camera: Camera,
    viewport: Size,
    worldMatrix?: Matrix4,
): ScreenBounds | null {
    if (box.isEmpty() || viewport.width <= 0 || viewport.height <= 0) return null;
    camera.updateMatrixWorld();
    const matrix = new Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
    );
    if (worldMatrix) matrix.multiply(worldMatrix);
    if (!new Frustum().setFromProjectionMatrix(matrix).intersectsBox(box)) return null;
    const corners: Vector4[] = [];
    for (let i = 0; i < 8; i++) {
        corners.push(
            new Vector4(
                i & 1 ? box.max.x : box.min.x,
                i & 2 ? box.max.y : box.min.y,
                i & 4 ? box.max.z : box.min.z,
                1,
            ).applyMatrix4(matrix),
        );
    }
    const points = corners.filter((point) => point.z + point.w >= 0 && point.w > 0);
    for (let i = 0; i < 8; i++) {
        for (const bit of [1, 2, 4]) {
            if (i & bit) continue;
            const a = corners[i],
                b = corners[i | bit],
                da = a.z + a.w,
                db = b.z + b.w;
            if (da < 0 !== db < 0) {
                const point = a.clone().lerp(b, da / (da - db));
                if (point.w > 0) points.push(point);
            }
        }
    }
    if (!points.length) return null;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const xs = points.map((point) => ((clamp(point.x / point.w) + 1) * viewport.width) / 2);
    const ys = points.map((point) => ((1 - clamp(point.y / point.w)) * viewport.height) / 2);
    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
    };
}

/** Keep both rails away from the view switch, orientation gizmo and canvas footer. */
export function layoutSelectionTools(
    bounds: ScreenBounds,
    viewport: Size,
    left: Size,
    right: Size,
) {
    const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(Math.max(min, max), value));
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const top = 76;
    const bottom = viewport.height - (viewport.height < 400 ? 48 : 64);
    const minX = 84;
    const gap = 16;
    let rx = clamp(
        Math.max(bounds.right + gap, centerX + 52),
        minX + left.width + gap,
        viewport.width - right.width - 12,
    );
    const ry = clamp(centerY - right.height / 2, top, bottom - right.height);
    // If the rail rises into the orientation gizmo's corner, move it to its left.
    if (ry < 140 && rx + right.width > viewport.width - 140) {
        rx = clamp(
            viewport.width - 140 - right.width - gap,
            minX + left.width + gap,
            viewport.width - right.width - 12,
        );
    }
    return {
        left: {
            x: clamp(
                Math.min(bounds.left - left.width - gap, centerX - 52 - left.width),
                minX,
                rx - left.width - gap,
            ),
            y: clamp(centerY - left.height / 2, top, bottom - left.height),
        },
        right: { x: rx, y: ry },
    };
}
