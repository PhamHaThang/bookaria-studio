import { Focus, Move, Play, RotateCcw, RotateCw, Scaling, Square } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import { type Action, ActionSchema, type Scene } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import { createBillboard } from '@/shared/scene/billboard';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import { sleep } from '@/shared/scene-runtime/InteractionRunner';
import { observeTheme } from '@/shared/theme/observe-theme';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
import { Button } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
import { assetsApi } from '../../assets';
import { LocalPreviewStage } from '../../preview/model/LocalPreviewStage';
import { makePreviewPayload } from '../../preview/model/preview';
import type { InteractionFlow } from '../model/interaction-flow';
import { movementStartState, readMovementSequence } from '../model/movement-sequence';

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
    graph,
    stepId,
}: {
    scene: Scene;
    page: Page;
    book: BookDetail;
    action: TargetAction;
    disabled: boolean;
    onChange: (action: Action) => void;
    graph: InteractionFlow;
    stepId: string;
}) {
    const target = scene.objects.find((object) => object.id === action.objectId);
    const context = useMemo(
        () => (target ? movementStartState(graph, stepId, target) : undefined),
        [graph, stepId, target],
    );
    const start = context?.transform ?? target?.transform;
    const host = useRef<HTMLDivElement>(null);
    const ghostId = useId();
    const stage = useRef<LocalPreviewStage | null>(null);
    const runtime = useRef<PageRuntime | null>(null);
    const gizmo = useRef<TransformControls | null>(null);
    const playback = useRef<AbortController | null>(null);
    const [playing, setPlaying] = useState(false);
    const [playError, setPlayError] = useState('');
    const latest = useRef({ scene, page, book, action, disabled, onChange, start });
    latest.current = { scene, page, book, action, disabled, onChange, start };
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [mode, setMode] = useState<Mode>(
        action.position
            ? 'translate'
            : action.rotation
              ? 'rotate'
              : action.scale
                ? 'scale'
                : 'translate',
    );
    const [showInitial, setShowInitial] = useState(true);
    const modeRef = useRef(mode);
    const rotationLocked = Boolean(target && facesCamera(target));
    const movement = useMemo(() => {
        const sequence = readMovementSequence(graph, stepId);
        const initial = target
            ? movementStartState(graph, sequence.steps[0].id, target)
            : undefined;
        const actions = sequence.steps.map((step) => ActionSchema.safeParse(step.action));
        return {
            actions: actions.flatMap((result) => (result.success ? [result.data] : [])),
            valid:
                actions.every((result) => result.success) &&
                Boolean(initial?.resolved && context?.resolved),
            initial: initial?.transform,
            message: context?.message || initial?.message,
            loop: sequence.loop,
            count: sequence.steps.filter((step) => step.action?.type === 'transformTo').length,
        };
    }, [graph, stepId, target, context]);
    const ghostInitial = playing ? movement.initial : start;
    const ghostState = useRef(ghostInitial);
    ghostState.current = ghostInitial;
    const ghostSignature = ghostInitial
        ? [...ghostInitial.position, ...ghostInitial.rotation, ...ghostInitial.scale].join(',')
        : '';
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
            !current.start ||
            !Object.values(current.start).every((values) => values.every(Number.isFinite)) ||
            playback.current ||
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
        const { action, disabled, onChange, scene, start } = latest.current;
        const object = scene.objects.find((object) => object.id === action.objectId);
        const root = gizmo.current?.object;
        const tool = tools.find((tool) => tool.mode === modeRef.current);
        if (
            !root ||
            !object ||
            !tool ||
            disabled ||
            playback.current ||
            (tool.field === 'rotation' && facesCamera(object))
        )
            return;
        const values = (
            tool.field === 'position'
                ? root.position.toArray()
                : tool.field === 'rotation'
                  ? [root.rotation.x, root.rotation.y, root.rotation.z].map(
                        THREE.MathUtils.radToDeg,
                    )
                  : root.scale.toArray().map((value) => Math.max(0.001, value))
        ) as [number, number, number];
        const previous = action[tool.field] ?? start?.[tool.field] ?? object.transform[tool.field];
        if (values.every((value, index) => Math.abs(value - previous[index]) < 1e-9)) return;
        onChange({ ...action, [tool.field]: values });
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
            playback.current?.abort();
            playback.current = null;
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
        void movement;
        void disabled;
        void source;
        void state;
        playback.current?.abort();
        playback.current = null;
        setPlaying(false);
        setPlayError('');
        return () => {
            playback.current?.abort();
            playback.current = null;
        };
    }, [movement, disabled, source, state]);
    useEffect(() => {
        if (state !== 'ready' || !host.current || !gizmo.current) return;
        const element = host.current;
        const recolor = () => {
            const colors = getComputedStyle(element);
            gizmo.current?.traverse((node) => {
                if (!('tag' in node) || node.tag !== 'helper') return;
                if (!(node instanceof THREE.Line || node instanceof THREE.Mesh)) return;
                const axis = ['X', 'Y', 'Z'].includes(node.name) ? node.name.toLowerCase() : 'z';
                for (const material of Array.isArray(node.material)
                    ? node.material
                    : [node.material]) {
                    if (
                        !(
                            material instanceof THREE.LineBasicMaterial ||
                            material instanceof THREE.MeshBasicMaterial
                        )
                    )
                        continue;
                    material.color.set(colors.getPropertyValue(`--editor-axis-${axis}`).trim());
                    material.opacity = 0.85;
                }
            });
        };
        recolor();
        return observeTheme(recolor);
    }, [state]);
    useEffect(() => {
        void ghostSignature;
        const currentStage = stage.current;
        const node = runtime.current?.nodes.get(action.objectId);
        const original = scene.objects.find((object) => object.id === action.objectId);
        const initial = ghostState.current;
        if (
            state !== 'ready' ||
            !showInitial ||
            !node ||
            !original ||
            !currentStage ||
            !initial ||
            !Object.values(initial).every((values) => values.every(Number.isFinite))
        )
            return;
        const ghost = cloneSkeleton(node.root);
        ghost.name = 'interaction-initial-ghost';
        ghost.visible = true;
        ghost.position.fromArray(initial.position);
        ghost.rotation.set(
            ...(initial.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
        );
        ghost.scale.fromArray(initial.scale);
        const materials = new Set<THREE.Material>();
        const skeletons = new Set<THREE.Skeleton>();
        ghost.traverse((object) => {
            object.userData = {};
            object.raycast = () => {};
            if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
            if (
                object instanceof THREE.Mesh ||
                object instanceof THREE.Line ||
                object instanceof THREE.Sprite
            ) {
                const faded = (material: THREE.Material) => {
                    const copy = material.clone();
                    copy.transparent = true;
                    copy.opacity *= 0.2;
                    copy.depthWrite = false;
                    materials.add(copy);
                    return copy;
                };
                object.material = Array.isArray(object.material)
                    ? object.material.map(faded)
                    : faded(object.material);
            }
        });
        const previousContent = ghost.getObjectByName('camera-facing-content');
        const facing = createBillboard(ghost);
        if (previousContent) {
            for (const child of [...previousContent.children]) facing.content.add(child);
            previousContent.removeFromParent();
        }
        currentStage.scene.add(ghost);
        const updateFacing = () => {
            currentStage.camera.updateMatrixWorld();
            ghost.updateWorldMatrix(true, true);
            facing.update(currentStage.camera, facesCamera(original));
        };
        updateFacing();
        currentStage.controls.addEventListener('change', updateFacing);
        return () => {
            currentStage.controls.removeEventListener('change', updateFacing);
            ghost.removeFromParent();
            for (const material of materials) material.dispose();
            for (const skeleton of skeletons) skeleton.dispose();
        };
    }, [action.objectId, scene.objects, state, showInitial, ghostSignature]);
    useEffect(() => {
        const control = gizmo.current;
        const currentRuntime = runtime.current;
        if (state !== 'ready' || !control || !currentRuntime || control.dragging || playing) return;
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
        if (!start || !context?.resolved) {
            root.visible = false;
            control.detach();
            return;
        }
        const base = start;
        root.position.fromArray(validVector(action.position) ? action.position : base.position);
        root.rotation.set(
            ...((validVector(action.rotation) && !facesCamera(original)
                ? action.rotation
                : base.rotation
            ).map(THREE.MathUtils.degToRad) as [number, number, number]),
        );
        root.scale.fromArray(validVector(action.scale, true) ? action.scale : base.scale);
        const available = tools.filter(
            (tool) => tool.field !== 'rotation' || !facesCamera(original),
        );
        const active = available.find((tool) => tool.mode === modeRef.current) || available[0];
        if (disabled || !active) {
            control.detach();
            return;
        }
        control.attach(root);
        changeMode(active.mode);
    }, [action, disabled, scene.objects, state, changeMode, playing, start, context?.resolved]);
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
                document.querySelector('[role=alertdialog],[role=menu]') ||
                (document.querySelector('[role=dialog]') &&
                    !document.querySelector('[role=dialog]')?.contains(host.current))
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
        if (!target || disabled || !start || !context?.resolved) return;
        onChange({
            ...action,
            ...(action.position ? { position: [...start.position] } : {}),
            ...(action.rotation && !rotationLocked ? { rotation: [...start.rotation] } : {}),
            ...(action.scale ? { scale: [...start.scale] } : {}),
        });
    };
    async function play() {
        if (playing) {
            playback.current?.abort();
            playback.current = null;
            setPlaying(false);
            return;
        }
        const current = runtime.current;
        const root = current?.nodes.get(action.objectId)?.root;
        if (
            !current ||
            !root ||
            !target ||
            !movement.initial ||
            !movement.valid ||
            disabled ||
            dragging
        )
            return;
        const controller = new AbortController();
        playback.current = controller;
        setPlaying(true);
        setPlayError('');
        gizmo.current?.detach();
        const restoreInitial = () => {
            const initial = movement.initial ?? target.transform;
            root.position.fromArray(initial.position);
            root.rotation.set(
                ...(initial.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
            );
            root.scale.fromArray(initial.scale);
            root.visible = true;
        };
        try {
            do {
                restoreInitial();
                await current.previewMovement(movement.actions, controller.signal);
                if (!movement.loop) break;
                await sleep(Math.max(16, movement.loop.pauseMs), controller.signal);
            } while (!controller.signal.aborted);
        } catch (cause) {
            if (!controller.signal.aborted)
                setPlayError(
                    cause instanceof Error ? cause.message : 'Không chạy được chuyển động.',
                );
        } finally {
            if (playback.current === controller) {
                playback.current = null;
                setPlaying(false);
            }
        }
    }
    const canReset =
        target &&
        start &&
        context?.resolved &&
        tools.some(
            ({ field }) =>
                (field !== 'rotation' || !rotationLocked) &&
                action[field]?.some(
                    (value, index) => Math.abs(value - start[field][index]) > 0.000001,
                ),
        );
    return (
        <section
            aria-label="Đặt trạng thái đích trong scene"
            className="flex min-h-0 w-[clamp(22rem,30vw,30rem)] shrink-0 flex-col border-border border-l bg-surface"
        >
            <div className="relative min-h-40 flex-1">
                <div ref={host} className="absolute inset-0" />
                {state === 'ready' && target && (
                    <div
                        role="toolbar"
                        aria-label="Công cụ chỉnh chuyển động"
                        aria-orientation="horizontal"
                        hidden={dragging || playing}
                        className="absolute top-3 right-3 flex items-center gap-1 rounded-xl bg-surface p-1 shadow-[0_4px_18px_#0000001a] [&[hidden]]:hidden"
                    >
                        <ToggleGroup
                            type="single"
                            orientation="horizontal"
                            size="lg"
                            value={rotationLocked && mode === 'rotate' ? '' : mode}
                            onValueChange={changeMode}
                            disabled={disabled || dragging || playing}
                            aria-label="Công cụ đặt trạng thái đích"
                            className="gap-1"
                        >
                            {tools.map(({ mode, field, label, shortcut, icon: Icon }) => (
                                <Tooltip key={mode}>
                                    <TooltipTrigger asChild>
                                        <span className="flex">
                                            <ToggleGroupItem
                                                value={mode}
                                                aria-label={`${label} (${shortcut})`}
                                                disabled={
                                                    disabled ||
                                                    dragging ||
                                                    playing ||
                                                    !context?.resolved ||
                                                    (field === 'rotation' && rotationLocked)
                                                }
                                                className="size-10 p-2"
                                            >
                                                <Icon />
                                            </ToggleGroupItem>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" sideOffset={10}>
                                        {field === 'rotation' && rotationLocked
                                            ? 'Tắt “Luôn hướng về camera” để xoay.'
                                            : `${label} (${shortcut})`}
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </ToggleGroup>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Đặt lại góc nhìn trạng thái đích"
                                    disabled={state !== 'ready'}
                                    onClick={() => stage.current?.resetView()}
                                >
                                    <Focus />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" sideOffset={10}>
                                Đặt lại góc nhìn
                            </TooltipContent>
                        </Tooltip>
                    </div>
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
            <footer className="flex shrink-0 flex-col gap-2 border-border border-t p-3">
                <div className="flex items-center justify-between gap-2">
                    <label htmlFor={ghostId} className="flex items-center gap-2 text-xs">
                        <Checkbox
                            id={ghostId}
                            checked={showInitial}
                            onCheckedChange={(value) => setShowInitial(value === true)}
                        />
                        <span aria-hidden="true">Hình mờ ban đầu</span>
                        <span className="sr-only">Hiện hình mờ ở trạng thái ban đầu</span>
                    </label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Về trạng thái ban đầu"
                                disabled={
                                    disabled ||
                                    dragging ||
                                    playing ||
                                    state !== 'ready' ||
                                    !canReset
                                }
                                onClick={reset}
                            >
                                <RotateCcw />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            Đặt lại các thông số đích về trạng thái trước bước này
                        </TooltipContent>
                    </Tooltip>
                </div>
                <Button
                    size="sm"
                    disabled={
                        !playing &&
                        (disabled || dragging || state !== 'ready' || !target || !movement.valid)
                    }
                    onClick={() => void play()}
                    aria-label={playing ? 'Dừng thử chuyển động' : 'Chạy thử chuyển động'}
                >
                    {playing ? (
                        <Square data-icon="inline-start" />
                    ) : (
                        <Play data-icon="inline-start" />
                    )}
                    {playing ? 'Dừng chạy thử' : 'Chạy thử chuyển động'}
                </Button>
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                    <p
                        role="status"
                        aria-live="polite"
                        className="m-0 min-w-0 text-muted-foreground text-xs leading-5"
                    >
                        {playError ||
                            (playing
                                ? 'Đang chạy thử chuyển động.'
                                : movement.message
                                  ? movement.message
                                  : !movement.valid
                                    ? 'Kiểm tra thông số bên phải để chạy thử.'
                                    : 'Kéo tay nắm để chỉnh đích.')}
                    </p>
                    {target && movement.valid && (
                        <div className="flex shrink-0 items-baseline gap-2 whitespace-nowrap text-muted-foreground text-xs leading-5">
                            <span className="tabular-nums">
                                {movement.count > 1
                                    ? `${movement.count} bước`
                                    : `${action.durationMs / 1000} giây`}
                            </span>
                            {movement.loop && <span title="Lặp vô hạn">Lặp</span>}
                        </div>
                    )}
                </div>
            </footer>
        </section>
    );
}
