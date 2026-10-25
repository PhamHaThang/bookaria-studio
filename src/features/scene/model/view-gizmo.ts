import { type PerspectiveCamera, Quaternion, Spherical, Vector3 } from 'three';

export const VIEW_AXES = [
    {
        id: '+x',
        text: 'X',
        label: 'Nhìn từ bên phải (+X)',
        vector: [1, 0, 0],
        color: 'var(--view-axis-x)',
    },
    {
        id: '-x',
        text: '−X',
        label: 'Nhìn từ bên trái (−X)',
        vector: [-1, 0, 0],
        color: 'var(--view-axis-x)',
    },
    {
        id: '+y',
        text: 'Y',
        label: 'Nhìn từ mép trên trang (+Y)',
        vector: [0, 1, 0],
        color: 'var(--view-axis-y)',
    },
    {
        id: '-y',
        text: '−Y',
        label: 'Nhìn từ mép dưới trang (−Y)',
        vector: [0, -1, 0],
        color: 'var(--view-axis-y)',
    },
    {
        id: '+z',
        text: 'Z',
        label: 'Nhìn vào mặt trang (+Z)',
        vector: [0, 0, 1],
        color: 'var(--view-axis-z)',
    },
    {
        id: '-z',
        text: '−Z',
        label: 'Nhìn từ sau trang (−Z)',
        vector: [0, 0, -1],
        color: 'var(--view-axis-z)',
    },
] as const;

export type ViewAxis = (typeof VIEW_AXES)[number]['id'];
export type ViewGizmoController = {
    begin: () => boolean;
    rotate: (dx: number, dy: number) => void;
    axis: (axis: ViewAxis) => void;
    end: () => void;
};

/** Camera navigation only: retain the current pan target and distance to it. */
export function setAxisView(camera: PerspectiveCamera, target: Vector3, axis: ViewAxis) {
    const direction = VIEW_AXES.find((item) => item.id === axis);
    if (!direction) return;
    const distance = camera.position.distanceTo(target);
    const offset = new Vector3(...direction.vector);
    // OrbitControls uses Y-up and cannot look exactly along its polar axis.
    if (Math.abs(offset.y) === 1) offset.z = 0.000001;
    camera.position.copy(target).addScaledVector(offset.normalize(), distance);
    camera.lookAt(target);
    camera.updateMatrixWorld();
}

export function rotateSceneView(
    camera: PerspectiveCamera,
    target: Vector3,
    dx: number,
    dy: number,
    minPolarAngle = 0,
    maxPolarAngle = Math.PI,
) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const offset = camera.position.clone().sub(target);
    const spherical = new Spherical().setFromVector3(offset);
    spherical.theta -= dx * 0.012;
    spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi - dy * 0.012));
    spherical.makeSafe();
    camera.position.copy(target).add(offset.setFromSpherical(spherical));
    camera.lookAt(target);
    camera.updateMatrixWorld();
}

/** Project the six world axes into a small DOM overlay; no second WebGL renderer. */
export function createViewGizmoProjection(host: HTMLElement, camera: PerspectiveCamera) {
    const inverse = new Quaternion();
    const last = new Quaternion();
    let ready = false;
    const handles = VIEW_AXES.map((axis) => ({
        axis,
        vector: new Vector3(...axis.vector),
        button: host.querySelector<HTMLButtonElement>(`[data-view-axis="${axis.id}"]`),
        line: host.querySelector<SVGLineElement>(`[data-view-line="${axis.id}"]`),
    }));
    return {
        update() {
            if (ready && last.angleTo(camera.quaternion) < 0.000001) return;
            last.copy(camera.quaternion);
            inverse.copy(camera.quaternion).invert();
            for (const { axis, vector, button, line } of handles) {
                vector.set(axis.vector[0], axis.vector[1], axis.vector[2]).applyQuaternion(inverse);
                const x = 64 + vector.x * 40;
                const y = 64 - vector.y * 40;
                if (button) {
                    button.style.transform = `translate(${x - 12}px, ${y - 12}px)`;
                    button.style.zIndex = String(Math.round((vector.z + 1) * 10));
                }
                line?.setAttribute('x2', String(x));
                line?.setAttribute('y2', String(y));
            }
            host.dataset.ready = 'true';
            ready = true;
        },
        dispose() {
            host.dataset.ready = 'false';
        },
    };
}
