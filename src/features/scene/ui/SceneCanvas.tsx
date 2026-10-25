import { Focus, Magnet, Maximize2, Move, RotateCw, Scaling } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { Page } from '../../../shared/contracts/dto.schema';
import type { Scene, SceneObject } from '../../../shared/contracts/scene.schema';
import { createFrontGuide } from '../model/front-guide';
import { objectLabels } from '../model/objects';
import type { SelectionMode } from '../model/selection';
import { selectionFrustum, transformSelection } from '../model/selection-transform';
import { wrapText } from '../model/text';
import { objectFromGizmo } from '../model/transforms';
import {
    createViewGizmoProjection,
    rotateSceneView,
    setAxisView,
    type ViewGizmoController,
} from '../model/view-gizmo';
import { SceneViewGizmo } from './SceneViewGizmo';

type Mode = 'translate' | 'rotate' | 'scale';
type Props = {
    footer?: ReactNode;
    page: Page;
    aspect: number;
    scene: Scene;
    assets: Record<string, AssetRef>;
    selectedIds: string[];
    disabled: boolean;
    onSelect: (ids: string[], mode?: SelectionMode) => void;
    onChange: (objects: SceneObject[]) => void;
    onBegin: () => void;
    onEnd: () => void;
};
type Node = {
    root: THREE.Group;
    key: string;
    spec: SceneObject;
    mixer?: THREE.AnimationMixer;
    dispose: () => void;
};

