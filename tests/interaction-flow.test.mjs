import assert from 'node:assert/strict';
import test from 'node:test';
import {
    arrangeFlow,
    connectionProblem,
    flowLink,
    flowToRule,
    insertFlowStep,
    layoutInsertedFlowStep,
    orderedFlowSteps,
    removeFlowStep,
    restoreFlowLayout,
    ruleToFlow,
    saveFlowLayout,
    sceneWithInteractionDraft,
} from '../src/features/scene/model/interaction-flow.ts';
import {
    interactionTemplates,
    templateRule,
} from '../src/features/scene/model/interaction-templates.ts';
import { newRule } from '../src/features/scene/model/interactions.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { InteractionRuleSchema } from '../src/shared/contracts/scene.schema.ts';

const rule = () => ({
    ...newRule('flow'),
    actions: [
        { type: 'wait', ms: 100 },
        { type: 'wait', ms: 200 },
        { type: 'wait', ms: 300 },
    ],
});
test('flow roundtrip preserves every action field and follows connections, not array or visual order', () => {
    const initial = rule(),
        graph = ruleToFlow(initial);
    assert.deepEqual(executable(flowToRule(graph, initial)), executable(initial));
    graph.nodes.reverse();
    graph.nodes.forEach((n) => {
        n.position.x = -n.position.x;
    });
    assert.deepEqual(executable(flowToRule(graph, initial)), executable(initial));
    graph.edges = [
        flowLink('start', 'action-2'),
        flowLink('action-2', 'action-0'),
        flowLink('action-0', 'action-1'),
    ];
    assert.deepEqual(
        flowToRule(graph, initial).actions.map((a) => a.ms),
        [300, 100, 200],
    );
    assert.deepEqual(
        orderedFlowSteps(arrangeFlow(graph)).map((n) => n.position.x),
        [40, 350, 660, 970],
    );
});
test('connection validation prevents self-links, merges, branches, duplicate wires, backward trigger wires and cycles', () => {
    const graph = ruleToFlow(rule());
    for (const pair of [
        ['start', 'start'],
        ['start', 'action-0'],
        ['action-2', 'start'],
        ['action-2', 'action-1'],
        ['missing', 'action-0'],
    ])
        assert.ok(connectionProblem(graph, ...pair), pair.join(' -> '));
    const partial = {
        ...graph,
        edges: [flowLink('action-0', 'action-1'), flowLink('action-1', 'action-2')],
    };
    assert.match(connectionProblem(partial, 'action-2', 'action-0'), /vòng lặp/);
    assert.equal(connectionProblem(partial, 'start', 'action-0'), null);
});
test('disconnected, empty, cyclic and branching graphs cannot compile to an executable rule', () => {
    const initial = rule(),
        graph = ruleToFlow(initial);
    assert.throws(
        () => flowToRule({ ...graph, edges: graph.edges.slice(1) }, initial),
        /chưa được nối|Nối sự kiện/,
    );
    assert.throws(() => flowToRule({ nodes: [graph.nodes[0]], edges: [] }, initial), /ít nhất/);
    assert.throws(() =>
        flowToRule(
            { ...graph, edges: [...graph.edges, flowLink('action-2', 'action-0')] },
            initial,
        ),
    );
    assert.throws(() =>
        flowToRule({ ...graph, edges: [...graph.edges, flowLink('start', 'action-2')] }, initial),
    );
    assert.throws(() => flowToRule({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }, initial));
});
test('click inserts between steps and deleting a middle step repairs its predecessor/successor', () => {
    const initial = rule(),
        graph = ruleToFlow(initial),
        fresh = { id: 'new', position: { x: 0, y: 0 }, action: { type: 'wait', ms: 400 } };
    const inserted = insertFlowStep(graph, fresh, 'action-0');
    assert.deepEqual(
        flowToRule(inserted, initial).actions.map((a) => a.ms),
        [100, 400, 200, 300],
    );
    assert.deepEqual(
        executable(flowToRule(removeFlowStep(inserted, 'new'), initial)),
        executable(initial),
    );
    assert.equal(removeFlowStep(graph, 'start'), graph);
    assert.equal(graph.nodes.length, 4, 'original snapshot untouched for undo');
    const dropped = insertFlowStep(graph, fresh);
    assert.throws(() => flowToRule(dropped, initial), /chưa được nối|Nối sự kiện/);
});
test('flow enforces action limits without mutating existing nodes', () => {
    const initial = {
            ...rule(),
            actions: Array.from({ length: 20 }, () => ({ type: 'wait', ms: 100 })),
        },
        graph = ruleToFlow(initial);
    assert.throws(
        () =>
            insertFlowStep(
                graph,
                { id: 'extra', position: { x: 0, y: 0 }, action: { type: 'wait', ms: 1 } },
                'start',
            ),
        /20/,
    );
    assert.equal(graph.nodes.length, 21);
    assert.equal(InteractionRuleSchema.safeParse(flowToRule(graph, initial)).success, true);
});
test('all templates compile through the graphical builder to the existing runtime contract', () => {
    const aid = '11111111-1111-4111-8111-111111111111',
        mid = '22222222-2222-4222-8222-222222222222',
        vid = '33333333-3333-4333-8333-333333333333';
    const assets = { [mid]: { type: 'MODEL', meta: { animations: ['Idle'] } } };
    const scene = {
        schemaVersion: 1,
        objects: [
            newObject('text', 'source'),
            newObject('text', 'target'),
            newObject('audio', 'audio', { id: aid, type: 'AUDIO', status: 'READY' }),
            newObject('model', 'model', { id: mid, type: 'MODEL', status: 'READY' }),
            newObject('video', 'video', { id: vid, type: 'VIDEO', status: 'READY' }),
        ],
        interactions: [],
    };
    for (const t of interactionTemplates) {
        const initial = templateRule(t.id, 'flow', scene, assets, { type: 'all' });
        if (t.id === 'link') initial.actions[0].url = 'https://example.com';
        const compiled = flowToRule(ruleToFlow(initial), initial);
        if (initial.workflow) {
            const byId = (a, b) => a.id.localeCompare(b.id);
            assert.deepEqual(
                ruleToFlow(compiled).nodes.sort(byId),
                ruleToFlow(initial).nodes.sort(byId),
                t.id,
            );
            assert.deepEqual(compiled.workflow, initial.workflow, t.id);
        } else assert.deepEqual(executable(compiled), executable(initial), t.id);
        assert.equal(InteractionRuleSchema.safeParse(compiled).success, true, t.id);
    }
});
test('local layout follows compiled action order, rejects stale data and tolerates blocked storage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    let value = null;
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: () => value,
            setItem: (_, next) => {
                value = next;
            },
        },
    });
    try {
        const initial = rule(),
            graph = ruleToFlow(initial);
        graph.edges = [
            flowLink('start', 'action-2'),
            flowLink('action-2', 'action-0'),
            flowLink('action-0', 'action-1'),
        ];
        const compiled = flowToRule(graph, initial);
        saveFlowLayout(compiled, graph);
        const restored = restoreFlowLayout(compiled);
        assert.equal(restored.nodes[1].position.x, graph.nodes[3].position.x);
        assert.deepEqual(flowToRule(restored, compiled), compiled);
        assert.deepEqual(
            restoreFlowLayout(initial),
            ruleToFlow(initial),
            'stale graph positions ignored',
        );
        value = '{broken';
        assert.deepEqual(restoreFlowLayout(initial), ruleToFlow(initial));
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() {
                throw Error('blocked');
            },
        });
        assert.deepEqual(restoreFlowLayout(initial), ruleToFlow(initial));
        assert.doesNotThrow(() => saveFlowLayout(initial, ruleToFlow(initial)));
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
        else delete globalThis.localStorage;
    }
});

