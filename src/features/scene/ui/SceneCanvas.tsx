import { MousePointerClick, X } from 'lucide-react';
import {
    type ReactNode,
    type Ref,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isHexColor } from '@/shared/lib/color-change-session';
import { facesCamera } from '@/shared/scene/audio-kind';
import { configureSceneOrbit, stopSceneOrbit } from '@/shared/scene/camera-navigation';
import { createPageLighting } from '@/shared/scene/page-lighting';
import { observeTheme } from '@/shared/theme/observe-theme';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { Page } from '../../../shared/contracts/dto.schema';
import type { Scene, SceneObject } from '../../../shared/contracts/scene.schema';
import type { PreviewView } from '../../preview/model/LocalPreviewStage';
import type { AnnotationObject, AnnotationPlacement } from '../model/annotation-placement';
import {
    createEditorGrid,
    DEFAULT_EDITOR_GRID,
    type EditorGridSettings,
} from '../model/editor-grid';
import { createFrontGuide } from '../model/front-guide';
import { fitPreviewCamera } from '../model/preview-fit';
import { canRenderTransform } from '../model/render-transform';
import type { SceneAudioStore } from '../model/scene-audio-store';
import type { SceneLoadStore } from '../model/scene-load-store';
import { formatTransformValue, mmToPageUnits, pageUnitsToMm } from '../model/scene-units';
import type { SelectionMode } from '../model/selection';
import {
    isPlanarObject,
    paddedSelectionBounds,
    planarSelectionFrame,
} from '../model/selection-frame';
import { defaultSnapStepsForPage, type SnapSteps } from '../model/snap';
import { textVisualColors } from '../model/text-visual-colors';
import {
    createViewGizmoProjection,
    rotateSceneView,
    setAxisView,
    type ViewGizmoController,
} from '../model/view-gizmo';
import { SceneAssetLoading } from './SceneAssetLoading';
import { SceneCanvasHints } from './SceneCanvasHints';
import { SceneCanvasToolbar } from './SceneCanvasToolbar';
import { SceneDepthGizmo } from './SceneDepthGizmo';
import { useBookSceneRenderer } from './SceneRendererProvider';
import { SceneSelectionTools, type SelectionActions } from './SceneSelectionTools';
import { useSceneWidthMm } from './SceneUnits';
import { SceneViewGizmo } from './SceneViewGizmo';
import { createSceneCanvasNodes, type SceneCanvasNode } from './scene-canvas-nodes';
import { createSceneCanvasOverlays, observeSceneCanvasLayout } from './scene-canvas-overlays';
import { createSceneCanvasPaper } from './scene-canvas-paper';
import { bindSceneCanvasPointer } from './scene-canvas-pointer';
import { bindSceneCanvasTransforms, createSceneCanvasControls } from './scene-canvas-transforms';
import { useSceneCanvasShortcuts } from './use-scene-canvas-shortcuts';

type Mode = 'translate' | 'rotate' | 'scale';
type Space = 'world' | 'local';
export type SceneCanvasHandle = {
    previewTextColor: (id: string, color: string) => void;
    getPreviewView: () => PreviewView | undefined;
    getDisplayedRotation: (id: string) => SceneObject['transform']['rotation'] | undefined;
};
type Props = {
    audioStore: SceneAudioStore;
    loadStore: SceneLoadStore;
    onRemoveObject: (id: string) => void;
    ref?: Ref<SceneCanvasHandle>;
    footer?: ReactNode;
    suspended?: boolean;
    annotationToPlace?: AnnotationObject;
    onPlaceAnnotation: (placement: AnnotationPlacement) => void;
    onCancelAnnotationPlacement: () => void;
    page: Page;
    lighting?: Page['settings']['lighting'];
    imageUrl?: string;
    aspect: number;
    scene: Scene;
    assets: Record<string, AssetRef>;
    selectedIds: string[];
    disabled: boolean;
    onSelect: (ids: string[], mode?: SelectionMode) => void;
    onChange: (objects: SceneObject[]) => void;
    onBegin: () => void;
    onEnd: () => void;
    selectionActions: SelectionActions;
};

