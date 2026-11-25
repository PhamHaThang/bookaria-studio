import {
    type Action,
    ActionSchema,
    SCENE_LIMITS,
    type SceneObject,
    type Transform,
} from '@/shared/contracts/scene.schema';
import type { FlowStep, InteractionFlow } from './interaction-flow';

/** Unknown axes stay NaN in editor context only; they must never be persisted as action values. */
export function movementStartState(graph: InteractionFlow, stepId: string, object: SceneObject) {
    const memo = new Map<string, Transform | null>();
    const visiting = new Set<string>();
    const unknown = (): Transform => ({
        position: [NaN, NaN, NaN],
        rotation: [NaN, NaN, NaN],
        scale: [NaN, NaN, NaN],
    });
    const merge = (states: Transform[]): Transform | null => {
        if (!states.length) return null;
        const value = structuredClone(states[0]);
        for (const field of ['position', 'rotation', 'scale'] as const)
            for (let axis = 0; axis < 3; axis++)
                if (
                    !states.every(
                        (state) =>
                            Number.isFinite(state[field][axis]) &&
                            Math.abs(state[field][axis] - value[field][axis]) < 1e-9,
                    )
                )
                    value[field][axis] = NaN;
        return value;
    };
    const before = (id: string): Transform | null =>
        id === 'start'
            ? structuredClone(object.transform)
            : merge(
                  graph.edges
                      .filter((edge) => edge.target === id)
                      .flatMap((edge) => {
                          const state = after(edge.source);
                          return state ? [state] : [];
                      }),
              );
    function after(id: string): Transform | null {
        if (memo.has(id)) return memo.get(id) ?? null;
        if (visiting.has(id)) return unknown();
        const node = graph.nodes.find((node) => node.id === id);
        if (!node || node.action?.type === 'navigate' || id === graph.movementLoop?.endId)
            return null;
        visiting.add(id);
        let state = before(id);
        if (state && node.action?.type === 'transformTo' && node.action.objectId === object.id)
            state = movementState(state, node.action);
        if (state && node.action?.type === 'controlModel' && node.action.objectId === object.id)
            state =
                node.action.operation === 'reset'
                    ? structuredClone(object.transform)
                    : node.action.operation === 'enable'
                      ? { ...state, position: [NaN, NaN, NaN], rotation: [NaN, NaN, NaN] }
                      : state;
        visiting.delete(id);
        memo.set(id, state);
        return state;
    }
    const state = before(stepId);
    const transform = state ?? unknown();
    const resolved = Object.values(transform).every((values) => values.every(Number.isFinite));
    return {
        transform,
        resolved,
        message: !state
            ? 'Bước này chưa được nối hoặc nằm sau một đoạn lặp vô hạn. Hãy kiểm tra luồng.'
            : !resolved
              ? 'Trạng thái trước bước này phụ thuộc nhánh hoặc điều khiển mô hình. Nhập đích tuyệt đối hoặc chạy thử cả luồng để kiểm chứng.'
              : '',
    };
}

export function initializeMovementTarget(
    graph: InteractionFlow,
    stepId: string,
    objects: SceneObject[],
): InteractionFlow {
    const node = graph.nodes.find((node) => node.id === stepId);
    if (node?.action?.type !== 'transformTo') return graph;
    const action = node.action;
    const object = objects.find((object) => object.id === action.objectId);
    if (!object) return graph;
    const start = movementStartState(graph, stepId, object);
    if (!start.resolved) return graph;
    return {
        ...graph,
        nodes: graph.nodes.map((node) =>
            node.id === stepId
                ? {
                      ...node,
                      action: {
                          ...action,
                          ...(action.position ? { position: [...start.transform.position] } : {}),
                          ...(action.rotation ? { rotation: [...start.transform.rotation] } : {}),
                          ...(action.scale ? { scale: [...start.transform.scale] } : {}),
                      },
                  }
                : node,
        ),
    };
}

export function refreshMovementLoop(
    graph: InteractionFlow,
    objects: SceneObject[],
): InteractionFlow {
    const loop = graph.movementLoop;
    if (!loop) return graph;
    const action = graph.nodes.find((node) => node.id === loop.startId)?.action;
    if (action?.type !== 'transformTo') return graph;
    const object = objects.find((item) => item.id === action.objectId);
    if (!object) return graph;
    const initial = movementStartState(graph, loop.startId, object);
    if (!initial.resolved || JSON.stringify(initial.transform) === JSON.stringify(loop.initial))
        return graph;
    return { ...graph, movementLoop: { ...loop, initial: initial.transform } };
}

