import { Focus, Move, RotateCcw, RotateCw, Scaling } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import type { Action, Scene } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
import { Button } from '@/shared/ui/primitives/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
import { assetsApi } from '../../assets';
import { LocalPreviewStage } from '../../preview/model/LocalPreviewStage';
import { makePreviewPayload } from '../../preview/model/preview';
import { objectName } from '../model/interaction-templates';

type TargetAction = Extract<Action, { type: 'transformTo' }>;
const tools = [
    { mode: 'translate', field: 'position', label: 'Di chuyển', shortcut: 'W', icon: Move },
    { mode: 'rotate', field: 'rotation', label: 'Xoay', shortcut: 'E', icon: RotateCw },
    { mode: 'scale', field: 'scale', label: 'Kích thước', shortcut: 'R', icon: Scaling },
] as const;
type Mode = (typeof tools)[number]['mode'];
const validVector = (
    values: [number, number, number] | undefined,
    positive = false,
): values is [number, number, number] =>
    Boolean(values?.every((value) => Number.isFinite(value) && (!positive || value > 0)));

export function InteractionTargetPreview({
    scene,
    page,
    book,
    action,
    disabled,
    onChange,
}: {
    scene: Scene;
    page: Page;
    book: BookDetail;
    action: TargetAction;
    disabled: boolean;
    onChange: (action: Action) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<LocalPreviewStage | null>(null);
    const runtime = useRef<PageRuntime | null>(null);
    const gizmo = useRef<TransformControls | null>(null);
    const latest = useRef({ scene, page, book, action, disabled, onChange });
    latest.current = { scene, page, book, action, disabled, onChange };
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [mode, setMode] = useState<Mode>('translate');
    const modeRef = useRef(mode);
    const target = scene.objects.find((object) => object.id === action.objectId);
    const rotationLocked = Boolean(target && facesCamera(target));
    // Editing action values must not recreate WebGL, reload assets or reset the camera.
    const source = useMemo(
        () => ({
            objects: scene.objects,
            pageId: page.id,
            imageUrl: page.image.url,
            settings: page.settings,
            aspect: book.pageAspect,
        }),
        [scene.objects, page.id, page.image.url, page.settings, book.pageAspect],
    );
    const changeMode = useCallback((value: string) => {
        const tool = tools.find((item) => item.mode === value);
        const current = latest.current;
        if (
            !tool ||
            current.disabled ||
            !current.action[tool.field] ||
            (tool.field === 'rotation' &&
                current.scene.objects.some(
                    (object) => object.id === current.action.objectId && facesCamera(object),
                )) ||
            !gizmo.current ||
            gizmo.current.dragging
        )
            return;
        modeRef.current = tool.mode;
        gizmo.current.setMode(tool.mode);
        setMode(tool.mode);
    }, []);
    const saveTransform = useCallback(() => {
        const { action, disabled, onChange, scene } = latest.current;
        const rotationLocked = scene.objects.some(
            (object) => object.id === action.objectId && facesCamera(object),
        );
        const root = gizmo.current?.object;
        if (!root || disabled) return;
        const next: TargetAction = {
            ...action,
            ...(action.position ? { position: root.position.toArray() } : {}),
            ...(action.rotation && !rotationLocked
                ? {
                      rotation: [root.rotation.x, root.rotation.y, root.rotation.z].map(
                          THREE.MathUtils.radToDeg,
                      ) as [number, number, number],
                  }
                : {}),
            ...(action.scale
                ? {
                      scale: root.scale.toArray().map((value) => Math.max(0.001, value)) as [
                          number,
                          number,
                          number,
                      ],
                  }
                : {}),
        };
        if (JSON.stringify(next) !== JSON.stringify(action)) onChange(next);
    }, []);
    useEffect(() => {
        void source;
        void retry;
        const controller = new AbortController();
        const element = host.current;
        let currentStage: LocalPreviewStage | undefined;
        let currentRuntime: PageRuntime | undefined;
        let currentGizmo: TransformControls | undefined;
        setState('loading');
        setError('');
        setDragging(false);
        const fail = (event: Event) => {
            if (!controller.signal.aborted) {
                setError((event as CustomEvent<string>).detail);
                setState('error');
            }
        };
        element?.addEventListener('preview-error', fail);
        void (async () => {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            if (!element || controller.signal.aborted) return;
            try {
                const current = latest.current;
                // Front view, looking down 30 degrees; keep the page fitted to this panel.
                const viewportAspect = element.clientWidth / Math.max(1, element.clientHeight) || 1;
                const distance =
                    (Math.max(source.aspect, 1 / viewportAspect) /
                        (2 * Math.tan(THREE.MathUtils.degToRad(20)))) *
                    1.25;
                const elevation = THREE.MathUtils.degToRad(30);
                currentStage = new LocalPreviewStage(element, {
                    position: [0, -distance * Math.cos(elevation), distance * Math.sin(elevation)],
                    target: [0, 0, 0],
                    up: [0, 0, 1],
                });
                stage.current = currentStage;
                const payload = await makePreviewPayload(
                    current.page,
                    current.book,
                    {
                        schemaVersion: 1,
                        objects: source.objects,
                        interactions: [],
                    },
                    assetsApi.detail,
                    controller.signal,
                );
                controller.signal.throwIfAborted();
                currentRuntime = await buildScene(payload.page, payload.assets, controller.signal, {
                    notice: () => {},
                    link: () => {},
                    log: () => {},
                });
                if (controller.signal.aborted) {
                    currentRuntime.dispose();
                    return;
                }
                runtime.current = currentRuntime;
                currentStage.setRuntime(currentRuntime, payload.page);
                currentStage.start({ startRuntime: false, interactive: false });
                currentGizmo = new TransformControls(
                    currentStage.camera,
                    currentStage.renderer.domElement,
                );
                currentGizmo.setMode(modeRef.current);
                currentGizmo.setSize(0.85);
                currentStage.scene.add(currentGizmo);
                const navigation = currentStage.controls;
                currentGizmo.addEventListener('dragging-changed', (event) => {
                    navigation.enabled = !event.value;
                    setDragging(Boolean(event.value));
                });
                // One history entry per gesture; typing and undo use the same action state.
                currentGizmo.addEventListener('mouseUp', saveTransform);
                gizmo.current = currentGizmo;
                setState('ready');
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setError(cause instanceof Error ? cause.message : 'Chưa tải được scene.');
                    setState('error');
                }
            }
        })();
        return () => {
            controller.abort();
            if (currentGizmo) {
                currentGizmo.detach();
                currentStage?.scene.remove(currentGizmo);
                currentGizmo.dispose();
            }
            currentRuntime?.dispose();
            currentStage?.dispose();
            element?.removeEventListener('preview-error', fail);
            if (runtime.current === currentRuntime) runtime.current = null;
            if (stage.current === currentStage) stage.current = null;
            if (gizmo.current === currentGizmo) gizmo.current = null;
        };
    }, [source, retry, saveTransform]);
    useEffect(() => {
        const control = gizmo.current;
        const currentRuntime = runtime.current;
        if (state !== 'ready' || !control || !currentRuntime || control.dragging) return;
        // Restore the previously selected target before attaching to a different object.
        if (control.object) {
            const previous = scene.objects.find(
                (item) => item.id === control.object?.userData.objectId,
            );
            if (previous) {
                control.object.position.fromArray(previous.transform.position);
                control.object.rotation.set(
                    ...(previous.transform.rotation.map(THREE.MathUtils.degToRad) as [
                        number,
                        number,
                        number,
                    ]),
                );
                control.object.scale.fromArray(previous.transform.scale);
                control.object.visible = previous.visible;
            }
        }
        const root = currentRuntime.nodes.get(action.objectId)?.root;
        const original = scene.objects.find((object) => object.id === action.objectId);
        if (!root || !original) {
            control.detach();
            return;
        }
        root.visible = true;
        root.position.fromArray(
            validVector(action.position) ? action.position : original.transform.position,
        );
        root.rotation.set(
            ...((validVector(action.rotation) && !facesCamera(original)
                ? action.rotation
                : original.transform.rotation
            ).map(THREE.MathUtils.degToRad) as [number, number, number]),
        );
        root.scale.fromArray(
            validVector(action.scale, true) ? action.scale : original.transform.scale,
        );
        const available = tools.filter(
            (tool) => action[tool.field] && (tool.field !== 'rotation' || !facesCamera(original)),
        );
        const active = available.find((tool) => tool.mode === modeRef.current) || available[0];
        if (disabled || !active) {
            control.detach();
            return;
        }
        control.attach(root);
        changeMode(active.mode);
    }, [action, disabled, scene.objects, state, changeMode]);
    useEffect(() => {
        const keyboard = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                event.isComposing ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                (event.target instanceof HTMLElement &&
                    event.target.closest(
                        'input,textarea,select,[role=combobox],[contenteditable=true]',
                    )) ||
                document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
            )
                return;
            const tool = tools.find(
                (item) => item.shortcut.toLowerCase() === event.key.toLowerCase(),
            );
            if (!tool || state !== 'ready') return;
            event.preventDefault();
            event.stopPropagation();
            changeMode(tool.mode);
        };
        window.addEventListener('keydown', keyboard, true);
        return () => window.removeEventListener('keydown', keyboard, true);
    }, [changeMode, state]);
    const reset = () => {
        if (!target || disabled) return;
        onChange({
            ...action,
            ...(action.position ? { position: [...target.transform.position] } : {}),
            ...(action.rotation && !rotationLocked
                ? { rotation: [...target.transform.rotation] }
                : {}),
            ...(action.scale ? { scale: [...target.transform.scale] } : {}),
        });
    };
    const canReset =
        target &&
        tools.some(
            ({ field }) =>
                (field !== 'rotation' || !rotationLocked) &&
                action[field]?.some(
                    (value, index) => Math.abs(value - target.transform[field][index]) > 0.000001,
                ),
        );
    return (
        <section
            aria-label="Đặt trạng thái đích trong scene"
            className="flex min-h-0 w-[clamp(22rem,30vw,30rem)] shrink-0 flex-col border-border border-l bg-surface"
        >
            <header className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="m-0 font-semibold text-sm">Trạng thái đích</h3>
                    <p className="m-0 truncate text-muted-foreground text-xs">
                        {target ? objectName(target) : 'Chọn đối tượng trong bảng thông số'}
                    </p>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Đặt lại góc nhìn trạng thái đích"
                            disabled={state !== 'ready'}
                            onClick={() => stage.current?.resetView()}
                        >
                            <Focus />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Đặt lại góc nhìn</TooltipContent>
                </Tooltip>
            </header>
            <div className="relative min-h-40 flex-1">
                <div ref={host} className="absolute inset-0" />
                {state === 'ready' && target && (
                    <ToggleGroup
                        type="single"
                        value={rotationLocked && mode === 'rotate' ? '' : mode}
                        onValueChange={changeMode}
                        variant="outline"
                        size="sm"
                        aria-label="Công cụ đặt trạng thái đích"
                        className="absolute top-3 left-3 flex-wrap bg-surface p-1 shadow-sm"
                    >
                        {tools.map(({ mode, field, label, shortcut, icon: Icon }) => (
                            <ToggleGroupItem
                                key={mode}
                                value={mode}
                                aria-label={`${label} (${shortcut})`}
                                title={
                                    field === 'rotation' && rotationLocked
                                        ? 'Đối tượng luôn hướng về camera nên không thể xoay.'
                                        : action[field]
                                          ? `${label} (${shortcut})`
                                          : `Bật thay đổi ${label.toLocaleLowerCase('vi')} trong bảng thông số.`
                                }
                                disabled={
                                    disabled ||
                                    dragging ||
                                    !action[field] ||
                                    (field === 'rotation' && rotationLocked)
                                }
                            >
                                <Icon data-icon="inline-start" />
                                {label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                )}
                {state === 'loading' && (
                    <div
                        role="status"
                        className="absolute inset-0 flex items-center justify-center gap-2 bg-surface text-muted-foreground text-sm"
                    >
                        <Spinner />
                        Đang chuẩn bị scene…
                    </div>
                )}
                {state === 'ready' && !target && (
                    <Empty className="absolute inset-0 border-0 bg-surface">
                        <EmptyHeader>
                            <EmptyTitle>Chọn đối tượng</EmptyTitle>
                            <EmptyDescription>
                                Chọn đối tượng cần chuyển động ở bảng thông số bên cạnh.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                {state === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface p-4">
                        <Alert variant="destructive" className="m-0">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRetry((value) => value + 1)}
                        >
                            Thử lại
                        </Button>
                    </div>
                )}
            </div>
            <footer className="flex shrink-0 flex-col gap-3 border-border border-t p-4">
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Kéo tay nắm để chỉnh đích. Thông số cập nhật khi thả chuột; đối tượng trong
                    trang giữ nguyên.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || dragging || state !== 'ready' || !canReset}
                    onClick={reset}
                >
                    <RotateCcw data-icon="inline-start" />
                    Về trạng thái ban đầu
                </Button>
            </footer>
        </section>
    );
}
