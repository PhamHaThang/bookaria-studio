import {
    Box3,
    Group,
    InstancedMesh,
    MathUtils,
    Matrix4,
    Mesh,
    type Object3D,
    type PerspectiveCamera,
    SkinnedMesh,
    Vector3,
} from 'three';

/** Read rendered vertices, not accessor min/max or cached bind-pose bounds. */
export function visibleModelBounds(root: Object3D) {
    root.updateWorldMatrix(true, false);
    root.updateMatrixWorld(true);
    const result = new Box3(),
        vertex = new Vector3(),
        instance = new Matrix4();
    root.traverseVisible((node) => {
        if (!(node instanceof Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        if (materials.every((material) => !material.visible)) return;
        if (node instanceof SkinnedMesh) {
            for (const bone of node.skeleton.bones) bone.updateWorldMatrix(true, false);
            node.skeleton.update();
        }
        const positions = node.geometry.getAttribute('position');
        if (!positions) return;
        const count = node instanceof InstancedMesh ? node.count : 1;
        for (let i = 0; i < count; i++) {
            if (node instanceof InstancedMesh) node.getMatrixAt(i, instance);
            for (let v = 0; v < positions.count; v++) {
                node.getVertexPosition(v, vertex);
                if (node instanceof InstancedMesh) vertex.applyMatrix4(instance);
                vertex.applyMatrix4(node.matrixWorld);
                if (
                    !Number.isFinite(vertex.x) ||
                    !Number.isFinite(vertex.y) ||
                    !Number.isFinite(vertex.z)
                )
                    throw new Error('Mô hình chứa tọa độ không hợp lệ.');
                result.expandByPoint(vertex);
            }
        }
    });
    return result;
}

export type PreviewPlacement = { scale: number; x: number; y: number; z: number };
export function applyPreviewPlacement(
    wrapper: Group,
    base: { scale: number; position: Vector3 },
    placement: PreviewPlacement,
) {
    if (
        ![placement.scale, placement.x, placement.y, placement.z].every(Number.isFinite) ||
        placement.scale < 0.01 ||
        placement.scale > 10
    )
        throw new Error('Tỉ lệ phải từ 1% đến 1000% và vị trí phải là số hữu hạn.');
    wrapper.scale.setScalar(base.scale * placement.scale);
    wrapper.position
        .copy(base.position)
        .multiplyScalar(placement.scale)
        .add(new Vector3(placement.x, placement.y, placement.z));
    wrapper.updateMatrixWorld(true);
}

export function normalizePreviewModel(root: Object3D) {
    root.traverse((node) => {
        if (node instanceof Mesh) {
            // Preview geometry can have stale exporter bounds; avoid renderer culling it away.
            node.geometry.computeBoundingBox();
            node.geometry.computeBoundingSphere();
            node.frustumCulled = false;
        }
    });
    const box = visibleModelBounds(root),
        size = box.getSize(new Vector3()),
        center = box.getCenter(new Vector3());
    const extent = Math.max(size.x, size.y, size.z);
    if (
        box.isEmpty() ||
        ![...size.toArray(), ...center.toArray()].every(Number.isFinite) ||
        extent <= 0
    )
        throw new Error('Mô hình không có hình học hợp lệ để xem trước.');
    const wrapper = new Group(),
        centered = new Group();
    centered.position.copy(center).negate();
    centered.add(root);
    wrapper.add(centered);
    wrapper.scale.setScalar(1.2 / extent);
    wrapper.position.y = (size.y / extent) * 0.6;
    wrapper.updateMatrixWorld(true);
    return wrapper;
}

/** Fit all eight world-space corners; horizontal FOV matters in narrow preview panes. */
export function fitPreviewCamera(
    bounds: Box3,
    camera: PerspectiveCamera,
    direction = new Vector3(1, 0.65, 1),
    padding = 1.45,
) {
    if (bounds.isEmpty()) throw new Error('Không xác định được giới hạn mô hình.');
    const target = bounds.getCenter(new Vector3()),
        size = bounds.getSize(new Vector3()),
        radius = size.length() / 2;
    if (
        ![...target.toArray(), radius, camera.aspect, camera.fov].every(Number.isFinite) ||
        radius <= 0 ||
        camera.aspect <= 0 ||
        camera.fov <= 0 ||
        camera.fov >= 180
    )
        throw new Error('Kích thước khung xem hoặc mô hình không hợp lệ.');
    const axis = direction.clone().normalize();
    if (!axis.lengthSq()) axis.set(1, 0.65, 1).normalize();
    // OrbitControls caches Y-up at construction; keep that basis near the poles.
    if (Math.abs(axis.y) > 0.999) {
        axis.z = 0.045;
        axis.normalize();
    }
    const upHint = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(upHint, axis).normalize(),
        up = new Vector3().crossVectors(axis, right).normalize();
    const tanY = Math.tan(MathUtils.degToRad(camera.fov / 2)) / camera.zoom,
        tanX = tanY * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
            for (const z of [bounds.min.z, bounds.max.z]) {
                const v = new Vector3(x, y, z).sub(target),
                    depth = v.dot(axis);
                distance = Math.max(
                    distance,
                    depth + (Math.abs(v.dot(right)) * padding) / tanX,
                    depth + (Math.abs(v.dot(up)) * padding) / tanY,
                );
            }
    distance = Math.max(distance, radius * 1.05);
    camera.up.copy(upHint);
    camera.position.copy(target).addScaledVector(axis, distance);
    camera.lookAt(target);
    camera.near = Math.max(radius / 1000, 0.000001);
    camera.far = Math.max(distance + radius * 50, camera.near * 100);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return { target, distance, radius };
}
