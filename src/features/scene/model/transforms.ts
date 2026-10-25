import type { SceneObject } from '../../../shared/contracts/scene.schema';

export function safeTransform(
    value: SceneObject['transform'],
    snapToPaper: boolean,
    moving: boolean,
): SceneObject['transform'] | null {
    const fields = [...value.position, ...value.rotation, ...value.scale];
    if (!fields.every(Number.isFinite)) return null;
    const round = (n: number) => Math.round(n * 100000) / 100000;
    return {
        position: value.position.map((n, index) =>
            snapToPaper && moving && index === 2 ? 0 : round(n),
        ) as [number, number, number],
        rotation: value.rotation.map(round) as [number, number, number],
        scale: value.scale.map((n) => Math.max(0.001, round(n))) as [number, number, number],
    };
}

/** An explicit height edit leaves paper snapping; keep intermediate numeric input for validation. */
export function withObjectPosition(
    object: SceneObject,
    position: [number, number, number],
): SceneObject {
    return {
        ...object,
        snapToPaper: Number.isFinite(position[2]) && position[2] !== 0 ? false : object.snapToPaper,
        transform: { ...object.transform, position },
    };
}

/** Choosing paper mode deliberately puts the object on the paper in one undoable edit. */
export function withPaperSnap(object: SceneObject, enabled: boolean): SceneObject {
    return {
        ...object,
        snapToPaper: enabled,
        transform: enabled
            ? {
                  ...object.transform,
                  position: [object.transform.position[0], object.transform.position[1], 0],
              }
            : object.transform,
    };
}

/** Z and XZ/YZ/free handles can lift a pinned object; XY dragging keeps paper placement. */
export function objectFromGizmo(
    object: SceneObject,
    value: SceneObject['transform'],
    moving: boolean,
    axis: string | null,
): SceneObject | null {
    const offPaper = (z: number) => Math.abs(Math.round(z * 100000)) > 0;
    const movingIn3D =
        moving &&
        (offPaper(object.transform.position[2]) ||
            (Boolean(axis?.includes('Z')) && offPaper(value.position[2])));
    const snapToPaper = object.snapToPaper && !movingIn3D;
    const transform = safeTransform(value, snapToPaper, moving);
    return transform ? { ...object, snapToPaper, transform } : null;
}
