import type { Action, InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { SCENE_LIMITS } from '@/shared/contracts/scene.schema';

export type FlowStep = { id: string; position: { x: number; y: number }; action?: Action };
export type FlowPort = 'next' | 'true' | 'false';
export type FlowLink = { id: string; source: string; target: string; port?: FlowPort };
export type InteractionFlow = { nodes: FlowStep[]; edges: FlowLink[] };
export const START_NODE = 'start';
export const flowLink = (source: string, target: string, port: FlowPort = 'next'): FlowLink => ({
    id: port === 'next' ? `${source}:${target}` : `${source}:${port}:${target}`,
    source,
    target,
    ...(port !== 'next' ? { port } : {}),
});

/** Choice lists must see the active graph even while it is disconnected or incomplete. */
export function sceneWithInteractionDraft(
    scene: Scene,
    rule?: InteractionRule,
    graph?: InteractionFlow,
): Scene {
    if (!rule || !graph) return scene;
    const current = {
        ...rule,
        actions: graph.nodes.flatMap((node) => (node.action ? [node.action] : [])),
    };
    return {
        ...scene,
        interactions: scene.interactions.some((item) => item.id === rule.id)
            ? scene.interactions.map((item) => (item.id === rule.id ? current : item))
            : [...scene.interactions, current],
    };
}

export function ruleToFlow(rule: InteractionRule): InteractionFlow {
    const nodes: FlowStep[] = [
        {
            id: START_NODE,
            position: { x: rule.editorLayout?.[0]?.x ?? 40, y: rule.editorLayout?.[0]?.y ?? 80 },
        },
        ...rule.actions.map((action, index) => ({
            id: rule.editorLayout?.[index + 1]?.id || `action-${index}`,
            position: {
                x: rule.editorLayout?.[index + 1]?.x ?? 340 + index * 300,
                y: rule.editorLayout?.[index + 1]?.y ?? 80,
            },
            action: structuredClone(action),
        })),
    ];
    return {
        nodes,
        edges: rule.workflow
            ? rule.workflow.edges.map((edge) => flowLink(edge.source, edge.target, edge.port))
            : nodes.slice(1).map((node, index) => flowLink(nodes[index].id, node.id)),
    };
}

/** Partial drafts may be disconnected; valid connections form a directed acyclic graph. */
export function connectionProblem(
    graph: InteractionFlow,
    source: string,
    target: string,
    port: FlowPort = 'next',
): string | null {
    const from = graph.nodes.find((node) => node.id === source);
    if (!from || !graph.nodes.some((node) => node.id === target))
        return 'Không tìm thấy bước cần nối.';
    if (source === target) return 'Không thể nối một bước với chính nó.';
    if (target === START_NODE) return 'Sự kiện bắt đầu không nhận dây nối vào.';
    if (from.action?.type === 'navigate') return 'Chuyển trang là bước cuối của nhánh.';
    if ((from.action?.type === 'condition') === (port === 'next'))
        return 'Chọn cổng Đúng hoặc Sai của điều kiện.';
    if (graph.edges.some((edge) => edge.source === source && (edge.port || 'next') === port))
        return 'Cổng này đã có dây nối. Ngắt dây cũ trước khi nối lại.';
    const visited = new Set<string>();
    const visit = (id: string): boolean => {
        if (id === source) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        return graph.edges.filter((edge) => edge.source === id).some((edge) => visit(edge.target));
    };
    return visit(target) ? 'Không thể nối thành vòng lặp.' : null;
}

/** Stable node ordering for persistence; execution follows ports, never coordinates. */
export function orderedFlowSteps(graph: InteractionFlow): FlowStep[] {
    if (
        new Set(graph.nodes.map((node) => node.id)).size !== graph.nodes.length ||
        graph.nodes.filter((node) => !node.action).length !== 1 ||
        !graph.nodes.some((node) => node.id === START_NODE && !node.action)
    )
        throw new Error('Luồng cần đúng một sự kiện bắt đầu.');
    if (graph.nodes.length < 2) throw new Error('Thêm ít nhất một bước sau sự kiện bắt đầu.');
    if (graph.nodes.length > SCENE_LIMITS.maxActionsPerRule + 1)
        throw new Error(`Mỗi luồng tối đa ${SCENE_LIMITS.maxActionsPerRule} bước.`);
    const checked: InteractionFlow = { nodes: graph.nodes, edges: [] };
    for (const edge of graph.edges) {
        const problem = connectionProblem(checked, edge.source, edge.target, edge.port);
        if (problem) throw new Error(problem);
        checked.edges.push(edge);
    }
    if (!graph.edges.some((edge) => edge.source === START_NODE))
        throw new Error('Nối sự kiện với bước đầu tiên.');
    for (const node of graph.nodes)
        if (
            node.action?.type === 'condition' &&
            graph.edges.filter((edge) => edge.source === node.id).length !== 2
        )
            throw new Error('Nối cả nhánh Đúng và Sai của điều kiện.');
    const reachable = new Set<string>();
    const visit = (id: string) => {
        if (reachable.has(id)) return;
        reachable.add(id);
        for (const edge of graph.edges.filter((item) => item.source === id)) visit(edge.target);
    };
    visit(START_NODE);
    if (reachable.size !== graph.nodes.length)
        throw new Error('Có bước chưa được nối từ sự kiện bắt đầu.');
    const degree = new Map(
        graph.nodes.map((node) => [
            node.id,
            graph.edges.filter((edge) => edge.target === node.id).length,
        ]),
    );
    const queue = [START_NODE],
        ordered: FlowStep[] = [];
    while (queue.length) {
        const id = queue.shift() as string;
        ordered.push(graph.nodes.find((node) => node.id === id) as FlowStep);
        for (const edge of graph.edges.filter((item) => item.source === id)) {
            const remaining = (degree.get(edge.target) || 0) - 1;
            degree.set(edge.target, remaining);
            if (!remaining) queue.push(edge.target);
        }
    }
    return ordered;
}
export function flowToRule(graph: InteractionFlow, rule: InteractionRule): InteractionRule {
    const nodes = orderedFlowSteps(graph);
    return {
        ...rule,
        workflow: {
            version: 1,
            edges: graph.edges.map((edge) => ({
                source: edge.source,
                target: edge.target,
                port: edge.port || 'next',
            })),
        },
        editorLayout: nodes.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
        })),
        actions: nodes.slice(1).map((node) => structuredClone(node.action as Action)),
    };
}

