import * as THREE from 'three';

export type AnnotationLabelDrag = {
    plane: THREE.Plane;
    inverse: THREE.Matrix4;
    origin: THREE.Vector3;
    offset: [number, number];
};

/** Freeze the annotation plane and grab point so dragging never jumps or changes its anchor. */
export function beginAnnotationLabelDrag(
    group: THREE.Object3D,
    point: THREE.Vector3,
    offset: [number, number],
): AnnotationLabelDrag {
    group.updateWorldMatrix(true, false);
    const inverse = group.matrixWorld.clone().invert();
    const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(
        new THREE.Matrix3().getNormalMatrix(group.matrixWorld),
    );
    return {
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point),
        inverse,
        origin: point.clone().applyMatrix4(inverse),
        offset: [...offset],
    };
}

export function annotationLabelOffset(
    start: AnnotationLabelDrag,
    camera: THREE.Camera,
    rect: { left: number; top: number; width: number; height: number },
    x: number,
    y: number,
): [number, number] | undefined {
    if (rect.width <= 0 || rect.height <= 0) return;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
        new THREE.Vector2(
            ((x - rect.left) / rect.width) * 2 - 1,
            1 - ((y - rect.top) / rect.height) * 2,
        ),
        camera,
    );
    const hit = ray.ray.intersectPlane(start.plane, new THREE.Vector3());
    if (!hit) return;
    hit.applyMatrix4(start.inverse).sub(start.origin);
    const offset: [number, number] = [start.offset[0] + hit.x, start.offset[1] + hit.y];
    return offset.every(Number.isFinite) ? offset : undefined;
}
