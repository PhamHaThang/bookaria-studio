import assert from 'node:assert/strict';
import test from 'node:test';
import { flowLink, flowToRule, ruleToFlow } from '../src/features/scene/model/interaction-flow.ts';
import {
    initializeMovementTarget,
    movementStartState,
    readMovementSequence,
    setMovementLoop,
} from '../src/features/scene/model/movement-sequence.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { InteractionRuleSchema } from '../src/shared/contracts/scene.schema.ts';

const initial = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
const frame = (id, position, holdMs = 0) => ({
    id,
    action: {
        type: 'transformTo',
        objectId: 'target',
        position,
        durationMs: 1000,
        delayMsSchema: 0,
        easing: 'linear',
    },
    holdMs,
});

const contextGraph = (actions, edges) => ({
    nodes: [
        { id: 'start', position: { x: 0, y: 0 } },
        ...actions.map((action, index) => ({
            id: `step-${index}`,
            action,
            position: { x: (index + 1) * 310, y: 0 },
        })),
    ],
    edges:
        edges ??
        actions.map((_, index) => flowLink(index ? `step-${index - 1}` : 'start', `step-${index}`)),
});
const contextObject = () => ({
    ...newObject('text', 'target'),
    transform: structuredClone(initial),
});

test('action starts inherit earlier transforms through waits/media/other targets and never include their own destination', () => {
    const object = contextObject();
    const actions = [
        { ...frame('a', [1, 2, 3]).action, rotation: [10, 20, 30], scale: [2, 3, 4] },
        { type: 'wait', ms: 500 },
        { ...frame('other', [9, 9, 9]).action, objectId: 'other' },
        { type: 'playVideo', objectId: 'video', delayMsSchema: 0 },
        {
            type: 'transformTo',
            objectId: 'target',
            rotation: [0, 0, 90],
            durationMs: 500,
            easing: 'linear',
            delayMsSchema: 0,
        },
        frame('last', [7, 8, 9]).action,
    ];
    const graph = contextGraph(actions);
    const before = structuredClone(graph);
    assert.deepEqual(movementStartState(graph, 'step-4', object), {
        transform: { position: [1, 2, 3], rotation: [10, 20, 30], scale: [2, 3, 4] },
        resolved: true,
        message: '',
    });
    assert.deepEqual(movementStartState(graph, 'step-5', object).transform, {
        position: [1, 2, 3],
        rotation: [0, 0, 90],
        scale: [2, 3, 4],
    });
    const initialized = initializeMovementTarget(graph, 'step-5', [object]);
    assert.deepEqual(initialized.nodes.at(-1).action.position, [1, 2, 3]);
    assert.equal(initialized.nodes.at(-1).action.rotation, undefined);
    assert.deepEqual(graph, before);
    assert.deepEqual(object.transform, initial);
});

test('branch merges keep shared axes, flag conflicting values and resolve again after an explicit destination', () => {
    const object = contextObject();
    const graph = contextGraph(
        [
            { type: 'condition', test: { type: 'visible', objectId: 'target', value: true } },
            frame('left', [1, 2, 3]).action,
            frame('right', [4, 2, 3]).action,
            { type: 'wait', ms: 0 },
            frame('fixed', [7, 8, 9]).action,
            { type: 'wait', ms: 0 },
        ],
        [
            flowLink('start', 'step-0'),
            flowLink('step-0', 'step-1', 'true'),
            flowLink('step-0', 'step-2', 'false'),
            flowLink('step-1', 'step-3'),
            flowLink('step-2', 'step-3'),
            flowLink('step-3', 'step-4'),
            flowLink('step-4', 'step-5'),
        ],
    );
    const merged = movementStartState(graph, 'step-3', object);
    assert.equal(merged.resolved, false);
    assert.ok(Number.isNaN(merged.transform.position[0]));
    assert.deepEqual(merged.transform.position.slice(1), [2, 3]);
    assert.deepEqual(merged.transform.scale, initial.scale);
    assert.match(merged.message, /nhánh/);
    assert.deepEqual(movementStartState(graph, 'step-5', object).transform, {
        ...initial,
        position: [7, 8, 9],
    });
    graph.nodes[3].action.position = [1, 2, 3];
    assert.equal(movementStartState(graph, 'step-3', object).resolved, true);
});