/** Click-to-add inserts after the selected step; dropping a node leaves it available for manual wiring. */
export function insertFlowStep(
    graph: InteractionFlow,
    node: FlowStep,
    afterId?: string,
    fromPort?: FlowPort,
): InteractionFlow {
    if (graph.nodes.length >= SCENE_LIMITS.maxActionsPerRule + 1)
        throw new Error(`Mỗi luồng tối đa ${SCENE_LIMITS.maxActionsPerRule} bước.`);
    if (!node.action || graph.nodes.some((n) => n.id === node.id))
        throw new Error('Bước mới không hợp lệ.');
    if (!afterId) return { ...graph, nodes: [...graph.nodes, node] };
    if (!graph.nodes.some((n) => n.id === afterId))
        throw new Error('Không tìm thấy vị trí thêm bước.');
    const parent = graph.nodes.find((node) => node.id === afterId);
    const port: FlowPort =
        fromPort ||
        (parent?.action?.type === 'condition'
            ? graph.edges.some((edge) => edge.source === afterId && edge.port === 'true')
                ? 'false'
                : 'true'
            : 'next');
    if (parent?.action?.type === 'navigate') throw new Error('Thêm bước trước node chuyển trang.');
    const next = graph.edges.find(
        (edge) => edge.source === afterId && (edge.port || 'next') === port,
    );
    return {
        nodes: [...graph.nodes, node],
        edges: [
            ...graph.edges.filter((edge) => edge !== next),
            flowLink(afterId, node.id, port),
            ...(next && node.action.type !== 'navigate' ? [flowLink(node.id, next.target)] : []),
        ],
    };
}

