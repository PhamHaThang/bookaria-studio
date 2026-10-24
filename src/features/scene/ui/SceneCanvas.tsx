import { Focus, Magnet, Maximize2, Move, RotateCw, Scaling } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { Page } from '../../../shared/contracts/dto.schema';
import type { Scene, SceneObject } from '../../../shared/contracts/scene.schema';
import { objectLabels } from '../model/objects';
import { wrapText } from '../model/text';
import { safeTransform } from '../model/transforms';

type Mode = 'translate' | 'rotate' | 'scale';
type Props = {
    footer?: ReactNode;
    page: Page;
    aspect: number;
    scene: Scene;
    assets: Record<string, AssetRef>;
    selectedId?: string;
    disabled: boolean;
    onSelect: (id: string) => void;
    onChange: (object: SceneObject) => void;
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
        latest = useRef(props);
    latest.current = props;
    const api = useRef<{
        sync: () => void;
        mode: (mode: Mode, snap: boolean) => void;
        view: (view: string) => void;
        focus: () => void;
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
        scene.background = new THREE.Color('#eef0f4');
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        camera.position.set(0, -0.9, 2.2);
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true;
        orbit.minDistance = 0.15;
        orbit.maxDistance = 15;
        orbit.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        const controls = new TransformControls(camera, renderer.domElement);
        controls.setSize(0.8);
        scene.add(controls);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.setAttribute(
            'aria-label',
            'Canvas 3D: chọn đối tượng, kéo trục để chỉnh; kéo vùng trống để xoay góc nhìn',
        );
        renderer.domElement.tabIndex = 0;
        element.append(renderer.domElement);
        const ambient = new THREE.HemisphereLight(0xffffff, 0x57665c, 2.2);
        scene.add(ambient);
        const light = new THREE.DirectionalLight(0xffffff, 2.5);
        light.position.set(2, 3, 4);
        scene.add(light);
        const grid = new THREE.GridHelper(4, 40, 0xaeb5c0, 0xd2d7df);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -0.008;
        scene.add(grid);
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
        const outline = new THREE.BoxHelper(new THREE.Object3D(), 0x215fff);
        outline.visible = false;
        scene.add(outline);
        const nodes = new Map<string, Node>();
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
                                color: 0x215fff,
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
                if (!(dragging && controls.object === node.root)) {
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
            const selected = value.selectedId ? nodes.get(value.selectedId) : undefined;
            if (
                selected &&
                !selected.spec.editorHidden &&
                !selected.spec.locked &&
                !value.disabled
            ) {
                if (controls.object !== selected.root) controls.attach(selected.root);
                controls.showZ = !(selected.spec.snapToPaper && controls.mode === 'translate');
            } else controls.detach();
            if (selected?.root.visible) {
                outline.setFromObject(selected.root);
                outline.visible = !new THREE.Box3().setFromObject(selected.root).isEmpty();
            } else outline.visible = false;
        }
        const changed = () => {
            const root = controls.object;
            if (!root || latest.current.disabled) return;
            const spec = latest.current.scene.objects.find(
                (object) => object.id === root.userData.objectId,
            );
            if (!spec || spec.locked) return;
            const transform = safeTransform(
                {
                    position: root.position.toArray(),
                    rotation: [root.rotation.x, root.rotation.y, root.rotation.z].map(
                        THREE.MathUtils.radToDeg,
                    ) as [number, number, number],
                    scale: root.scale.toArray(),
                },
                spec.snapToPaper,
                controls.mode === 'translate',
            );
            if (transform) latest.current.onChange({ ...spec, transform });
        };
        controls.addEventListener('objectChange', changed);
        controls.addEventListener('mouseDown', () => {
            dragging = true;
            latest.current.onBegin();
            orbit.enabled = false;
        });
        controls.addEventListener('mouseUp', () => {
            if (!dragging) return;
            changed();
            dragging = false;
            latest.current.onEnd();
            orbit.enabled = true;
            sync();
        });
        const start = new THREE.Vector2();
        const pointerDown = (event: PointerEvent) => start.set(event.clientX, event.clientY);
        const pointerUp = (event: PointerEvent) => {
            if (
                event.button !== 0 ||
                controls.axis ||
                start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4 ||
                latest.current.disabled
            )
                return;
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
                if (root) {
                    latest.current.onSelect(root.userData.objectId);
                    break;
                }
            }
        };
        renderer.domElement.addEventListener('pointerdown', pointerDown);
        renderer.domElement.addEventListener('pointerup', pointerUp);
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
            const selected = latest.current.selectedId
                ? nodes.get(latest.current.selectedId)
                : undefined;
            if (selected && outline.visible) outline.setFromObject(selected.root);
            renderer.render(scene, camera);
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
                const distance = Math.max(1.6, latest.current.aspect * 1.5);
                orbit.target.set(0, 0, 0);
                if (view === 'front') camera.position.set(0, 0, distance);
                else if (view === 'side') camera.position.set(distance, 0, 0.01);
                else camera.position.set(distance * 0.65, -distance * 0.65, distance);
                orbit.update();
            },
            focus() {
                const selected = latest.current.selectedId
                    ? nodes.get(latest.current.selectedId)
                    : undefined;
                if (!selected) return;
                const box = new THREE.Box3().setFromObject(selected.root);
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
            cancelAnimationFrame(frame);
            api.current = null;
            resize.disconnect();
            controls.detach();
            controls.dispose();
            orbit.dispose();
            for (const node of nodes.values()) node.dispose();
            draco.dispose();
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
                (event.target as HTMLElement)?.closest(
                    'input,textarea,select,[contenteditable="true"]',
                ) ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            )
                return;
            const value = event.key.toLowerCase();
            if (value === 'w') setMode('translate');
            if (value === 'e') setMode('rotate');
            if (value === 'r') setMode('scale');
            if (value === 'f') api.current?.focus();
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, []);
    return (
        <div className="scene-stage-column">
            <div className="canvas-toolbar" role="toolbar" aria-label="Công cụ canvas">
                <div className="canvas-tool-group">
                    {(
                        [
                            { value: 'translate', label: 'Di chuyển (W)', icon: Move },
                            { value: 'rotate', label: 'Xoay (E)', icon: RotateCw },
                            { value: 'scale', label: 'Kích thước (R)', icon: Scaling },
                        ] as const
                    ).map((tool) => (
                        <button
                            key={tool.value}
                            type="button"
                            title={tool.label}
                            aria-label={tool.label}
                            aria-pressed={mode === tool.value}
                            disabled={props.disabled}
                            onClick={() => setMode(tool.value)}
                        >
                            <tool.icon size={18} />
                            <span>{tool.label.split(' (')[0]}</span>
                        </button>
                    ))}
                </div>
                <div className="canvas-tool-group">
                    <button
                        type="button"
                        title="Bắt bước: 0,025 đơn vị / 15°"
                        aria-label="Bật bắt bước"
                        aria-pressed={snap}
                        onClick={() => setSnap(!snap)}
                    >
                        <Magnet size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label="Đưa đối tượng vào giữa (F)"
                        onClick={() => api.current?.focus()}
                    >
                        <Focus size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label="Vừa trang"
                        onClick={() => api.current?.view('front')}
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>
            </div>
            <div className="canvas-viewport">
                <div className="scene-three-host" ref={host} />
                {failure && (
                    <p className="canvas-failure" role="alert">
                        {failure}
                    </p>
                )}
                <fieldset className="canvas-view-switch" aria-label="Góc nhìn">
                    {[
                        ['front', 'Mặt trang'],
                        ['iso', 'Phối cảnh'],
                        ['side', 'Bên cạnh'],
                    ].map(([value, label]) => (
                        <button key={value} type="button" onClick={() => api.current?.view(value)}>
                            {label}
                        </button>
                    ))}
                </fieldset>
                {loading > 0 && (
                    <p className="canvas-loading" role="status">
                        Đang tải {loading} đối tượng…
                    </p>
                )}
            </div>
            <div className="canvas-footer">{props.footer}</div>
            <div className="canvas-status">
                <span>Kéo vùng trống: xoay · Cuộn: thu/phóng · Chuột phải: dịch góc nhìn</span>
                <span>1 đơn vị = chiều rộng trang</span>
            </div>
            {Object.entries(issues)
                .filter(
                    ([id]) =>
                        id === 'page' || props.scene.objects.some((object) => object.id === id),
                )
                .map(([id, issue]) => (
                    <p className="canvas-issue" role="alert" key={id}>
                        {issue}
                    </p>
                ))}
        </div>
    );
}
