import { type Camera, Euler, Frustum, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { SceneObject } from '../../../shared/contracts/scene.schema';
import { objectFromGizmo } from './transforms';

function objectMatrix(object: SceneObject) {
    return new Matrix4().compose(
        new Vector3(...object.transform.position),
        new Quaternion().setFromEuler(
            new Euler(
                ...(object.transform.rotation.map(MathUtils.degToRad) as [number, number, number]),
            ),
        ),
        new Vector3(...object.transform.scale),
    );
}

/** Delta is rigid motion or uniform scale, so TRS remains representable without shear. */
export function transformSelection(
    before: SceneObject[],
    delta: Matrix4,
    moving: boolean,
    axis: string | null,
): SceneObject[] | null {
    if (
        !delta.elements.every(Number.isFinite) ||
        before.some((object) => object.locked || object.editorHidden)
    )
        return null;
    const result: SceneObject[] = [];
    for (const object of before) {
        const position = new Vector3(),
            rotation = new Quaternion(),
            scale = new Vector3();
        delta.clone().multiply(objectMatrix(object)).decompose(position, rotation, scale);
        if (![scale.x, scale.y, scale.z].every((value) => value > 0)) return null;
        const euler = new Euler().setFromQuaternion(rotation, 'XYZ');
        const next = objectFromGizmo(
            object,
            {
                position: position.toArray(),
                rotation: [euler.x, euler.y, euler.z].map(MathUtils.radToDeg) as [
                    number,
                    number,
                    number,
                ],
                scale: scale.toArray(),
            },
            moving,
            axis,
        );
        if (!next) return null;
        if (Math.abs(next.transform.position[2]) > 0.00001) next.snapToPaper = false;
        result.push(next);
    }
    return result;
}

/** Crop the view frustum to a canvas-local pixel rectangle, including near/far clipping. */
export function selectionFrustum(
    camera: Camera,
    rect: { left: number; top: number; right: number; bottom: number },
    viewport: { width: number; height: number },
) {
    if (
        viewport.width <= 0 ||
        viewport.height <= 0 ||
        rect.right <= rect.left ||
        rect.bottom <= rect.top
    )
        return null;
    const left = (rect.left / viewport.width) * 2 - 1,
        right = (rect.right / viewport.width) * 2 - 1;
    const top = 1 - (rect.top / viewport.height) * 2,
        bottom = 1 - (rect.bottom / viewport.height) * 2;
    const crop = new Matrix4().set(
        2 / (right - left),
        0,
        0,
        -(right + left) / (right - left),
        0,
        2 / (top - bottom),
        0,
        -(top + bottom) / (top - bottom),
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
    );
    camera.updateMatrixWorld();
    return new Frustum().setFromProjectionMatrix(
        crop.multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse),
    );
}