/** Make room on the selected wire, including its shared continuation, without moving its sibling branch. */
export function layoutInsertedFlowStep(
    before: InteractionFlow,
    after: InteractionFlow,
    insertedId: string,
): InteractionFlow {
    const inserted = after.nodes.find((node) => node.id === insertedId);
    const incoming = after.edges.find((edge) => edge.target === insertedId);
    if (!inserted || !incoming) return after;
    const original = before.edges.find(
        (edge) =>
            edge.source === incoming.source && (edge.port || 'next') === (incoming.port || 'next'),
    );
    const target = before.nodes.find((node) => node.id === original?.target);
    if (!target) return after;
    const downstream = new Set<string>();
    const queue = [target.id];
    while (queue.length) {
        const id = queue.pop();
        if (!id || downstream.has(id)) continue;
        downstream.add(id);
        queue.push(...before.edges.filter((edge) => edge.source === id).map((edge) => edge.target));
    }
    const existing = new Set(before.nodes.map((node) => node.id));
    const dx = target.position.x - inserted.position.x;
    const dy = target.position.y - inserted.position.y;
    const spacing = inserted.action?.type === 'condition' ? 620 : 310;
    return {
        ...after,
        nodes: after.nodes.map((node) =>
            !existing.has(node.id)
                ? { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } }
                : downstream.has(node.id)
                  ? { ...node, position: { ...node.position, x: node.position.x + spacing } }
                  : node,
        ),
    };
}

/** Deleting a branching node requires deliberate rewiring; never silently pick a branch. */
export function removeFlowStep(graph: InteractionFlow, id: string): InteractionFlow {
    if (id === START_NODE || !graph.nodes.some((node) => node.id === id)) return graph;
    const before = graph.edges.filter((edge) => edge.target === id),
        after = graph.edges.filter((edge) => edge.source === id);
    return {
        nodes: graph.nodes.filter((node) => node.id !== id),
        edges: [
            ...graph.edges.filter((edge) => edge.source !== id && edge.target !== id),
            ...(after.length === 1
                ? before.map((edge) => flowLink(edge.source, after[0].target, edge.port))
                : []),
        ],
    };
}
export function arrangeFlow(graph: InteractionFlow): InteractionFlow {
    const depth = new Map<string, number>([[START_NODE, 0]]);
    for (let pass = 0; pass < graph.nodes.length; pass++)
        for (const edge of graph.edges) {
            const level = depth.get(edge.source);
            if (level !== undefined)
                depth.set(edge.target, Math.max(depth.get(edge.target) || 0, level + 1));
        }
    const levels = new Map<number, number>();
    return {
        ...graph,
        nodes: graph.nodes.map((node) => {
            const level = depth.get(node.id) ?? graph.nodes.length;
            const row = levels.get(level) || 0;
            levels.set(level, row + 1);
            return { ...node, position: { x: 40 + level * 310, y: 80 + row * 230 } };
        }),
    };
}

const layoutKey = 'bookaria:interaction-layouts:v1';
const signature = (rule: InteractionRule) => JSON.stringify([rule.trigger, rule.actions]);
/** Layout is a device preference. The executable workflow is persisted in the scene API. */
export function restoreFlowLayout(rule: InteractionRule): InteractionFlow {
    const graph = ruleToFlow(rule);
    if (rule.editorLayout) return graph;
    try {
        const saved = JSON.parse(localStorage.getItem(layoutKey) || '{}')[rule.id];
        if (saved?.signature !== signature(rule)) return graph;
        return {
            ...graph,
            nodes: graph.nodes.map((n, i) => {
                const p = saved.positions?.[i];
                return p &&
                    Number.isFinite(p.x) &&
                    Number.isFinite(p.y) &&
                    Math.abs(p.x) < 100000 &&
                    Math.abs(p.y) < 100000
                    ? { ...n, position: p }
                    : n;
            }),
        };
    } catch {
        return graph;
    }
}
export function saveFlowLayout(rule: InteractionRule, graph: InteractionFlow) {
    try {
        const entries = Object.entries(JSON.parse(localStorage.getItem(layoutKey) || '{}'))
            .filter(([id]) => id !== rule.id)
            .slice(-59);
        localStorage.setItem(
            layoutKey,
            JSON.stringify({
                ...Object.fromEntries(entries),
                [rule.id]: {
                    signature: signature(rule),
                    positions: orderedFlowSteps(graph).map((n) => n.position),
                },
            }),
        );
    } catch {
        /* A blocked or full browser store must not prevent saving the scene. */
    }
}
