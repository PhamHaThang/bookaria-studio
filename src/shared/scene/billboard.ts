import * as THREE from 'three';

/** Face the camera without overwriting the authored transform or an AR anchor. */
export function createBillboard(root: THREE.Object3D) {
    const content = new THREE.Group();
    content.name = 'camera-facing-content';
    content.matrixAutoUpdate = false;
    root.add(content);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const world = new THREE.Matrix4();
    let facing = false;
    let overlay = false;
    let lastChild: THREE.Object3D | undefined;
    const depths = new WeakMap<THREE.Material, { test: boolean; write: boolean }>();
    const orders = new WeakMap<THREE.Object3D, number>();
    const updateOverlay = (enabled: boolean) => {
        const child = content.children[0];
        if (overlay === enabled && lastChild === child) return;
        overlay = enabled;
        lastChild = child;
        content.traverse((object) => {
            if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
            if (!orders.has(object)) orders.set(object, object.renderOrder);
            object.renderOrder = enabled ? 100 : (orders.get(object) ?? 0);
            for (const material of Array.isArray(object.material)
                ? object.material
                : [object.material]) {
                if (!depths.has(material))
                    depths.set(material, { test: material.depthTest, write: material.depthWrite });
                const original = depths.get(material);
                if (!original) continue;
                material.depthTest = enabled ? false : original.test;
                material.depthWrite = enabled ? false : original.write;
            }
        });
    };
    return {
        content,
        /** Capture displayed orientation in the authored object's parent coordinates. */
        getDisplayedRotation(): [number, number, number] {
            const rotation = content.getWorldQuaternion(new THREE.Quaternion());
            if (root.parent)
                rotation.premultiply(
                    root.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),
                );
            const euler = new THREE.Euler().setFromQuaternion(rotation, 'XYZ');
            return [euler.x, euler.y, euler.z].map(THREE.MathUtils.radToDeg) as [
                number,
                number,
                number,
            ];
        },
        update(camera: THREE.Camera, enabled: boolean, textOverlay = false) {
            // Text legibility is independent of whether its orientation follows the camera.
            updateOverlay(textOverlay);
            if (!enabled) {
                if (!facing) return;
                content.matrix.identity();
            } else {
                root.updateWorldMatrix(true, false);
                root.getWorldPosition(position);
                root.getWorldScale(scale);
                // Parallel to the screen: pan and off-centre placement must not tilt readable cards.
                camera.getWorldQuaternion(orientation);
                world.compose(position, orientation, scale);
                // Matrix compensation also handles rotated, nonuniformly scaled parents.
                content.matrix.copy(root.matrixWorld).invert().multiply(world);
            }
            facing = enabled;
            content.matrixWorldNeedsUpdate = true;
            content.updateWorldMatrix(true, true);
        },
    };
}
