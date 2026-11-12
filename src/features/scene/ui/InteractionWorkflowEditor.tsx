import '@xyflow/react/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import {
    applyNodeChanges,
    Background,
    BaseEdge,
    type Connection,
    type Edge,
    EdgeLabelRenderer,
    type EdgeProps,
    getSmoothStepPath,
    Handle,
    MarkerType,
    type Node,
    type NodeProps,
    Panel,
    Position,
    ReactFlow,
    type ReactFlowInstance,
    useUpdateNodeInternals,
} from '@xyflow/react';
import { Check, Focus, LayoutGrid, Plus, TriangleAlert, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import {
    type CSSProperties,
    type DragEvent,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import type { InteractionRule, Scene, Trigger } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/primitives/popover';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';
import { actionOperationChoices, blockChoices, blockLabel } from '../model/interaction-blocks';
import {
    connectionProblem,
    type FlowPort,
    flowLink,
    type InteractionFlow,
    orderedFlowSteps,
    START_NODE,
} from '../model/interaction-flow';
import {
    ACTION_MIME,
    isPaletteId,
    OBJECT_MIME,
    type PaletteId,
    TRIGGER_MIME,
} from '../model/interaction-palette';
import { ruleTriggerLabel } from '../model/interaction-scope';
import { workflowTargetChoices } from '../model/interaction-targets';
import { actionSummary } from '../model/interaction-templates';
import { defaultWorkflowTrigger, triggerLabels } from '../model/interactions';
import { memorySummary } from '../model/memory-variables';
import { ActionPalette, actionIcons } from './InteractionAddMenu';
import { ObjectThumbnail } from './InteractionScopeFilter';
import { useMemory } from './MemoryContext';
import { useInteractionPopoverDismiss } from './useInteractionPopoverDismiss';

type Trace = Record<string, 'waiting' | 'running' | 'done' | 'error' | 'cancelled'>;
type Context = {
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onAdd: (id: PaletteId, after: string, port?: FlowPort) => void;
    onObject: (nodeId: string, objectId: string) => void;
    onChoice: (nodeId: string, value: string) => void;
    onTarget: (nodeId: string, value: string) => void;
    onPick: (after: string, anchor: HTMLButtonElement, port?: FlowPort) => void;
};
type StepData = Context & {
    title: string;
    target: ReturnType<typeof workflowTargetChoices>;
    summary: string;
    choice: ReturnType<typeof blockChoices>;
    operation: ReturnType<typeof actionOperationChoices>;
    event: boolean;
    condition: boolean;
    terminal: boolean;
    id: string;
    targetId?: string;
    invalid?: string;
    status?: Trace[string];
    branch?: 'true' | 'false';
    actionType?: keyof typeof actionIcons;
    action?: import('@/shared/contracts/scene.schema').Action;
};
type WorkflowNode = Node<StepData, 'workflow'>;
type WorkflowEdge = Edge<{ context: Context; port?: FlowPort }, 'workflow'>;
const Step = memo(function Step({ data, selected }: NodeProps<WorkflowNode>) {
    const { definitions } = useMemory();
    const choices = data.choice;
    const memoryText = data.action ? memorySummary(data.action, definitions) : undefined;
    const { user } = useAuth();
    const externalAudioId =
        (data.actionType === 'playAudio' || data.actionType === 'stopAudio') &&
        data.target?.value.startsWith('asset:')
            ? data.target.value.slice('asset:'.length)
            : '';
    const audioDetail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', externalAudioId),
        queryFn: ({ signal }) => assetsApi.detail(externalAudioId, signal),
        enabled: Boolean(externalAudioId),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });
    const audioName = audioDetail.data?.type === 'AUDIO' ? audioDetail.data.name : undefined;
    const targetOptions = data.target?.options.map((option) =>
        audioName && option.value === data.target?.value
            ? { ...option, label: audioName, disabled: audioDetail.data?.status !== 'READY' }
            : option,
    );
    const summary = audioName
        ? `${data.actionType === 'stopAudio' ? 'Dừng' : 'Phát'} “${audioName}”`
        : data.summary;
    const [over, setOver] = useState(false);
    const updateNodeInternals = useUpdateNodeInternals();
    // biome-ignore lint/correctness/useExhaustiveDependencies: Changing terminal/branch handles requires React Flow to remeasure their positions.
    useEffect(() => {
        updateNodeInternals(data.id);
    }, [
        data.id,
        data.condition,
        data.terminal,
        data.choice.value,
        data.operation?.value,
        updateNodeInternals,
    ]);
    const object = data.scene.objects.find((item) => item.id === data.targetId);
    const Icon = data.event ? Zap : data.actionType ? actionIcons[data.actionType] : Zap;
    return (
        <fieldset
            aria-label={data.title}
            data-workflow-step={data.id}
            data-step-state={data.status}
            className={cn(
                'relative m-0 w-60 min-w-0 rounded-lg border bg-surface p-0 text-foreground',
                selected || over ? 'border-primary ring-1 ring-primary' : 'border-border',
                data.invalid && 'border-destructive',
                (data.status === 'running' || data.status === 'waiting') &&
                    'border-info-foreground ring-2 ring-info-foreground/30',
            )}
            onDragOver={(event) => {
                if (!data.disabled && event.dataTransfer.types.includes(OBJECT_MIME)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = 'copy';
                    setOver(true);
                }
            }}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node))
                    setOver(false);
            }}
            onDrop={(event) => {
                const id = event.dataTransfer.getData(OBJECT_MIME);
                if (!id || data.disabled) return;
                event.preventDefault();
                event.stopPropagation();
                setOver(false);
                data.onObject(data.id, id);
            }}
        >
            {!data.event && (
                <Handle
                    isConnectable={!data.disabled}
                    type="target"
                    position={Position.Left}
                    aria-label="Nhận bước trước"
                    className="size-3! border-2! border-surface! bg-primary!"
                />
            )}
            <div className="workflow-drag flex items-center gap-2 border-border border-b px-3 py-3">
                <Icon className="size-4 shrink-0" strokeWidth={1.7} />
                <span className="min-w-0 flex-1 font-semibold text-sm">{data.title}</span>
                {data.status === 'done' && <Check className="size-4 text-success-foreground" />}
            </div>
            <div className="nodrag nopan px-3 pt-3">
                <FormSelect
                    aria-label={`Chức năng khối ${data.title}`}
                    size="sm"
                    className="w-full text-xs"
                    value={choices.value}
                    options={choices.options}
                    disabled={data.disabled}
                    onValueChange={(value) => data.onChoice(data.id, value)}
                />
            </div>
            {data.operation && (
                <div className="nodrag nopan px-3 pt-3">
                    <Field className="gap-1.5">
                        <FieldLabel htmlFor={`workflow-operation-${data.id}`}>Thao tác</FieldLabel>
                        <FormSelect
                            id={`workflow-operation-${data.id}`}
                            aria-label={`Thao tác khối ${data.title}`}
                            size="sm"
                            className="w-full text-xs"
                            value={data.operation.value}
                            options={data.operation.options}
                            disabled={data.disabled}
                            onValueChange={(value) => data.onChoice(data.id, `operation:${value}`)}
                        />
                    </Field>
                </div>
            )}
            {data.target && (
                <div className="nodrag nopan px-3 pt-3">
                    <Field className="gap-1.5">
                        <FieldLabel htmlFor={`workflow-target-${data.id}`}>
                            {data.target.label}
                        </FieldLabel>
                        <FormSelect
                            id={`workflow-target-${data.id}`}
                            aria-label={`Mục tiêu khối ${data.title}`}
                            size="sm"
                            className="w-full text-xs"
                            value={data.target.value}
                            options={targetOptions || data.target.options}
                            disabled={data.disabled}
                            onValueChange={(value) => data.onTarget(data.id, value)}
                        />
                    </Field>
                </div>
            )}
            <div className="flex min-h-22 items-center gap-3 px-3 py-3">
                {object && (
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border [&_svg]:size-5">
                        <ObjectThumbnail object={object} assets={data.assets} />
                    </span>
                )}
                <p className="m-0 min-w-0 flex-1 text-xs leading-5">{memoryText || summary}</p>
            </div>
            {data.branch && (
                <p className="m-0 px-3 pb-3 text-xs">
                    Kết quả: <strong>{data.branch === 'true' ? 'Đúng' : 'Sai'}</strong>
                </p>
            )}
            {data.invalid && (
                <p className="m-0 flex items-center gap-1.5 px-3 pb-3 text-destructive text-xs">
                    <TriangleAlert className="size-3.5 shrink-0" />
                    {data.invalid}
                </p>
            )}
            {(data.status === 'waiting' || data.status === 'running') && (
                <p className="m-0 px-3 pb-3 text-info-foreground text-xs">
                    {data.status === 'waiting' ? 'Đang chờ…' : 'Đang thực hiện…'}
                </p>
            )}
            {!data.terminal &&
                (data.condition ? (
                    <>
                        <span className="pointer-events-none absolute right-4 bottom-15 text-success-foreground text-xs">
                            Đúng
                        </span>
                        <Handle
                            type="source"
                            id="true"
                            isConnectable={!data.disabled}
                            position={Position.Right}
                            style={{ top: 'auto', bottom: 56 }}
                            aria-label="Nhánh Đúng"
                            className="size-3! border-2! border-surface! bg-success-foreground!"
                        />
                        <span className="pointer-events-none absolute right-4 bottom-5 text-destructive text-xs">
                            Sai
                        </span>
                        <Handle
                            type="source"
                            id="false"
                            isConnectable={!data.disabled}
                            position={Position.Right}
                            style={{ top: 'auto', bottom: 16 }}
                            aria-label="Nhánh Sai"
                            className="size-3! border-2! border-surface! bg-destructive!"
                        />
                    </>
                ) : (
                    <Handle
                        type="source"
                        isConnectable={!data.disabled}
                        position={Position.Right}
                        aria-label="Nối bước tiếp theo"
                        className="size-3! border-2! border-surface! bg-primary!"
                    />
                ))}
            {selected && !data.terminal && !data.condition && (
                <div className="nodrag nopan absolute -bottom-10 left-1/2 -translate-x-1/2">
                    <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label="Thêm bước sau khối này"
                        disabled={data.disabled}
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onPick(data.id, event.currentTarget);
                        }}
                    >
                        <Plus />
                    </Button>
                </div>
            )}
        </fieldset>
    );
});
function WorkflowConnection(props: EdgeProps<WorkflowEdge>) {
    const [path, x, y] = getSmoothStepPath(props);
    const context = props.data?.context;
    return (
        <>
            <BaseEdge
                path={path}
                markerEnd={props.markerEnd}
                style={props.style}
                interactionWidth={28}
            />
            <EdgeLabelRenderer>
                {context && (
                    <div
                        className="nodrag nopan pointer-events-auto absolute"
                        data-flow-after={props.source}
                        data-flow-port={props.data?.port || 'next'}
                        style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)` }}
                    >
                        <Button
                            variant="outline"
                            size="icon-xs"
                            aria-label="Chèn bước vào đây"
                            disabled={context.disabled}
                            onClick={(event) => {
                                event.stopPropagation();
                                context.onPick(props.source, event.currentTarget, props.data?.port);
                            }}
                        >
                            <Plus />
                        </Button>
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    );
}
const nodeTypes = { workflow: Step };
const edgeTypes = { workflow: WorkflowConnection };
const flowStyle = {
    '--xy-background-color': 'var(--editor-ground)',
    '--xy-edge-stroke': 'var(--text-muted)',
    '--xy-node-boxshadow-selected': 'none',
    '--xy-handle-background-color': 'var(--text-primary)',
    '--xy-handle-border-color': 'var(--bg-surface)',
} as CSSProperties;
export function InteractionWorkflowEditor({
    scene,
    assets,
    rule,
    graph,
    selected,
    selectedEdge,
    pages,
    onTarget,
    errors,
    trace,
    branches,
    disabled,
    testing = false,
    onSelect,
    onDeselect,
    onTrigger,
    onChoice,
    onSelectEdge,
    onGraph,
    onAdd,
    onObject,
    onBlankObject,
    onArrange,
    onMoveStart,
    onMoveEnd,
    focusOnResize = false,
}: {
    focusOnResize?: boolean;
    scene: Scene;
    assets: Record<string, AssetRef>;
    rule: InteractionRule;
    graph: InteractionFlow;
    selected: string | null;
    selectedEdge: string | null;
    pages: BookDetail['pages'];
    errors: Record<string, string>;
    trace: Trace;
    branches: Record<string, 'true' | 'false'>;
    disabled: boolean;
    testing?: boolean;
    onSelect: (id: string) => void;
    onDeselect: () => void;
    onTrigger: (trigger?: Trigger) => void;
    onSelectEdge: (id: string | null) => void;
    onGraph: (graph: InteractionFlow, history?: boolean) => void;
    onAdd: (
        id: PaletteId,
        after?: string,
        position?: { x: number; y: number },
        port?: FlowPort,
    ) => void;
    onObject: (nodeId: string, objectId: string) => void;
    onChoice: (nodeId: string, value: string) => void;
    onTarget: (nodeId: string, value: string) => void;
    onBlankObject: (objectId: string, position: { x: number; y: number }) => void;
    onArrange: () => void;
    onMoveStart: () => void;
    onMoveEnd: () => void;
}) {
    const { definitions } = useMemory();
    const [flow, setFlow] = useState<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);
    const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
    const [addMenu, setAddMenu] = useState<{
        after: string;
        anchor: HTMLButtonElement;
        port?: FlowPort;
    } | null>(null);
    const anchor = useRef<HTMLButtonElement | null>(null);
    const content = useRef<HTMLDivElement | null>(null);
    const pick = useCallback((after: string, button: HTMLButtonElement, port?: FlowPort) => {
        anchor.current = button;
        setAddMenu((current) =>
            current?.anchor === button ? null : { after, anchor: button, port },
        );
    }, []);
    const virtualAnchor = useMemo(() => ({ current: addMenu?.anchor || null }), [addMenu]);
    useInteractionPopoverDismiss(!!addMenu, anchor, content, () => setAddMenu(null));
    useEffect(() => {
        if (
            addMenu &&
            (!addMenu.anchor.isConnected ||
                disabled ||
                !graph.nodes.some((node) => node.id === addMenu.after))
        )
            setAddMenu(null);
    }, [addMenu, disabled, graph]);
    const [dropAfter, setDropAfter] = useState<string | null>(null);
    const context = useMemo<Context>(
        () => ({
            scene,
            assets,
            disabled,
            onAdd: (id, after, port) => onAdd(id, after, undefined, port),
            onObject,
            onChoice,
            onTarget,
            onPick: pick,
        }),
        [scene, assets, disabled, onAdd, onObject, onChoice, onTarget, pick],
    );
    const nodes = useMemo<WorkflowNode[]>(
        () =>
            graph.nodes.map((step) => ({
                id: step.id,
                position: step.position,
                measured: sizes[step.id],
                type: 'workflow',
                selected: selected === step.id && !selectedEdge,
                data: {
                    ...context,
                    id: step.id,
                    title: blockLabel(step.action),
                    target: workflowTargetChoices(step.action, rule.trigger, scene, assets, pages),
                    choice: blockChoices(step.action, rule.trigger, scene, assets, definitions),
                    operation: actionOperationChoices(step.action),
                    summary: step.action
                        ? actionSummary(step.action, scene.objects)
                        : ruleTriggerLabel(rule, scene.objects, definitions),
                    actionType: step.action?.type,
                    action: step.action,
                    event: !step.action,
                    condition: step.action?.type === 'condition',
                    terminal: step.action?.type === 'navigate',
                    targetId:
                        step.action && 'objectId' in step.action
                            ? step.action.objectId
                            : step.action && 'assetId' in step.action
                              ? scene.objects.find(
                                    (o) =>
                                        o.type === 'audio' &&
                                        o.assetId ===
                                            (step.action && 'assetId' in step.action
                                                ? step.action.assetId
                                                : undefined),
                                )?.id
                              : !step.action && rule.trigger.type === 'onTap'
                                ? rule.trigger.objectId
                                : undefined,
                    invalid: errors[step.id],
                    status: trace[step.id],
                    branch: branches[step.id],
                },
            })),
        [
            graph.nodes,
            definitions,
            pages,
            selected,
            selectedEdge,
            context,
            rule,
            scene,
            assets,
            errors,
            trace,
            branches,
            sizes,
        ],
    );
    const edges = useMemo<WorkflowEdge[]>(
        () =>
            graph.edges.map((edge) => ({
                ...edge,
                type: 'workflow',
                selected: selectedEdge === edge.id,
                sourceHandle: edge.port && edge.port !== 'next' ? edge.port : undefined,
                data: { context, port: edge.port },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-muted)' },
                style: {
                    stroke:
                        trace[edge.source] === 'done' &&
                        trace[edge.target] &&
                        (!branches[edge.source] || edge.port === branches[edge.source])
                            ? 'var(--text-primary)'
                            : dropAfter === edge.source
                              ? 'var(--text-primary)'
                              : 'var(--text-muted)',
                    strokeWidth: dropAfter === edge.source || selectedEdge === edge.id ? 2.5 : 1.5,
                },
                ariaLabel: 'Dây nối giữa các bước',
            })),
        [graph.edges, context, selectedEdge, dropAfter, trace, branches],
    );
    const connect = useCallback(
        (connection: Connection) => {
            if (
                disabled ||
                connectionProblem(
                    graph,
                    connection.source,
                    connection.target,
                    (connection.sourceHandle || 'next') as FlowPort,
                )
            )
                return;
            onGraph({
                ...graph,
                edges: [
                    ...graph.edges,
                    flowLink(
                        connection.source,
                        connection.target,
                        (connection.sourceHandle || 'next') as FlowPort,
                    ),
                ],
            });
        },
        [graph, disabled, onGraph],
    );
    const canvasHost = useRef<HTMLDivElement>(null);
    const resizeFocus = useRef({ enabled: focusOnResize, id: selected });
    resizeFocus.current = { enabled: focusOnResize, id: selected };
    useEffect(() => {
        const host = canvasHost.current;
        if (!host || !flow) return;
        let width = host.clientWidth;
        const observer = new ResizeObserver(() => {
            const nextWidth = host.clientWidth;
            const shrinking = nextWidth < width - 1;
            width = nextWidth;
            const { enabled, id } = resizeFocus.current;
            if (shrinking && enabled && id) {
                void flow.fitView({
                    nodes: [{ id }],
                    padding: 0.3,
                    maxZoom: 1,
                    duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180,
                });
            }
        });
        observer.observe(host);
        return () => observer.disconnect();
    }, [flow]);
    const drop = (event: DragEvent) => {
        if (disabled || !flow) return;
        event.preventDefault();
        setDropAfter(null);
        setAddMenu(null);
        const trigger = event.dataTransfer.getData(TRIGGER_MIME);
        if (trigger === 'group') {
            onTrigger();
            void flow.fitView({ nodes: [{ id: START_NODE }], duration: 200, maxZoom: 1 });
            return;
        }
        if (trigger && trigger in triggerLabels) {
            onTrigger(defaultWorkflowTrigger(trigger as Trigger['type'], scene));
            return;
        }
        const position = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const objectId = event.dataTransfer.getData(OBJECT_MIME);
        if (objectId) {
            onBlankObject(objectId, position);
            return;
        }
        const id = event.dataTransfer.getData(ACTION_MIME);
        if (!isPaletteId(id)) return;
        const target = event.target as HTMLElement;
        const after =
            target.closest('[data-flow-after]')?.getAttribute('data-flow-after') ||
            graph.edges.find(
                (edge) => edge.id === target.closest('.react-flow__edge')?.getAttribute('data-id'),
            )?.source;
        const port =
            target.closest('[data-flow-port]')?.getAttribute('data-flow-port') ||
            graph.edges.find(
                (edge) => edge.id === target.closest('.react-flow__edge')?.getAttribute('data-id'),
            )?.port;
        onAdd(id, after || undefined, after ? undefined : position, port as FlowPort | undefined);
    };
    let count = 0;
    try {
        count = orderedFlowSteps(graph).length - 1;
    } catch {
        count = graph.nodes.length - 1;
    }
    return (
        <div
            className="relative min-h-0 min-w-0 flex-1 bg-[var(--editor-ground)]"
            ref={canvasHost}
            data-testid="interaction-flow-canvas"
        >
            <Popover
                open={!!addMenu}
                onOpenChange={(open) => {
                    if (!open) setAddMenu(null);
                }}
            >
                <PopoverAnchor virtualRef={virtualAnchor} />
                <PopoverContent
                    ref={content}
                    aria-label="Thêm khối tương tác"
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={12}
                    updatePositionStrategy="always"
                    onInteractOutside={(event) => {
                        if (
                            event.target instanceof globalThis.Node &&
                            anchor.current?.contains(event.target)
                        )
                            event.preventDefault();
                    }}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    onEscapeKeyDown={() => anchor.current?.focus({ preventScroll: true })}
                    className="flex max-h-[min(420px,75dvh)] w-72 flex-col p-2"
                >
                    <ActionPalette
                        descriptions
                        scene={scene}
                        assets={assets}
                        disabled={disabled}
                        onChoose={(id) => {
                            if (addMenu) onAdd(id, addMenu.after, undefined, addMenu.port);
                            setAddMenu(null);
                        }}
                    />
                </PopoverContent>
            </Popover>
            <ReactFlow<WorkflowNode, WorkflowEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                proOptions={{ hideAttribution: true }}
                style={flowStyle}
                onInit={setFlow}
                fitView
                fitViewOptions={{
                    padding: 0.18,
                    minZoom: 0.85,
                    maxZoom: 1,
                    nodes: graph.nodes.slice(0, 2),
                }}
                nodeExtent={[
                    [-99000, -99000],
                    [99000, 99000],
                ]}
                minZoom={0.25}
                maxZoom={1.5}
                nodesDraggable={!disabled}
                nodesConnectable={!disabled}
                deleteKeyCode={null}
                zoomOnDoubleClick={false}
                panOnDrag={[0, 2]}
                onPaneContextMenu={(event) => event.preventDefault()}
                onConnect={connect}
                isValidConnection={(connection) =>
                    !disabled &&
                    !connectionProblem(
                        graph,
                        connection.source,
                        connection.target,
                        (connection.sourceHandle || 'next') as FlowPort,
                    )
                }
                connectionRadius={28}
                onNodeClick={(_, node) => {
                    onSelect(node.id);
                    onSelectEdge(null);
                }}
                onEdgesChange={(changes) => {
                    const removed = new Set(
                        changes
                            .filter((change) => change.type === 'remove')
                            .map((change) => change.id),
                    );
                    if (!disabled && removed.size)
                        onGraph({
                            ...graph,
                            edges: graph.edges.filter((edge) => !removed.has(edge.id)),
                        });
                }}
                onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
                onPaneClick={() => {
                    setAddMenu(null);
                    onDeselect();
                }}
                onMoveStart={() => setAddMenu(null)}
                onNodeDragStart={onMoveStart}
                onNodeDragStop={onMoveEnd}
                onNodesChange={(changes) => {
                    const dimensionChanges = changes.filter(
                        (change) => change.type === 'dimensions' && change.dimensions,
                    );
                    if (dimensionChanges.length)
                        setSizes((previous) => {
                            let next = previous;
                            for (const change of dimensionChanges) {
                                if (change.type !== 'dimensions' || !change.dimensions) continue;
                                const size = previous[change.id];
                                if (
                                    size?.width === change.dimensions.width &&
                                    size?.height === change.dimensions.height
                                )
                                    continue;
                                if (next === previous) next = { ...previous };
                                next[change.id] = change.dimensions;
                            }
                            return next;
                        });
                    const positional = changes.filter((change) => change.type === 'position');
                    if (!positional.length || disabled) return;
                    const next = applyNodeChanges(positional, nodes);
                    onGraph(
                        {
                            ...graph,
                            nodes: graph.nodes.map((step) => ({
                                ...step,
                                position:
                                    next.find((node) => node.id === step.id)?.position ||
                                    step.position,
                            })),
                        },
                        false,
                    );
                }}
                onDragOver={(event) => {
                    if (
                        !disabled &&
                        (event.dataTransfer.types.includes(TRIGGER_MIME) ||
                            event.dataTransfer.types.includes(ACTION_MIME) ||
                            event.dataTransfer.types.includes(OBJECT_MIME))
                    ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        const target = event.target as HTMLElement;
                        setDropAfter(
                            target.closest('[data-flow-after]')?.getAttribute('data-flow-after') ||
                                graph.edges.find(
                                    (edge) =>
                                        edge.id ===
                                        target
                                            .closest('.react-flow__edge')
                                            ?.getAttribute('data-id'),
                                )?.source ||
                                null,
                        );
                    }
                }}
                onDragLeave={() => setDropAfter(null)}
                onDrop={drop}
                ariaLabelConfig={{
                    'node.a11yDescription.default':
                        'Chọn khối để thiết lập. Kéo khối để di chuyển.',
                    'edge.a11yDescription.default': 'Đường nối xác định thứ tự thực hiện.',
                }}
            >
                {testing && (
                    <Background
                        gap={20}
                        size={1.2}
                        color="color-mix(in srgb, var(--text-muted) 35%, transparent)"
                    />
                )}
                <Panel position="bottom-left">
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Thu nhỏ luồng"
                            title="Thu nhỏ góc nhìn"
                            onClick={() => void flow?.zoomOut()}
                        >
                            <ZoomOut />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Phóng to luồng"
                            title="Phóng to góc nhìn"
                            onClick={() => void flow?.zoomIn()}
                        >
                            <ZoomIn />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Vừa toàn bộ luồng"
                            title="Đưa toàn bộ luồng vào khung nhìn"
                            onClick={() => void flow?.fitView({ padding: 0.3, maxZoom: 1 })}
                        >
                            <Focus />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={disabled}
                            aria-label="Tự sắp xếp luồng"
                            title="Sắp xếp các khối theo luồng thực hiện"
                            onClick={() => {
                                onArrange();
                                requestAnimationFrame(
                                    () => void flow?.fitView({ padding: 0.3, maxZoom: 1 }),
                                );
                            }}
                        >
                            <LayoutGrid />
                        </Button>
                    </div>
                </Panel>
                <Panel position="bottom-right">
                    <p className="m-0 rounded-md bg-surface px-3 py-2 text-muted-foreground text-xs">
                        {count} bước · Kéo trái/phải để dịch · Cuộn để zoom
                    </p>
                </Panel>
            </ReactFlow>
        </div>
    );
}
export { START_NODE };
