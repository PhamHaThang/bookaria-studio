import { MathUtils, type Object3D, type PerspectiveCamera, Quaternion, Vector3 } from 'three';

export type LocalDepthDrag = {
    position: Vector3;
    axis: Vector3;
    distance: number;
    unitsPerPixel: number;
    minDistance: number;
    maxDistance: number;
};

/** Capture a fixed local Z axis so one pointer gesture cannot bend as the billboard turns. */
export function beginLocalDepthDrag(
    camera: PerspectiveCamera,
    object: Object3D,
    height: number,
): LocalDepthDrag | null {
    if (!Number.isFinite(height) || height <= 0) return null;
    const position = object.getWorldPosition(new Vector3());
    const axis = new Vector3(0, 0, 1)
        .applyQuaternion(object.getWorldQuaternion(new Quaternion()))
        .normalize();
    const distance = camera.getWorldPosition(new Vector3()).sub(position).dot(axis);
    const minDistance = Math.max(0.02, camera.near * 4);
    if (!Number.isFinite(distance) || distance <= 1e-6) return null;
    return {
        position,
        axis,
        distance,
        minDistance: Math.min(minDistance, distance),
        maxDistance: Math.max(distance, camera.far * 0.8),
        unitsPerPixel: (2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2))) / height,
    };
}

/** Up moves toward the camera; snap is an offset from the gesture's original position. */
export function localDepthPosition(start: LocalDepthDrag, deltaY: number, snap = 0) {
    if (!Number.isFinite(deltaY) || !Number.isFinite(snap) || snap < 0) return null;
    let offset = -deltaY * start.unitsPerPixel;
    if (snap > 0) offset = Math.round(offset / snap) * snap;
    offset = MathUtils.clamp(
        offset,
        start.distance - start.maxDistance,
        start.distance - start.minDistance,
    );
    return start.position.clone().addScaledVector(start.axis, offset);
}