test('steps after an infinite loop/navigation or disconnected steps have no guessed initial pose', () => {
    const object = contextObject();
    const graph = contextGraph([frame('a', [1, 2, 3]).action, frame('b', [4, 5, 6]).action]);
    graph.movementLoop = { startId: 'step-0', endId: 'step-0', initial, pauseMs: 0 };
    assert.equal(movementStartState(graph, 'step-0', object).resolved, true);
    assert.equal(movementStartState(graph, 'step-1', object).resolved, false);
    delete graph.movementLoop;
    graph.nodes[1].action = { type: 'navigate', navigation: { target: 'end' }, delayMsSchema: 0 };
    assert.equal(movementStartState(graph, 'step-1', object).resolved, false);
    graph.edges = [];
    assert.equal(movementStartState(graph, 'step-1', object).resolved, false);
});

test('loop settings persist and only change metadata, preserving a saved return block and its edits', () => {
    const object = contextObject();
    const rule = InteractionRuleSchema.parse({
        id: 'r',
        trigger: { type: 'onPageEnter' },
        actions: [
            frame('a', [3, 2, 1]).action,
            { type: 'wait', ms: 300 },
            frame('return', [2, 1, 0]).action,
        ],
        editorLayout: [
            { id: 'start', x: 0, y: 0 },
            {
                id: 'out',
                x: 310,
                y: 0,
                movement: {
                    endId: 'return',
                    sourceEndId: 'out',
                    direction: 'alternate',
                    finish: 'last',
                },
            },
            { id: 'wait', x: 620, y: 0 },
            { id: 'return', x: 930, y: 0 },
        ],
        workflow: {
            version: 1,
            edges: [flowLink('start', 'out'), flowLink('out', 'wait'), flowLink('wait', 'return')],
        },
    });
    const graph = ruleToFlow(rule);
    const enabled = setMovementLoop(graph, 'out', object, 0);
    assert.strictEqual(enabled.nodes, graph.nodes);
    assert.strictEqual(enabled.edges, graph.edges);
    assert.deepEqual(enabled.movementLoop, {
        startId: 'out',
        endId: 'return',
        pauseMs: 0,
        initial,
    });
    const updated = setMovementLoop(enabled, 'return', object, 500);
    const saved = InteractionRuleSchema.parse(
        JSON.parse(JSON.stringify(flowToRule(updated, rule))),
    );
    assert.deepEqual(saved.actions, rule.actions);
    assert.deepEqual(saved.editorLayout, rule.editorLayout);
    assert.deepEqual(saved.workflow, rule.workflow);
    const restored = ruleToFlow(saved);
    assert.equal(readMovementSequence(restored, 'return').loop.pauseMs, 500);
    const disabled = setMovementLoop(restored, 'return', undefined, null);
    assert.equal(flowToRule(disabled, saved).movementLoop, undefined);
    assert.deepEqual(flowToRule(disabled, saved).actions, rule.actions);
});

test('loop starts from the inherited pose and does not include non-movement actions or a different target', () => {
    const object = contextObject();
    const graph = contextGraph([
        frame('a', [3, 2, 1]).action,
        { type: 'setVisible', objectId: 'target', value: true, durationMs: 0, delayMsSchema: 0 },
        frame('b', [4, 5, 6]).action,
        { ...frame('other', [1, 2, 3]).action, objectId: 'other' },
    ]);
    const loop = setMovementLoop(graph, 'step-2', object, 0).movementLoop;
    assert.deepEqual(loop, {
        startId: 'step-2',
        endId: 'step-2',
        pauseMs: 0,
        initial: { ...initial, position: [3, 2, 1] },
    });
    assert.throws(() => setMovementLoop(graph, 'step-2', object, -1), /0–60/);
    assert.throws(
        () => setMovementLoop({ ...graph, movementLoop: loop }, 'step-0', object, 0),
        /chỉ có một đoạn lặp/,
    );
});