function executable(rule) {
    const { editorLayout, workflow, ...value } = rule;
    return value;
}
test('layout survives JSON/schema roundtrip and preserves stable ids after reconnecting steps', () => {
    const initial = rule(),
        graph = ruleToFlow(initial);
    graph.nodes[2].position = { x: 1250, y: -240 };
    graph.edges = [
        flowLink('start', 'action-2'),
        flowLink('action-2', 'action-0'),
        flowLink('action-0', 'action-1'),
    ];
    const saved = InteractionRuleSchema.parse(
        JSON.parse(JSON.stringify(flowToRule(graph, initial))),
    );
    const restored = ruleToFlow(saved);
    assert.deepEqual(
        restored.nodes.map((node) => node.id),
        ['start', 'action-2', 'action-0', 'action-1'],
    );
    assert.deepEqual(restored.nodes[3].position, { x: 1250, y: -240 });
    assert.deepEqual(
        restored.nodes.slice(1).map((node) => node.action.ms),
        [300, 100, 200],
    );
    assert.deepEqual(flowToRule(restored, saved), saved);
});

function branchedLayout() {
    const wait = (id, x, y) => ({ id, position: { x, y }, action: { type: 'wait', ms: 1 } });
    return {
        nodes: [
            { id: 'start', position: { x: 40, y: 80 } },
            {
                id: 'condition',
                position: { x: 350, y: 80 },
                action: {
                    type: 'condition',
                    test: { type: 'variable', key: 'score', operator: 'gte', value: 1 },
                    delayMsSchema: 0,
                },
            },
            wait('yes', 660, -50),
            wait('no', 660, 210),
            wait('join', 970, 80),
            wait('tail', 1280, 80),
        ],
        edges: [
            flowLink('start', 'condition'),
            flowLink('condition', 'yes', 'true'),
            flowLink('condition', 'no', 'false'),
            flowLink('yes', 'join'),
            flowLink('no', 'join'),
            flowLink('join', 'tail'),
        ],
    };
}

