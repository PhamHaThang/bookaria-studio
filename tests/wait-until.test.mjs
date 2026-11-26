import assert from 'node:assert/strict';
import test from 'node:test';
import { flowToRule, ruleToFlow } from '../src/features/scene/model/interaction-flow.ts';
import { objectRemovalImpact } from '../src/features/scene/model/interaction-health.ts';
import { copyRule, newAction } from '../src/features/scene/model/interactions.ts';
import {
    memoryDefinitions,
    memorySummary,
    memoryUses,
} from '../src/features/scene/model/memory-variables.ts';
import { SceneSchema } from '../src/shared/contracts/scene.schema.ts';

test('waitUntil remains a sequential step in the graph', () => {
    const action = newAction('waitUntil');
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'waiter',
                trigger: { type: 'onPageEnter' },
                actions: [action, { type: 'wait', ms: 10 }],
            },
        ],
    });
    const rule = scene.interactions[0];
    const flow = ruleToFlow(rule);
    assert.equal(flow.nodes.length, 3);
    assert.equal(flow.edges.filter((edge) => edge.source === flow.nodes[1].id).length, 1);
    assert.deepEqual(flowToRule(flow, rule).actions, rule.actions);
    const definitions = memoryDefinitions([], [scene]);
    assert.equal(definitions[0].key, 'score');
    assert.equal(memoryUses('score', [{ id: 'page', title: null, scene }]).length, 1);
    assert.match(memorySummary(action, definitions), /^Chờ đến khi/);
});

test('removing an object includes waitUntil rules and copying remaps question references', () => {
    const scene = {
        objects: [],
        interactions: [
            {
                id: 'waiter',
                actions: [
                    {
                        type: 'waitUntil',
                        test: { type: 'visible', objectId: 'removed', value: true },
                    },
                ],
                trigger: { type: 'onPageEnter' },
            },
        ],
    };
    assert.deepEqual(
        objectRemovalImpact(scene, ['removed']).map((item) => item.id),
        ['waiter'],
    );
    const original = {
        id: 'question-rule',
        trigger: { type: 'onPageEnter' },
        actions: [
            { type: 'askQuestion', question: { questionId: 'q1' } },
            { type: 'waitUntil', test: { type: 'answer', questionId: 'q1', result: 'correct' } },
        ],
    };
    const copied = copyRule([original], original.id, 'copy').at(-1);
    assert.notEqual(copied.actions[0].question.questionId, 'q1');
    assert.equal(copied.actions[1].test.questionId, copied.actions[0].question.questionId);
});
