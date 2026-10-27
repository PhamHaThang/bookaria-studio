import { Maximize } from 'lucide-react';
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { annotationConnectorSide } from '@/shared/scene/annotation-connector';
import { createBillboard } from '@/shared/scene/billboard';
import { createTextVisual, disposeTextVisual } from '@/shared/scene/text-renderer';
import { Button } from '@/shared/ui/primitives/button';
import { Spinner } from '@/shared/ui/primitives/spinner';
import {
    type AnnotationLabelDrag,
    annotationLabelOffset,
    beginAnnotationLabelDrag,
} from '../model/annotation-label-drag';
import { fitPreviewCamera } from '../model/preview-fit';
import { createTextPreviewImageCache } from '../model/text-preview-image';

type Textual = Extract<SceneObject, { type: 'text' | 'label' }>;
// Placement, billboard and links do not affect the cached geometry or texture.
function visualKey(spec: Textual, url?: string, shapeOnly = false) {
    return JSON.stringify(
        [
            spec.id,
            spec.type,
            spec.text,
            spec.style,
            spec.presentation,
            spec.type === 'label' ? spec.target : undefined,
            url,
        ],
        (key, value) =>
            key === 'buttonUrl' ||
            key === 'labelOffset' ||
            key === 'connectorSide' ||
            (shapeOnly &&
                (key === 'color' ||
                    key === 'background' ||
                    key === 'buttonBackground' ||
                    key === 'border' ||
                    key === 'descriptionColor' ||
                    key === 'descriptionBackground' ||
                    key === 'pointerPosition'))
                ? undefined
                : value,
    );
}
function visualShapeKey(spec: Textual, url?: string) {
    return visualKey(spec, url, true);
}
function updateKey(spec: Textual, url?: string) {
    return spec.presentation?.kind === 'extruded'
        ? JSON.stringify(['extruded', spec.text, spec.style.bold])
        : visualShapeKey(spec, url);
}