export function SceneCanvas(props: Props) {
    const bookRenderer = useBookSceneRenderer();
    const widthMm = useSceneWidthMm();
    const widthMmRef = useRef(widthMm);
    const host = useRef<HTMLDivElement>(null),
        marqueeHost = useRef<HTMLDivElement>(null),
        loadingHost = useRef<HTMLDivElement>(null),
        leftTools = useRef<HTMLDivElement>(null),
        rightTools = useRef<HTMLDivElement>(null),
        depthHandle = useRef<HTMLButtonElement>(null),
        gizmoHost = useRef<HTMLFieldSetElement>(null),
        gizmoController = useRef<ViewGizmoController | null>(null),
        latest = useRef(props);
    latest.current = props;
    const loadStates = useSyncExternalStore(props.loadStore.subscribe, props.loadStore.getSnapshot);
    const api = useRef<{
        getPreviewView: () => PreviewView;
        sync: () => void;
        previewTextColor: SceneCanvasHandle['previewTextColor'];
        retry: (id: string) => void;
        getDisplayedRotation: SceneCanvasHandle['getDisplayedRotation'];
        mode: (mode: Mode, snap: boolean, space: Space, steps: SnapSteps) => void;
        grid: (settings: EditorGridSettings, widthMm: number) => void;
        shift: (active: boolean) => void;
        pan: (active: boolean) => void;
        isDragging: () => boolean;
        getMode: () => Mode;
        view: (view: string) => void;
        focus: () => void;
        cancel: () => boolean;
    } | null>(null);
    useImperativeHandle(
        props.ref,
        () => ({
            getDisplayedRotation: (id) => api.current?.getDisplayedRotation(id),
            getPreviewView: () => api.current?.getPreviewView(),
            previewTextColor: (id, color) => api.current?.previewTextColor(id, color),
        }),
        [],
    );
    const [mode, setMode] = useState<Mode>('translate'),
        [snap, setSnap] = useState(false),
        [snapSteps, setSnapSteps] = useState<SnapSteps>(() => defaultSnapStepsForPage(widthMm)),
        [space, setSpace] = useState<Space>('world'),
        [transforming, setTransforming] = useState(false);
    const [gridSettings, setGridSettings] = useState<EditorGridSettings>(DEFAULT_EDITOR_GRID);
    const gridSettingsRef = useRef(gridSettings);
    gridSettingsRef.current = gridSettings;
    const [failure, setFailure] = useState(''),
        [loading, setLoading] = useState(0),
        [issues, setIssues] = useState<Record<string, string>>({});
    useEffect(() => {
        const previousWidth = widthMmRef.current;
        widthMmRef.current = widthMm;
        if (previousWidth !== widthMm) {
            setSnapSteps((current) => ({
                ...current,
                translation: mmToPageUnits(
                    pageUnitsToMm(current.translation, previousWidth),
                    widthMm,
                ),
            }));
        }
    }, [widthMm]);
    const [hintsHost, setHintsHost] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setHintsHost(
            host.current
                ?.closest('.workbench-body')
                ?.querySelector<HTMLElement>('[data-canvas-hints-host]') ?? null,
        );
    }, []);
    // biome-ignore lint/correctness/useExhaustiveDependencies: Recreate GPU resources only for page identity or geometry; textures and other props sync through latest.
    useEffect(() => {
        setIssues({});
        setLoading(0);
        const element = host.current;
        if (!element) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer =
                bookRenderer?.current ?? new THREE.WebGLRenderer({ antialias: true, alpha: false });
            if (bookRenderer) bookRenderer.current = renderer;
        } catch {
            setFailure(
                'Không mở được canvas 3D. Hãy bật tăng tốc đồ họa hoặc dùng bảng thuộc tính để tiếp tục chỉnh sửa.',
            );
            return;
        }
        let placingAnnotation = false;
        const settings = { mode, snap, space, steps: snapSteps };
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let disposed = false,
            dragging = false,
            frame = 0;
        function setDragging(active: boolean) {
            dragging = active;
        }
        const scene = new THREE.Scene();
        const theme = getComputedStyle(element);
        const themeColor = (token: string) =>
            new THREE.Color(getComputedStyle(element).getPropertyValue(token).trim());
        scene.background = themeColor('--editor-ground');
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        // Paper is XY; height and the navigation up direction are +Z.
        camera.up.set(0, 0, 1);
        // Frame the whole page and its front guide without changing scene coordinates.
        const stageDistance = () => {
            const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
            return Math.max(
                2.2,
                ((latest.current.aspect + 0.6) / (2 * tangent)) * 1.1,
                0.65 / (camera.aspect * tangent),
            );
        };
        camera.position.set(0, -0.9, stageDistance());
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.target.set(0, -0.18, 0);
        configureSceneOrbit(orbit);
        const viewGizmo = gizmoHost.current
            ? createViewGizmoProjection(gizmoHost.current, camera)
            : null;
        function stopOrbitMomentum() {
            stopSceneOrbit(orbit);
        }
        gizmoController.current = {
            begin() {
                if (disposed || dragging) return false;
                stopOrbitMomentum();
                orbit.enabled = false;
                return true;
            },
            rotate(dx, dy) {
                if (disposed || dragging) return;
                rotateSceneView(
                    camera,
                    orbit.target,
                    dx,
                    dy,
                    orbit.minPolarAngle,
                    orbit.maxPolarAngle,
                    (2 * Math.PI * orbit.rotateSpeed) /
                        Math.max(1, renderer.domElement.clientHeight),
                );
                orbit.update();
            },
            axis(axis) {
                if (disposed || dragging) return;
                stopOrbitMomentum();
                setAxisView(camera, orbit.target, axis);
                orbit.update();
            },
            end() {
                if (!disposed) orbit.enabled = !dragging;
            },
        };
        const controls = createSceneCanvasControls(camera, renderer.domElement, themeColor);
        scene.add(controls);
        const pixelRatio = Math.min(window.devicePixelRatio, 2);
        if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute(
            'aria-label',
            'Canvas 3D: nhấp để chọn; kéo gizmo để biến đổi; Shift/Ctrl + nhấp để chọn nhiều, Shift + kéo để khoanh vùng; kéo chuột trái ngoài gizmo để xoay camera; Space + kéo hoặc chuột phải để dịch camera; giữ chuột giữa và kéo lên/xuống để zoom liên tục; cuộn để zoom theo con trỏ. Nhãn FRONT đánh dấu hướng trước ở mép dưới trang.',
        );
        renderer.domElement.tabIndex = 0;
        element.append(renderer.domElement);
        const lighting = createPageLighting(
            latest.current.lighting ?? latest.current.page.settings.lighting,
        );
        scene.add(lighting.group);
        const editorGrid = createEditorGrid(
            widthMmRef.current,
            latest.current.aspect,
            gridSettingsRef.current,
            { center: themeColor('--editor-grid-strong'), line: themeColor('--editor-grid') },
        );
        scene.add(editorGrid.grid);
        const frontGuide = createFrontGuide(latest.current.aspect, {
            surface: theme.getPropertyValue('--bg-surface').trim(),
            foreground: theme.getPropertyValue('--text-primary').trim(),
            border: theme.getPropertyValue('--border-default').trim(),
            font: theme.getPropertyValue('--font-body').trim(),
            anisotropy: renderer.capabilities.getMaxAnisotropy(),
        });
        if (frontGuide) scene.add(frontGuide.mesh);
        const {
            paper,
            updatePaperImage,
            dispose: disposePaper,
        } = createSceneCanvasPaper({
            scene,
            getAspect: () => latest.current.aspect,
            isDisposed: () => disposed,
            setIssues,
        });
        const outline = new THREE.Box3Helper(
            new THREE.Box3(),
            themeColor('--editor-selection-outline'),
        );
        outline.visible = false;
        const outlineSpace = new THREE.Group();
        outlineSpace.name = 'bookaria-selection-outline';
        outlineSpace.userData.editorHelper = true;
        outlineSpace.matrixAutoUpdate = false;
        const worldFrameMatrix = new THREE.Matrix4();
        outlineSpace.add(outline);
        scene.add(outlineSpace);
        const selectionPivot = new THREE.Group();
        selectionPivot.name = 'bookaria-selection-pivot';
        selectionPivot.userData.editorHelper = true;
        scene.add(selectionPivot);
        // Gizmo pose follows the billboard; authored rotation stays on the actual object root.
        const billboardPivot = new THREE.Group();
        billboardPivot.name = 'bookaria-billboard-transform-pivot';
        billboardPivot.userData.editorHelper = true;
        scene.add(billboardPivot);
        function updateBillboardPivot(node: SceneCanvasNode) {
            node.billboard.content.matrixWorld.decompose(
                billboardPivot.position,
                billboardPivot.quaternion,
                billboardPivot.scale,
            );
            billboardPivot.userData.objectId = node.spec.id;
            billboardPivot.updateMatrixWorld(true);
        }
        const depthButton = depthHandle.current;
        const depthLink = depthButton?.querySelector('[data-depth-axis-link]');
        function selectedNodes() {
            return latest.current.selectedIds.flatMap((id) => {
                const node = nodes.get(id);
                return node ? [node] : [];
            });
        }
        function selectionFrame() {
            const chosen = selectedNodes();
            if (chosen.length !== 1) return;
            const frame = planarSelectionFrame(chosen[0].spec, chosen[0].billboard.content);
            return frame
                ? {
                      bounds: paddedSelectionBounds(
                          frame.bounds,
                          frame.matrix,
                          camera,
                          renderer.domElement.clientHeight,
                          true,
                      ),
                      matrix: frame.matrix,
                  }
                : undefined;
        }
        function nodeBounds(node: SceneCanvasNode) {
            return node.modelBounds?.() ?? new THREE.Box3().setFromObject(node.root);
        }
        function selectionBounds() {
            const box = new THREE.Box3();
            for (const node of selectedNodes()) {
                if (!node.root.visible) continue;
                const bounds = nodeBounds(node);
                if (bounds.isEmpty()) box.expandByPoint(node.root.position);
                else box.union(bounds);
            }
            return box;
        }
        const {
            nodes,
            syncNodes,
            retryNode,
            dispose: disposeNodes,
        } = createSceneCanvasNodes({
            scene,
            camera,
            latest,
            themeColor,
            isDisposed: () => disposed,
            isDragging: () => dragging,
            detachNode(node) {
                if (controls.object === node.root) controls.detach();
            },
            onLoadSettled: sync,
            setLoading,
            setIssues,
        });
        function sync() {
            if (disposed) return;
            const value = latest.current;
            updatePaperImage(value.imageUrl ?? value.page.image.url);
            lighting.setPreset(value.lighting ?? value.page.settings.lighting);
            if (placingAnnotation !== Boolean(value.annotationToPlace)) {
                placingAnnotation = Boolean(value.annotationToPlace);
                renderer.domElement.style.cursor = placingAnnotation ? 'crosshair' : '';
                hidePlacementMarker();
            }
            syncNodes(value);
            const selected = selectedNodes();
            if (controls.mode === 'rotate' && selected.some((node) => facesCamera(node.spec))) {
                settings.mode = 'translate';
                controls.setMode('translate');
                setMode('translate');
            }
            const bounds = selectionBounds();
            const canTransform =
                selected.length > 0 &&
                selected.length === value.selectedIds.length &&
                selected.every(
                    (node) =>
                        node.status === 'ready' &&
                        node.root.visible &&
                        !node.spec.locked &&
                        canRenderTransform(node.spec.transform),
                ) &&
                !value.disabled &&
                !value.annotationToPlace &&
                !hasMovedAnnotation();
            if (canTransform) {
                const single = selected.length === 1 ? selected[0] : undefined;
                const target = single
                    ? facesCamera(single.spec)
                        ? billboardPivot
                        : single.root
                    : selectionPivot;
                if (target === billboardPivot && single && !dragging) updateBillboardPivot(single);
                if (target === selectionPivot && !dragging) {
                    selectionPivot.position.copy(bounds.getCenter(new THREE.Vector3()));
                    selectionPivot.rotation.set(0, 0, 0);
                    selectionPivot.scale.setScalar(1);
                    selectionPivot.updateMatrixWorld(true);
                }
                controls.setSpace(selected.length > 1 ? 'world' : settings.space);
                if (controls.object !== target) controls.attach(target);
                // End-on local Z uses the virtual depth arm instead of a second native handle.
                const planarScale =
                    controls.mode === 'scale' && single && isPlanarObject(single.spec);
                controls.showZ = !planarScale && !canUseDepth();
                if (planarScale && controls.axis?.includes('Z')) controls.axis = null;
            } else controls.detach();
            outline.box.copy(bounds);
            outline.visible = !bounds.isEmpty();
        }
        const start = new THREE.Vector2();
        const {
            applySnapping,
            finishTransform,
            setShift,
            resetShift,
            trackScalePointer,
            canUseDepth,
            getDepthDrag,
            removeDepthListeners,
        } = bindSceneCanvasTransforms({
            canvas: renderer.domElement,
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
            isDragging: () => dragging,
            setDragging,
            setTransforming,
        });
        const {
            hidePlacementMarker,
            finishAudioPress,
            finishAnnotationDrag,
            hasMovedAnnotation,
            clearMarquee,
            pointerCancel,
            pan,
            removePointerListeners,
        } = bindSceneCanvasPointer({
            element,
            canvas: renderer.domElement,
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
            isDisposed: () => disposed,
            isDragging: () => dragging,
            setDragging,
            setTransforming,
            setShift,
            resetShift,
            trackScalePointer,
            finishTransform,
        });
        const viewportSize = new THREE.Vector2();
        const fitViewport = () => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            renderer.getSize(viewportSize);
            if (viewportSize.x !== rect.width || viewportSize.y !== rect.height)
                renderer.setSize(rect.width, rect.height);
            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
        };
        fitViewport();
        const resize = new ResizeObserver(fitViewport);
        resize.observe(element);
        const stopLayout = observeSceneCanvasLayout(element);
        const { positionSelectionTools, positionDepthHandle, positionLoadingCards } =
            createSceneCanvasOverlays({
                canvas: renderer.domElement,
                camera,
                leftTools,
                rightTools,
                loadingHost,
                depthButton,
                depthLink,
                widthMmRef,
                billboardPivot,
                nodes,
                selectionFrame,
                selectionBounds,
                isDragging: () => dragging,
                isOutlineVisible: () => outline.visible,
                getDepthDrag,
                canUseDepth,
            });
        const clock = new THREE.Clock();
        function tick() {
            if (disposed) return;
            frame = requestAnimationFrame(tick);
            const delta = Math.min(clock.getDelta(), 0.05);
            if (latest.current.suspended || document.hidden) return;
            for (const node of nodes.values()) {
                node.mixer?.update(delta);
                node.placeholder?.pulse(
                    clock.elapsedTime,
                    reducedMotion || node.status === 'failed',
                );
            }
            orbit.update();
            for (const node of nodes.values()) {
                const spec = node.spec;
                node.billboard.update(
                    camera,
                    facesCamera(spec),
                    (spec.type === 'text' || spec.type === 'label') &&
                        spec.presentation?.kind !== 'extruded',
                );
            }
            if (controls.object === billboardPivot && !dragging) {
                const node = nodes.get(billboardPivot.userData.objectId);
                if (node && facesCamera(node.spec)) updateBillboardPivot(node);
            }
            if (outline.visible) {
                const frame = selectionFrame();
                if (frame) {
                    outline.box.copy(frame.bounds);
                    outlineSpace.matrix.copy(frame.matrix);
                } else {
                    outlineSpace.matrix.identity();
                    const selected = selectedNodes();
                    const bounds = selectionBounds();
                    outline.box.copy(
                        selected.length > 0 && selected.every((node) => node.spec.type === 'model')
                            ? bounds
                            : paddedSelectionBounds(
                                  bounds,
                                  worldFrameMatrix,
                                  camera,
                                  renderer.domElement.clientHeight,
                                  false,
                              ),
                    );
                }
                outlineSpace.matrixWorldNeedsUpdate = true;
                const material = outline.material as THREE.LineBasicMaterial;
                material.depthTest = !frame;
                material.depthWrite = !frame;
                outline.renderOrder = frame ? 101 : 0;
            }
            renderer.render(scene, camera);
            viewGizmo?.update();
            positionSelectionTools();
            positionDepthHandle();
            positionLoadingCards();
        }
        api.current = {
            previewTextColor(id, color) {
                const node = nodes.get(id);
                if (
                    !disposed &&
                    node?.textVisual &&
                    (node.spec.type === 'text' || node.spec.type === 'label') &&
                    isHexColor(color)
                ) {
                    node.textVisual.updateColors?.(
                        textVisualColors({ ...node.spec, style: { ...node.spec.style, color } }),
                    );
                }
            },
            grid(settings, pageWidthMm) {
                editorGrid.update(settings, pageWidthMm, latest.current.aspect);
            },
            getPreviewView: () => ({
                viewport: (() => {
                    const { left, top, width, height } =
                        renderer.domElement.getBoundingClientRect();
                    return { left, top, width, height };
                })(),
                projection: {
                    fov: camera.fov,
                    zoom: camera.zoom,
                    near: camera.near,
                    far: camera.far,
                },
                position: camera.position.toArray(),
                target: orbit.target.toArray(),
                up: camera.up.toArray(),
                minDistance: orbit.minDistance,
                maxDistance: orbit.maxDistance,
            }),
            sync,
            retry: retryNode,
            getDisplayedRotation(id) {
                const node = nodes.get(id);
                return node?.billboard.getDisplayedRotation();
            },
            mode(value, snapped, nextSpace, steps) {
                if (dragging) return;
                const effective =
                    value === 'rotate' && selectedNodes().some((node) => facesCamera(node.spec))
                        ? 'translate'
                        : value;
                if (effective !== value) setMode(effective);
                settings.mode = effective;
                settings.snap = snapped;
                settings.space = nextSpace;
                settings.steps = steps;
                controls.setMode(effective);
                applySnapping();
                sync();
            },
            shift(active) {
                setShift(active);
            },
            pan,
            isDragging: () => dragging,
            getMode: () => controls.mode,
            view(view) {
                if (dragging) return;
                // Clear the last orbit/pan gesture before applying an exact preset.
                stopOrbitMomentum();
                const distance = stageDistance();
                orbit.minDistance = 0.15;
                orbit.maxDistance = Math.max(15, distance * 3);
                camera.near = 0.01;
                camera.far = Math.max(100, distance * 4);
                camera.updateProjectionMatrix();
                orbit.target.set(0, -0.18, 0);
                if (view === 'front') {
                    camera.position.copy(orbit.target).add(new THREE.Vector3(0, 0, distance));
                    setAxisView(camera, orbit.target, '+z');
                } else if (view === 'side') camera.position.set(distance, orbit.target.y, 0.01);
                else
                    camera.position.set(
                        distance * 0.65,
                        orbit.target.y - distance * 0.65,
                        distance,
                    );
                orbit.update();
            },
            cancel() {
                if (latest.current.annotationToPlace) {
                    pointerCancel();
                    latest.current.onCancelAnnotationPlacement();
                    return true;
                }
                return finishAnnotationDrag(true) || clearMarquee() || finishTransform(true);
            },
            focus() {
                const box = selectionBounds();
                if (box.isEmpty()) return;
                if (dragging) return;
                stopOrbitMomentum();
                const direction = camera.position.clone().sub(orbit.target).normalize();
                const fitted = fitPreviewCamera(box, camera, direction, 1.35);
                orbit.target.copy(fitted.target);
                orbit.minDistance = Math.min(0.15, Math.max(0.005, fitted.radius * 0.5));
                orbit.maxDistance = Math.max(15, fitted.distance * 3);
                camera.near = Math.min(0.01, camera.near);
                camera.far = Math.max(100, camera.far);
                camera.updateProjectionMatrix();
                orbit.update();
            },
        };
        const stopTheme = observeTheme(() => {
            const colors = getComputedStyle(element);
            scene.background = themeColor('--editor-ground');
            editorGrid.recolor({
                center: themeColor('--editor-grid-strong'),
                line: themeColor('--editor-grid'),
            });
            (outline.material as THREE.LineBasicMaterial).color.copy(
                themeColor('--editor-selection-outline'),
            );
            frontGuide?.recolor({
                surface: colors.getPropertyValue('--bg-surface').trim(),
                foreground: colors.getPropertyValue('--text-primary').trim(),
                border: colors.getPropertyValue('--border-default').trim(),
            });
            controls.traverse((node) => {
                if (
                    !('tag' in node) ||
                    node.tag !== 'helper' ||
                    !(node instanceof THREE.Line || node instanceof THREE.Mesh)
                )
                    return;
                for (const material of Array.isArray(node.material)
                    ? node.material
                    : [node.material]) {
                    if (material instanceof THREE.LineBasicMaterial) {
                        const axis = ['X', 'Y', 'Z'].includes(node.name)
                            ? node.name.toLowerCase()
                            : 'z';
                        material.color.copy(themeColor(`--editor-axis-${axis}`));
                    }
                }
            });
        });
        api.current.mode(mode, snap, space, snapSteps);
        tick();
        return () => {
            stopTheme();
            finishAudioPress();
            finishAnnotationDrag(true);
            disposed = true;
            latest.current.loadStore.clear();
            if (marqueeHost.current) marqueeHost.current.hidden = true;
            cancelAnimationFrame(frame);
            api.current = null;
            gizmoController.current = null;
            viewGizmo?.dispose();
            resize.disconnect();
            stopLayout();
            removePointerListeners();
            removeDepthListeners();
            controls.detach();
            controls.dispose();
            orbit.dispose();
            disposeNodes();
            frontGuide?.dispose();
            disposePaper();
            editorGrid.dispose();
            outline.geometry.dispose();
            (outline.material as THREE.Material).dispose();
            if (!bookRenderer) renderer.dispose();
            renderer.domElement.style.cursor = '';
            renderer.domElement.remove();
        };
    }, [props.page.id, props.aspect, bookRenderer]);
    useEffect(() => {
        if (!props.suspended) api.current?.sync();
    });
    useEffect(() => {
        api.current?.mode(mode, snap, space, snapSteps);
    }, [mode, snap, space, snapSteps]);
    useEffect(() => {
        api.current?.grid(gridSettings, widthMm);
    }, [gridSettings, widthMm]);
    useSceneCanvasShortcuts(host, latest, api, setMode, setSnap, setSpace);
    const localAxes = props.selectedIds.length <= 1 && (space === 'local' || mode === 'scale');
    const selectedObject = props.scene.objects.find(
        (object) => object.id === props.selectedIds.at(-1),
    );
    const toolName = mode === 'translate' ? 'Di chuyển' : mode === 'rotate' ? 'Xoay' : 'Kích thước';
    return (
        <div className="scene-stage-column relative flex min-h-0 min-w-0 flex-col bg-[var(--editor-ground)] pb-[var(--canvas-hints-height,2.5rem)] max-[760px]:min-h-120 [.scene-editor[data-panel=preview]_&]:hidden">
            <div className="canvas-viewport relative min-h-90 flex-[1] overflow-hidden">
                <div
                    className="scene-three-host absolute top-0 right-0 bottom-0 left-0 [touch-action:none] [&_canvas]:block [&_canvas]:size-full"
                    ref={host}
                />
                <SceneAssetLoading
                    objects={props.scene.objects}
                    states={loadStates}
                    hostRef={loadingHost}
                    disabled={props.disabled}
                    onRetry={(id) => api.current?.retry(id)}
                    onRemove={props.onRemoveObject}
                />
                <SceneDepthGizmo buttonRef={depthHandle} disabled={props.disabled} />
                <div
                    hidden
                    data-annotation-placement-marker
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 left-0 z-2 size-3 rounded-full border-2 border-surface bg-primary shadow-sm"
                    style={{
                        backgroundColor:
                            props.annotationToPlace?.presentation?.kind === 'annotation'
                                ? props.annotationToPlace.presentation.background
                                : undefined,
                    }}
                />
                {props.annotationToPlace && (
                    <section
                        aria-label="Đặt chú thích"
                        className="pointer-events-auto absolute bottom-[var(--transform-feedback-bottom,148px)] left-1/2 z-3 flex max-w-[calc(100%_-_var(--inspector-offset,0px)_-_32px)] -translate-x-[calc(50%+var(--inspector-offset,0px)/2)] items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm transition-[translate] duration-200 ease-out motion-reduce:transition-none"
                    >
                        <MousePointerClick className="size-5 shrink-0" />
                        <div role="status" className="flex min-w-0 flex-col gap-1 text-xs">
                            <span className="font-semibold">Nhấp để đặt chú thích</span>
                            <span className="text-muted-foreground">
                                Chọn một điểm trên đối tượng hoặc trang sách · Esc để hủy
                            </span>
                        </div>
                        <ActionButton
                            variant="plain"
                            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                            aria-label="Hủy đặt chú thích"
                            title="Hủy đặt chú thích (Esc)"
                            onClick={props.onCancelAnnotationPlacement}
                        >
                            <X className="size-4" />
                        </ActionButton>
                    </section>
                )}
                <div
                    ref={marqueeHost}
                    hidden
                    aria-hidden="true"
                    data-selection-marquee
                    className="pointer-events-none absolute border border-primary bg-primary/10"
                />
                <SceneCanvasToolbar
                    mode={mode}
                    localAxes={localAxes}
                    selectedCount={props.selectedIds.length}
                    disabled={props.disabled}
                    transforming={transforming}
                    failed={Boolean(failure)}
                    snap={snap}
                    snapSteps={snapSteps}
                    gridSettings={gridSettings}
                    onView={(view) => api.current?.view(view)}
                    onToggleSpace={() =>
                        setSpace((current) => (current === 'world' ? 'local' : 'world'))
                    }
                    onSnapChange={setSnap}
                    onSnapStepsChange={setSnapSteps}
                    onGridChange={setGridSettings}
                />
                {!failure && (
                    <SceneViewGizmo
                        key={`${props.page.id}:${props.page.image.url}:${props.aspect}`}
                        hostRef={gizmoHost}
                        controller={gizmoController}
                    />
                )}
                {!failure && (
                    <SceneSelectionTools
                        objects={props.scene.objects.filter((object) =>
                            props.selectedIds.includes(object.id),
                        )}
                        mode={mode}
                        snap={snap}
                        onSnapChange={setSnap}
                        disabled={props.disabled}
                        transforming={
                            transforming || props.selectedIds.some((id) => loadStates.has(id))
                        }
                        actions={props.selectionActions}
                        leftRef={leftTools}
                        rightRef={rightTools}
                        onModeChange={setMode}
                    />
                )}
                {transforming && selectedObject && (
                    <output
                        aria-live="off"
                        data-transform-feedback
                        className="pointer-events-none absolute bottom-[var(--transform-feedback-bottom,148px)] left-1/2 max-w-[calc(100%_-_var(--inspector-offset,0px)_-_32px)] -translate-x-[calc(50%+var(--inspector-offset,0px)/2)] rounded-lg bg-surface px-3 py-2 text-center text-xs tabular-nums transition-[translate] duration-200 ease-out motion-reduce:transition-none"
                    >
                        {toolName}
                        {props.selectedIds.length > 1
                            ? ` ${props.selectedIds.length} đối tượng`
                            : ` · ${(['X', 'Y', 'Z'] as const)
                                  .map((axis, index) => {
                                      const value =
                                          mode === 'rotate'
                                              ? selectedObject.transform.rotation[index]
                                              : selectedObject.transform[
                                                    mode === 'scale' ? 'scale' : 'position'
                                                ][index];
                                      return `${axis} ${formatTransformValue(mode, value, widthMm)}`;
                                  })
                                  .join(' · ')}`}
                    </output>
                )}
                {failure && (
                    <p
                        className="canvas-failure absolute top-[35%] bottom-auto left-1/2 m-0 w-[calc(100%_-_var(--inspector-offset,0px)_-_32px)] max-w-xl -translate-x-[calc(50%+var(--inspector-offset,0px)/2)] bg-surface p-5 text-[length:13px] transition-[translate] duration-200 ease-out motion-reduce:transition-none"
                        role="alert"
                    >
                        {failure}
                    </p>
                )}
                {loading > 0 && (
                    <p
                        className="canvas-loading pointer-events-none absolute @max-[72rem]:bottom-[var(--transform-feedback-bottom,148px)] bottom-4 left-[18px] m-0 max-w-[calc(100%_-_var(--inspector-offset,0px)_-_var(--sidebar-toolbar-offset,0px)_-_36px)] translate-x-[var(--sidebar-toolbar-offset,0px)] rounded-[5px] bg-surface px-[10px] py-[5px] text-[length:12px] transition-[translate] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease) motion-reduce:transition-none"
                        role="status"
                    >
                        Đang tải {loading} đối tượng…
                    </p>
                )}
            </div>
            {props.footer && (
                <div
                    data-canvas-footer
                    className="canvas-footer absolute right-[18px] bottom-[calc(var(--canvas-tools-inset,3.5rem)_-_7px)] z-3 flex -translate-x-[var(--inspector-offset,0px)] items-end gap-1.5 transition-[translate] duration-200 ease-out motion-reduce:transition-none"
                >
                    {props.footer}
                </div>
            )}
            {hintsHost &&
                createPortal(
                    <SceneCanvasHints
                        mode={mode}
                        objects={props.scene.objects.filter((object) =>
                            props.selectedIds.includes(object.id),
                        )}
                    />,
                    hintsHost,
                )}
            <p className="sr-only" role="status" aria-live="polite">
                Đã chọn {props.selectedIds.length} đối tượng.
            </p>
            {Object.entries(issues)
                .filter(
                    ([id]) =>
                        id === 'page' ||
                        props.scene.objects.some(
                            (object) =>
                                object.id === id &&
                                !['model', 'image', 'video'].includes(object.type),
                        ),
                )
                .map(([id, issue]) => (
                    <p
                        className="canvas-issue m-0 bg-danger px-3 py-2 text-[length:12px] text-danger-foreground"
                        role="alert"
                        key={id}
                    >
                        {issue}
                    </p>
                ))}
        </div>
    );
}
