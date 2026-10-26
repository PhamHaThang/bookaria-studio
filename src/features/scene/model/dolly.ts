import { type PerspectiveCamera, Plane, Raycaster, type Vector2, Vector3 } from 'three';

export type DollyStart = {
    position: Vector3;
    target: Vector3;
    anchor: Vector3;
    distance: number;
};

/** Fix the anchor at pointer-down on the view plane through the orbit target. */
export function beginDolly(
    camera: PerspectiveCamera,
    target: Vector3,
    pointer: Vector2,
): DollyStart {
    camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(pointer, camera);
    const plane = new Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new Vector3()),
        target,
    );
    const anchor = ray.ray.intersectPlane(plane, new Vector3()) || target.clone();
    return {
        position: camera.position.clone(),
        target: target.clone(),
        anchor,
        distance: camera.position.distanceTo(target),
    };
}

/** Absolute displacement gives the same zoom on fast and slow mice and is reversible. */
export function dragDolly(
    camera: PerspectiveCamera,
    target: Vector3,
    start: DollyStart,
    deltaY: number,
    viewportHeight: number,
    minDistance: number,
    maxDistance: number,
) {
    if (
        ![deltaY, viewportHeight, minDistance, maxDistance, start.distance].every(
            Number.isFinite,
        ) ||
        viewportHeight <= 0 ||
        minDistance <= 0 ||
        maxDistance < minDistance ||
        start.distance <= 0
    )
        return false;
    const exponent = Math.max(-20, Math.min(20, (deltaY / viewportHeight) * 3));
    const distance = Math.max(
        minDistance,
        Math.min(maxDistance, start.distance * Math.exp(exponent)),
    );
    const ratio = distance / start.distance;
    camera.position
        .copy(start.anchor)
        .addScaledVector(start.position.clone().sub(start.anchor), ratio);
    target.copy(start.anchor).addScaledVector(start.target.clone().sub(start.anchor), ratio);
    camera.updateMatrixWorld();
    return true;
}