for (const port of ['true', 'false']) {
    test(`inserting on ${port} preserves sibling positions and moves the entire shared continuation once`, () => {
        const before = branchedLayout();
        const snapshot = structuredClone(before);
        const sibling = port === 'true' ? 'no' : 'yes',
            target = port === 'true' ? 'yes' : 'no';
        const inserted = insertFlowStep(
            before,
            { id: 'new', position: { x: 660, y: 80 }, action: { type: 'wait', ms: 2 } },
            'condition',
            port,
        );
        const after = layoutInsertedFlowStep(before, inserted, 'new');
        const position = (graph, id) => graph.nodes.find((node) => node.id === id).position;
        assert.deepEqual(position(after, 'new'), position(before, target));
        assert.deepEqual(position(after, sibling), position(before, sibling));
        for (const id of [target, 'join', 'tail'])
            assert.equal(position(after, id).x, position(before, id).x + 310);
        assert.deepEqual(after.edges, inserted.edges);
        assert.deepEqual(before, snapshot);
    });
}

test('a nested condition reserves two columns and keeps both new branch handles beside their selected row', () => {
    const before = branchedLayout();
    const after = insertFlowStep(
        before,
        { id: 'nested', position: { x: 660, y: 80 }, action: before.nodes[1].action },
        'condition',
        'false',
    );
    after.edges = after.edges.filter((edge) => edge.source !== 'nested');
    for (const [id, port, y] of [
        ['nested-yes', 'true', -50],
        ['nested-no', 'false', 210],
    ]) {
        after.nodes.push({ id, position: { x: 970, y }, action: { type: 'wait', ms: 0 } });
        after.edges.push(flowLink('nested', id, port), flowLink(id, 'no'));
    }
    const result = layoutInsertedFlowStep(before, after, 'nested');
    assert.deepEqual(result.nodes.find((node) => node.id === 'nested').position, {
        x: 660,
        y: 210,
    });
    assert.equal(result.nodes.find((node) => node.id === 'no').position.x, 1280);
    assert.equal(result.nodes.find((node) => node.id === 'nested-yes').position.x, 970);
    assert.deepEqual(
        result.nodes.find((node) => node.id === 'yes').position,
        before.nodes.find((node) => node.id === 'yes').position,
    );
});

test('editable scene uses current graph questions even while invalid and preserves other workflows', () => {
    const oldQuestion = {
        type: 'askQuestion',
        question: { questionId: 'old', title: 'Old prompt' },
    };
    const rule = { id: 'active', trigger: { type: 'onPageEnter' }, actions: [oldQuestion] };
    const other = {
        id: 'other',
        trigger: { type: 'onPageEnter' },
        actions: [
            { type: 'askQuestion', question: { questionId: 'other-q', title: 'Other prompt' } },
        ],
    };
    const scene = { schemaVersion: 1, objects: [], interactions: [rule, other] };
    const condition = {
        type: 'condition',
        test: { type: 'answer', questionId: '', result: 'correct' },
    };
    const question = {
        type: 'askQuestion',
        question: { questionId: 'new', title: 'Draft prompt' },
    };
    const graph = {
        nodes: [
            { id: 'start', position: { x: 0, y: 0 } },
            { id: 'condition', position: { x: 300, y: 0 }, action: condition },
            { id: 'question', position: { x: 600, y: 0 }, action: question },
        ],
        edges: [],
    };
    const edited = sceneWithInteractionDraft(scene, rule, graph);
    assert.deepEqual(edited.interactions[0].actions, [condition, question]);
    assert.equal(edited.interactions[1], other);
    assert.deepEqual(scene.interactions[0].actions, [oldQuestion]);
    const deleted = sceneWithInteractionDraft(scene, rule, {
        ...graph,
        nodes: graph.nodes.filter((node) => node.id !== 'question'),
    });
    assert.equal(
        deleted.interactions
            .flatMap((item) => item.actions)
            .some(
                (action) => action.type === 'askQuestion' && action.question.questionId === 'old',
            ),
        false,
    );
    assert.equal(
        deleted.interactions
            .flatMap((item) => item.actions)
            .some(
                (action) => action.type === 'askQuestion' && action.question.questionId === 'new',
            ),
        false,
    );
    assert.equal(sceneWithInteractionDraft(scene), scene);
});
