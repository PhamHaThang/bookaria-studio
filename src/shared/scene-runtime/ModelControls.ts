import * as THREE from 'three';
import type { ModelControl, SceneObject } from '../contracts/scene.schema';

export type ModelMotion = 'inactive' | 'idle' | 'moving';
type Model = Extract<SceneObject, { type: 'model' }>;
type Entry = {
    spec: Model;
    root: THREE.Object3D;
    config: ModelControl;
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    forwardAngle: number;
    enabled: boolean;
    touched: boolean;
    motion: ModelMotion;
};
const defaults: ModelControl = {
    enabled: false,
    speed: 0.3,
    bounds: 'page',
    autoRotate: true,
    forwardAxis: '+z',
};
const bindings: Record<string, readonly [number, number]> = {
    KeyW: [0, 1],
    ArrowUp: [0, 1],
    KeyS: [0, -1],
    ArrowDown: [0, -1],
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
};

/** Shared reader input drives every enabled model without mutating authored specifications. */
export class ModelControls {
    readonly entries = new Map<string, Entry>();
    private running = false;
    private paused = false;
    private keys = new Set<string>();
    private axis = new THREE.Vector2();
    private movement = new THREE.Vector2();
    private heading = new THREE.Quaternion();
    private targetRotation = new THREE.Quaternion();
    private readonly up = new THREE.Vector3(0, 0, 1);
    private panel?: HTMLDivElement;
    private pad?: HTMLDivElement;
    private knob?: HTMLSpanElement;
    private keyboardTarget?: HTMLElement;
    private pointer: number | null = null;
    private lastVisible = false;
    private aspect: number;
    private busy: (id: string) => boolean;
    private onMotion: (id: string, motion: ModelMotion) => void;
    constructor(
        nodes: ReadonlyMap<string, { spec: SceneObject; root: THREE.Object3D }>,
        aspect: number,
        busy: (id: string) => boolean = () => false,
        onMotion: (id: string, motion: ModelMotion) => void = () => {},
    ) {
        this.aspect = aspect;
        this.busy = busy;
        this.onMotion = onMotion;
        for (const [id, node] of nodes) {
            if (node.spec.type !== 'model') continue;
            const config = { ...defaults, ...node.spec.controls };
            const axes = {
                '+x': [1, 0, 0],
                '-x': [-1, 0, 0],
                '+y': [0, 1, 0],
                '-y': [0, -1, 0],
                '+z': [0, 0, 1],
                '-z': [0, 0, -1],
            };
            const forward = new THREE.Vector3()
                .fromArray(axes[config.forwardAxis])
                .applyQuaternion(node.root.quaternion);
            // A vertically pointing axis has no heading on the page; use the model's local Y.
            if (Math.hypot(forward.x, forward.y) < 1e-5)
                forward.set(0, 1, 0).applyQuaternion(node.root.quaternion);
            this.entries.set(id, {
                spec: node.spec,
                root: node.root,
                config,
                position: node.root.position.clone(),
                rotation: node.root.quaternion.clone(),
                forwardAngle: Math.atan2(forward.y, forward.x),
                enabled: config.enabled,
                touched: false,
                motion: 'inactive',
            });
        }
        this.refresh();
    }
    private setMotion(id: string, motion: ModelMotion) {
        const entry = this.entries.get(id);
        if (!entry || entry.motion === motion) return;
        entry.motion = motion;
        this.onMotion(id, motion);
    }
    private idle() {
        for (const [id, entry] of this.entries)
            this.setMotion(id, this.running && entry.enabled ? 'idle' : 'inactive');
    }
    private hasControllable() {
        for (const [id, entry] of this.entries)
            if (entry.enabled && this.visible(entry) && !this.busy(id)) return true;
        return false;
    }
    command(id: string, operation: 'enable' | 'disable' | 'reset') {
        const entry = this.entries.get(id);
        if (!entry) throw new Error('Chọn mô hình 3D cần điều khiển.');
        entry.touched = true;
        if (operation === 'reset') {
            entry.root.position.copy(entry.position);
            entry.root.quaternion.copy(entry.rotation);
        } else {
            entry.enabled = operation === 'enable';
            if (entry.enabled) this.running = true;
        }
        this.setMotion(id, this.running && entry.enabled ? 'idle' : 'inactive');
        if (!this.hasControllable()) this.clearInput();
        this.refresh();
    }
    activate() {
        this.running = true;
        this.idle();
        this.refresh();
    }
    start() {
        for (const entry of this.entries.values()) {
            if (entry.touched || entry.spec.controls) {
                entry.root.position.copy(entry.position);
                entry.root.quaternion.copy(entry.rotation);
            }
            entry.enabled = entry.config.enabled;
        }
        this.running = true;
        this.paused = false;
        this.clearInput();
        this.refresh();
    }
    pause(value: boolean) {
        this.paused = value;
        this.clearInput();
        this.refresh();
    }
    private visible(entry: Entry) {
        for (let node: THREE.Object3D | null = entry.root; node; node = node.parent)
            if (!node.visible) return false;
        return true;
    }
    private blocked() {
        if (typeof document === 'undefined') return false;
        return (
            document.hidden ||
            Boolean(
                document.querySelector(
                    'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"], [role="menu"], details#reader-menu[open]',
                ) ||
                    (document.activeElement instanceof HTMLElement &&
                        document.activeElement.closest(
                            'input,textarea,select,[contenteditable="true"],[role="textbox"]',
                        )),
            )
        );
    }
    setMove(x: number, y: number) {
        this.axis.set(x, y).clampLength(0, 1);
        if (this.knob)
            this.knob.style.transform = `translate(${this.axis.x * 28}px, ${-this.axis.y * 28}px)`;
    }
    update(delta: number) {
        const visible = this.running && !this.paused && this.hasControllable();
        if (this.panel && visible !== this.lastVisible) {
            this.panel.hidden = !visible;
            this.lastVisible = visible;
        }
        if (!visible || this.blocked()) {
            this.clearInput();
            return;
        }
        this.movement.copy(this.axis);
        for (const key of this.keys) {
            const vector = bindings[key];
            if (vector) {
                this.movement.x += vector[0];
                this.movement.y += vector[1];
            }
        }
        this.movement.clampLength(0, 1);
        for (const [id, entry] of this.entries) {
            if (
                !entry.enabled ||
                !this.visible(entry) ||
                this.busy(id) ||
                !this.movement.lengthSq()
            ) {
                this.setMotion(id, entry.enabled ? 'idle' : 'inactive');
                continue;
            }
            this.moveModel(id, entry, delta);
        }
    }
    private moveModel(id: string, entry: Entry, delta: number) {
        const distance = entry.config.speed * Math.max(0, Math.min(delta, 0.05));
        const previousX = entry.root.position.x,
            previousY = entry.root.position.y;
        entry.root.position.x += this.movement.x * distance;
        entry.root.position.y += this.movement.y * distance;
        if (entry.config.bounds === 'page') {
            entry.root.position.x = THREE.MathUtils.clamp(entry.root.position.x, -0.5, 0.5);
            const halfHeight = this.aspect / 2;
            entry.root.position.y = THREE.MathUtils.clamp(
                entry.root.position.y,
                -halfHeight,
                halfHeight,
            );
        }
        const movedX = entry.root.position.x - previousX,
            movedY = entry.root.position.y - previousY;
        this.setMotion(id, Math.hypot(movedX, movedY) > 1e-10 ? 'moving' : 'idle');
        if (
            entry.config.autoRotate &&
            !entry.spec.billboard &&
            Math.hypot(movedX, movedY) > 1e-10
        ) {
            this.heading.setFromAxisAngle(this.up, Math.atan2(movedY, movedX) - entry.forwardAngle);
            this.targetRotation.copy(entry.rotation).premultiply(this.heading);
            // Take the shortest turn, without changing the model's authored tilt or roll.
            entry.root.quaternion.rotateTowards(
                this.targetRotation,
                12 * Math.max(0, Math.min(delta, 0.05)),
            );
        }
        entry.touched = true;
    }
    private clearInput = () => {
        this.keys.clear();
        this.setMove(0, 0);
        this.idle();
        if (this.pointer !== null) {
            const pointer = this.pointer;
            this.pointer = null;
            if (this.pad?.hasPointerCapture(pointer)) this.pad.releasePointerCapture(pointer);
        }
    };
    private keyDown = (event: KeyboardEvent) => {
        if (
            !bindings[event.code] ||
            !this.running ||
            this.paused ||
            !this.hasControllable() ||
            this.blocked() ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        )
            return;
        if (
            this.keyboardTarget &&
            event.target !== this.keyboardTarget &&
            !(event.target === document.body && this.keyboardTarget.matches(':hover')) &&
            !(event.target instanceof Node && this.panel?.contains(event.target))
        )
            return;
        event.preventDefault();
        event.stopPropagation();
        this.keys.add(event.code);
    };
    private keyUp = (event: KeyboardEvent) => {
        this.keys.delete(event.code);
    };
    private focusChange = () => {
        if (this.blocked()) this.clearInput();
    };
    private movePointer = (event: PointerEvent) => {
        if (this.pointer !== event.pointerId || !this.pad) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = this.pad.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) / 32;
        const y = -(event.clientY - rect.top - rect.height / 2) / 32;
        const magnitude = Math.min(1, Math.hypot(x, y));
        if (magnitude <= 0.12) this.setMove(0, 0);
        else {
            const scale = (magnitude - 0.12) / 0.88 / Math.hypot(x, y);
            this.setMove(x * scale, y * scale);
        }
    };
    private endPointer = (event: PointerEvent) => {
        if (this.pointer !== event.pointerId) return;
        this.pointer = null;
        this.setMove(0, 0);
        if (this.pad?.hasPointerCapture(event.pointerId))
            this.pad.releasePointerCapture(event.pointerId);
    };
    attach(host: HTMLElement, keyboardTarget: HTMLElement) {
        this.detach();
        this.keyboardTarget = keyboardTarget;
        const pad = document.createElement('div');
        pad.dataset.modelControls = '';
        pad.hidden = true;
        pad.tabIndex = 0;
        pad.setAttribute('role', 'group');
        pad.setAttribute('aria-label', 'Joystick di chuyển mô hình');
        pad.className =
            'absolute bottom-[var(--reader-bottom-inset,max(12px,env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-10 hidden size-24 touch-none select-none place-items-center rounded-full border border-border bg-hover pointer-coarse:grid';
        const knob = document.createElement('span');
        knob.className = 'pointer-events-none block size-9 rounded-full bg-primary';
        pad.append(knob);
        pad.onpointerdown = (event) => {
            if (this.pointer !== null || this.blocked()) return;
            event.preventDefault();
            event.stopPropagation();
            this.pointer = event.pointerId;
            pad.setPointerCapture(event.pointerId);
            this.movePointer(event);
        };
        pad.onpointermove = this.movePointer;
        pad.onpointerup = this.endPointer;
        pad.onpointercancel = this.endPointer;
        pad.onlostpointercapture = this.endPointer;
        host.append(pad);
        this.panel = pad;
        this.pad = pad;
        this.knob = knob;
        window.addEventListener('keydown', this.keyDown, true);
        window.addEventListener('keyup', this.keyUp, true);
        window.addEventListener('blur', this.clearInput);
        document.addEventListener('focusin', this.focusChange);
        document.addEventListener('visibilitychange', this.clearInput);
        this.refresh();
    }
    private refresh() {
        if (!this.panel) return;
        this.lastVisible = this.running && !this.paused && this.hasControllable();
        this.panel.hidden = !this.lastVisible;
    }
    private detach() {
        this.clearInput();
        this.pointer = null;
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.keyDown, true);
            window.removeEventListener('keyup', this.keyUp, true);
            window.removeEventListener('blur', this.clearInput);
            document.removeEventListener('focusin', this.focusChange);
            document.removeEventListener('visibilitychange', this.clearInput);
        }
        this.panel?.remove();
        this.panel = undefined;
        this.pad = undefined;
        this.knob = undefined;
    }
    dispose() {
        this.running = false;
        this.detach();
    }
}