export function SceneCanvas(props: Props) {
    const host = useRef<HTMLDivElement>(null),
        marqueeHost = useRef<HTMLDivElement>(null),
        gizmoHost = useRef<HTMLFieldSetElement>(null),
        gizmoController = useRef<ViewGizmoController | null>(null),
        latest = useRef(props);
    latest.current = props;
    const api = useRef<{
        sync: () => void;
        mode: (mode: Mode, snap: boolean) => void;
        view: (view: string) => void;
        focus: () => void;
        cancel: () => boolean;
    } | null>(null);
    const [mode, setMode] = useState<Mode>('translate'),
        [snap, setSnap] = useState(false);
    const [failure, setFailure] = useState(''),
        [loading, setLoading] = useState(0),
        [issues, setIssues] = useState<Record<string, string>>({});
    // biome-ignore lint/correctness/useExhaustiveDependencies: Recreate GPU resources when the page image or geometry changes; other props are read through latest.
    useEffect(() => {
        setIssues({});
        setLoading(0);
        const element = host.current;
        if (!element) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        } catch {
            setFailure(
                'Không mở được canvas 3D. Hãy bật tăng tốc đồ họa hoặc dùng bảng thuộc tính để tiếp tục chỉnh sửa.',
            );
            return;
        }
        let disposed = false,
            dragging = false,
            frame = 0;
        const scene = new THREE.Scene();
        const theme = getComputedStyle(element);
        const themeColor = (token: string) => new THREE.Color(theme.getPropertyValue(token).trim());
        scene.background = themeColor('--editor-ground');
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
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
        orbit.enableDamping = true;
        orbit.minDistance = 0.15;
        orbit.maxDistance = 15;
        orbit.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        const viewGizmo = gizmoHost.current
            ? createViewGizmoProjection(gizmoHost.current, camera)
            : null;
        function stopOrbitMomentum() {
            const damping = orbit.enableDamping;
            const position = camera.position.clone();
            const target = orbit.target.clone();
            orbit.enableDamping = false;
            orbit.update();
            // Flush internal deltas, then retain the view the user was actually seeing.
            camera.position.copy(position);
            orbit.target.copy(target);
            orbit.update();
            orbit.enableDamping = damping;
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
        const controls = new TransformControls(camera, renderer.domElement);
        controls.setSize(0.8);
        scene.add(controls);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute(
            'aria-label',
            'Canvas 3D: Shift/Ctrl + nhấp để chọn nhiều, Shift + kéo để khoanh vùng, kéo trục để chỉnh; kéo vùng trống để xoay góc nhìn. Nhãn FRONT đánh dấu hướng trước ở mép dưới trang.',
        );
        renderer.domElement.tabIndex = 0;
        element.append(renderer.domElement);
        const ambient = new THREE.HemisphereLight(0xffffff, 0x57665c, 2.2);
        scene.add(ambient);
        const light = new THREE.DirectionalLight(0xffffff, 2.5);
        light.position.set(2, 3, 4);
        scene.add(light);
        const grid = new THREE.GridHelper(
            4,
            40,
            themeColor('--editor-grid-strong'),
            themeColor('--editor-grid'),
        );
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -0.008;
        scene.add(grid);
        const frontGuide = createFrontGuide(latest.current.aspect, {
            surface: theme.getPropertyValue('--bg-surface').trim(),
            foreground: theme.getPropertyValue('--text-primary').trim(),
            border: theme.getPropertyValue('--border-default').trim(),
            font: theme.getPropertyValue('--font-body').trim(),
            anisotropy: renderer.capabilities.getMaxAnisotropy(),
        });
        if (frontGuide) scene.add(frontGuide.mesh);
        const paper = new THREE.Mesh(
            new THREE.PlaneGeometry(1, latest.current.aspect),
            new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
        );
        paper.position.z = -0.003;
        scene.add(paper);
        const paperTexture = new THREE.TextureLoader();
        paperTexture.setCrossOrigin('anonymous');
        paperTexture.load(
            latest.current.page.image.url,
            (texture) => {
                if (disposed) {
                    texture.dispose();
                    return;
                }
                texture.colorSpace = THREE.SRGBColorSpace;
                paper.material.map = texture;
                paper.material.needsUpdate = true;
            },
            undefined,
            () => {
                if (!disposed)
                    setIssues((current) => ({
                        ...current,
                        page: 'Không tải được ảnh trang. Kiểm tra kết nối và tải lại trang.',
                    }));
            },
        );
        const outline = new THREE.Box3Helper(new THREE.Box3(), themeColor('--action-primary'));
        outline.visible = false;
        scene.add(outline);
        const nodes = new Map<string, Node>();
        const selectionPivot = new THREE.Group();
        selectionPivot.name = 'bookaria-selection-pivot';
        selectionPivot.userData.editorHelper = true;
        scene.add(selectionPivot);
        let transformDrag: {
            objects: SceneObject[];
            inverse: THREE.Matrix4;
            group: boolean;
        } | null = null;
        function selectedNodes() {
            return latest.current.selectedIds.flatMap((id) => {
                const node = nodes.get(id);
                return node ? [node] : [];
            });
        }
        function selectionBounds() {
            const box = new THREE.Box3();
            for (const node of selectedNodes()) {
                if (!node.root.visible) continue;
                const bounds = new THREE.Box3().setFromObject(node.root);
                if (bounds.isEmpty()) box.expandByPoint(node.root.position);
                else box.union(bounds);
            }
            return box;
        }
        function applyTransform(node: Node, object: SceneObject) {
            node.root.position.fromArray(object.transform.position);
            node.root.rotation.set(
                ...(object.transform.rotation.map(THREE.MathUtils.degToRad) as [
                    number,
                    number,
                    number,
                ]),
            );
            node.root.scale.fromArray(object.transform.scale);
            node.root.updateMatrixWorld(true);
        }

        const draco = new DRACOLoader().setDecoderPath('/vendor/draco-0.161.0/');
        const loader = new GLTFLoader().setDRACOLoader(draco);
        function resources(root: THREE.Object3D) {
            root.traverse((object) => {
                if (
                    !(
                        object instanceof THREE.Mesh ||
                        object instanceof THREE.Line ||
                        object instanceof THREE.Sprite
                    )
                )
                    return;
                if ('geometry' in object) object.geometry.dispose();
                for (const mat of Array.isArray(object.material)
                    ? object.material
                    : [object.material]) {
                    for (const item of Object.values(mat))
                        if (item instanceof THREE.Texture) item.dispose();
                    mat.dispose();
                }
            });
        }
        const basic = (map: THREE.Texture) =>
            new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide });
        const plane = (w: number, h: number, mat: THREE.Material) =>
            new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        async function build(spec: SceneObject, key: string) {
            const root = new THREE.Group();
            root.userData.objectId = spec.id;
            scene.add(root);
            let media: HTMLMediaElement | undefined;
            const node: Node = {
                root,
                key,
                spec,
                dispose() {
                    scene.remove(root);
                    node.mixer?.stopAllAction();
                    if (node.mixer) node.mixer.uncacheRoot(node.mixer.getRoot());
                    if (media) {
                        media.pause();
                        media.removeAttribute('src');
                        media.load();
                    }
                    resources(root);
                    root.clear();
                },
            };
            nodes.set(spec.id, node);
            setLoading((count) => count + 1);
            try {
                const asset = 'assetId' in spec ? latest.current.assets[spec.assetId] : undefined;
                if ('assetId' in spec && !asset)
                    throw new Error('Thiếu tài nguyên. Chọn lại tài nguyên trong bảng thuộc tính.');
                if (spec.type === 'model' && asset) {
                    const model = await loader.loadAsync(asset.url);
                    if (disposed || nodes.get(spec.id) !== node) {
                        resources(model.scene);
                        return;
                    }
                    root.add(model.scene);
                    node.mixer = new THREE.AnimationMixer(model.scene);
                    if (spec.animation?.autoplay) {
                        const clip = model.animations.find(
                            (clip) => clip.name === spec.animation?.clip,
                        );
                        if (clip) {
                            const action = node.mixer.clipAction(clip);
                            action.setLoop(
                                spec.animation.loop ? THREE.LoopRepeat : THREE.LoopOnce,
                                spec.animation.loop ? Infinity : 1,
                            );
                            action.clampWhenFinished = true;
                            action.play();
                        }
                    }
                } else if (spec.type === 'image' && asset) {
                    const texture = await new THREE.TextureLoader()
                        .setCrossOrigin('anonymous')
                        .loadAsync(asset.url);
                    if (disposed || nodes.get(spec.id) !== node) {
                        texture.dispose();
                        return;
                    }
                    texture.colorSpace = THREE.SRGBColorSpace;
                    const mat = basic(texture);
                    mat.opacity = spec.opacity;
                    root.add(plane(1, texture.image.height / texture.image.width, mat));
                } else if (spec.type === 'text' || spec.type === 'label') {
                    await document.fonts.ready;
                    if (disposed || nodes.get(spec.id) !== node) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = 1024;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Không vẽ được văn bản.');
                    const family =
                        spec.style.font === 'serif'
                            ? 'Georgia, serif'
                            : '"Be Vietnam Pro", sans-serif';
                    ctx.font = `${spec.style.bold ? 700 : 400} 64px ${family}`;
                    ctx.fillStyle = spec.style.color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const lines = wrapText(spec.text, (text) => ctx.measureText(text).width, 980);
                    const height = Math.min(84, 470 / Math.max(lines.length, 1));
                    if (height < 64)
                        ctx.font = `${spec.style.bold ? 700 : 400} ${Math.max(1, height * 0.8)}px ${family}`;
                    lines.forEach((line, index) => {
                        ctx.fillText(
                            line,
                            512,
                            256 + (index - (lines.length - 1) / 2) * height,
                            980,
                        );
                    });
                    const texture = new THREE.CanvasTexture(canvas);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    root.add(plane(spec.style.size * 16, spec.style.size * 8, basic(texture)));
                    if (spec.type === 'label')
                        root.add(
                            new THREE.Line(
                                new THREE.BufferGeometry().setFromPoints([
                                    new THREE.Vector3(),
                                    new THREE.Vector3(...spec.target),
                                ]),
                                new THREE.LineBasicMaterial({ color: spec.style.color }),
                            ),
                        );
                } else if (spec.type === 'video' && asset) {
                    const video = document.createElement('video');
                    media = video;
                    video.crossOrigin = 'anonymous';
                    video.playsInline = true;
                    video.preload = 'auto';
                    video.muted = true;
                    video.src = asset.url;
                    video.addEventListener(
                        'loadeddata',
                        () => {
                            if (!disposed && nodes.get(spec.id) === node)
                                video.currentTime = Math.min(0.05, video.duration || 0);
                        },
                        { once: true },
                    );
                    video.addEventListener('error', () => {
                        if (!disposed && nodes.get(spec.id) === node)
                            setIssues((current) => ({
                                ...current,
                                [spec.id]: 'Không tải được video. Kiểm tra tệp tài nguyên.',
                            }));
                    });
                    const texture = new THREE.VideoTexture(video);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    root.add(
                        plane(
                            1,
                            (asset.meta.height || 1) / (asset.meta.width || 1),
                            basic(texture),
                        ),
                    );
                } else if (spec.type === 'hotspot')
                    root.add(
                        plane(
                            spec.size[0],
                            spec.size[1],
                            new THREE.MeshBasicMaterial({
                                color: themeColor('--action-primary'),
                                transparent: true,
                                opacity: 0.28,
                                side: THREE.DoubleSide,
                                depthWrite: false,
                            }),
                        ),
                    );
                else if (spec.type === 'audio') {
                    // Editor-only position handle; audio playback belongs to the real Viewer preview.
                    root.add(
                        new THREE.Mesh(
                            new THREE.SphereGeometry(0.04, 16, 12),
                            new THREE.MeshBasicMaterial({ color: 0xc58826, wireframe: true }),
                        ),
                    );
                }
                if (disposed || nodes.get(spec.id) !== node) {
                    node.dispose();
                    return;
                }
                setIssues((current) => {
                    const copy = { ...current };
                    delete copy[spec.id];
                    return copy;
                });
                sync();
            } catch (cause) {
                if (!disposed && nodes.get(spec.id) === node)
                    setIssues((current) => ({
                        ...current,
                        [spec.id]: `${spec.name || objectLabels[spec.type]}: ${cause instanceof Error ? cause.message : 'Không tải được đối tượng.'}`,
                    }));
            } finally {
                if (!disposed) setLoading((count) => Math.max(0, count - 1));
            }
        }
        function sync() {
            if (disposed) return;
            const value = latest.current;
            const ids = new Set(value.scene.objects.map((object) => object.id));
            for (const [id, node] of nodes)
                if (!ids.has(id)) {
                    if (controls.object === node.root) controls.detach();
                    node.dispose();
                    nodes.delete(id);
                }
            for (const spec of value.scene.objects) {
                const {
                    transform: _t,
                    name: _n,
                    visible: _v,
                    locked: _l,
                    editorHidden: _h,
                    snapToPaper: _snap,
                    ...content
                } = spec;
                const asset = 'assetId' in spec ? value.assets[spec.assetId] : undefined;
                const key = JSON.stringify([content, asset?.url, asset?.meta]);
                let node = nodes.get(spec.id);
                if (node && node.key !== key) {
                    if (controls.object === node.root) controls.detach();
                    node.dispose();
                    nodes.delete(spec.id);
                    node = undefined;
                }
                if (!node) {
                    void build(spec, key);
                    node = nodes.get(spec.id);
                }
                if (!node) continue;
                node.spec = spec;
                if (!(dragging && latest.current.selectedIds.includes(spec.id))) {
                    if (
                        [
                            ...spec.transform.position,
                            ...spec.transform.rotation,
                            ...spec.transform.scale,
                        ].every(Number.isFinite)
                    ) {
                        node.root.position.fromArray(spec.transform.position);
                        node.root.rotation.set(
                            ...(spec.transform.rotation.map(THREE.MathUtils.degToRad) as [
                                number,
                                number,
                                number,
                            ]),
                        );
                        node.root.scale.fromArray(spec.transform.scale);
                    }
                }
                node.root.visible = !spec.editorHidden;
            }
            const selected = selectedNodes();
            const bounds = selectionBounds();
            const canTransform =
                selected.length > 0 &&
                selected.length === value.selectedIds.length &&
                selected.every(
                    (node) =>
                        !node.spec.editorHidden &&
                        !node.spec.locked &&
                        [
                            ...node.spec.transform.position,
                            ...node.spec.transform.rotation,
                            ...node.spec.transform.scale,
                        ].every(Number.isFinite) &&
                        node.spec.transform.scale.every((n) => n > 0),
                ) &&
                !value.disabled;
            if (canTransform) {
                const target = selected.length === 1 ? selected[0].root : selectionPivot;
                if (target === selectionPivot && !dragging) {
                    selectionPivot.position.copy(bounds.getCenter(new THREE.Vector3()));
                    selectionPivot.rotation.set(0, 0, 0);
                    selectionPivot.scale.setScalar(1);
                    selectionPivot.updateMatrixWorld(true);
                }
                if (controls.object !== target) controls.attach(target);
                controls.showZ = true;
            } else controls.detach();
            outline.box.copy(bounds);
            outline.visible = !bounds.isEmpty();
        }
        const changed = () => {
            const root = controls.object;
            if (!root || latest.current.disabled) return;
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
                    rotation: [root.rotation.x, root.rotation.y, root.rotation.z].map(
                        THREE.MathUtils.radToDeg,
                    ) as [number, number, number],
                    scale: root.scale.toArray(),
                },
                controls.mode === 'translate',
                controls.axis,
            );
            if (next) latest.current.onChange([next]);
        };
        function finishTransform(cancelled = false) {
            if (!dragging) return false;
            if (cancelled && transformDrag) {
                for (const object of transformDrag.objects) {
                    const node = nodes.get(object.id);
                    if (node) applyTransform(node, object);
                }
                latest.current.onChange(transformDrag.objects);
            } else changed();
            dragging = false;
            controls.dragging = false;
            transformDrag = null;
            latest.current.onEnd();
            orbit.enabled = true;
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
            dragging = true;
            latest.current.onBegin();
            orbit.enabled = false;
        });
        controls.addEventListener('mouseUp', () => finishTransform());
        const start = new THREE.Vector2();
        let selecting: { id: number; x: number; y: number; moved: boolean; box: boolean } | null =
            null;
        function hitObject(event: PointerEvent) {
            const rect = renderer.domElement.getBoundingClientRect();
            const ray = new THREE.Raycaster();
            ray.setFromCamera(
                new THREE.Vector2(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    (-(event.clientY - rect.top) / rect.height) * 2 + 1,
                ),
                camera,
            );
            const hits = ray.intersectObjects(
                [...nodes.values()].filter((node) => node.root.visible).map((node) => node.root),
                true,
            );
            for (const hit of hits) {
                let root: THREE.Object3D | null = hit.object;
                while (root && !root.userData.objectId) root = root.parent;
                if (root) return root.userData.objectId as string;
            }
            return null;
        }
        function marqueeRect(x: number, y: number) {
            const rect = renderer.domElement.getBoundingClientRect();
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
            orbit.enabled = !dragging;
            if (previous && renderer.domElement.hasPointerCapture(previous.id))
                renderer.domElement.releasePointerCapture(previous.id);
            return Boolean(previous);
        }
        const pointerDown = (event: PointerEvent) => {
            start.set(event.clientX, event.clientY);
            if (
                event.button !== 0 ||
                latest.current.disabled ||
                dragging ||
                !(event.shiftKey || event.ctrlKey || event.metaKey)
            )
                return;
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
            renderer.domElement.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const pointerMove = (event: PointerEvent) => {
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
            if (selecting?.id === event.pointerId) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!latest.current.disabled) {
                    if (selecting.box && selecting.moved) {
                        const rect = renderer.domElement.getBoundingClientRect();
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
                                    frustum?.intersectsBox(
                                        new THREE.Box3().setFromObject(node.root),
                                    ),
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
                dragging ||
                start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4 ||
                latest.current.disabled
            )
                return;
            const id = hitObject(event);
            latest.current.onSelect(id ? [id] : [], 'replace');
        };
        const pointerCancel = () => {
            clearMarquee();
            finishTransform(true);
        };
        const lostCapture = () => {
            if (selecting) clearMarquee();
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown, true);
        renderer.domElement.addEventListener('pointermove', pointerMove, true);
        renderer.domElement.addEventListener('pointerup', pointerUp, true);
        renderer.domElement.addEventListener('pointercancel', pointerCancel);
        renderer.domElement.addEventListener('lostpointercapture', lostCapture);
        const resize = new ResizeObserver(() => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            renderer.setSize(rect.width, rect.height);
            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
        });
        resize.observe(element);
        const clock = new THREE.Clock();
        function tick() {
            if (disposed) return;
            frame = requestAnimationFrame(tick);
            const delta = Math.min(clock.getDelta(), 0.05);
            for (const node of nodes.values()) node.mixer?.update(delta);
            orbit.update();
            if (outline.visible) outline.box.copy(selectionBounds());
            renderer.render(scene, camera);
            viewGizmo?.update();
        }
        api.current = {
            sync,
            mode(value, snapped) {
                controls.setMode(value);
                controls.setTranslationSnap(snapped ? 0.025 : null);
                controls.setRotationSnap(snapped ? Math.PI / 12 : null);
                controls.setScaleSnap(snapped ? 0.05 : null);
                sync();
            },
            view(view) {
                // Clear the last orbit/pan gesture before applying an exact preset.
                stopOrbitMomentum();
                const distance = stageDistance();
                orbit.target.set(0, -0.18, 0);
                if (view === 'front') camera.position.set(0, orbit.target.y, distance);
                else if (view === 'side') camera.position.set(distance, orbit.target.y, 0.01);
                else
                    camera.position.set(
                        distance * 0.65,
                        orbit.target.y - distance * 0.65,
                        distance,
                    );
                orbit.update();
            },
            cancel() {
                return clearMarquee() || finishTransform(true);
            },
            focus() {
                const box = selectionBounds();
                if (box.isEmpty()) return;
                const center = box.getCenter(new THREE.Vector3());
                const distance = Math.max(0.25, box.getSize(new THREE.Vector3()).length() * 1.5);
                const direction = camera.position.clone().sub(orbit.target).normalize();
                orbit.target.copy(center);
                camera.position.copy(center).addScaledVector(direction, distance);
                orbit.update();
            },
        };
        sync();
        tick();
        return () => {
            disposed = true;
            if (marqueeHost.current) marqueeHost.current.hidden = true;
            cancelAnimationFrame(frame);
            api.current = null;
            gizmoController.current = null;
            viewGizmo?.dispose();
            resize.disconnect();
            renderer.domElement.removeEventListener('pointerdown', pointerDown, true);
            renderer.domElement.removeEventListener('pointermove', pointerMove, true);
            renderer.domElement.removeEventListener('pointerup', pointerUp, true);
            renderer.domElement.removeEventListener('pointercancel', pointerCancel);
            renderer.domElement.removeEventListener('lostpointercapture', lostCapture);
            controls.detach();
            controls.dispose();
            orbit.dispose();
            for (const node of nodes.values()) node.dispose();
            draco.dispose();
            frontGuide?.dispose();
            paper.material.map?.dispose();
            paper.geometry.dispose();
            paper.material.dispose();
            grid.geometry.dispose();
            (grid.material as THREE.Material).dispose();
            outline.geometry.dispose();
            (outline.material as THREE.Material).dispose();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [props.page.id, props.page.image.url, props.aspect]);
    useEffect(() => {
        api.current?.sync();
    });
    useEffect(() => {
        api.current?.mode(mode, snap);
    }, [mode, snap]);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                document.querySelector(
                    '[role=dialog], [role=alertdialog], [role=menu], [data-slot=select-content][data-state=open]',
                )
            )
                return;
            if (
                (event.target as HTMLElement)?.closest(
                    'input,textarea,select,[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[data-slot="accordion-trigger"],[contenteditable="true"]',
                ) ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            )
                return;
            const value = event.key.toLowerCase();
            if (value === 'escape' && api.current?.cancel()) {
                event.preventDefault();
                return;
            }
            if (value === 'w') setMode('translate');
            if (value === 'e') setMode('rotate');
            if (value === 'r') setMode('scale');
            if (value === 'f') api.current?.focus();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, []);
    return (
        <div className="scene-stage-column relative flex min-h-0 min-w-0 flex-col bg-[var(--editor-ground)] max-[760px]:min-h-120 [.scene-editor[data-panel=preview]_&]:hidden">
            <div
                className="canvas-toolbar absolute bottom-[58px] left-[18px] z-2 flex flex-col gap-[6px] rounded-[12px] bg-surface p-[5px] shadow-[0_4px_14px_#00000014] [&_button:hover]:bg-hover [&_button:hover]:text-foreground [&_button[aria-pressed=true]]:bg-selected [&_button[aria-pressed=true]]:text-primary [&_button[data-state=on]]:bg-selected [&_button[data-state=on]]:text-primary [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:rounded-[8px] [&_button]:border-0 [&_button]:border-[transparent] [&_button]:border-solid [&_button]:bg-[transparent] [&_button]:p-[10px] [&_button]:text-[length:11px] [&_button]:text-muted-foreground [&_button_span]:hidden"
                role="toolbar"
                aria-label="Công cụ canvas"
            >
                <ToggleGroup
                    type="single"
                    orientation="vertical"
                    value={mode}
                    onValueChange={(value) => {
                        if (value) setMode(value as Mode);
                    }}
                    disabled={props.disabled}
                    aria-label="Chế độ biến đổi"
                    className="canvas-tool-group flex-col gap-[3px]"
                >
                    {(
                        [
                            { value: 'translate', label: 'Di chuyển (W)', icon: Move },
                            { value: 'rotate', label: 'Xoay (E)', icon: RotateCw },
                            { value: 'scale', label: 'Kích thước (R)', icon: Scaling },
                        ] as const
                    ).map((tool) => (
                        <ToggleGroupItem
                            key={tool.value}
                            value={tool.value}
                            title={tool.label}
                            aria-label={tool.label}
                            disabled={props.disabled}
                        >
                            <tool.icon size={18} />
                            <span>{tool.label.split(' (')[0]}</span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <div className="canvas-tool-group flex flex-col gap-[3px]">
                    <ActionButton
                        variant="plain"
                        type="button"
                        title="Bắt bước: 0,025 đơn vị / 15°"
                        aria-label="Bật bắt bước"
                        aria-pressed={snap}
                        onClick={() => setSnap(!snap)}
                    >
                        <Magnet size={18} />
                    </ActionButton>
                    <ActionButton
                        variant="plain"
                        type="button"
                        aria-label="Đưa đối tượng vào giữa (F)"
                        onClick={() => api.current?.focus()}
                    >
                        <Focus size={18} />
                    </ActionButton>
                    <ActionButton
                        variant="plain"
                        type="button"
                        aria-label="Vừa trang"
                        onClick={() => api.current?.view('front')}
                    >
                        <Maximize2 size={18} />
                    </ActionButton>
                </div>
            </div>
            <div className="canvas-viewport relative min-h-90 flex-[1] overflow-hidden">
                <div
                    className="scene-three-host absolute top-0 right-0 bottom-0 left-0 [touch-action:none] [&_canvas]:block [&_canvas]:size-full"
                    ref={host}
                />
                <div
                    ref={marqueeHost}
                    hidden
                    aria-hidden="true"
                    data-selection-marquee
                    className="pointer-events-none absolute border border-primary bg-primary/10"
                />
                {!failure && (
                    <SceneViewGizmo
                        key={`${props.page.id}:${props.page.image.url}:${props.aspect}`}
                        hostRef={gizmoHost}
                        controller={gizmoController}
                    />
                )}
                {failure && (
                    <p
                        className="canvas-failure absolute top-[35%] right-[10%] bottom-auto left-[10%] bg-surface p-5 text-[length:13px]"
                        role="alert"
                    >
                        {failure}
                    </p>
                )}
                <fieldset
                    className="canvas-view-switch absolute top-[18px] left-[18px] flex rounded-[10px] bg-surface p-[3px] shadow-[0_2px_6px_#0000000a] [&_button:hover]:bg-hover [&_button:hover]:text-foreground [&_button]:flex [&_button]:items-center [&_button]:gap-[5px] [&_button]:rounded-[8px] [&_button]:border-0 [&_button]:border-[transparent] [&_button]:border-solid [&_button]:bg-[transparent] [&_button]:p-[10px] [&_button]:text-[length:11px] [&_button]:text-muted-foreground"
                    aria-label="Góc nhìn"
                >
                    {[
                        ['front', 'Mặt trang'],
                        ['iso', 'Phối cảnh'],
                        ['side', 'Bên cạnh'],
                    ].map(([value, label]) => (
                        <ActionButton
                            variant="plain"
                            key={value}
                            type="button"
                            onClick={() => api.current?.view(value)}
                        >
                            {label}
                        </ActionButton>
                    ))}
                </fieldset>
                {loading > 0 && (
                    <p
                        className="canvas-loading absolute bottom-2 left-[74px] rounded-[5px] bg-surface px-[10px] py-[5px] text-[length:12px]"
                        role="status"
                    >
                        Đang tải {loading} đối tượng…
                    </p>
                )}
            </div>
            <div className="canvas-footer absolute right-[18px] bottom-[42px] z-3 max-[760px]:right-[10px] max-[760px]:bottom-[58px] max-[760px]:left-[10px] max-[760px]:max-w-[calc(100%_-_20px)]">
                {props.footer}
            </div>
            <div className="canvas-status flex flex-wrap justify-center gap-3 bg-[var(--editor-ground)] px-[10px] py-2 text-[length:10px] text-muted-foreground [&_span:last-child]:hidden">
                <span>
                    Shift + kéo: chọn nhiều · Kéo vùng trống: xoay · Cuộn: thu/phóng · Chuột phải:
                    dịch góc nhìn{props.selectedIds.length > 1 ? ' · Scale nhóm đồng đều' : ''}
                </span>
                <span>1 đơn vị = chiều rộng trang</span>
            </div>
            <p className="sr-only" role="status" aria-live="polite">
                Đã chọn {props.selectedIds.length} đối tượng.
            </p>
            {Object.entries(issues)
                .filter(
                    ([id]) =>
                        id === 'page' || props.scene.objects.some((object) => object.id === id),
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
