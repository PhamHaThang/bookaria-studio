import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ManifestPage } from '@/shared/contracts/manifest.schema';
import { configureSceneOrbit, stopSceneOrbit } from '@/shared/scene/camera-navigation';
import { createPageLighting } from '@/shared/scene/page-lighting';
import type { PageRuntime } from '@/shared/scene-runtime/buildScene';
import { beginDolly, type DollyStart, dragDolly } from '../../scene/model/dolly';

export type PreviewView = {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    minDistance?: number;
    maxDistance?: number;
};

/** Studio host for the same PageRuntime used by the reader, with no authoring controls. */
export class LocalPreviewStage {
    readonly renderer: THREE.WebGLRenderer;
    readonly scene = new THREE.Scene();
    readonly camera = new THREE.PerspectiveCamera(40, 1, 0.005, 10000);
    readonly controls: OrbitControls;
    private ownsRenderer: boolean;
    private lighting = createPageLighting();
    private runtime: PageRuntime | null = null;
    private observer: ResizeObserver;
    private last = 0;
    private active = false;
    private down: {
        x: number;
        y: number;
        id: number;
        button: number;
        moved: boolean;
        tap: boolean;
    } | null = null;
    private spaceHeld = false;
    private zoomDrag: { id: number; y: number; start: DollyStart } | null = null;
    private initial: PreviewView | undefined;
    private aspect = 1.4;
    private container: HTMLElement;
    constructor(container: HTMLElement, view?: PreviewView, renderer?: THREE.WebGLRenderer) {
        this.container = container;
        this.initial = view;
        this.ownsRenderer = !renderer;
        this.renderer = renderer || new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.scene.background = new THREE.Color(
            getComputedStyle(container).getPropertyValue('--editor-ground').trim() || '#f5f5f5',
        );
        const canvas = this.renderer.domElement;
        canvas.setAttribute('aria-label', 'Xem trước trang sách 3D');
        canvas.setAttribute('role', 'img');
        canvas.tabIndex = 0;
        canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
        container.append(canvas);
        // OrbitControls caches the up-axis rotation during construction.
        this.camera.up.fromArray(view?.up || [0, 0, 1]);
        this.controls = new OrbitControls(this.camera, canvas);
        configureSceneOrbit(this.controls);
        this.scene.add(this.lighting.group);
        canvas.addEventListener('pointerdown', this.pointerDown, true);
        canvas.addEventListener('pointermove', this.pointerMove, true);
        canvas.addEventListener('pointerup', this.pointerUp, true);
        canvas.addEventListener('pointercancel', this.pointerCancel);
        canvas.addEventListener('lostpointercapture', this.lostCapture);
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.blur);
        canvas.addEventListener('webglcontextlost', this.contextLost);
        this.observer = new ResizeObserver(this.resize);
        this.observer.observe(container);
        this.resize();
        this.resetView();
    }
    private draw(delta: number) {
        this.controls.update();
        this.runtime?.update(delta, this.camera);
        this.renderer.render(this.scene, this.camera);
    }
    private tick = (time: number) => {
        const delta = this.last ? Math.min(0.1, (time - this.last) / 1000) : 0;
        this.last = time;
        this.draw(delta);
    };
    private resize = () => {
        const width = this.container.clientWidth,
            height = this.container.clientHeight;
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        if (!this.active && this.runtime) this.draw(0);
    };
    private contextLost = (event: Event) => {
        event.preventDefault();
        this.container.dispatchEvent(
            new CustomEvent('preview-error', {
                detail: 'Đồ họa bị gián đoạn. Bấm Thử lại để tải lại bản xem trước.',
            }),
        );
    };
    private restoreNavigation() {
        this.controls.enabled = true;
        this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        this.zoomDrag = null;
        this.renderer.domElement.style.cursor = this.spaceHeld ? 'all-scroll' : '';
    }
    private keyDown = (event: KeyboardEvent) => {
        if (
            event.defaultPrevented ||
            event.code !== 'Space' ||
            event.target !== this.renderer.domElement ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            document.querySelector('[role=dialog], [role=alertdialog], [role=menu]')
        )
            return;
        event.preventDefault();
        this.spaceHeld = true;
        if (!this.down) this.renderer.domElement.style.cursor = 'all-scroll';
    };
    private keyUp = (event: KeyboardEvent) => {
        if (event.code !== 'Space') return;
        this.spaceHeld = false;
        if (!this.down) this.renderer.domElement.style.cursor = '';
    };
    private blur = () => {
        this.spaceHeld = false;
        const pointer = this.down;
        // Let OrbitControls release its native gesture state as well.
        if (pointer)
            this.renderer.domElement.dispatchEvent(
                new PointerEvent('pointercancel', {
                    pointerId: pointer.id,
                    button: pointer.button,
                }),
            );
        else this.restoreNavigation();
    };
    private lostCapture = (event: PointerEvent) => {
        queueMicrotask(() => {
            if (
                this.down?.id === event.pointerId &&
                !this.renderer.domElement.hasPointerCapture(event.pointerId)
            )
                this.blur();
        });
    };
    private pointerDown = (event: PointerEvent) => {
        if (this.down) {
            this.down.tap = false;
            return;
        }
        const canvas = this.renderer.domElement;
        canvas.focus({ preventScroll: true });
        stopSceneOrbit(this.controls);
        const modified = event.shiftKey || event.ctrlKey || event.metaKey;
        this.down = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
            button: event.button,
            moved: false,
            tap: event.button === 0 && !this.spaceHeld && !modified && !event.altKey,
        };
        if (event.button === 1) {
            const rect = canvas.getBoundingClientRect();
            this.zoomDrag = {
                id: event.pointerId,
                y: event.clientY,
                start: beginDolly(
                    this.camera,
                    this.controls.target,
                    new THREE.Vector2(
                        ((event.clientX - rect.left) / rect.width) * 2 - 1,
                        1 - ((event.clientY - rect.top) / rect.height) * 2,
                    ),
                ),
            };
            this.controls.enabled = false;
            canvas.style.cursor = 'ns-resize';
            canvas.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        const pan = event.button === 2 ? !modified : this.spaceHeld;
        // Compensate OrbitControls' modifier inversion, as the editor does for left drag.
        this.controls.mouseButtons.LEFT = pan !== modified ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        canvas.style.cursor = pan ? 'all-scroll' : 'move';
    };
    private pointerMove = (event: PointerEvent) => {
        if (
            this.down?.id === event.pointerId &&
            Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 4
        )
            this.down.moved = true;
        if (this.zoomDrag?.id !== event.pointerId) return;
        dragDolly(
            this.camera,
            this.controls.target,
            this.zoomDrag.start,
            event.clientY - this.zoomDrag.y,
            this.renderer.domElement.clientHeight,
            this.controls.minDistance,
            this.controls.maxDistance,
        );
        this.controls.update();
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    private pointerCancel = () => {
        const pointer = this.down;
        this.down = null;
        this.restoreNavigation();
        if (pointer && this.renderer.domElement.hasPointerCapture(pointer.id))
            this.renderer.domElement.releasePointerCapture(pointer.id);
    };
    private pointerUp = (event: PointerEvent) => {
        const down = this.down;
        if (!down || down.id !== event.pointerId) return;
        const zooming = this.zoomDrag?.id === event.pointerId;
        this.down = null;
        this.restoreNavigation();
        if (zooming) {
            if (this.renderer.domElement.hasPointerCapture(event.pointerId))
                this.renderer.domElement.releasePointerCapture(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (
            !this.active ||
            !this.runtime ||
            !down.tap ||
            down.moved ||
            this.spaceHeld ||
            event.shiftKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4
        )
            return;
        const box = this.renderer.domElement.getBoundingClientRect();
        if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
        )
            return;
        const pointer = new THREE.Vector2(
            ((event.clientX - box.left) / box.width) * 2 - 1,
            (-(event.clientY - box.top) / box.height) * 2 + 1,
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(pointer, this.camera);
        for (const hit of ray.intersectObject(this.runtime.group, true)) {
            let object: THREE.Object3D | null = hit.object,
                id: string | undefined,
                visible = true;
            while (object) {
                visible &&= object.visible;
                if (object.userData.objectId) id = object.userData.objectId;
                object = object.parent;
            }
            if (id && visible) {
                this.runtime.retryMedia();
                this.runtime.tap(id, hit.uv);
                break;
            }
        }
    };
    setRuntime(runtime: PageRuntime | null, page?: ManifestPage) {
        if (this.runtime) this.scene.remove(this.runtime.group);
        this.runtime = runtime;
        this.active = false;
        this.renderer.setAnimationLoop(null);
        if (runtime) this.scene.add(runtime.group);
        if (page) {
            this.aspect = page.aspect;
            this.lighting.setPreset(page.settings.lighting);
        }
        this.resetView();
        if (runtime) this.draw(0);
    }
    start() {
        if (!this.runtime || this.active) return;
        this.active = true;
        this.last = 0;
        this.runtime.start();
        this.renderer.setAnimationLoop(this.tick);
    }
    getView(): PreviewView {
        return {
            position: this.camera.position.toArray(),
            target: this.controls.target.toArray(),
            up: this.camera.up.toArray(),
            minDistance: this.controls.minDistance,
            maxDistance: this.controls.maxDistance,
        };
    }
    resetView() {
        stopSceneOrbit(this.controls);
        this.controls.minDistance = this.initial?.minDistance ?? 0.15;
        this.controls.maxDistance = this.initial?.maxDistance ?? 15;
        if (this.initial) {
            this.camera.up.fromArray(this.initial.up);
            this.camera.position.fromArray(this.initial.position);
            this.controls.target.fromArray(this.initial.target);
        } else {
            const distance =
                (Math.max(this.aspect, 1 / this.camera.aspect) /
                    (2 * Math.tan(THREE.MathUtils.degToRad(20)))) *
                1.25;
            this.camera.position.set(0, -0.25, distance);
            this.controls.target.set(0, 0, 0);
        }
        this.controls.update();
    }
    dispose() {
        this.active = false;
        this.renderer.setAnimationLoop(null);
        this.observer.disconnect();
        const canvas = this.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.pointerDown, true);
        canvas.removeEventListener('pointermove', this.pointerMove, true);
        canvas.removeEventListener('pointerup', this.pointerUp, true);
        canvas.removeEventListener('pointercancel', this.pointerCancel);
        canvas.removeEventListener('lostpointercapture', this.lostCapture);
        window.removeEventListener('keydown', this.keyDown);
        window.removeEventListener('keyup', this.keyUp);
        window.removeEventListener('blur', this.blur);
        this.down = null;
        this.restoreNavigation();
        this.controls.dispose();
        canvas.removeEventListener('webglcontextlost', this.contextLost);
        this.runtime = null;
        this.lighting.group.traverse((o) => {
            if (o instanceof THREE.Light) o.dispose();
        });
        if (this.ownsRenderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
        canvas.remove();
        this.scene.clear();
    }
}
