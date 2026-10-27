import * as THREE from 'three';
import type { SceneObject } from '@/shared/contracts/scene.schema';

export function isPlanarObject(spec: SceneObject) {
    return (
        spec.type !== 'model' &&
        spec.type !== 'audio' &&
        !((spec.type === 'text' || spec.type === 'label') && spec.presentation?.kind === 'extruded')
    );
}

/** A flat selection is expressed in its visible plane, including the whole annotation callout. */
export function planarSelectionFrame(spec: SceneObject, content: THREE.Object3D) {
    if (!spec.visible || spec.editorHidden || !isPlanarObject(spec)) return;
    content.updateWorldMatrix(true, true);
    if (
        spec.type === 'label' ||
        (spec.type === 'text' && spec.presentation?.kind === 'annotation')
    ) {
        const bounds = new THREE.Box3();
        const inverse = content.matrixWorld.clone().invert();
        const relative = new THREE.Matrix4();
        const partBounds = new THREE.Box3();
        content.traverseVisible((part) => {
            if (!(part instanceof THREE.Mesh || part instanceof THREE.Line)) return;
            if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
            if (!part.geometry.boundingBox) return;
            relative.multiplyMatrices(inverse, part.matrixWorld);
            partBounds.copy(part.geometry.boundingBox).applyMatrix4(relative);
            bounds.union(partBounds);
        });
        if (bounds.isEmpty()) return;
        // Marker spheres and thick leaders contribute their XY extents without creating a 3D box.
        bounds.min.z = 0;
        bounds.max.z = 0;
        return { bounds, matrix: content.matrixWorld };
    }
    let plane: THREE.Mesh | undefined;
    content.traverse((child) => {
        if (
            !plane &&
            child instanceof THREE.Mesh &&
            child.geometry.type === 'PlaneGeometry' &&
            child.visible
        )
            plane = child;
    });
    if (!plane) return;
    if (!plane.geometry.boundingBox) plane.geometry.computeBoundingBox();
    return plane.geometry.boundingBox
        ? { bounds: plane.geometry.boundingBox, matrix: plane.matrixWorld }
        : undefined;
}

/** Add a small visual gap without changing the object's geometry or saved transform. */
export function paddedSelectionBounds(
    bounds: THREE.Box3,
    matrix: THREE.Matrix4,
    camera: THREE.Camera,
    viewportHeight: number,
    flat: boolean,
    pixels = 3,
) {
    const result = bounds.clone();
    if (result.isEmpty() || viewportHeight <= 0) return result;
    camera.updateMatrixWorld();
    const centre = bounds
        .getCenter(new THREE.Vector3())
        .applyMatrix4(matrix)
        .applyMatrix4(camera.matrixWorldInverse);
    const depth = camera instanceof THREE.PerspectiveCamera ? Math.max(camera.near, -centre.z) : 1;
    const worldPadding =
        (2 * depth * pixels) / (camera.projectionMatrix.elements[5] * viewportHeight);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    const padding = new THREE.Vector3(
        worldPadding / Math.max(scale.x, 1e-9),
        worldPadding / Math.max(scale.y, 1e-9),
        flat ? 0 : worldPadding / Math.max(scale.z, 1e-9),
    );
    result.min.sub(padding);
    result.max.add(padding);
    return result;
}
