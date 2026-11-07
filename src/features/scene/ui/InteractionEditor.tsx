import { Copy, Play, Plus, Trash2, TriangleAlert, Unplug, X, Zap } from 'lucide-react';
import {
    type Ref,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import { toast } from 'sonner';
import { ZodError } from 'zod';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import {
    ActionSchema,
    findSceneReferenceIssues,
    type InteractionRule,
    InteractionRuleSchema,
    SCENE_LIMITS,
    type Scene,
    type SceneObject,
    type WorkflowVariable,
    WorkflowVariablesSchema,
} from '@/shared/contracts/scene.schema';
import type { InteractionStepEvent } from '@/shared/scene-runtime/InteractionRunner';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Separator } from '@/shared/ui/primitives/separator';
import { Switch } from '@/shared/ui/primitives/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { useAuth } from '../../auth';
import type { PreviewRepair } from '../../preview/model/preview-problem';
import { changeBlockAction } from '../model/interaction-blocks';
import {
    arrangeFlow,
    type FlowPort,
    flowLink,
    flowToRule,
    type InteractionFlow,
    insertFlowStep,
    layoutInsertedFlowStep,
    orderedFlowSteps,
    removeFlowStep,
    restoreFlowLayout,
    START_NODE,
    sceneWithInteractionDraft,
} from '../model/interaction-flow';
import {
    actionTitle,
    assignActionObject,
    OBJECT_MIME,
    type PaletteId,
    paletteAction,
} from '../model/interaction-palette';
import { type InteractionScope, rulesInScope } from '../model/interaction-scope';
import {
    type InteractionTemplateId,
    interactionProblems,
    objectName,
    templateRule,
    updateTemplateActions,
} from '../model/interaction-templates';
import {
    copyRule,
    copyStepAction,
    defaultWorkflowTrigger,
    targetObjects,
} from '../model/interactions';
import { memoryDefinitions, memoryOperations } from '../model/memory-variables';
import { InteractionActionEditor } from './InteractionActionEditor';
import { ActionPalette, TemplateMenu } from './InteractionAddMenu';
import { InteractionFlowPicker } from './InteractionFlowPicker';
import { InteractionTargetPreview } from './InteractionTargetPreview';
import { InteractionTestPanel } from './InteractionTestPanel';
import { InteractionWorkflowEditor } from './InteractionWorkflowEditor';
import { MemoryContext } from './MemoryContext';
import { MemoryVariablesPanel, type MemoryVariablesPanelHandle } from './MemoryVariablesPanel';
import { WorkflowTriggerFields } from './WorkflowFields';