type MovementAction = Extract<Action, { type: 'transformTo' }>;

export function readMovementSequence(graph: InteractionFlow, selectedId: string) {
    const selected = graph.nodes.find((node) => node.id === selectedId);
    if (selected?.action?.type !== 'transformTo') throw new Error('Chọn một bước chuyển động.');
    const objectId = selected.action.objectId;
    const segment = (startId?: string, endId?: string) => {
        const steps: FlowStep[] = [];
        let node = graph.nodes.find((node) => node.id === startId);
        while (node && !steps.includes(node)) {
            steps.push(node);
            if (node.id === endId) return steps;
            const nextId: string | undefined = graph.edges.find(
                (edge) => edge.source === node?.id,
            )?.target;
            node = graph.nodes.find((node) => node.id === nextId);
        }
        return [];
    };
    const loopSteps = segment(graph.movementLoop?.startId, graph.movementLoop?.endId);
    const loop = loopSteps.includes(selected) ? graph.movementLoop : undefined;
    if (loop) return { steps: loopSteps, objectId, loop };
    const isPart = (node?: FlowStep) =>
        (!node || !loopSteps.includes(node)) &&
        (node?.action?.type === 'wait' ||
            (node?.action?.type === 'transformTo' && node.action.objectId === objectId));
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const steps = [selected];
    const seen = new Set([selectedId]);
    let current = selected;
    for (;;) {
        const incoming = graph.edges.filter((edge) => edge.target === current.id);
        const previous = nodes.get(incoming[0]?.source ?? '');
        if (
            incoming.length !== 1 ||
            !previous ||
            !isPart(previous) ||
            seen.has(previous.id) ||
            graph.edges.filter((edge) => edge.source === previous.id).length !== 1
        )
            break;
        steps.unshift(previous);
        seen.add(previous.id);
        current = previous;
    }
    current = selected;
    for (;;) {
        const outgoing = graph.edges.filter((edge) => edge.source === current.id);
        const next = nodes.get(outgoing[0]?.target ?? '');
        if (
            outgoing.length !== 1 ||
            !next ||
            !isPart(next) ||
            seen.has(next.id) ||
            graph.edges.filter((edge) => edge.target === next.id).length !== 1
        )
            break;
        steps.push(next);
        seen.add(next.id);
        current = next;
    }
    while (steps[0]?.action?.type === 'wait') steps.shift();
    while (steps.at(-1)?.action?.type === 'wait') steps.pop();
    return { steps, objectId, loop };
}

function movementState(initial: Transform, action: MovementAction): Transform {
    return {
        position: [...(action.position ?? initial.position)],
        rotation: [...(action.rotation ?? initial.rotation)],
        scale: [...(action.scale ?? initial.scale)],
    };
}

export function setMovementLoop(
    graph: InteractionFlow,
    stepId: string,
    object: SceneObject | undefined,
    pauseMs: number | null,
): InteractionFlow {
    const { steps, loop } = readMovementSequence(graph, stepId);
    if (pauseMs === null) return loop ? { ...graph, movementLoop: undefined } : graph;
    if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > SCENE_LIMITS.maxDelayMs)
        throw new Error('Khoảng nghỉ giữa lượt cần nằm trong 0–60 giây.');
    if (loop) return { ...graph, movementLoop: { ...loop, pauseMs } };
    if (graph.movementLoop)
        throw new Error('Mỗi luồng chỉ có một đoạn lặp. Hãy tắt đoạn lặp hiện tại trước.');
    if (!object) throw new Error('Hãy chọn đối tượng chuyển động.');
    if (steps.some((step) => !ActionSchema.safeParse(step.action).success))
        throw new Error('Kiểm tra thông số chuyển động trước khi bật lặp.');
    const startId = steps[0].id;
    const endId = steps[steps.length - 1].id;
    const initial = movementStartState(graph, startId, object);
    if (!initial.resolved) throw new Error(initial.message);
    return { ...graph, movementLoop: { startId, endId, pauseMs, initial: initial.transform } };
}
