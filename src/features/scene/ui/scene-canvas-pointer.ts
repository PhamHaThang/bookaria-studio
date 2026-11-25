import type { RefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import {
    type AnnotationLabelDrag,
    annotationLabelOffset,
    beginAnnotationLabelDrag,
} from '../model/annotation-label-drag';
import type { AnnotationObject, AnnotationPlacement } from '../model/annotation-placement';
import { beginDolly, type DollyStart, dragDolly } from '../model/dolly';
import type { SceneAudioStore } from '../model/scene-audio-store';
import type { SelectionMode } from '../model/selection';
import { selectionFrustum } from '../model/selection-transform';
import type { SceneCanvasNode } from './scene-canvas-nodes';

type PointerOptions = {
    element: HTMLElement;
    canvas: HTMLCanvasElement;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    controls: TransformControls;
    paper: THREE.Mesh;
    nodes: ReadonlyMap<string, SceneCanvasNode>;
    latest: RefObject<{
        annotationToPlace?: AnnotationObject;
        disabled: boolean;
        selectedIds: string[];
        onPlaceAnnotation: (placement: AnnotationPlacement) => void;
        onSelect: (ids: string[], mode?: SelectionMode) => void;
        onBegin: () => void;
        onEnd: () => void;
        onChange: (objects: SceneObject[]) => void;
        audioStore: SceneAudioStore;
    }>;
    marqueeHost: RefObject<HTMLDivElement | null>;
    start: THREE.Vector2;
    nodeBounds: (node: SceneCanvasNode) => THREE.Box3;
    stopOrbitMomentum: () => void;
    isDisposed: () => boolean;
    isDragging: () => boolean;
    setDragging: (active: boolean) => void;
    setTransforming: (active: boolean) => void;
    setShift: (active: boolean) => void;
    resetShift: () => void;
    trackScalePointer: (event: PointerEvent) => void;
    finishTransform: (cancelled?: boolean) => boolean;
};

export function bindSceneCanvasPointer({
    element,
    canvas,
    camera,
    orbit,
    controls,
    paper,
    nodes,
    latest,
    marqueeHost,
    start,
    nodeBounds,
    stopOrbitMomentum,
    isDisposed,
    isDragging,
    setDragging,
    setTransforming,
    setShift,
    resetShift,
    trackScalePointer,
    finishTransform,
}: PointerOptions) {
    let spaceHeld = false;
    let cameraPointer: number | null = null;
    let cameraClick = false;
    let zoomDrag: { id: number; y: number; start: DollyStart } | null = null;
    let annotationDrag: {
        pointerId: number;
        x: number;
        y: number;
        node: SceneCanvasNode;
        original: SceneObject;
        start: AnnotationLabelDrag;
        moved: boolean;
    } | null = null;
    const placementMarker = element.parentElement?.querySelector<HTMLElement>(
        '[data-annotation-placement-marker]',
    );
    const placementRay = new THREE.Raycaster();
    const placementPointer = new THREE.Vector2();
    function hidePlacementMarker() {
        if (placementMarker) placementMarker.hidden = true;
    }
    function annotationSurface(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        placementPointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        placementRay.setFromCamera(placementPointer, camera);
        const surfaces = [...nodes.values()]
            .filter(
                (node) =>
                    node.status === 'ready' &&
                    node.root.visible &&
                    node.spec.type !== 'label' &&
                    !(node.spec.type === 'text' && node.spec.presentation?.kind === 'annotation'),
            )
            .map((node) => node.root);
        return placementRay.intersectObjects([...surfaces, paper], true)[0]?.point;
    }
    function placeAtPointer(event: PointerEvent) {
        const point = annotationSurface(event);
        if (!point) return;
        const angles = new THREE.Euler().setFromQuaternion(
            camera.getWorldQuaternion(new THREE.Quaternion()),
            'XYZ',
        );
        latest.current.onPlaceAnnotation({
            position: point.toArray(),
            rotation: [angles.x, angles.y, angles.z].map(THREE.MathUtils.radToDeg) as [
                number,
                number,
                number,
            ],
        });
        hidePlacementMarker();
    }
    let audioPress: { id: string; pointerId: number; x: number; y: number } | null = null;
    function audioButton(event: PointerEvent) {
        const detail = hitDetail(event);
        if (!detail?.hit.uv) return;
        return nodes.get(detail.id)?.audioCard?.isPlayHit(detail.hit.uv) ? detail.id : undefined;
    }
    function finishAudioPress() {
        const previous = audioPress;
        audioPress = null;
        if (!previous) return;
        controls.enabled = true;
        orbit.enabled = !isDragging();
        if (canvas.hasPointerCapture(previous.pointerId))
            canvas.releasePointerCapture(previous.pointerId);
    }
    let selecting: { id: number; x: number; y: number; moved: boolean; box: boolean } | null = null;
    function hitDetail(event: PointerEvent, selectedOnly = false) {
        const rect = canvas.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
            new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                (-(event.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            camera,
        );
        const hits = ray.intersectObjects(
            [...nodes.values()]
                .filter(
                    (node) =>
                        node.root.visible &&
                        (!selectedOnly || latest.current.selectedIds.includes(node.spec.id)),
                )
                .map((node) => node.root),
            true,
        );
        for (const hit of hits) {
            let root: THREE.Object3D | null = hit.object;
            while (root && !root.userData.objectId) root = root.parent;
            if (root) return { id: root.userData.objectId as string, hit };
        }
        return null;
    }
    function hitObject(event: PointerEvent) {
        return hitDetail(event)?.id ?? null;
    }
    function draggableAnnotation(event: PointerEvent) {
        if (
            latest.current.selectedIds.length !== 1 ||
            latest.current.disabled ||
            latest.current.annotationToPlace
        )
            return;
        const detail = hitDetail(event, true);
        if (!detail || detail.id !== latest.current.selectedIds[0]) return;
        const node = nodes.get(detail.id),
            spec = node?.spec;
        if (
            !node?.textVisual ||
            !spec ||
            spec.locked ||
            !spec.visible ||
            !(spec.type === 'label' || spec.type === 'text') ||
            spec.presentation?.kind !== 'annotation'
        )
            return;
        const part =
            spec.presentation.shape === 'circle' ? 'annotation-description' : 'annotation-label';
        if (detail.hit.object.name !== part || !detail.hit.object.visible) return;
        return {
            node,
            spec,
            visual: node.textVisual,
            offset: spec.presentation.labelOffset ?? ([0, 0] as [number, number]),
            hit: detail.hit,
        };
    }
    function finishAnnotationDrag(cancelled = false) {
        const previous = annotationDrag;
        if (!previous) return false;
        annotationDrag = null;
        if (previous.moved) {
            if (cancelled) {
                const spec = previous.original;
                if (
                    (spec.type === 'text' || spec.type === 'label') &&
                    spec.presentation?.kind === 'annotation'
                )
                    previous.node.textVisual?.setAnnotationOffset?.(
                        spec.presentation.labelOffset ?? [0, 0],
                    );
                latest.current.onChange([spec]);
            }
            setDragging(false);
            setTransforming(false);
            latest.current.onEnd();
        }
        controls.enabled = true;
        orbit.enabled = true;
        canvas.style.cursor = spaceHeld ? 'all-scroll' : 'grab';
        if (canvas.hasPointerCapture(previous.pointerId))
            canvas.releasePointerCapture(previous.pointerId);
        return true;
    }
    function marqueeRect(x: number, y: number) {
        const rect = canvas.getBoundingClientRect();
        const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
        const x1 = clamp((selecting?.x || 0) - rect.left, rect.width),
            x2 = clamp(x - rect.left, rect.width);
        const y1 = clamp((selecting?.y || 0) - rect.top, rect.height),
            y2 = clamp(y - rect.top, rect.height);
        return {
            left: Math.min(x1, x2),
            right: Math.max(x1, x2),
            top: Math.min(y1, y2),
            bottom: Math.max(y1, y2),
        };
    }
    function clearMarquee() {
        const previous = selecting;
        selecting = null;
        if (marqueeHost.current) marqueeHost.current.hidden = true;
        controls.enabled = true;
        orbit.enabled = !isDragging();
        if (previous && canvas.hasPointerCapture(previous.id))
            canvas.releasePointerCapture(previous.id);
        return Boolean(previous);
    }
    function restoreNavigation() {
        cameraPointer = null;
        cameraClick = false;
        zoomDrag = null;
        controls.enabled = true;
        orbit.enabled = !isDragging();
        orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        canvas.style.cursor = spaceHeld
            ? 'all-scroll'
            : latest.current.annotationToPlace
              ? 'crosshair'
              : '';
    }
    function beginCameraNavigation(event: PointerEvent, pan: boolean, selectOnClick = false) {
        stopOrbitMomentum();
        cameraPointer = event.pointerId;
        cameraClick = selectOnClick;
        controls.enabled = false;
        orbit.enabled = true;
        const inverted = event.shiftKey || event.ctrlKey || event.metaKey;
        orbit.mouseButtons.LEFT = pan !== inverted ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        canvas.style.cursor = pan ? 'all-scroll' : 'move';
    }
    const pointerDown = (event: PointerEvent) => {
        start.set(event.clientX, event.clientY);
        canvas.focus({ preventScroll: true });
        if (isDragging() || zoomDrag) return;
        if (event.button === 1) {
            stopOrbitMomentum();
            const rect = canvas.getBoundingClientRect();
            zoomDrag = {
                id: event.pointerId,
                y: event.clientY,
                start: beginDolly(
                    camera,
                    orbit.target,
                    new THREE.Vector2(
                        ((event.clientX - rect.left) / rect.width) * 2 - 1,
                        -((event.clientY - rect.top) / rect.height) * 2 + 1,
                    ),
                ),
            };
            controls.enabled = false;
            orbit.enabled = false;
            canvas.style.cursor = 'ns-resize';
            canvas.setPointerCapture(event.pointerId);
            // Prevent browser auto-scroll and let only this zoom handler own the gesture.
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (event.button === 2) {
            const rotate = event.ctrlKey || event.shiftKey || event.metaKey;
            // Keep native right-button mapping; report its modifier-switched action correctly.
            beginCameraNavigation(event, !rotate);
            return;
        }
        if (event.button !== 0) return;
        if (spaceHeld) {
            beginCameraNavigation(event, true);
            return;
        }
        if (latest.current.disabled) {
            beginCameraNavigation(event, false);
            return;
        }
        if (latest.current.annotationToPlace) {
            beginCameraNavigation(event, false, true);
            return;
        }
        // A visible gizmo takes priority over Shift marquee selection.
        if (controls.axis && controls.object && !event.ctrlKey && !event.metaKey) {
            setShift(event.shiftKey);
            stopOrbitMomentum();
            orbit.enabled = false;
            return;
        }
        if (!(event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)) {
            const audio = audioButton(event);
            if (audio) {
                stopOrbitMomentum();
                audioPress = {
                    id: audio,
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                };
                controls.enabled = false;
                orbit.enabled = false;
                canvas.setPointerCapture(event.pointerId);
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            const hit = draggableAnnotation(event);
            if (hit) {
                stopOrbitMomentum();
                annotationDrag = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    node: hit.node,
                    original: structuredClone(hit.spec),
                    moved: false,
                    start: beginAnnotationLabelDrag(hit.visual.group, hit.hit.point, hit.offset),
                };
                controls.enabled = false;
                orbit.enabled = false;
                canvas.style.cursor = 'grabbing';
                canvas.setPointerCapture(event.pointerId);
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
        }
        if (!(event.shiftKey || event.ctrlKey || event.metaKey)) {
            beginCameraNavigation(event, false, true);
            return;
        }
        selecting = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            box: event.shiftKey,
        };
        stopOrbitMomentum();
        orbit.enabled = false;
        controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const pointerMove = (event: PointerEvent) => {
        if (audioPress?.pointerId === event.pointerId) {
            event.stopImmediatePropagation();
            return;
        }
        trackScalePointer(event);
        if (annotationDrag?.pointerId === event.pointerId) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (
                !annotationDrag.moved &&
                Math.hypot(event.clientX - annotationDrag.x, event.clientY - annotationDrag.y) <= 4
            )
                return;
            const offset = annotationLabelOffset(
                annotationDrag.start,
                camera,
                canvas.getBoundingClientRect(),
                event.clientX,
                event.clientY,
            );
            const spec = annotationDrag.original;
            if (
                !offset ||
                !(spec.type === 'text' || spec.type === 'label') ||
                spec.presentation?.kind !== 'annotation'
            )
                return;
            if (!annotationDrag.moved) {
                annotationDrag.moved = true;
                setDragging(true);
                setTransforming(true);
                latest.current.onBegin();
            }
            annotationDrag.node.textVisual?.setAnnotationOffset?.(offset);
            latest.current.onChange([
                { ...spec, presentation: { ...spec.presentation, labelOffset: offset } },
            ]);
            return;
        }
        if (
            !event.buttons &&
            !isDragging() &&
            !cameraPointer &&
            !spaceHeld &&
            !latest.current.annotationToPlace
        )
            canvas.style.cursor =
                !controls.axis && audioButton(event)
                    ? 'pointer'
                    : !controls.axis && draggableAnnotation(event)
                      ? 'grab'
                      : '';
        if (zoomDrag?.id === event.pointerId) {
            dragDolly(
                camera,
                orbit.target,
                zoomDrag.start,
                event.clientY - zoomDrag.y,
                canvas.clientHeight,
                orbit.minDistance,
                orbit.maxDistance,
            );
            orbit.update();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (latest.current.annotationToPlace && placementMarker) {
            const point = event.buttons === 0 ? annotationSurface(event) : undefined;
            placementMarker.hidden = !point;
            if (point) {
                const rect = canvas.getBoundingClientRect();
                placementMarker.style.transform = `translate3d(${event.clientX - rect.left - 6}px, ${event.clientY - rect.top - 6}px, 0)`;
            }
        }
        if (!selecting || selecting.id !== event.pointerId) return;
        event.stopImmediatePropagation();
        if (
            Math.hypot(event.clientX - selecting.x, event.clientY - selecting.y) <= 4 &&
            !selecting.moved
        )
            return;
        selecting.moved = true;
        if (!selecting.box || !marqueeHost.current) return;
        const box = marqueeRect(event.clientX, event.clientY);
        const overlay = marqueeHost.current;
        overlay.hidden = false;
        overlay.style.left = `${box.left}px`;
        overlay.style.top = `${box.top}px`;
        overlay.style.width = `${box.right - box.left}px`;
        overlay.style.height = `${box.bottom - box.top}px`;
    };
    const pointerUp = (event: PointerEvent) => {
        if (audioPress?.pointerId === event.pointerId) {
            const pressed = audioPress;
            finishAudioPress();
            if (
                Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) <= 4 &&
                audioButton(event) === pressed.id
            ) {
                latest.current.onSelect([pressed.id]);
                void latest.current.audioStore.toggle(pressed.id);
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (annotationDrag?.pointerId === event.pointerId) {
            finishAnnotationDrag();
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (zoomDrag?.id === event.pointerId) {
            restoreNavigation();
            if (canvas.hasPointerCapture(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (cameraPointer === event.pointerId) {
            const select =
                cameraClick &&
                event.button === 0 &&
                !latest.current.disabled &&
                start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 4;
            restoreNavigation();
            if (select && latest.current.annotationToPlace) {
                placeAtPointer(event);
                return;
            }
            if (select) {
                const id = hitObject(event);
                latest.current.onSelect(id ? [id] : [], 'replace');
            }
            return;
        }
        if (selecting?.id === event.pointerId) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!latest.current.disabled) {
                if (selecting.box && selecting.moved) {
                    const rect = canvas.getBoundingClientRect();
                    const frustum = selectionFrustum(
                        camera,
                        marqueeRect(event.clientX, event.clientY),
                        rect,
                    );
                    const ids = [...nodes.values()]
                        .filter(
                            (node) =>
                                !node.spec.locked &&
                                node.root.visible &&
                                frustum?.intersectsBox(nodeBounds(node)),
                        )
                        .map((node) => node.spec.id);
                    latest.current.onSelect(ids, 'add');
                } else if (!selecting.moved) {
                    const id = hitObject(event);
                    if (id) latest.current.onSelect([id], 'toggle');
                }
            }
            clearMarquee();
            return;
        }
        if (
            event.button !== 0 ||
            controls.axis ||
            isDragging() ||
            start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4 ||
            latest.current.disabled
        )
            return;
        const id = hitObject(event);
        latest.current.onSelect(id ? [id] : [], 'replace');
    };
    const pointerCancel = () => {
        finishAudioPress();
        finishAnnotationDrag(true);
        hidePlacementMarker();
        clearMarquee();
        finishTransform(true);
        restoreNavigation();
    };
    const lostCapture = (event: PointerEvent) => {
        if (selecting) clearMarquee();
        // TransformControls releases capture just before its normal mouseUp handler.
        // Wait for that handler; unexpected capture loss cancels the gesture instead.
        queueMicrotask(() => {
            if (isDisposed() || canvas.hasPointerCapture(event.pointerId)) return;
            if (audioPress?.pointerId === event.pointerId) finishAudioPress();
            if (annotationDrag?.pointerId === event.pointerId) finishAnnotationDrag(true);
            else if (isDragging()) finishTransform(true);
            if (cameraPointer === event.pointerId || zoomDrag?.id === event.pointerId)
                restoreNavigation();
        });
    };
    const blur = () => {
        spaceHeld = false;
        resetShift();
        pointerCancel();
    };
    canvas.addEventListener('pointerleave', hidePlacementMarker);
    window.addEventListener('blur', blur);
    canvas.addEventListener('pointerdown', pointerDown, true);
    canvas.addEventListener('pointermove', pointerMove, true);
    canvas.addEventListener('pointerup', pointerUp, true);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('lostpointercapture', lostCapture);

    function pan(active: boolean) {
        spaceHeld = active;
        if (cameraPointer === null && !zoomDrag)
            canvas.style.cursor = active
                ? 'all-scroll'
                : latest.current.annotationToPlace
                  ? 'crosshair'
                  : '';
    }

    return {
        hidePlacementMarker,
        finishAudioPress,
        finishAnnotationDrag,
        hasMovedAnnotation: () => Boolean(annotationDrag?.moved),
        clearMarquee,
        pointerCancel,
        pan,
        removePointerListeners() {
            canvas.removeEventListener('pointerdown', pointerDown, true);
            canvas.removeEventListener('pointermove', pointerMove, true);
            canvas.removeEventListener('pointerup', pointerUp, true);
            canvas.removeEventListener('pointercancel', pointerCancel);
            canvas.removeEventListener('lostpointercapture', lostCapture);
            window.removeEventListener('blur', blur);
            canvas.removeEventListener('pointerleave', hidePlacementMarker);
        },
    };
}
