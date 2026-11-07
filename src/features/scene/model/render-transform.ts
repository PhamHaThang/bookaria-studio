import { MathUtils, type Object3D } from 'three';
import type { Transform } from '../../../shared/contracts/scene.schema';

/** Draft number fields can briefly contain NaN or zero while the author types. */
export function canRenderTransform(transform: Transform) {
    return (
        [...transform.position, ...transform.rotation, ...transform.scale].every(Number.isFinite) &&
        transform.scale.every((value) => value > 0) &&
        Number.isFinite(transform.scale[0] * transform.scale[1] * transform.scale[2]) &&
        transform.scale[0] * transform.scale[1] * transform.scale[2] > 0
    );
}

/** Retain the last valid canvas transform; leave the authored draft intact for validation. */
export function applyRenderTransform(root: Object3D, transform: Transform) {
    if (!canRenderTransform(transform)) return false;
    root.position.fromArray(transform.position);
    root.rotation.set(...(transform.rotation.map(MathUtils.degToRad) as [number, number, number]));
    root.scale.fromArray(transform.scale);
    root.updateMatrixWorld(true);
    return true;
}