export type TextVisualPreviewHandle = {
    cancelAnnotationDrag: () => boolean;
    getDisplayedRotation: () => Textual['transform']['rotation'] | undefined;
};
export function TextVisualPreview({
    ref,
    object,
    imageUrl,
    page = 0,
    onReadyChange,
    onAdvance,
    onAnnotationOffsetChange,
}: {
    ref?: Ref<TextVisualPreviewHandle>;
    object: Textual;
    imageUrl?: string;
    page?: number;
    onReadyChange: (ready: boolean) => void;
    onAdvance?: (page?: number) => void;
    onAnnotationOffsetChange?: (offset: [number, number]) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const api = useRef<{
        show: (object: Textual, url?: string, page?: number) => void;
        reset: () => void;
        cancelAnnotationDrag: TextVisualPreviewHandle['cancelAnnotationDrag'];
        getDisplayedRotation: TextVisualPreviewHandle['getDisplayedRotation'];
    } | null>(null);
    useImperativeHandle(
        ref,
        () => ({
            getDisplayedRotation: () => api.current?.getDisplayedRotation(),
            cancelAnnotationDrag: () => api.current?.cancelAnnotationDrag() ?? false,
        }),
        [],
    );
    const latest = useRef({ object, imageUrl, page, onAdvance, onAnnotationOffsetChange });
    latest.current = { object, imageUrl, page, onAdvance, onAnnotationOffsetChange };
    const previousShape = useRef('');
    const previousObjectId = useRef<string | null>(null);
    const [failure, setFailure] = useState(''),
        [loading, setLoading] = useState(true),
        [hasVisual, setHasVisual] = useState(false);
    useEffect(() => {
        const element = host.current;
        if (!element) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true });
        } catch {
            setFailure('Không mở được xem trước 3D. Hãy bật tăng tốc đồ họa.');
            onReadyChange(false);
            return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute('aria-label', 'Xem trước văn bản');
        renderer.domElement.tabIndex = 0;
        element.append(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#fafafa');
        const visualRoot = new THREE.Group();
        scene.add(visualRoot);
        const billboard = createBillboard(visualRoot);
        const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
        camera.position.set(0, 0, 2);
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true;
        orbit.dampingFactor = 0.18;
        orbit.enablePan = true;
        orbit.screenSpacePanning = true;
        orbit.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN,
        };
        orbit.minDistance = 0.1;
        orbit.maxDistance = 8;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x7c8390, 2.5));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(2, 3, 4);
        scene.add(light);
        const grid = new THREE.GridHelper(8, 80, 0xe2e5e9, 0xe2e5e9);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -0.04;
        scene.add(grid);
        let current: THREE.Group | null = null,
            currentSpec: Textual | null = null,
            currentUrl: string | undefined,
            currentVisual: Awaited<ReturnType<typeof createTextVisual>> | null = null,
            version = 0,
            disposed = false,
            frame = 0,
            controller: AbortController | null = null;
        type CachedPreview = {
            visual: Awaited<ReturnType<typeof createTextVisual>>;
            spec: Textual;
            url?: string;
            position: THREE.Vector3;
            target: THREE.Vector3;
            aspect: number;
            near: number;
            far: number;
        };
        // Only inactive tabs are cached; four tabs need at most three inactive visuals.
        const cache = new Map<string, CachedPreview>();
        const imageCache = createTextPreviewImageCache();
        const rememberCurrent = () => {
            if (!currentSpec || !currentVisual) return;
            cache.set(currentSpec.id, {
                visual: currentVisual,
                spec: currentSpec,
                url: currentUrl,
                position: camera.position.clone(),
                target: orbit.target.clone(),
                aspect: camera.aspect,
                near: camera.near,
                far: camera.far,
            });
            if (cache.size > 3) {
                const oldest = cache.entries().next().value;
                if (oldest) {
                    disposeTextVisual(oldest[1].visual.group);
                    cache.delete(oldest[0]);
                }
            }
        };
        const clearDamping = () => {
            const enabled = orbit.enableDamping;
            orbit.enableDamping = false;
            orbit.update();
            orbit.enableDamping = enabled;
        };
        function invalidate() {
            if (!disposed && !frame) frame = requestAnimationFrame(render);
        }
        const lastPosition = new THREE.Vector3();
        const lastQuaternion = new THREE.Quaternion();
        function updateOrientation() {
            if (currentSpec)
                visualRoot.rotation.set(
                    ...(currentSpec.transform.rotation.map(THREE.MathUtils.degToRad) as [
                        number,
                        number,
                        number,
                    ]),
                );
            billboard.update(
                camera,
                Boolean(currentSpec?.billboard),
                currentSpec?.presentation?.kind !== 'extruded',
            );
        }
        function render() {
            frame = 0;
            if (disposed || document.hidden) return;
            lastPosition.copy(camera.position);
            lastQuaternion.copy(camera.quaternion);
            orbit.update();
            updateOrientation();
            renderer.render(scene, camera);
            // OrbitControls stops emitting change before its damping tail fully settles.
            if (
                lastPosition.distanceToSquared(camera.position) > 1e-14 ||
                1 - Math.abs(lastQuaternion.dot(camera.quaternion)) > 1e-14
            )
                invalidate();
        }
        orbit.addEventListener('change', invalidate);
        const visibility = () => {
            if (!document.hidden) invalidate();
        };
        document.addEventListener('visibilitychange', visibility);
        const fit = (reset = false) => {
            if (!current) return;
            updateOrientation();
            const direction = reset
                ? currentSpec?.presentation?.kind === 'extruded'
                    ? new THREE.Vector3(0.65, 0.3, 1)
                    : new THREE.Vector3(0, 0, 1)
                : camera.position.clone().sub(orbit.target).normalize();
            const bounds = new THREE.Box3().setFromObject(current);
            if (currentSpec?.presentation?.kind === 'annotation') {
                // A stable work area keeps short labels and numbered dots at the same readable scale.
                bounds.expandByPoint(new THREE.Vector3(-0.8, -0.6, 0));
                bounds.expandByPoint(new THREE.Vector3(0.8, 0.6, 0));
            }
            const fitted = fitPreviewCamera(bounds, camera, direction, 1.4);
            orbit.target.copy(fitted.target);
            orbit.update();
            invalidate();
        };
        const resize = new ResizeObserver(() => {
            const { width, height } = element.getBoundingClientRect();
            renderer.setSize(Math.max(1, width), Math.max(1, height));
            camera.aspect = Math.max(1, width) / Math.max(1, height);
            camera.updateProjectionMatrix();
            fit();
            invalidate();
        });
        resize.observe(element);
        let pointerStart = { x: 0, y: 0 };
        let dragged = false;
        let labelDrag: { pointerId: number; start: AnnotationLabelDrag; moved: boolean } | null =
            null;
        function labelHit(event: PointerEvent) {
            if (
                !current ||
                !latest.current.onAnnotationOffsetChange ||
                currentSpec?.presentation?.kind !== 'annotation'
            )
                return;
            const part =
                currentSpec.presentation.shape === 'circle'
                    ? 'annotation-description'
                    : 'annotation-label';
            const mesh = current.getObjectByName(part);
            if (!mesh?.visible) return;
            const rect = renderer.domElement.getBoundingClientRect(),
                ray = new THREE.Raycaster();
            ray.setFromCamera(
                new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    1 - ((event.clientY - rect.top) / rect.height) * 2,
                ),
                camera,
            );
            return ray.intersectObject(mesh, false)[0];
        }
        function finishLabelDrag(cancelled = false) {
            const previous = labelDrag;
            if (!previous) return;
            labelDrag = null;
            if (cancelled && previous.moved) {
                currentVisual?.setAnnotationOffset?.(previous.start.offset);
                latest.current.onAnnotationOffsetChange?.(previous.start.offset);
                invalidate();
            }
            orbit.enabled = true;
            renderer.domElement.style.cursor = 'grab';
            if (renderer.domElement.hasPointerCapture(previous.pointerId))
                renderer.domElement.releasePointerCapture(previous.pointerId);
        }
        const pointerDown = (event: PointerEvent) => {
            pointerStart = { x: event.clientX, y: event.clientY };
            dragged = false;
            if (event.button === 1 || event.button === 2) {
                renderer.domElement.style.cursor =
                    event.ctrlKey || event.shiftKey || event.metaKey ? 'move' : 'all-scroll';
                // Keep OrbitControls' pointer handling and suppress browser middle-button auto-scroll.
                event.preventDefault();
                return;
            }
            if (
                event.button !== 0 ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
            )
                return;
            const hit = labelHit(event);
            if (!hit || !current || currentSpec?.presentation?.kind !== 'annotation') return;
            const position = camera.position.clone(),
                target = orbit.target.clone();
            clearDamping();
            camera.position.copy(position);
            orbit.target.copy(target);
            orbit.update();
            updateOrientation();
            labelDrag = {
                pointerId: event.pointerId,
                moved: false,
                start: beginAnnotationLabelDrag(
                    current,
                    hit.point,
                    currentSpec.presentation.labelOffset ?? [0, 0],
                ),
            };
            orbit.enabled = false;
            renderer.domElement.focus({ preventScroll: true });
            renderer.domElement.style.cursor = 'grabbing';
            renderer.domElement.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const pointerMove = (event: PointerEvent) => {
            if (labelDrag?.pointerId === event.pointerId) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (
                    !labelDrag.moved &&
                    Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 4
                )
                    return;
                const offset = annotationLabelOffset(
                    labelDrag.start,
                    camera,
                    renderer.domElement.getBoundingClientRect(),
                    event.clientX,
                    event.clientY,
                );
                if (!offset) return;
                dragged = true;
                labelDrag.moved = true;
                currentVisual?.setAnnotationOffset?.(offset);
                latest.current.onAnnotationOffsetChange?.(offset);
                invalidate();
                return;
            }
            if (
                event.buttons &&
                Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6
            )
                dragged = true;
        };
        const pointerUp = (event: PointerEvent) => {
            if (!labelDrag)
                renderer.domElement.style.cursor = latest.current.onAdvance ? 'pointer' : 'grab';
            if (labelDrag?.pointerId !== event.pointerId) return;
            finishLabelDrag();
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const cancelLabel = () => {
            finishLabelDrag(true);
            renderer.domElement.style.cursor = latest.current.onAdvance ? 'pointer' : 'grab';
        };
        const keyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !labelDrag) return;
            finishLabelDrag(true);
            event.preventDefault();
            event.stopPropagation();
        };
        const click = (event: MouseEvent) => {
            if (dragged || event.button !== 0) return;
            if (!current || !latest.current.onAdvance) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const ray = new THREE.Raycaster();
            ray.setFromCamera(
                new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
                ),
                camera,
            );
            const hit = ray.intersectObject(current, true)[0];
            if (hit) {
                const page = currentVisual?.tap?.(hit.uv);
                latest.current.onAdvance(page);
                invalidate();
            }
        };
        renderer.domElement.addEventListener('click', click);
        renderer.domElement.addEventListener('pointerdown', pointerDown, true);
        renderer.domElement.addEventListener('pointermove', pointerMove, true);
        renderer.domElement.addEventListener('pointerup', pointerUp, true);
        renderer.domElement.addEventListener('pointercancel', cancelLabel);
        renderer.domElement.addEventListener('lostpointercapture', cancelLabel);
        renderer.domElement.addEventListener('keydown', keyDown);
        window.addEventListener('blur', cancelLabel);
        api.current = {
            cancelAnnotationDrag: () => {
                if (!labelDrag) return false;
                finishLabelDrag(true);
                return true;
            },
            getDisplayedRotation: () =>
                currentSpec?.id === latest.current.object.id
                    ? billboard.getDisplayedRotation()
                    : undefined,
            reset: () => fit(true),
            show(spec, url, selectedPage) {
                const attempt = ++version;
                controller?.abort();
                controller = new AbortController();
                const signal = controller.signal;
                const cached = cache.get(spec.id);
                if (
                    currentSpec?.id !== spec.id &&
                    cached &&
                    visualShapeKey(cached.spec, cached.url) === visualShapeKey(spec, url)
                ) {
                    cache.delete(spec.id);
                    rememberCurrent();
                    if (current) billboard.content.remove(current);
                    clearDamping();
                    currentVisual = cached.visual;
                    current = cached.visual.group;
                    currentSpec = cached.spec;
                    currentUrl = cached.url;
                    billboard.content.add(current);
                    orbit.enableRotate = true;
                    camera.near = cached.near;
                    camera.far = cached.far;
                    camera.updateProjectionMatrix();
                    camera.position.copy(cached.position);
                    orbit.target.copy(cached.target);
                    orbit.update();
                    if (cached.aspect !== camera.aspect) fit();
                    currentVisual.setPage?.(selectedPage ?? 0);
                } else if (cached) {
                    cache.delete(spec.id);
                    disposeTextVisual(cached.visual.group);
                }
                if (
                    current &&
                    currentSpec &&
                    visualKey(currentSpec, currentUrl) === visualKey(spec, url)
                ) {
                    currentVisual?.setPage?.(selectedPage ?? 0);
                    if (spec.presentation?.kind === 'annotation')
                        currentVisual?.setAnnotationOffset?.(
                            spec.presentation.labelOffset ?? [0, 0],
                        );
                    if (spec.presentation?.kind === 'annotation')
                        currentVisual?.setAnnotationConnectorSide?.(
                            annotationConnectorSide(
                                spec.presentation,
                                spec.type === 'label' ? spec.target : [-0.3, 0, 0],
                            ),
                        );
                    currentSpec = spec;
                    setFailure('');
                    setLoading(false);
                    onReadyChange(true);
                    invalidate();
                    return;
                }
                if (
                    currentSpec &&
                    currentVisual?.updateColors &&
                    visualShapeKey(currentSpec, currentUrl) === visualShapeKey(spec, url)
                ) {
                    if (spec.presentation?.kind === 'annotation')
                        currentVisual.setAnnotationOffset?.(
                            spec.presentation.labelOffset ?? [0, 0],
                        );
                    currentVisual.updateColors({
                        color: spec.style.color,
                        background:
                            spec.presentation && 'background' in spec.presentation
                                ? spec.presentation.background
                                : undefined,
                        buttonBackground:
                            spec.presentation?.kind === 'screen'
                                ? spec.presentation.buttonBackground
                                : undefined,
                        border:
                            spec.presentation && 'border' in spec.presentation
                                ? spec.presentation.border
                                : undefined,
                        descriptionColor:
                            spec.presentation?.kind === 'annotation'
                                ? spec.presentation.descriptionColor
                                : undefined,
                        descriptionBackground:
                            spec.presentation?.kind === 'annotation'
                                ? spec.presentation.descriptionBackground
                                : undefined,
                    });
                    if (
                        spec.presentation?.kind === 'bubble' &&
                        currentSpec.presentation?.kind === 'bubble' &&
                        spec.presentation.pointerPosition !==
                            currentSpec.presentation.pointerPosition
                    )
                        currentVisual.setPointerPosition?.(
                            spec.presentation.pointerPosition ?? 0.5,
                        );
                    if (spec.presentation?.kind === 'annotation')
                        currentVisual?.setAnnotationConnectorSide?.(
                            annotationConnectorSide(
                                spec.presentation,
                                spec.type === 'label' ? spec.target : [-0.3, 0, 0],
                            ),
                        );
                    currentSpec = spec;
                    setFailure('');
                    setLoading(false);
                    onReadyChange(true);
                    invalidate();
                    return;
                }
                if (
                    current &&
                    currentSpec?.presentation?.kind === 'extruded' &&
                    spec.presentation?.kind === 'extruded' &&
                    currentSpec.text === spec.text &&
                    currentSpec.style.bold === spec.style.bold
                ) {
                    const mesh = current.children[0];
                    if (
                        mesh instanceof THREE.Mesh &&
                        mesh.material instanceof THREE.MeshStandardMaterial
                    ) {
                        mesh.material.color.set(spec.style.color);
                        mesh.scale.set(spec.style.size, spec.style.size, spec.presentation.depth);
                        currentSpec = spec;
                        setFailure('');
                        setLoading(false);
                        onReadyChange(true);
                        invalidate();
                        return;
                    }
                }
                setLoading(true);
                setFailure('');
                onReadyChange(false);
                void createTextVisual(spec, {
                    imageUrl: url,
                    page: selectedPage,
                    expanded: true,
                    signal,
                    loadImage: imageCache.load,
                })
                    .then((visual) => {
                        if (disposed || attempt !== version) {
                            disposeTextVisual(visual.group);
                            return;
                        }
                        const reset =
                            !current || currentSpec?.presentation?.kind !== spec.presentation?.kind;
                        if (current) {
                            if (currentSpec?.id !== spec.id) rememberCurrent();
                            else disposeTextVisual(current);
                            billboard.content.remove(current);
                        }
                        clearDamping();
                        current = visual.group;
                        currentVisual = visual;
                        currentSpec = spec;
                        currentUrl = url;
                        billboard.content.add(current);
                        orbit.enableRotate = true;
                        fit(reset);
                        setHasVisual(true);
                        setLoading(false);
                        onReadyChange(true);
                        invalidate();
                    })
                    .catch((error) => {
                        if (!disposed && attempt === version && !signal.aborted) {
                            setFailure(
                                error instanceof Error
                                    ? error.message
                                    : 'Không xem trước được văn bản.',
                            );
                            setLoading(false);
                            onReadyChange(false);
                        }
                    });
            },
        };
        invalidate();
        return () => {
            disposed = true;
            ++version;
            controller?.abort();
            imageCache.dispose();
            api.current = null;
            cancelAnimationFrame(frame);
            resize.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            renderer.domElement.removeEventListener('click', click);
            renderer.domElement.removeEventListener('pointerdown', pointerDown, true);
            renderer.domElement.removeEventListener('pointermove', pointerMove, true);
            renderer.domElement.removeEventListener('pointerup', pointerUp, true);
            renderer.domElement.removeEventListener('pointercancel', cancelLabel);
            renderer.domElement.removeEventListener('lostpointercapture', cancelLabel);
            renderer.domElement.removeEventListener('keydown', keyDown);
            window.removeEventListener('blur', cancelLabel);
            orbit.removeEventListener('change', invalidate);
            orbit.dispose();
            if (current) disposeTextVisual(current);
            for (const cached of cache.values()) disposeTextVisual(cached.visual.group);
            cache.clear();
            grid.geometry.dispose();
            (grid.material as THREE.Material).dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        };
    }, [onReadyChange]);
    useEffect(() => {
        const key = updateKey(object, imageUrl);
        const switchedTab = previousObjectId.current !== object.id;
        const immediate = previousShape.current === key;
        previousObjectId.current = object.id;
        previousShape.current = key;
        if (switchedTab) {
            api.current?.show(object, imageUrl, page);
            return;
        }
        if (immediate || object.presentation?.kind !== 'extruded') {
            const frame = requestAnimationFrame(() => api.current?.show(object, imageUrl, page));
            return () => cancelAnimationFrame(frame);
        }
        const timer = setTimeout(() => api.current?.show(object, imageUrl, page), 120);
        return () => clearTimeout(timer);
    }, [object, imageUrl, page]);
    useEffect(() => {
        const canvas = host.current?.querySelector('canvas');
        if (canvas) canvas.style.cursor = onAdvance ? 'pointer' : 'grab';
    }, [onAdvance]);
    return (
        <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface"
            data-text-preview
            aria-busy={loading}
        >
            <div ref={host} className="absolute inset-0 [&_canvas]:block [&_canvas]:size-full" />
            {loading && (
                <div
                    className={
                        hasVisual
                            ? 'pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs shadow-sm'
                            : 'pointer-events-none absolute inset-0 grid place-items-center'
                    }
                    role="status"
                >
                    <Spinner />
                    <span className={hasVisual ? '' : 'sr-only'}>
                        {hasVisual ? 'Đang cập nhật…' : 'Đang dựng văn bản…'}
                    </span>
                </div>
            )}
            {failure && (
                <p
                    role="alert"
                    className="absolute inset-x-5 top-1/2 m-0 -translate-y-1/2 rounded-lg bg-surface p-4 text-center text-destructive"
                >
                    {failure}
                </p>
            )}
            <div className="absolute bottom-3 left-3">
                <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Đưa văn bản vừa khung"
                    title="Đặt lại góc nhìn"
                    onClick={() => api.current?.reset()}
                >
                    <Maximize />
                </Button>
            </div>
        </div>
    );
}