type Draft = { rule: InteractionRule; graph: InteractionFlow; template?: InteractionTemplateId };
export type InteractionEditorHandle = { confirmLeave: (action: () => void) => void };
export type InteractionRequest = {
    id?: string;
    request: number;
    actionIndex?: number | null;
    memory?: boolean;
};
function compile(draft: Draft, scene: Scene) {
    try {
        const rule = flowToRule(draft.graph, draft.rule);
        const errors = interactionProblems(rule, scene);
        if (errors.length) return { rule, error: errors[0] };
        return { rule: InteractionRuleSchema.parse(rule), error: '' };
    } catch (cause) {
        return {
            rule: draft.rule,
            error:
                cause instanceof ZodError
                    ? cause.issues.map((issue) => issue.message).join(' ')
                    : cause instanceof Error
                      ? cause.message
                      : 'Kiểm tra các bước trong luồng.',
        };
    }
}
function recover(key: string, scene: Scene): Draft | null {
    try {
        const text = localStorage.getItem(key) || 'null';
        if (text.length > 256000) return null;
        const saved = JSON.parse(text);
        if (
            !saved ||
            saved.base !== JSON.stringify(scene.interactions) ||
            !saved.draft ||
            !saved.draft.rule?.id ||
            !Array.isArray(saved.draft.graph?.nodes) ||
            !Array.isArray(saved.draft.graph?.edges)
        )
            return null;
        const rule = saved.draft.rule;
        if (
            typeof rule.id !== 'string' ||
            rule.id.length > 64 ||
            typeof rule.enabled !== 'boolean' ||
            !['ignore', 'restart'].includes(rule.onRetrigger) ||
            (rule.name !== undefined && typeof rule.name !== 'string') ||
            ![
                'onTap',
                'onPageEnter',
                'onPageLeave',
                'onMarkerFound',
                'onMarkerLost',
                'onAnimationEnd',
                'onAnswer',
            ].includes(rule.trigger?.type) ||
            (rule.trigger.type === 'onTap' && typeof rule.trigger.objectId !== 'string')
        )
            return null;
        const graph: InteractionFlow = saved.draft.graph;
        if (
            !graph.nodes.length ||
            graph.nodes.length > SCENE_LIMITS.maxActionsPerRule + 1 ||
            new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length ||
            !graph.nodes.some((node) => node.id === START_NODE && !node.action) ||
            graph.edges.length > SCENE_LIMITS.maxActionsPerRule * 2 ||
            graph.nodes.some(
                (node) =>
                    typeof node.id !== 'string' ||
                    !Number.isFinite(node.position?.x) ||
                    !Number.isFinite(node.position?.y) ||
                    Math.abs(node.position.x) > 100000 ||
                    Math.abs(node.position.y) > 100000 ||
                    (node.action &&
                        !ActionSchema.options.some(
                            (option) => option.shape.type.value === node.action?.type,
                        )),
            )
        )
            return null;
        if (
            graph.edges.some(
                (edge) =>
                    typeof edge.id !== 'string' ||
                    typeof edge.source !== 'string' ||
                    typeof edge.target !== 'string',
            )
        )
            return null;
        for (const node of graph.nodes) {
            const action = node.action;
            if (!action) continue;
            if ('objectId' in action && typeof action.objectId !== 'string') return null;
            if (
                action.type === 'askQuestion' &&
                (!action.question ||
                    typeof action.question.title !== 'string' ||
                    typeof action.question.questionId !== 'string' ||
                    !Array.isArray(action.question.choices) ||
                    action.question.choices.length > 6 ||
                    action.question.choices.some(
                        (choice) =>
                            typeof choice.id !== 'string' || typeof choice.text !== 'string',
                    ))
            )
                return null;
            if (action.type === 'condition') {
                const test = action.test;
                if (
                    !test ||
                    !['variable', 'answer', 'interactionCount', 'visible'].includes(test.type)
                )
                    return null;
                if (test.type === 'variable' && typeof test.key !== 'string') return null;
                if ('objectId' in test && typeof test.objectId !== 'string') return null;
                if (test.type === 'answer' && typeof test.questionId !== 'string') return null;
                if (test.type === 'variable' && (test as { value: unknown }).value === null)
                    Object.assign(test, { value: Number.NaN });
                if (test.type === 'interactionCount' && (test as { min: unknown }).min === null)
                    Object.assign(test, { min: Number.NaN });
            }
            if (action.type === 'setState') {
                if (
                    typeof action.key !== 'string' ||
                    !['set', 'increment', 'toggle'].includes(action.operation)
                )
                    return null;
                if ((action as { value: unknown }).value === null)
                    Object.assign(action, { value: Number.NaN });
            }
            if (
                action.type === 'navigate' &&
                (!action.navigation ||
                    !['page', 'next', 'previous', 'end'].includes(action.navigation.target))
            )
                return null;

            if (action.type === 'openUrl' && typeof action.url !== 'string') return null;
            if (action.type === 'playAnimation' && typeof action.clip !== 'string') return null;
            if (action.type === 'transformTo') {
                for (const field of ['position', 'rotation', 'scale'] as const) {
                    const vector = action[field];
                    if (
                        vector &&
                        (!Array.isArray(vector) ||
                            vector.length !== 3 ||
                            vector.some((value) => value !== null && typeof value !== 'number'))
                    )
                        return null;
                    if (vector)
                        action[field] = vector.map((value) =>
                            value === null ? Number.NaN : value,
                        ) as [number, number, number];
                }
            }
            // JSON writes NaN as null; restore it as an unfinished numeric field.
            for (const field of ['ms', 'durationMs', 'delayMsSchema', 'volume'] as const)
                if (field in action && action[field as keyof typeof action] === null)
                    Object.assign(action, { [field]: Number.NaN });
        }
        return saved.draft;
    } catch {
        return null;
    }
}
export function InteractionEditor({
    scene,
    assets,
    disabled,
    onChange,
    preferredObject,
    requestedRule,
    page,
    book,
    onDirtyChange,
    onWorkflowVariablesChange,
    loadMemoryPages,
    ref,
}: {
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onChange: (scene: Scene) => void;
    onWorkflowVariablesChange?: (definitions: WorkflowVariable[]) => void;
    loadMemoryPages?: () => Promise<Pick<Page, 'id' | 'title' | 'scene'>[]>;
    preferredObject?: SceneObject;
    requestedRule?: InteractionRequest;
    page: Page;
    book: BookDetail;
    onDirtyChange: (dirty: boolean) => void;
    ref?: Ref<InteractionEditorHandle>;
}) {
    const { user } = useAuth();
    const key = `bookaria:workflow-draft:${user?.id || 'local'}:${page.id}`;
    const scope: InteractionScope = preferredObject
        ? { type: 'object', objectId: preferredObject.id }
        : { type: 'all' };
    const [draft, setDraft] = useState<Draft | null>(() => {
        const recovered = recover(key, scene);
        if (recovered) return recovered;
        const initial =
            scene.interactions.find((rule) => rule.id === requestedRule?.id) ||
            rulesInScope(
                scene.interactions,
                preferredObject
                    ? { type: 'object', objectId: preferredObject.id }
                    : { type: 'all' },
            )[0];
        return initial
            ? { rule: structuredClone(initial), graph: restoreFlowLayout(initial) }
            : null;
    });
    const current = useRef(draft);
    current.current = draft;
    const editingScene = useMemo(
        () => sceneWithInteractionDraft(scene, draft?.rule, draft?.graph),
        [scene, draft],
    );
    const currentScene = useRef(editingScene);
    currentScene.current = editingScene;
    const [localDefinitions, setLocalDefinitions] = useState<WorkflowVariable[]>(
        book.workflowVariables || [],
    );
    const memoryPanel = useRef<MemoryVariablesPanelHandle>(null);
    const [memoryTab, setMemoryTab] = useState('flows');
    const [memoryDirty, setMemoryDirty] = useState(false);
    const [memoryLoading, setMemoryLoading] = useState(false),
        [memoryError, setMemoryError] = useState<string | null>(null);
    const [memoryPages, setMemoryPages] = useState<Pick<Page, 'id' | 'title' | 'scene'>[]>([]);
    const memoryLoadVersion = useRef(0);
    useEffect(
        () => () => {
            memoryLoadVersion.current++;
        },
        [],
    );
    const declared = onWorkflowVariablesChange ? book.workflowVariables || [] : localDefinitions;
    const readMemoryPages = useCallback(async () => {
        const version = ++memoryLoadVersion.current;
        setMemoryLoading(true);
        setMemoryError(null);
        try {
            const pages = loadMemoryPages ? await loadMemoryPages() : [page];
            if (memoryLoadVersion.current === version) setMemoryPages(pages);
        } catch (cause) {
            if (memoryLoadVersion.current === version)
                setMemoryError(
                    cause instanceof Error ? cause.message : 'Chưa tải được các trang của sách.',
                );
        } finally {
            if (memoryLoadVersion.current === version) setMemoryLoading(false);
        }
    }, [loadMemoryPages, page]);
    function manageMemory(select?: (definition: WorkflowVariable) => void) {
        setMemoryTab('memory');
        void readMemoryPages();
        if (select) memoryPanel.current?.create(select);
        else memoryPanel.current?.showList();
    }
    const [selected, setSelected] = useState<string | null>(START_NODE),
        [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    const [showInspector, setShowInspector] = useState(true);
    const [pending, setPending] = useState<(() => void) | null>(null);
    const [deleting, setDeleting] = useState<InteractionRule | null>(null);
    const [test, setTest] = useState<{
        book: BookDetail;
        scene: Scene;
        rule: InteractionRule;
        graph: InteractionFlow;
    } | null>(null);
    const [memoryValues, setMemoryValues] = useState<Record<
        string,
        boolean | number | string
    > | null>(null);
    const memoryDefinitionSignature = JSON.stringify(declared);
    useEffect(() => {
        // A changed workflow or definition invalidates the previous isolated test result.
        void memoryDefinitionSignature;
        void scene.interactions;
        setMemoryValues(null);
    }, [memoryDefinitionSignature, scene.interactions]);
    const [trace, setTrace] = useState<Record<string, InteractionStepEvent['state']>>({});
    const [branches, setBranches] = useState<Record<string, 'true' | 'false'>>({});
    const [objectChoice, setObjectChoice] = useState<{
        id: string;
        position: { x: number; y: number };
    } | null>(null);
    const history = useRef<{ past: Draft[]; future: Draft[] }>({ past: [], future: [] });
    const [movingNode, setMovingNode] = useState(false);
    const result = draft ? compile(draft, scene) : null;
    const invalid = !!result?.error;
    const blocked = disabled || !!test;
    const emitted = useRef<string | null>(null);
    const previousRules = useRef(scene.interactions);
    const restoreNotice = useRef(false);
    useEffect(() => {
        if (!restoreNotice.current && recover(key, scene))
            toast.info('Đã khôi phục luồng tương tác đang sửa trên thiết bị này.', {
                id: 'interaction-recovery',
            });
        restoreNotice.current = true;
    }, [key, scene]);
    useEffect(() => {
        onDirtyChange(invalid || memoryDirty);
    }, [invalid, memoryDirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    useEffect(() => {
        if (!draft || disabled || movingNode) return;
        const next = compile(draft, scene);
        if (previousRules.current !== scene.interactions) {
            previousRules.current = scene.interactions;
            const external = scene.interactions.find((rule) => rule.id === draft.rule.id);
            const signature = JSON.stringify(external);
            if (
                !next.error &&
                signature !== JSON.stringify(next.rule) &&
                signature !== emitted.current
            ) {
                setDraft(
                    external
                        ? { rule: structuredClone(external), graph: restoreFlowLayout(external) }
                        : null,
                );
                emitted.current = signature || null;
                return;
            }
        }
        if (!next.error) {
            const signature = JSON.stringify(next.rule);
            const previous = scene.interactions.find((rule) => rule.id === next.rule.id);
            if (JSON.stringify(previous) !== signature && emitted.current !== signature) {
                emitted.current = signature;
                onChange({
                    ...scene,
                    interactions: previous
                        ? scene.interactions.map((rule) =>
                              rule.id === next.rule.id ? next.rule : rule,
                          )
                        : [...scene.interactions, next.rule],
                });
            }
            try {
                localStorage.removeItem(key);
            } catch {
                /* Local storage is optional. */
            }
        } else {
            emitted.current = null;
            try {
                localStorage.setItem(
                    key,
                    JSON.stringify({ base: JSON.stringify(scene.interactions), draft }),
                );
            } catch {
                /* Keep the in-memory draft if storage is unavailable. */
            }
        }
    }, [draft, scene, disabled, movingNode, onChange, key]);
    const commit = useCallback(
        (next: Draft, record = true) => {
            if (disabled) return;
            const previous = current.current;
            if (record && previous) {
                history.current.past = [
                    ...history.current.past.slice(-59),
                    structuredClone(previous),
                ];
                history.current.future = [];
            }
            emitted.current = null;
            current.current = next;
            setDraft(next);
            setTrace({});
            setBranches({});
        },
        [disabled],
    );
    const guard = (action: () => void) => {
        const leave = () => {
            if (invalid) setPending(() => action);
            else action();
        };
        if (memoryPanel.current) memoryPanel.current.confirmLeave(leave);
        else leave();
    };
    useImperativeHandle(ref, () => ({ confirmLeave: guard }));
    const selectRule = useCallback(
        (rule: InteractionRule, actionIndex?: number | null) => {
            const select = () => {
                emitted.current = JSON.stringify(rule);
                setDraft({ rule: structuredClone(rule), graph: restoreFlowLayout(rule) });
                setSelected(
                    actionIndex == null
                        ? START_NODE
                        : restoreFlowLayout(rule).nodes.filter((node) => node.action)[actionIndex]
                              ?.id || START_NODE,
                );
                setShowInspector(true);
                setSelectedEdge(null);
                history.current = { past: [], future: [] };

                setTest(null);
                setTrace({});
                setBranches({});
            };
            if (invalid) setPending(() => select);
            else select();
        },
        [invalid],
    );
    const handledRuleRequest = useRef<InteractionRequest | undefined>(undefined);
    useEffect(() => {
        if (!requestedRule || handledRuleRequest.current === requestedRule) return;
        handledRuleRequest.current = requestedRule;
        if (requestedRule.memory) {
            setMemoryTab('memory');
            memoryPanel.current?.showList();
            void readMemoryPages();
            return;
        }
        setMemoryTab('flows');
        const rule = scene.interactions.find((item) => item.id === requestedRule.id);
        if (rule && current.current?.rule.id === rule.id) {
            setSelected(
                requestedRule.actionIndex == null
                    ? START_NODE
                    : current.current.graph.nodes.filter((node) => node.action)[
                          requestedRule.actionIndex
                      ]?.id || START_NODE,
            );
            setShowInspector(true);
            setSelectedEdge(null);
        } else if (rule) selectRule(rule, requestedRule.actionIndex);
    }, [requestedRule, scene.interactions, selectRule, readMemoryPages]);
    function duplicateRule(rule: InteractionRule) {
        guard(() => {
            if (blocked) return;
            if (scene.interactions.length >= SCENE_LIMITS.maxRules) {
                toast.error('Trang đã đạt giới hạn tương tác.');
                return;
            }
            const source =
                rule.id === draft?.rule.id && result && !result.error
                    ? result.rule
                    : scene.interactions.find((item) => item.id === rule.id);
            if (!source) return;
            const interactions = copyRule(
                scene.interactions.map((item) => (item.id === source.id ? source : item)),
                source.id,
                crypto.randomUUID(),
            );
            const copy = interactions.at(-1);
            if (!copy) return;
            emitted.current = JSON.stringify(copy);
            history.current = { past: [], future: [] };
            setDraft({ rule: copy, graph: restoreFlowLayout(copy) });
            setSelected(START_NODE);
            setSelectedEdge(null);
            setShowInspector(true);
            setTrace({});
            setBranches({});
            onChange({ ...scene, interactions });
        });
    }
    function create(template: InteractionTemplateId, overrideScope = scope, source?: SceneObject) {
        guard(() => {
            if (scene.interactions.length >= SCENE_LIMITS.maxRules) {
                toast.error('Trang đã đạt giới hạn tương tác.');
                return;
            }
            const rule = templateRule(template, crypto.randomUUID(), scene, assets, overrideScope);
            if (source?.type === 'audio') {
                rule.actions = rule.actions.map((action) =>
                    action.type === 'playAudio' ? { ...action, assetId: source.assetId } : action,
                );
            }
            const graph = restoreFlowLayout(rule);
            if (template === 'custom') {
                rule.actions = [];
                graph.nodes = graph.nodes.slice(0, 1);
                graph.edges = [];
            }
            history.current = { past: [], future: [] };
            previousRules.current = scene.interactions;
            emitted.current = null;
            setDraft({ rule, graph, template });
            setSelected(START_NODE);
            setSelectedEdge(null);
            setTrace({});
            setBranches({});
            setTest(null);
        });
    }
    const graphChange = useCallback(
        (graph: InteractionFlow, record = true) => {
            if (current.current) commit({ ...current.current, graph }, record);
        },
        [commit],
    );
    const add = useCallback(
        (
            id: PaletteId,
            after?: string,
            position?: { x: number; y: number },
            object?: SceneObject,
            port?: FlowPort,
        ) => {
            const active = current.current;
            if (!active || disabled) return;
            try {
                const source =
                    object ||
                    (active.rule.trigger.type === 'onTap'
                        ? currentScene.current.objects.find(
                              (item) =>
                                  active.rule.trigger.type === 'onTap' &&
                                  item.id === active.rule.trigger.objectId,
                          )
                        : undefined);
                const action = paletteAction(id, source, currentScene.current.objects, assets);
                const preceding =
                    after ||
                    (!position
                        ? active.graph.nodes.find((node) => node.id === selected)?.id ||
                          active.graph.nodes.at(-1)?.id
                        : undefined);
                const anchor = active.graph.nodes.find((node) => node.id === preceding);
                const nextId = crypto.randomUUID();
                const graph = insertFlowStep(
                    active.graph,
                    {
                        id: nextId,
                        action,
                        position: position || {
                            x: (anchor?.position.x || 40) + 310,
                            y: anchor?.position.y || 80,
                        },
                    },
                    preceding,
                    port,
                );
                if (action.type === 'condition') {
                    if (graph.nodes.length + 2 > SCENE_LIMITS.maxActionsPerRule + 1)
                        throw new Error('Cần chỗ cho hai nhánh của điều kiện.');
                    const continuation = graph.edges.find((edge) => edge.source === nextId)?.target;
                    graph.edges = graph.edges.filter((edge) => edge.source !== nextId);
                    const anchor = graph.nodes.find((node) => node.id === nextId) as NonNullable<
                        (typeof active.graph.nodes)[0]
                    >;
                    for (const [branch, offset] of [
                        ['true', -130],
                        ['false', 130],
                    ] as const) {
                        const branchId = crypto.randomUUID();
                        graph.nodes.push({
                            id: branchId,
                            action: { type: 'wait', ms: 0 },
                            position: { x: anchor.position.x + 310, y: anchor.position.y + offset },
                        });
                        graph.edges.push(flowLink(nextId, branchId, branch));
                        if (continuation) graph.edges.push(flowLink(branchId, continuation));
                    }
                }
                commit({ ...active, graph: layoutInsertedFlowStep(active.graph, graph, nextId) });
                setSelected(nextId);
                setSelectedEdge(null);
                setShowInspector(true);
            } catch (cause) {
                toast.error(cause instanceof Error ? cause.message : 'Chưa thêm được bước.', {
                    id: 'interaction-feedback',
                });
            }
        },
        [assets, commit, disabled, selected],
    );
    const assign = useCallback(
        (nodeId: string, objectId: string) => {
            const active = current.current,
                object = currentScene.current.objects.find((item) => item.id === objectId);
            if (!active || !object || disabled) return;
            try {
                if (nodeId === START_NODE) {
                    if (object.type === 'audio')
                        throw new Error(
                            'Âm thanh dùng ở bước phát, hãy chọn đối tượng khác để chạm.',
                        );
                    if (
                        active.rule.trigger.type === 'onAnimationEnd' &&
                        (object.type !== 'model' ||
                            !assets[object.assetId]?.meta.animations?.length)
                    )
                        throw new Error('Chọn mô hình có hoạt ảnh.');
                    commit({
                        ...active,
                        rule: {
                            ...active.rule,
                            trigger:
                                active.rule.trigger.type === 'onAnimationEnd'
                                    ? {
                                          ...active.rule.trigger,
                                          objectId,
                                          clip:
                                              object.type === 'model' &&
                                              active.rule.trigger.clip &&
                                              assets[object.assetId]?.meta.animations?.includes(
                                                  active.rule.trigger.clip,
                                              )
                                                  ? active.rule.trigger.clip
                                                  : undefined,
                                      }
                                    : { type: 'onTap', objectId },
                        },
                    });
                } else {
                    let graph = {
                        ...active.graph,
                        nodes: active.graph.nodes.map((step) =>
                            step.id === nodeId && step.action
                                ? {
                                      ...step,
                                      action: assignActionObject(step.action, object, assets),
                                  }
                                : step,
                        ),
                    };
                    if (active.template === 'focus') {
                        const before = orderedFlowSteps(active.graph),
                            after = orderedFlowSteps(graph);
                        const paired = updateTemplateActions(
                            'focus',
                            before.slice(1).flatMap((n) => (n.action ? [n.action] : [])),
                            after.slice(1).flatMap((n) => (n.action ? [n.action] : [])),
                            currentScene.current.objects,
                        );
                        graph = {
                            ...graph,
                            nodes: graph.nodes.map((step) => {
                                const index = after.findIndex((n) => n.id === step.id) - 1;
                                return index >= 0 ? { ...step, action: paired[index] } : step;
                            }),
                        };
                    }
                    commit({ ...active, graph });
                }
                setSelected(nodeId);
                setSelectedEdge(null);
                setShowInspector(true);
            } catch (cause) {
                toast.error((cause as Error).message, { id: 'interaction-feedback' });
            }
        },
        [assets, commit, disabled],
    );
    const chooseTarget = useCallback(
        (nodeId: string, value: string) => {
            const active = current.current;
            if (!active || disabled || test) return;
            if (value.startsWith('object:')) {
                assign(nodeId, value.slice(7));
                return;
            }
            if (nodeId === START_NODE && value === 'page') {
                if ('objectId' in active.rule.trigger)
                    commit({
                        ...active,
                        rule: { ...active.rule, trigger: { type: 'onPageEnter' } },
                    });
            } else {
                const node = active.graph.nodes.find((item) => item.id === nodeId);
                let action = node?.action;
                if (action?.type === 'stopAudio' && value === 'all-audio')
                    action = { ...action, assetId: undefined };
                else if (
                    action?.type === 'navigate' &&
                    value.startsWith('page:') &&
                    book.pages.some((page) => page.id === value.slice(5))
                )
                    action = {
                        ...action,
                        navigation: {
                            ...action.navigation,
                            target: 'page',
                            pageId: value.slice(5),
                        },
                    };
                else return;
                commit({
                    ...active,
                    graph: {
                        ...active.graph,
                        nodes: active.graph.nodes.map((item) =>
                            item.id === nodeId ? { ...item, action } : item,
                        ),
                    },
                });
            }
            setSelected(nodeId);
            setSelectedEdge(null);
            setShowInspector(true);
        },
        [assign, book.pages, commit, disabled, test],
    );
    const chooseBlock = useCallback(
        (nodeId: string, value: string) => {
            const active = current.current;
            if (!active || disabled || test) return;
            try {
                if (nodeId === START_NODE) {
                    if (value !== active.rule.trigger.type)
                        commit({
                            ...active,
                            rule: {
                                ...active.rule,
                                trigger: defaultWorkflowTrigger(
                                    value as InteractionRule['trigger']['type'],
                                    currentScene.current,
                                ),
                            },
                        });
                } else {
                    const node = active.graph.nodes.find((item) => item.id === nodeId);
                    if (!node?.action) return;
                    const action = changeBlockAction(
                        node.action,
                        value,
                        currentScene.current,
                        assets,
                        book?.pages || [],
                    );
                    if (action.type === 'setState') {
                        const def = memoryDefinitions(declared, [currentScene.current]).find(
                            (item) => item.key === action.key,
                        );
                        if (
                            def &&
                            !memoryOperations(def).some(
                                (option) => option.value === action.operation,
                            )
                        )
                            return;
                    }
                    if (
                        action.type === 'navigate' &&
                        active.graph.edges.some((edge) => edge.source === nodeId)
                    ) {
                        toast.info('Đặt khối điều hướng ở cuối nhánh hoặc ngắt dây đi ra trước.', {
                            id: 'interaction-feedback',
                        });
                        return;
                    }
                    if (action !== node.action)
                        commit({
                            ...active,
                            template: undefined,
                            graph: {
                                ...active.graph,
                                nodes: active.graph.nodes.map((item) =>
                                    item.id === nodeId ? { ...item, action } : item,
                                ),
                            },
                        });
                }
                setSelected(nodeId);
                setSelectedEdge(null);
                setShowInspector(true);
            } catch (cause) {
                toast.error(cause instanceof Error ? cause.message : 'Chưa đổi được chức năng.', {
                    id: 'interaction-feedback',
                });
            }
        },
        [assets, book?.pages, commit, disabled, test, declared],
    );
    function updateAction(action: Parameters<typeof assignActionObject>[0]) {
        if (!draft) return;
        let graph = {
            ...draft.graph,
            nodes: draft.graph.nodes.map((node) =>
                node.id === selected ? { ...node, action } : node,
            ),
        };
        if (draft.template === 'focus') {
            try {
                const before = orderedFlowSteps(draft.graph),
                    after = orderedFlowSteps(graph);
                const paired = updateTemplateActions(
                    'focus',
                    before.slice(1).flatMap((n) => (n.action ? [n.action] : [])),
                    after.slice(1).flatMap((n) => (n.action ? [n.action] : [])),
                    scene.objects,
                );
                graph = {
                    ...graph,
                    nodes: graph.nodes.map((node) => {
                        const index = after.findIndex((n) => n.id === node.id) - 1;
                        return index >= 0 ? { ...node, action: paired[index] } : node;
                    }),
                };
            } catch {
                /* Disconnected steps remain editable. */
            }
        }
        commit({ ...draft, graph });
    }
    const undo = useCallback(
        (redo = false) => {
            const from = redo ? history.current.future : history.current.past,
                to = redo ? history.current.past : history.current.future;
            const next = from.pop();
            if (!next || !draft) return;
            to.push(draft);
            commit(next, false);
            setSelectedEdge(null);
        },
        [commit, draft],
    );
    // Incomplete graphs stay local, so page history cannot recover their unfinished edits.
    useEffect(() => {
        if (!invalid || blocked) return;
        const keyboard = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                !(event.ctrlKey || event.metaKey) ||
                !['z', 'y'].includes(event.key.toLowerCase()) ||
                (event.target instanceof HTMLElement &&
                    event.target.closest(
                        'input,textarea,[role=combobox],[contenteditable=true]',
                    )) ||
                document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
            )
                return;
            event.preventDefault();
            event.stopPropagation();
            undo(event.shiftKey || event.key.toLowerCase() === 'y');
        };
        window.addEventListener('keydown', keyboard);
        return () => window.removeEventListener('keydown', keyboard);
    }, [invalid, blocked, undo]);
    function removeSelected() {
        if (!draft || blocked) return;
        if (selectedEdge) {
            commit({
                ...draft,
                graph: {
                    ...draft.graph,
                    edges: draft.graph.edges.filter((edge) => edge.id !== selectedEdge),
                },
            });
            setSelectedEdge(null);
        } else if (selected && selected !== START_NODE) {
            commit({ ...draft, graph: removeFlowStep(draft.graph, selected) });
            setSelected(START_NODE);
        }
    }
    const selectedStep = draft?.graph.nodes.find((node) => node.id === selected);
    const errors: Record<string, string> = {};
    if (draft)
        for (const node of draft.graph.nodes) {
            if (node.action) {
                const issue =
                    node.action.type === 'condition'
                        ? ActionSchema.safeParse(node.action).success
                            ? undefined
                            : 'Kiểm tra thông tin điều kiện.'
                        : interactionProblems(
                              {
                                  ...draft.rule,
                                  editorLayout: undefined,
                                  workflow: undefined,
                                  trigger: { type: 'onPageEnter' },
                                  actions: [node.action],
                              },
                              scene,
                          )[0];
                if (issue) errors[node.id] = issue.replace(/^Bước 1: /, '');
            } else if (
                draft.rule.trigger.type === 'onTap' &&
                !targetObjects(scene.objects, 'onTap').some(
                    (item) =>
                        draft.rule.trigger.type === 'onTap' &&
                        item.id === draft.rule.trigger.objectId,
                )
            )
                errors[node.id] = 'Chọn đối tượng để chạm.';
        }
    if (draft) {
        const steps = draft.graph.nodes.filter((node) => node.action);
        for (const issue of findSceneReferenceIssues(editingScene)) {
            if (issue.interactionId !== draft.rule.id) continue;
            const id = issue.actionIndex === null ? START_NODE : steps[issue.actionIndex]?.id;
            if (id) errors[id] ||= issue.message;
        }
    }
    const selectedAction = selectedStep?.action;
    const revealTarget =
        selectedAction &&
        ((selectedAction.type === 'setVisible' && selectedAction.value) ||
            selectedAction.type === 'toggleVisible')
            ? scene.objects.find(
                  (object) =>
                      'objectId' in selectedAction &&
                      object.id === selectedAction.objectId &&
                      !(
                          draft?.rule.trigger.type === 'onTap' &&
                          draft.rule.trigger.objectId === object.id
                      ),
              )
            : undefined;
    const observe = useCallback(
        (event: InteractionStepEvent) => {
            if (!test) return;
            try {
                const step = event.nodeId
                    ? test.graph.nodes.find((node) => node.id === event.nodeId)
                    : orderedFlowSteps(test.graph)[event.index + 1];
                if (step) {
                    setTrace((previous) => ({ ...previous, [step.id]: event.state }));
                    if (event.branch)
                        setBranches((previous) => ({
                            ...previous,
                            [step.id]: event.branch as 'true' | 'false',
                        }));
                }
            } catch {
                /* Only validated graphs can be tested. */
            }
        },
        [test],
    );
    function startTest() {
        if (!draft || !result) return;
        if (result.error) {
            toast.error(result.error, { id: 'interaction-feedback' });
            const firstProblem = Object.keys(errors)[0];
            if (firstProblem) setSelected(firstProblem);
            setShowInspector(true);
            return;
        }
        const problem = Object.entries(errors)[0];
        if (problem) {
            setSelected(problem[0]);
            setShowInspector(true);
            toast.error(problem[1], { id: 'interaction-feedback' });
            return;
        }
        const memoryCheck = WorkflowVariablesSchema.safeParse(definitions);
        if (!memoryCheck.success) {
            toast.error(memoryCheck.error.issues[0]?.message || 'Kiểm tra thông tin ghi nhớ.', {
                id: 'interaction-feedback',
            });
            manageMemory();
            return;
        }
        setTrace({});
        setBranches({});
        setTest({
            book: memoryBook,
            scene: structuredClone(scene),
            rule: structuredClone(result.rule),
            graph: structuredClone(draft.graph),
        });
    }
    const memoryPageList = useMemo(
        () => [
            ...memoryPages.filter((item) => item.id !== page.id),
            { ...page, scene: editingScene },
        ],
        [editingScene, memoryPages, page],
    );
    const definitions = useMemo(
        () =>
            memoryDefinitions(
                declared,
                memoryPageList.map((item) => item.scene),
            ),
        [declared, memoryPageList],
    );
    const memoryBook = useMemo(
        () => ({ ...book, workflowVariables: definitions }),
        [book, definitions],
    );
    return (
        <MemoryContext.Provider
            value={{
                definitions,
                currentValues: memoryValues,
                disabled: disabled || Boolean(test),
                manage: manageMemory,
            }}
        >
            <section
                aria-label="Workspace tương tác"
                className="flex h-full min-h-0 flex-col overflow-hidden bg-surface"
                onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') return;
                    if (
                        (event.target as HTMLElement).closest(
                            'input,textarea,[role=combobox],[contenteditable=true]',
                        ) ||
                        document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
                    )
                        return;
                    if (blocked || memoryDirty) return;
                    if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        event.stopPropagation();
                        removeSelected();
                    }
                }}
            >
                <div className="flex min-h-0 flex-1">
                    <aside
                        aria-label="Công cụ tương tác"
                        className="flex w-60 shrink-0 flex-col border-border border-r bg-surface xl:w-64"
                    >
                        <Tabs
                            value={memoryTab}
                            className="min-h-0 flex-1 gap-0"
                            onValueChange={(value) => {
                                const change = () => {
                                    setMemoryTab(value);
                                    if (value === 'memory') void readMemoryPages();
                                };
                                if (value !== 'memory') memoryPanel.current?.confirmLeave(change);
                                else change();
                            }}
                        >
                            <TabsList
                                variant="line"
                                aria-label="Danh sách tương tác"
                                className="shrink-0 gap-4 px-4"
                            >
                                <TabsTrigger value="flows">Luồng</TabsTrigger>
                                <TabsTrigger value="memory">
                                    Ghi nhớ ({definitions.length})
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="flows" className="min-h-0 overflow-hidden">
                                <section
                                    aria-label="Danh sách luồng tương tác"
                                    className="flex h-full min-h-0 flex-col gap-3 py-4"
                                >
                                    <div className="flex shrink-0 items-center justify-between gap-2 px-4">
                                        <h2 className="m-0 font-semibold text-sm">
                                            Luồng tương tác
                                        </h2>
                                        <TemplateMenu
                                            scene={editingScene}
                                            scope={scope}
                                            disabled={
                                                blocked ||
                                                scene.interactions.length >= SCENE_LIMITS.maxRules
                                            }
                                            onChoose={create}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Thêm tương tác"
                                                title="Tạo luồng"
                                            >
                                                <Plus />
                                            </Button>
                                        </TemplateMenu>
                                    </div>
                                    <InteractionFlowPicker
                                        rules={scene.interactions}
                                        active={draft?.rule}
                                        objects={scene.objects}
                                        disabled={blocked}
                                        onSelect={selectRule}
                                        onDuplicate={duplicateRule}
                                        onDelete={setDeleting}
                                        canDuplicate={(rule) =>
                                            scene.interactions.length < SCENE_LIMITS.maxRules &&
                                            (rule.id !== draft?.rule.id || !invalid)
                                        }
                                    />
                                </section>
                            </TabsContent>
                            <TabsContent
                                value="memory"
                                forceMount
                                className="flex min-h-0 flex-col overflow-hidden"
                            >
                                <MemoryVariablesPanel
                                    ref={memoryPanel}
                                    definitions={definitions}
                                    pages={memoryPageList}
                                    disabled={blocked}
                                    loading={memoryLoading}
                                    error={memoryError}
                                    onRetry={() => void readMemoryPages()}
                                    onDirtyChange={setMemoryDirty}
                                    onChange={(next) => {
                                        if (onWorkflowVariablesChange)
                                            onWorkflowVariablesChange(next);
                                        else setLocalDefinitions(next);
                                    }}
                                />
                            </TabsContent>
                        </Tabs>
                        {memoryTab === 'flows' && (
                            <>
                                <Separator />
                                <section aria-label="Thêm khối" className="shrink-0 px-3 pt-4 pb-3">
                                    <h2 className="m-0 px-2 font-semibold text-sm">Thêm khối</h2>
                                    <p className="m-0 mt-1 mb-2 px-2 text-muted-foreground text-xs leading-5">
                                        {draft
                                            ? 'Kéo vào canvas hoặc nhấn để thêm.'
                                            : 'Tạo luồng trước khi thêm khối.'}
                                    </p>
                                    <ActionPalette
                                        scene={editingScene}
                                        assets={assets}
                                        disabled={blocked || !draft}
                                        onTrigger={() => {
                                            setSelected(START_NODE);
                                            setSelectedEdge(null);
                                            setShowInspector(true);
                                        }}
                                        onChoose={(id) => add(id)}
                                    />
                                </section>
                                <p className="m-0 shrink-0 px-5 pt-1 pb-4 text-muted-foreground text-xs leading-5">
                                    Chọn trang hoặc đối tượng trực tiếp trong từng khối.
                                </p>
                            </>
                        )}
                    </aside>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <div className="flex min-h-15 shrink-0 items-center gap-2 border-border border-b px-4 py-2.5">
                            {draft ? (
                                <Input
                                    aria-label="Tên luồng tương tác"
                                    value={draft.rule.name || ''}
                                    maxLength={100}
                                    className="min-w-24 max-w-64 flex-1"
                                    disabled={blocked}
                                    placeholder="Đặt tên luồng"
                                    onChange={(event) =>
                                        commit({
                                            ...draft,
                                            rule: { ...draft.rule, name: event.target.value },
                                        })
                                    }
                                />
                            ) : (
                                <p className="m-0 text-muted-foreground text-sm">
                                    Chọn hoặc tạo luồng ở thanh bên trái.
                                </p>
                            )}
                            {draft && (
                                <>
                                    <Switch
                                        aria-label="Bật luồng tương tác"
                                        checked={draft.rule.enabled}
                                        disabled={blocked}
                                        onCheckedChange={(enabled) =>
                                            commit({ ...draft, rule: { ...draft.rule, enabled } })
                                        }
                                    />
                                    <div className="ml-auto flex shrink-0 items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={disabled}
                                            onClick={() => (test ? setTest(null) : startTest())}
                                        >
                                            {test ? (
                                                <X data-icon="inline-start" />
                                            ) : (
                                                <Play data-icon="inline-start" />
                                            )}
                                            {test ? 'Đóng thử' : 'Chạy thử'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                        {draft ? (
                            <div className="relative flex min-h-0 flex-1">
                                <InteractionWorkflowEditor
                                    scene={editingScene}
                                    assets={assets}
                                    rule={draft.rule}
                                    graph={draft.graph}
                                    selected={selected}
                                    focusOnResize={
                                        !test &&
                                        showInspector &&
                                        selectedAction?.type === 'transformTo'
                                    }
                                    selectedEdge={selectedEdge}
                                    pages={book.pages}
                                    onTarget={chooseTarget}
                                    errors={errors}
                                    trace={trace}
                                    branches={branches}
                                    disabled={blocked}
                                    onSelect={(id) => {
                                        setSelected(id);
                                        setShowInspector(true);
                                    }}
                                    onDeselect={() => {
                                        setSelected(null);
                                        setSelectedEdge(null);
                                        setShowInspector(false);
                                    }}
                                    onTrigger={(trigger) => {
                                        if (trigger)
                                            commit({ ...draft, rule: { ...draft.rule, trigger } });
                                        setSelected(START_NODE);
                                        setSelectedEdge(null);
                                        setShowInspector(true);
                                    }}
                                    onChoice={chooseBlock}
                                    onSelectEdge={(id) => {
                                        setSelectedEdge(id);
                                        if (id) {
                                            setSelected(null);
                                            setShowInspector(true);
                                        }
                                    }}
                                    onGraph={graphChange}
                                    onMoveStart={() => {
                                        setMovingNode(true);
                                        if (current.current) commit(current.current);
                                    }}
                                    onMoveEnd={() => setMovingNode(false)}
                                    onAdd={(id, after, position, port) =>
                                        add(id, after, position, undefined, port)
                                    }
                                    onObject={assign}
                                    onBlankObject={(id, position) =>
                                        setObjectChoice({ id, position })
                                    }
                                    onArrange={() => graphChange(arrangeFlow(draft.graph))}
                                />
                                {objectChoice && (
                                    <fieldset
                                        aria-label="Thêm tương tác từ đối tượng"
                                        className="absolute top-4 left-4 z-10 flex w-72 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-lg"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="m-0 truncate font-medium text-sm">
                                                {objectName(
                                                    scene.objects.find(
                                                        (object) => object.id === objectChoice.id,
                                                    ),
                                                )}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                aria-label="Đóng lựa chọn đối tượng"
                                                onClick={() => setObjectChoice(null)}
                                            >
                                                <X />
                                            </Button>
                                        </div>
                                        {scene.objects.find(
                                            (object) => object.id === objectChoice.id,
                                        )?.type !== 'audio' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    assign(START_NODE, objectChoice.id);
                                                    setObjectChoice(null);
                                                }}
                                            >
                                                Bắt đầu khi chạm đối tượng này
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const object = scene.objects.find(
                                                    (item) => item.id === objectChoice.id,
                                                );
                                                if (object)
                                                    add(
                                                        object.type === 'audio'
                                                            ? 'playAudio'
                                                            : object.type === 'video'
                                                              ? 'playVideo'
                                                              : 'show',
                                                        undefined,
                                                        objectChoice.position,
                                                        object,
                                                    );
                                                setObjectChoice(null);
                                            }}
                                        >
                                            Thêm bước dùng đối tượng này
                                        </Button>
                                    </fieldset>
                                )}
                                {!test &&
                                    showInspector &&
                                    !selectedEdge &&
                                    selectedAction?.type === 'transformTo' && (
                                        <InteractionTargetPreview
                                            key={`${draft.rule.id}:${selected}`}
                                            scene={scene}
                                            page={page}
                                            book={book}
                                            action={selectedAction}
                                            disabled={blocked}
                                            onChange={updateAction}
                                        />
                                    )}
                                {test ? (
                                    <InteractionTestPanel
                                        scene={test.scene}
                                        rule={test.rule}
                                        page={page}
                                        book={test.book}
                                        onStep={observe}
                                        onMemoryChange={setMemoryValues}
                                        onReset={() => setTrace({})}
                                        onRepair={(repair: PreviewRepair) => {
                                            setTest(null);
                                            if (repair.kind === 'memory') manageMemory();
                                            else {
                                                setSelected(
                                                    repair.actionIndex == null
                                                        ? START_NODE
                                                        : draft?.graph.nodes.filter(
                                                              (node) => node.action,
                                                          )[repair.actionIndex]?.id || START_NODE,
                                                );
                                                setShowInspector(true);
                                            }
                                        }}
                                        onClose={() => {
                                            setTest(null);
                                            setTrace({});
                                            setBranches({});
                                        }}
                                    />
                                ) : (
                                    showInspector &&
                                    (selectedStep || selectedEdge) && (
                                        <aside
                                            aria-label="Thiết lập bước tương tác"
                                            className="flex w-76 shrink-0 flex-col border-border border-l bg-surface xl:w-80"
                                        >
                                            <header className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
                                                <h2 className="m-0 font-semibold text-sm">
                                                    {selectedEdge
                                                        ? 'Đường nối'
                                                        : selectedAction
                                                          ? actionTitle(selectedAction)
                                                          : 'Sự kiện bắt đầu'}
                                                </h2>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label="Đóng thiết lập bước"
                                                    onClick={() => setShowInspector(false)}
                                                >
                                                    <X />
                                                </Button>
                                            </header>
                                            <section
                                                aria-label="Thiết lập mục tiêu và thông số"
                                                className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
                                                onDragOver={(event) => {
                                                    if (
                                                        !blocked &&
                                                        event.dataTransfer.types.includes(
                                                            OBJECT_MIME,
                                                        )
                                                    )
                                                        event.preventDefault();
                                                }}
                                                onDrop={(event) => {
                                                    const id =
                                                        event.dataTransfer.getData(OBJECT_MIME);
                                                    if (id && selected && !blocked) {
                                                        event.preventDefault();
                                                        assign(selected, id);
                                                    }
                                                }}
                                            >
                                                {selectedEdge ? (
                                                    <>
                                                        <p className="m-0 text-muted-foreground text-sm leading-6">
                                                            Các bước chạy theo hướng mũi tên. Ngắt
                                                            dây để nối sang một bước khác.
                                                        </p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={blocked}
                                                            onClick={removeSelected}
                                                        >
                                                            <Unplug data-icon="inline-start" />
                                                            Ngắt dây nối
                                                        </Button>
                                                    </>
                                                ) : selectedAction ? (
                                                    <>
                                                        <p className="m-0 text-muted-foreground text-xs leading-5">
                                                            {selectedAction.type === 'transformTo'
                                                                ? 'Nhập thông số hoặc kéo tay nắm ở khung trạng thái đích bên cạnh.'
                                                                : 'Chọn chức năng ngay trong khối. Điều chỉnh thông số chi tiết tại đây.'}
                                                        </p>
                                                        <InteractionActionEditor
                                                            scene={editingScene}
                                                            pages={book.pages}
                                                            action={selectedAction}
                                                            objects={scene.objects}
                                                            assets={assets}
                                                            id={`workflow-${selected}`}
                                                            disabled={blocked}
                                                            onChange={updateAction}
                                                        />
                                                        {revealTarget && (
                                                            <Field orientation="horizontal">
                                                                <Checkbox
                                                                    id="workflow-hidden"
                                                                    checked={!revealTarget.visible}
                                                                    disabled={blocked}
                                                                    onCheckedChange={(checked) =>
                                                                        onChange({
                                                                            ...scene,
                                                                            objects:
                                                                                scene.objects.map(
                                                                                    (object) =>
                                                                                        object.id ===
                                                                                        revealTarget.id
                                                                                            ? {
                                                                                                  ...object,
                                                                                                  visible:
                                                                                                      checked !==
                                                                                                      true,
                                                                                              }
                                                                                            : object,
                                                                                ),
                                                                        })
                                                                    }
                                                                />
                                                                <FieldLabel
                                                                    htmlFor="workflow-hidden"
                                                                    className="font-normal text-xs leading-5"
                                                                >
                                                                    Ẩn “{objectName(revealTarget)}”
                                                                    khi mở trang
                                                                </FieldLabel>
                                                            </Field>
                                                        )}
                                                        <Separator />
                                                        <p className="m-0 text-muted-foreground text-xs leading-5">
                                                            {selectedAction.type === 'playAudio' ||
                                                            selectedAction.type === 'playVideo' ||
                                                            selectedAction.type === 'playAnimation'
                                                                ? 'Bước sau bắt đầu khi lệnh phát đã được gửi, không chờ nội dung phát xong. Thêm bước Chờ nếu cần.'
                                                                : 'Bước sau thực hiện khi bước này hoàn tất.'}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={
                                                                    blocked ||
                                                                    draft.graph.nodes.length >=
                                                                        SCENE_LIMITS.maxActionsPerRule +
                                                                            1
                                                                }
                                                                onClick={() => {
                                                                    const id = crypto.randomUUID();
                                                                    const next = insertFlowStep(
                                                                        draft.graph,
                                                                        {
                                                                            id,
                                                                            action: copyStepAction(
                                                                                selectedAction,
                                                                            ),
                                                                            position: {
                                                                                x:
                                                                                    (selectedStep
                                                                                        ?.position
                                                                                        .x || 0) +
                                                                                    310,
                                                                                y:
                                                                                    selectedStep
                                                                                        ?.position
                                                                                        .y || 80,
                                                                            },
                                                                        },
                                                                        selected || undefined,
                                                                    );
                                                                    graphChange(next);
                                                                    setSelected(id);
                                                                }}
                                                            >
                                                                <Copy data-icon="inline-start" />
                                                                Nhân bản bước
                                                            </Button>
                                                            <Button
                                                                variant="destructive-ghost"
                                                                size="sm"
                                                                disabled={blocked}
                                                                onClick={removeSelected}
                                                            >
                                                                <Trash2 data-icon="inline-start" />
                                                                Xóa bước
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <FieldGroup className="gap-5">
                                                        <WorkflowTriggerFields
                                                            assets={assets}
                                                            trigger={draft.rule.trigger}
                                                            scene={editingScene}
                                                            disabled={blocked}
                                                            onChange={(trigger) =>
                                                                commit({
                                                                    ...draft,
                                                                    rule: {
                                                                        ...draft.rule,
                                                                        trigger,
                                                                    },
                                                                })
                                                            }
                                                        />
                                                        <Field>
                                                            <FieldLabel htmlFor="workflow-retrigger">
                                                                {draft.rule.trigger.type === 'onTap'
                                                                    ? 'Bấm thêm khi đang chạy'
                                                                    : 'Kích hoạt thêm khi đang chạy'}
                                                            </FieldLabel>
                                                            <FormSelect
                                                                id="workflow-retrigger"
                                                                aria-describedby="workflow-retrigger-description"
                                                                value={draft.rule.onRetrigger}
                                                                disabled={blocked}
                                                                options={[
                                                                    {
                                                                        value: 'ignore',
                                                                        label:
                                                                            draft.rule.trigger
                                                                                .type === 'onTap'
                                                                                ? 'Bỏ qua lần bấm thêm'
                                                                                : 'Bỏ qua lần kích hoạt thêm',
                                                                    },
                                                                    {
                                                                        value: 'restart',
                                                                        label: 'Chạy lại từ đầu',
                                                                    },
                                                                ]}
                                                                onValueChange={(value) =>
                                                                    commit({
                                                                        ...draft,
                                                                        rule: {
                                                                            ...draft.rule,
                                                                            onRetrigger: value as
                                                                                | 'ignore'
                                                                                | 'restart',
                                                                        },
                                                                    })
                                                                }
                                                            />
                                                            <FieldDescription id="workflow-retrigger-description">
                                                                {draft.rule.onRetrigger === 'ignore'
                                                                    ? draft.rule.trigger.type ===
                                                                      'onTap'
                                                                        ? 'Lượt hiện tại vẫn chạy tiếp. Bấm thêm không có tác dụng.'
                                                                        : 'Lượt hiện tại vẫn chạy tiếp. Các lần kích hoạt thêm bị bỏ qua.'
                                                                    : draft.rule.trigger.type ===
                                                                        'onTap'
                                                                      ? 'Bấm thêm sẽ dừng lượt hiện tại và chạy lại từ bước đầu.'
                                                                      : 'Kích hoạt thêm sẽ dừng lượt hiện tại và chạy lại từ bước đầu.'}
                                                            </FieldDescription>
                                                        </Field>
                                                        {draft.rule.trigger.type ===
                                                            'onPageEnter' && (
                                                            <p className="m-0 text-muted-foreground text-xs leading-5">
                                                                Luồng chạy khi người đọc mở trang.
                                                            </p>
                                                        )}
                                                    </FieldGroup>
                                                )}
                                                {invalid && (
                                                    <Button
                                                        variant="plain"
                                                        className="flex items-start gap-2 text-left text-destructive text-xs leading-5"
                                                        onClick={() => {
                                                            const id = Object.keys(errors)[0];
                                                            if (id) setSelected(id);
                                                        }}
                                                    >
                                                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                                                        {result?.error}
                                                    </Button>
                                                )}
                                            </section>
                                        </aside>
                                    )
                                )}
                            </div>
                        ) : (
                            <fieldset
                                aria-label="Kéo đối tượng vào đây để tạo tương tác"
                                className="m-0 flex min-h-0 min-w-0 flex-1 items-center justify-center border-0 p-8"
                                onDragOver={(event) => {
                                    if (event.dataTransfer.types.includes(OBJECT_MIME))
                                        event.preventDefault();
                                }}
                                onDrop={(event) => {
                                    const id = event.dataTransfer.getData(OBJECT_MIME),
                                        object = scene.objects.find((item) => item.id === id);
                                    if (!object || blocked) return;
                                    event.preventDefault();
                                    if (object.type === 'audio') {
                                        create('intro', { type: 'page' }, object);
                                    } else
                                        create('custom', { type: 'object', objectId: object.id });
                                }}
                            >
                                <Empty className="max-w-lg border-0">
                                    <EmptyHeader>
                                        <EmptyMedia>
                                            <Zap className="size-10" strokeWidth={1.5} />
                                        </EmptyMedia>
                                        <EmptyTitle>Tạo một điểm khám phá</EmptyTitle>
                                        <EmptyDescription>
                                            Chạm con vật để nghe tiếng kêu, mở thẻ thông tin hoặc
                                            chạy hoạt cảnh. Tạo luồng trống, nhấn + ở Các luồng để
                                            chọn mẫu. Chọn trang và đối tượng trực tiếp trong các
                                            khối.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <Button disabled={blocked} onClick={() => create('custom')}>
                                        Tạo luồng trống
                                    </Button>
                                </Empty>
                            </fieldset>
                        )}
                    </div>
                </div>
                {pending && (
                    <ConfirmationDialog
                        title="Luồng này chưa hoàn thiện"
                        description="Phần đang sửa được giữ trên thiết bị, chưa lưu vào sách. Bạn có thể tiếp tục sửa hoặc bỏ phần chưa hoàn thiện để chuyển đi."
                        busy={false}
                        onClose={() => setPending(null)}
                    >
                        <div className="mt-5 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setPending(null)}>
                                Tiếp tục sửa
                            </Button>
                            <Button
                                onClick={() => {
                                    try {
                                        localStorage.removeItem(key);
                                    } catch {
                                        /* optional */
                                    }
                                    const action = pending;
                                    setPending(null);
                                    const saved = scene.interactions.find(
                                        (rule) => rule.id === draft?.rule.id,
                                    );
                                    setDraft(
                                        saved
                                            ? { rule: saved, graph: restoreFlowLayout(saved) }
                                            : null,
                                    );
                                    onDirtyChange(false);
                                    action();
                                }}
                            >
                                Bỏ phần chưa hoàn thiện
                            </Button>
                        </div>
                    </ConfirmationDialog>
                )}
                {deleting && (
                    <ConfirmationDialog
                        title="Xóa luồng tương tác?"
                        description={`“${deleting.name || 'Tương tác'}” sẽ được bỏ khỏi trang. Các đối tượng trong scene vẫn được giữ.`}
                        busy={false}
                        onClose={() => setDeleting(null)}
                    >
                        <div className="mt-5 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setDeleting(null)}>
                                Giữ lại
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    const interactions = scene.interactions.filter(
                                        (rule) => rule.id !== deleting.id,
                                    );
                                    if (deleting.id === draft?.rule.id) {
                                        setDraft(null);
                                        setSelected(null);
                                        setSelectedEdge(null);
                                        onDirtyChange(false);
                                        try {
                                            localStorage.removeItem(key);
                                        } catch {
                                            /* optional */
                                        }
                                    }
                                    onChange({ ...scene, interactions });
                                    setDeleting(null);
                                }}
                            >
                                Xóa luồng
                            </Button>
                        </div>
                    </ConfirmationDialog>
                )}
            </section>
        </MemoryContext.Provider>
    );
}
