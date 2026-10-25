import { Maximize, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cn } from '@/shared/lib/cn';
import { Feedback } from '@/shared/ui/Feedback';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { formatBytes } from '../../../shared/lib/format';
import {
    applyPreviewPlacement,
    fitPreviewCamera,
    normalizePreviewModel,
    type PreviewPlacement,
    visibleModelBounds,
} from '../model/preview-fit';

function disposeTree(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
    root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material)
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                materials.add(material);
                for (const value of Object.values(material))
                    if (value instanceof THREE.Texture) textures.add(value);
            }
    });
    for (const texture of textures) {
        const source = texture.source?.data;
        if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close();
        texture.dispose();
    }
    for (const material of materials) material.dispose();
    for (const geometry of geometries) geometry.dispose();
}
export type ModelPreviewOptions = { controlsTarget?: HTMLElement | null; fileSize?: number };
export default function ModelPreview({
    url,
    controlsTarget,
    fileSize,
}: { url: string } & ModelPreviewOptions) {
    const host = useRef<HTMLDivElement>(null),
        runtime = useRef<{
            reset: () => void;
            place: (placement: PreviewPlacement) => void;
            play: (name: string) => void;
            pause: (paused: boolean) => void;
            background: (color: string) => void;
        } | null>(null);
    const [info, setInfo] = useState<{ triangles: number; clips: string[] } | null>(null),
        [error, setError] = useState<string | null>(null),
        [clip, setClip] = useState(''),
        [playing, setPlaying] = useState(false),
        [background, setBackground] = useState('#f7f7f7'),
        [placement, setPlacement] = useState({ scale: '100', x: '0', y: '0', z: '0' });
    const validPlacement = useRef<PreviewPlacement>({ scale: 1, x: 0, y: 0, z: 0 });
    useEffect(() => {
        setInfo(null);
        setError(null);
        setClip('');
        setPlaying(false);
        setPlacement({ scale: '100', x: '0', y: '0', z: '0' });
        validPlacement.current = { scale: 1, x: 0, y: 0, z: 0 };
        const element = host.current;
        if (!element) return;
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch {
            setError('Không mở được trình xem 3D. Hãy bật tăng tốc đồ họa trong trình duyệt.');
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        element.append(renderer.domElement);
        const scene = new THREE.Scene(),
            camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true;
        orbit.minDistance = 0.25;
        orbit.maxDistance = 12;
        scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.5));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(3, 5, 4);
        scene.add(light);
        const grid = new THREE.GridHelper(8, 32, 0xb5b5b5, 0xdedede);
        grid.position.y = -0.01;
        scene.add(grid);
        const draco = new DRACOLoader().setDecoderPath('/vendor/draco-0.161.0/');
        const loader = new GLTFLoader().setDRACOLoader(draco),
            clock = new THREE.Clock();
        const controller = new AbortController();
        let disposed = false,
            root: THREE.Object3D | null = null,
            mixer: THREE.AnimationMixer | null = null;
        let framed: THREE.Group | null = null,
            lastFit = 0;
        camera.position.set(2.6, 1.7, 2.6);
        orbit.target.set(0, 0.5, 0);
        orbit.update();
        function reset(preserve = false) {
            if (!framed) return;
            const direction = preserve
                ? camera.position.clone().sub(orbit.target)
                : new THREE.Vector3(1, 0.65, 1);
            const zoomRatio = preserve && lastFit ? direction.length() / lastFit : 1;
            // Drain pending orbit motion before applying a new frame.
            orbit.enableDamping = false;
            orbit.update();
            orbit.enableDamping = true;
            const view = fitPreviewCamera(visibleModelBounds(framed), camera, direction);
            orbit.target.copy(view.target);
            camera.position.sub(view.target).multiplyScalar(zoomRatio).add(view.target);
            orbit.minDistance = view.radius * 0.05;
            orbit.maxDistance = Math.max(view.distance * 15, view.radius * 40);
            camera.far = Math.max(camera.far, orbit.maxDistance + view.radius * 2);
            camera.updateProjectionMatrix();
            orbit.update();
            lastFit = view.distance;
        }
        const resize = new ResizeObserver(() => {
            const { width, height } = element.getBoundingClientRect();
            if (width <= 0 || height <= 0) return;
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            reset(true);
        });
        resize.observe(element);
        const contextLost = (event: Event) => {
            event.preventDefault();
            setError('Trình xem 3D bị gián đoạn. Đóng phần xem trước rồi mở lại.');
        };
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        renderer.setAnimationLoop(() => {
            if (disposed) return;
            mixer?.update(Math.min(clock.getDelta(), 0.1));
            orbit.update();
            renderer.render(scene, camera);
        });
        void (async () => {
            try {
                // Fetch is abortable; parsing may finish after unmount and must still release its resources.
                const response = await fetch(url, {
                    signal: controller.signal,
                    credentials: 'omit',
                });
                if (!response.ok) throw new Error('Không tải được mô hình. Hãy thử mở lại.');
                const model = await loader.parseAsync(
                    await response.arrayBuffer(),
                    new URL('.', url.startsWith('blob:') ? window.location.href : url).href,
                );
                if (disposed) {
                    disposeTree(model.scene);
                    return;
                }
                root = model.scene;
                framed = normalizePreviewModel(root);
                scene.add(framed);
                const rect = element.getBoundingClientRect();
                camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
                reset();
                let triangles = 0;
                root.traverse((node) => {
                    const mesh = node as THREE.Mesh;
                    if (mesh.isMesh && mesh.geometry?.getAttribute('position'))
                        triangles +=
                            ((mesh.geometry.index?.count ??
                                mesh.geometry.getAttribute('position').count) /
                                3) *
                            (mesh instanceof THREE.InstancedMesh ? mesh.count : 1);
                });
                mixer = new THREE.AnimationMixer(root);
                const base = { scale: framed.scale.x, position: framed.position.clone() };
                let action: THREE.AnimationAction | null = null;
                runtime.current = {
                    reset: () => reset(),
                    place(placement) {
                        if (framed) applyPreviewPlacement(framed, base, placement);
                    },
                    pause(paused) {
                        if (action) action.paused = paused;
                    },
                    background(color) {
                        scene.background = new THREE.Color(color);
                    },
                    play(name) {
                        mixer?.stopAllAction();
                        const animation = model.animations.find((item) => item.name === name);
                        action = animation && mixer ? mixer.clipAction(animation) : null;
                        action?.play();
                        mixer?.update(0);
                        reset();
                    },
                };
                setInfo({
                    triangles: Math.floor(triangles),
                    clips: model.animations.map((item) => item.name).filter(Boolean),
                });
            } catch (cause) {
                if (!disposed && !controller.signal.aborted)
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : 'Không xem trước được mô hình. Hãy thử tệp GLB khác.',
                    );
            }
        })();
        return () => {
            disposed = true;
            controller.abort();
            runtime.current = null;
            resize.disconnect();
            renderer.setAnimationLoop(null);
            renderer.domElement.removeEventListener('webglcontextlost', contextLost);
            orbit.dispose();
            mixer?.stopAllAction();
            if (root) {
                mixer?.uncacheRoot(root);
                disposeTree(root);
            }
            grid.geometry.dispose();
            (grid.material as THREE.Material).dispose();
            draco.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        };
    }, [url]);
    useEffect(() => {
        if (info) runtime.current?.background(background);
    }, [background, info]);
    function editPlacement(field: 'scale' | 'x' | 'y' | 'z', value: string) {
        const next = { ...placement, [field]: value };
        setPlacement(next);
        const parsed = {
            scale: Number(next.scale) / 100,
            x: Number(next.x),
            y: Number(next.y),
            z: Number(next.z),
        };
        if (
            Object.values(next).some((v) => v.trim() === '') ||
            !Object.values(parsed).every(Number.isFinite) ||
            parsed.scale < 0.01 ||
            parsed.scale > 10
        )
            return;
        validPlacement.current = parsed;
        runtime.current?.place(parsed);
    }
    function restorePlacement() {
        setPlacement({ scale: '100', x: '0', y: '0', z: '0' });
        validPlacement.current = { scale: 1, x: 0, y: 0, z: 0 };
        runtime.current?.place(validPlacement.current);
        runtime.current?.reset();
    }
    const placementControls = (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Kích thước và vị trí mô hình"
                    title="Kích thước và vị trí"
                    disabled={!info}
                >
                    <SlidersHorizontal />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="end"
                sideOffset={12}
                className="w-80 gap-4 p-4"
                aria-label="Điều chỉnh mô hình"
                onEscapeKeyDown={(event) => event.stopPropagation()}
            >
                <PopoverHeader>
                    <PopoverTitle>Kích thước và vị trí</PopoverTitle>
                    <PopoverDescription>
                        Thu phóng và dịch chuyển mô hình trong khung xem.
                    </PopoverDescription>
                </PopoverHeader>
                <FieldGroup className="gap-3 [&_[data-slot=field-label]]:m-0 [&_[data-slot=input]]:m-0 [&_[data-slot=input]]:min-h-10">
                    <Field>
                        <FieldLabel htmlFor="preview-scale">Thu phóng (%)</FieldLabel>
                        <Input
                            id="preview-scale"
                            type="number"
                            min={1}
                            max={1000}
                            step={10}
                            value={placement.scale}
                            onChange={(e) => editPlacement('scale', e.currentTarget.value)}
                            onBlur={() =>
                                setPlacement((current) => ({
                                    ...current,
                                    scale: String(validPlacement.current.scale * 100),
                                }))
                            }
                        />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                        {(['x', 'y', 'z'] as const).map((axis) => (
                            <Field key={axis}>
                                <FieldLabel htmlFor={`preview-position-${axis}`}>
                                    Vị trí {axis.toUpperCase()}
                                </FieldLabel>
                                <Input
                                    id={`preview-position-${axis}`}
                                    type="number"
                                    step={0.1}
                                    value={placement[axis]}
                                    onChange={(e) => editPlacement(axis, e.currentTarget.value)}
                                    onBlur={() =>
                                        setPlacement((current) => ({
                                            ...current,
                                            [axis]: String(validPlacement.current[axis]),
                                        }))
                                    }
                                />
                            </Field>
                        ))}
                    </div>
                </FieldGroup>
                <Button variant="secondary" size="sm" onClick={restorePlacement}>
                    Tự căn giữa và vừa khung
                </Button>
            </PopoverContent>
        </Popover>
    );
    const animationControls = (
        <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 font-semibold text-sm">Animation</legend>
            {info?.clips.length ? (
                <div className="flex min-w-0 items-center gap-2">
                    <FormSelect
                        aria-label="Xem thử animation"
                        value={clip}
                        onValueChange={(value) => {
                            setClip(value);
                            setPlaying(Boolean(value));
                            runtime.current?.play(value);
                        }}
                        options={[
                            { value: '', label: 'Chọn animation' },
                            ...info.clips.map((name) => ({ value: name, label: name })),
                        ]}
                    />
                    <Button
                        variant="secondary"
                        size="icon"
                        disabled={!clip}
                        aria-label={playing ? 'Tạm dừng animation' : 'Phát animation'}
                        onClick={() => {
                            runtime.current?.pause(playing);
                            setPlaying(!playing);
                        }}
                    >
                        {playing ? <Pause /> : <Play />}
                    </Button>
                </div>
            ) : (
                <p className="text-muted-foreground text-xs">
                    {info
                        ? 'Mô hình này không có animation.'
                        : 'Animation sẽ hiển thị sau khi đọc mô hình.'}
                </p>
            )}
        </fieldset>
    );
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                ref={host}
                className="relative min-h-0 flex-1 [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:size-full"
                role="img"
                aria-label="Xem trước mô hình 3D"
            />
            <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-border border-t bg-surface px-4 py-2">
                {fileSize !== undefined && (
                    <div className="flex flex-col gap-1 text-xs">
                        <span className="font-medium">Dung lượng</span>
                        <span className="text-muted-foreground tabular-nums">
                            {formatBytes(fileSize)}
                        </span>
                    </div>
                )}
                {error ? (
                    <Feedback error={error} />
                ) : !info ? (
                    <span
                        role="status"
                        className="flex items-center gap-2 text-muted-foreground text-sm"
                    >
                        <Spinner />
                        Đang đọc mô hình…
                    </span>
                ) : (
                    <>
                        <div className="flex flex-col gap-1 text-xs">
                            <span className="font-medium">Hình học</span>
                            <span className="text-muted-foreground tabular-nums">
                                {info.triangles.toLocaleString('vi-VN')} tam giác
                            </span>
                        </div>
                        {!controlsTarget && info.clips.length > 0 && animationControls}
                    </>
                )}
                {controlsTarget && (
                    <fieldset className="flex items-center gap-2" aria-label="Nền xem trước">
                        <legend className="sr-only">Nền xem trước</legend>
                        {[
                            { color: '#ffffff', label: 'Trắng' },
                            { color: '#f7f7f7', label: 'Xám nhạt' },
                            { color: '#252525', label: 'Tối' },
                        ].map(({ color, label }) => (
                            <Button
                                key={color}
                                variant="plain"
                                className={cn(
                                    'size-7 rounded-full border border-border',
                                    background === color && 'ring-2 ring-primary ring-offset-2',
                                )}
                                style={{ backgroundColor: color }}
                                aria-label={`Nền ${label.toLowerCase()}`}
                                aria-pressed={background === color}
                                onClick={() => setBackground(color)}
                            />
                        ))}
                    </fieldset>
                )}
                <span className="ml-auto text-muted-foreground text-xs max-[1100px]:hidden">
                    Kéo để xoay · Cuộn để thu phóng
                </span>
                {placementControls}
                <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Vừa khung mô hình"
                    title="Vừa khung mô hình"
                    onClick={() => runtime.current?.reset()}
                >
                    <Maximize />
                </Button>
            </div>
            {controlsTarget && createPortal(animationControls, controlsTarget)}
        </div>
    );
}
