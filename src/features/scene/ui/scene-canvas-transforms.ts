import type { RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    TransformControls,
    TransformControlsGizmo,
} from 'three/addons/controls/TransformControls.js';
import type { Scene, SceneObject } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import { beginLocalDepthDrag, type LocalDepthDrag, localDepthPosition } from '../model/local-depth';
import { scaleConstraint, scaleFromGesture } from '../model/scale-gesture';
import { isPlanarObject } from '../model/selection-frame';
import { transformSelection } from '../model/selection-transform';
import { type SnapSteps, transformSnapSteps } from '../model/snap';
import { objectFromGizmo } from '../model/transforms';
import { applyTransform, type SceneCanvasNode } from './scene-canvas-nodes';

export function createSceneCanvasControls(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    themeColor: (token: string) => THREE.Color,
) {
    const controls = new TransformControls(camera, canvas);
    controls.setSize(1);
    // r161 bakes handle positions into geometry. Remove negative caps and their
    // pickers together so the hidden side cannot still capture pointer input.
    for (const gizmo of controls.children) {
        if (!(gizmo instanceof TransformControlsGizmo)) continue;
        for (const mode of ['translate', 'scale'] as const) {
            for (const group of [gizmo.gizmo[mode], gizmo.picker[mode]]) {
                for (const handle of [...group.children]) {
                    const axis = ['X', 'Y', 'Z'].indexOf(handle.name);
                    if (axis < 0 || !(handle instanceof THREE.Mesh)) continue;
                    handle.geometry.computeBoundingBox();
                    const bounds = handle.geometry.boundingBox;
                    if (
                        bounds &&
                        bounds.min.getComponent(axis) + bounds.max.getComponent(axis) < -1e-6
                    ) {
                        group.remove(handle);
                        handle.geometry.dispose();
                    }
                }
            }
        }
    }
    // Keep drag guides legible over the light page and editor grid.
    controls.traverse((node) => {
        if (!('tag' in node) || node.tag !== 'helper') return;
        if (!(node instanceof THREE.Line || node instanceof THREE.Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
            if (!(material instanceof THREE.LineBasicMaterial)) continue;
            const axis = ['X', 'Y', 'Z'].includes(node.name) ? node.name.toLowerCase() : 'z';
            material.color.copy(themeColor(`--editor-axis-${axis}`));
            material.opacity = 0.85;
        }
    });
    return controls;
}

type TransformOptions = {
    canvas: HTMLCanvasElement;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    controls: TransformControls;
    settings: { snap: boolean; steps: SnapSteps };
    start: THREE.Vector2;
    latest: RefObject<{
        scene: Scene;
        disabled: boolean;
        onChange: (objects: SceneObject[]) => void;
        onBegin: () => void;
        onEnd: () => void;
    }>;
    nodes: ReadonlyMap<string, SceneCanvasNode>;
    selectionPivot: THREE.Group;
    billboardPivot: THREE.Group;
    depthButton: HTMLButtonElement | null;
    depthLink: Element | null | undefined;
    selectedNodes: () => SceneCanvasNode[];
    stopOrbitMomentum: () => void;
    isDragging: () => boolean;
    setDragging: (active: boolean) => void;
    setTransforming: (active: boolean) => void;
};

export function bindSceneCanvasTransforms({
    canvas,
    camera,
    orbit,
    controls,
    settings,
    start,
    latest,
    nodes,
    selectionPivot,
    billboardPivot,
    depthButton,
    depthLink,
    selectedNodes,
    stopOrbitMomentum,
    isDragging,
    setDragging,
    setTransforming,
}: TransformOptions) {
    let shiftHeld = false;
    // These runtime fields are public in installed r161 but absent from its declaration file.
    const scaleControls = controls as TransformControls & {
        pointStart: THREE.Vector3;
        pointEnd: THREE.Vector3;
        worldQuaternionStart: THREE.Quaternion;
    };
    let transformDrag: {
        objects: SceneObject[];
        inverse: THREE.Matrix4;
        group: boolean;
        scale?: {
            initial: [number, number, number];
            start: THREE.Vector3;
            inverseRotation: THREE.Quaternion;
            axis: string;
            planar: boolean;
            pointer: THREE.Vector2;
            currentPointer: THREE.Vector2;
            moved: boolean;
        };
    } | null = null;
    let depthDrag: {
        id?: number;
        x: number;
        y: number;
        direction: THREE.Vector2;
        pointerSign: 1 | -1;
        start: LocalDepthDrag;
    } | null = null;
    function applySnapping() {
        const enabled = settings.snap || (shiftHeld && controls.mode !== 'scale');
        const steps = transformSnapSteps(settings.steps);
        controls.setTranslationSnap(enabled ? steps.translation : null);
        controls.setRotationSnap(enabled ? steps.rotation : null);
        // Scale snapping is applied to a shared relative factor, preserving existing proportions.
        controls.setScaleSnap(null);
    }
    const changed = () => {
        const root = controls.object;
        if (!root || latest.current.disabled) return;
        const scaling = transformDrag?.scale;
        if (controls.mode === 'scale' && scaling) {
            const end = scaleControls.pointEnd.clone().applyQuaternion(scaling.inverseRotation);
            const fallback = Math.exp(
                (scaling.currentPointer.x -
                    scaling.pointer.x -
                    (scaling.currentPointer.y - scaling.pointer.y)) /
                    160,
            );
            root.scale.fromArray(
                scaling.moved
                    ? scaleFromGesture(
                          scaling.initial,
                          scaling.start.toArray(),
                          end.toArray(),
                          scaling.axis,
                          scaling.planar,
                          shiftHeld,
                          settings.snap ? transformSnapSteps(settings.steps).scale : null,
                          fallback,
                      )
                    : scaling.initial,
            );
        }
        if (transformDrag?.group) {
            if (controls.mode === 'scale') {
                const minimum = Math.min(
                    1,
                    Math.max(
                        ...transformDrag.objects.flatMap((object) =>
                            object.transform.scale.map((value) => 0.001 / value),
                        ),
                    ),
                );
                selectionPivot.scale.setScalar(Math.max(minimum, selectionPivot.scale.x));
            }
            selectionPivot.updateMatrixWorld(true);
            const delta = selectionPivot.matrixWorld.clone().multiply(transformDrag.inverse);
            const next = transformSelection(
                transformDrag.objects,
                delta,
                controls.mode === 'translate',
                controls.axis,
                controls.mode === 'scale',
            );
            if (!next) return;
            for (const object of next) {
                const node = nodes.get(object.id);
                if (node) applyTransform(node, object);
            }
            latest.current.onChange(next);
            return;
        }
        const spec = latest.current.scene.objects.find(
            (object) => object.id === root.userData.objectId,
        );
        if (!spec || spec.locked) return;
        const next = objectFromGizmo(
            spec,
            {
                position: root.position.toArray(),
                rotation:
                    root === billboardPivot
                        ? spec.transform.rotation
                        : ([root.rotation.x, root.rotation.y, root.rotation.z].map(
                              THREE.MathUtils.radToDeg,
                          ) as [number, number, number]),
                scale: root.scale.toArray(),
            },
            controls.mode === 'translate',
            controls.axis,
            controls.space,
            controls.mode === 'scale',
        );
        if (next) {
            if (root === billboardPivot) {
                const node = nodes.get(spec.id);
                if (node) applyTransform(node, next);
            }
            latest.current.onChange([next]);
        }
    };
    function finishTransform(cancelled = false) {
        if (!isDragging()) return false;
        if (cancelled && transformDrag) {
            for (const object of transformDrag.objects) {
                const node = nodes.get(object.id);
                if (node) applyTransform(node, object);
            }
            latest.current.onChange(transformDrag.objects);
        } else changed();
        setDragging(false);
        setTransforming(false);
        controls.dragging = false;
        transformDrag = null;
        latest.current.onEnd();
        orbit.enabled = true;
        if (depthDrag) {
            const id = depthDrag.id;
            depthDrag = null;
            controls.enabled = true;
            controls.axis = null;
            if (id !== undefined && depthButton?.hasPointerCapture(id))
                depthButton.releasePointerCapture(id);
        }
        return true;
    }
    controls.addEventListener('objectChange', changed);
    controls.addEventListener('mouseDown', () => {
        const root = controls.object;
        if (!root || latest.current.disabled) return;
        const group = root === selectionPivot;
        root.updateMatrixWorld(true);
        transformDrag = {
            objects: structuredClone(selectedNodes().map((node) => node.spec)),
            inverse: root.matrixWorld.clone().invert(),
            group,
        };
        if (group && controls.mode === 'scale') controls.axis = 'XYZ';
        if (controls.mode === 'scale' && controls.axis) {
            const inverseRotation = scaleControls.worldQuaternionStart.clone().invert();
            const chosen = selectedNodes();
            transformDrag.scale = {
                initial: root.scale.toArray(),
                start: scaleControls.pointStart.clone().applyQuaternion(inverseRotation),
                inverseRotation,
                axis: controls.axis,
                planar: !group && chosen.length === 1 && isPlanarObject(chosen[0].spec),
                pointer: start.clone(),
                currentPointer: start.clone(),
                moved: false,
            };
        }
        stopOrbitMomentum();
        setDragging(true);
        setTransforming(true);
        latest.current.onBegin();
        orbit.enabled = false;
    });
    controls.addEventListener('mouseUp', () => finishTransform());
    function setShift(active: boolean) {
        const scaling = transformDrag?.scale;
        if (
            scaling &&
            controls.object &&
            shiftHeld !== active &&
            scaleConstraint(scaling.axis, scaling.planar, shiftHeld) !==
                scaleConstraint(scaling.axis, scaling.planar, active)
        ) {
            // Rebase at the currently displayed size; pressing/releasing Shift must not jump.
            scaling.initial = controls.object.scale.toArray();
            if (scaling.moved)
                scaling.start.copy(scaleControls.pointEnd).applyQuaternion(scaling.inverseRotation);
            scaling.pointer.copy(scaling.currentPointer);
            scaling.moved = false;
        }
        shiftHeld = active;
        applySnapping();
    }
    function canUseDepth() {
        const selected = selectedNodes();
        return (
            controls.object === billboardPivot &&
            controls.mode === 'translate' &&
            controls.space === 'local' &&
            selected.length === 1 &&
            selected[0].status === 'ready' &&
            facesCamera(selected[0].spec) &&
            !selected[0].spec.locked &&
            selected[0].root.visible &&
            !latest.current.disabled
        );
    }
    function beginDepth(x: number, y: number, id?: number) {
        if (isDragging() || !canUseDepth()) return false;
        const start = beginLocalDepthDrag(camera, billboardPivot, canvas.clientHeight);
        if (!start) return false;
        stopOrbitMomentum();
        transformDrag = {
            objects: structuredClone(selectedNodes().map((node) => node.spec)),
            inverse: billboardPivot.matrixWorld.clone().invert(),
            group: false,
        };
        // Constrain the pointer to the displayed Z arm, using a fixed direction
        // for this gesture even while the card and handle move on screen.
        const direction = new THREE.Vector2(
            20 - Number(depthLink?.getAttribute('x1') ?? 56),
            20 - Number(depthLink?.getAttribute('y1') ?? -16),
        );
        if (direction.lengthSq() < 1e-6) direction.set(-1, 1);
        direction.normalize();
        // Local +Z can project opposite the virtual arm after camera pan.
        // Choose the sign once so the object moves with the pointer on screen.
        const from = start.position.clone().project(camera);
        const to = start.position
            .clone()
            .addScaledVector(start.axis, start.distance * 0.1)
            .project(camera);
        const projectedZ = new THREE.Vector2(
            (to.x - from.x) * canvas.clientWidth,
            -(to.y - from.y) * canvas.clientHeight,
        );
        const pointerSign = projectedZ.dot(direction) > 1e-6 ? -1 : 1;
        depthDrag = { id, x, y, direction, pointerSign, start };
        controls.axis = 'Z';
        controls.enabled = false;
        controls.dragging = true;
        setDragging(true);
        orbit.enabled = false;
        setTransforming(true);
        latest.current.onBegin();
        return true;
    }
    function moveDepth(delta: number, shift: boolean) {
        if (!depthDrag) return;
        const position = localDepthPosition(
            depthDrag.start,
            delta,
            settings.snap || shift ? settings.steps.translation : 0,
        );
        if (!position) return;
        billboardPivot.position.copy(position);
        billboardPivot.updateMatrixWorld(true);
        changed();
    }
    const depthDown = (event: PointerEvent) => {
        if (event.button !== 0 || !beginDepth(event.clientX, event.clientY, event.pointerId))
            return;
        event.preventDefault();
        event.stopPropagation();
        depthButton?.focus({ preventScroll: true });
        depthButton?.setPointerCapture(event.pointerId);
    };
    const depthMove = (event: PointerEvent) => {
        if (depthDrag?.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const alongAxis =
            (event.clientX - depthDrag.x) * depthDrag.direction.x +
            (event.clientY - depthDrag.y) * depthDrag.direction.y;
        moveDepth(alongAxis * depthDrag.pointerSign, event.shiftKey);
    };
    const depthUp = (event: PointerEvent) => {
        if (depthDrag?.id !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        finishTransform();
    };
    const depthCancel = () => {
        if (depthDrag) finishTransform(true);
    };
    function nudgeDepth(toward: boolean, snapped: boolean) {
        if (!beginDepth(0, 0) || !depthDrag) return;
        const step = settings.snap || snapped ? settings.steps.translation : 0.01;
        moveDepth((toward ? -step : step) / depthDrag.start.unitsPerPixel, snapped);
        finishTransform();
    }
    const depthKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && depthDrag) {
            event.preventDefault();
            event.stopPropagation();
            finishTransform(true);
            return;
        }
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        event.stopPropagation();
        nudgeDepth(event.key === 'ArrowUp', event.shiftKey);
    };
    const depthClick = (event: MouseEvent) => {
        if (event.detail === 0) nudgeDepth(true, event.shiftKey);
    };
    const depthEnter = () => {
        if (!isDragging() && canUseDepth()) controls.axis = 'Z';
    };
    const depthLeave = () => {
        if (!depthDrag && controls.axis === 'Z') controls.axis = null;
    };
    depthButton?.addEventListener('pointerenter', depthEnter);
    depthButton?.addEventListener('pointerleave', depthLeave);
    depthButton?.addEventListener('pointerdown', depthDown);
    depthButton?.addEventListener('pointermove', depthMove);
    depthButton?.addEventListener('pointerup', depthUp);
    depthButton?.addEventListener('pointercancel', depthCancel);
    depthButton?.addEventListener('lostpointercapture', depthCancel);
    depthButton?.addEventListener('keydown', depthKey);
    depthButton?.addEventListener('click', depthClick);

    function trackScalePointer(event: PointerEvent) {
        if (transformDrag?.scale) {
            setShift(event.shiftKey);
            transformDrag.scale.currentPointer.set(event.clientX, event.clientY);
            transformDrag.scale.moved = true;
        }
    }

    return {
        applySnapping,
        finishTransform,
        setShift,
        canUseDepth,
        trackScalePointer,
        getDepthDrag: () => depthDrag,
        resetShift() {
            shiftHeld = false;
            applySnapping();
        },
        removeDepthListeners() {
            depthButton?.removeEventListener('pointerenter', depthEnter);
            depthButton?.removeEventListener('pointerleave', depthLeave);
            depthButton?.removeEventListener('pointerdown', depthDown);
            depthButton?.removeEventListener('pointermove', depthMove);
            depthButton?.removeEventListener('pointerup', depthUp);
            depthButton?.removeEventListener('pointercancel', depthCancel);
            depthButton?.removeEventListener('lostpointercapture', depthCancel);
            depthButton?.removeEventListener('keydown', depthKey);
            depthButton?.removeEventListener('click', depthClick);
            if (depthButton) depthButton.style.visibility = 'hidden';
        },
    };
}
