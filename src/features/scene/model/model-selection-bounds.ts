import {
    Box3,
    type BufferGeometry,
    InstancedMesh,
    InterleavedBufferAttribute,
    Mesh,
    type Object3D,
    SkinnedMesh,
} from 'three';
import { visibleModelBounds } from './preview-fit';

/** Reuse precise visible bounds until geometry, transforms, visibility or animated pose changes. */
export function createModelSelectionBounds(root: Object3D) {
    let previous: unknown[] = [];
    const bounds = new Box3();
    return () => {
        root.updateWorldMatrix(true, true);
        const signature: unknown[] = [];
        root.traverse((node) => {
            signature.push(node, node.visible, ...node.matrixWorld.elements);
            if (!(node instanceof Mesh)) return;
            const geometry: BufferGeometry = node.geometry;
            const attributeVersion = (attribute: typeof geometry.attributes.position) =>
                attribute instanceof InterleavedBufferAttribute
                    ? attribute.data.version
                    : attribute?.version;
            signature.push(
                geometry,
                geometry.index,
                geometry.index?.version,
                geometry.attributes.position,
                attributeVersion(geometry.attributes.position),
                geometry.drawRange.start,
                geometry.drawRange.count,
            );
            for (const group of geometry.groups)
                signature.push(group.start, group.count, group.materialIndex);
            for (const material of Array.isArray(node.material) ? node.material : [node.material])
                signature.push(material, material.visible, material.transparent, material.opacity);
            if (node instanceof InstancedMesh)
                signature.push(node.instanceMatrix, node.instanceMatrix.version, node.count);
            signature.push(...(node.morphTargetInfluences || []));
            for (const attribute of geometry.morphAttributes.position || [])
                signature.push(attribute, attributeVersion(attribute));
            if (node instanceof SkinnedMesh) {
                signature.push(...node.bindMatrix.elements, ...node.bindMatrixInverse.elements);
                for (const bone of node.skeleton.bones) {
                    bone.updateWorldMatrix(true, false);
                    signature.push(...bone.matrixWorld.elements);
                }
            }
        });
        if (
            previous.length !== signature.length ||
            signature.some((value, i) => !Object.is(value, previous[i]))
        ) {
            bounds.copy(visibleModelBounds(root));
            previous = signature;
        }
        return bounds;
    };
}
