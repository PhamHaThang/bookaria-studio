import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneApi } from '../src/features/scene/api/scene-api.ts';
import { aiPlanState, stageAiPlan } from '../src/features/scene/model/ai-proposal.ts';
import { InteractionRuleSchema, SceneSchema } from '../src/shared/contracts/scene.schema.ts';

const page = { id: '11111111-1111-4111-8111-111111111111', revision: 2 };
const scene = SceneSchema.parse({
    schemaVersion: 1,
    objects: [{ id: 'card', type: 'text', text: 'Rùa', transform: {}, style: {} }],
});
const rule = InteractionRuleSchema.parse({
    id: 'new-rule',
    trigger: { type: 'onPageEnter' },
    actions: [{ type: 'setVisible', objectId: 'card', value: true }],
});
const add = { rules: [{ rule }], variables: [] };
test('AI plans resolve references without overwriting existing rules', () => {
    const { scene: next } = stageAiPlan(scene, [], add);
    assert.equal(scene.interactions.length, 0);
    assert.equal(next.interactions.length, 1);
    assert.throws(() => stageAiPlan(next, [], add), /đã được áp dụng/);
    assert.throws(() => stageAiPlan({ ...scene, objects: [] }, [], add), /đã xoá/);
});
test('AI API uses a bounded timeout/cancellation and refuses response for a different revision', async () => {
    const controller = new AbortController();
    let seen;
    const api = createSceneApi({
        post: async (...args) => {
            seen = args;
            return {
                status: 200,
                data: {
                    data: {
                        status: 'proposal',
                        rule,
                        revision: 3,
                        usage: {
                            model: 'test',
                            promptVersion: 'bookaria-interactions-v1',
                            attempts: 1,
                            latencyMs: 10,
                            inputTokens: 20,
                            outputTokens: 10,
                        },
                    },
                },
            };
        },
    });
    await assert.rejects(
        api.propose(
            page.id,
            { revision: 2, scene, instruction: 'Khi vào trang hiện thẻ' },
            controller.signal,
        ),
    );
    assert.equal(seen[0], `/pages/${page.id}/interaction-proposals`);
    assert.equal(seen[2].signal, controller.signal);
    assert.equal(seen[2].timeout, 250000);
});

test('application status follows shared Undo and Redo and accepts subsequent manual edits', () => {
    const original = stageAiPlan(scene, [], add);
    const applied = original.scene.interactions[0];
    const revised = { ...rule, id: 'new-generated-id', actions: [{ type: 'wait', ms: 5000 }] };
    const update = { rules: [{ rule: revised, replaceId: applied.id }], variables: [] };
    const { scene: next, edit } = stageAiPlan(original.scene, [], update);
    assert.equal(next.interactions.length, 1);
    assert.equal(next.interactions[0].id, applied.id);
    assert.equal(next.interactions[0].actions[0].ms, 5000);
    const unrelated = { ...rule, id: 'another' };
    const withUnrelated = { ...next, interactions: [...next.interactions, unrelated] };
    assert.equal(aiPlanState(withUnrelated, [], edit), 'applied');
    assert.equal(aiPlanState(original.scene, [], edit), 'undone');
    assert.equal(aiPlanState(next, [], edit), 'applied');
    assert.equal(aiPlanState(scene, [], original.edit), 'undone');
    const manual = { ...next, interactions: [{ ...next.interactions[0], name: 'Sửa tay' }] };
    assert.equal(aiPlanState(manual, [], edit), 'changed');
    assert.doesNotThrow(() => stageAiPlan(manual, [], update));
    const definitions = [{ key: 'score', name: 'Điểm', type: 'number', initialValue: 0 }];
    const removed = stageAiPlan(scene, [], {
        rules: [],
        variables: definitions,
        removeObjectIds: ['card'],
    });
    assert.equal(aiPlanState(removed.scene, removed.variables, removed.edit), 'applied');
    assert.equal(aiPlanState(scene, [], removed.edit), 'undone');
    assert.equal(aiPlanState(scene, definitions, removed.edit), 'changed');
});

test('moving an object updates every affected loop in the same application and Undo status', () => {
    const loop = InteractionRuleSchema.parse({
        id: 'motion',
        trigger: { type: 'onPageEnter' },
        actions: [{ type: 'transformTo', objectId: 'card', position: [0.5, 0, 0] }],
        editorLayout: [
            { id: 'start', x: 40, y: 80 },
            { id: 'out', x: 340, y: 80 },
        ],
        workflow: { version: 1, edges: [{ source: 'start', target: 'out', port: 'next' }] },
        movementLoop: { startId: 'out', endId: 'out', initial: scene.objects[0].transform },
    });
    const before = SceneSchema.parse({
        ...scene,
        objects: [...scene.objects, { ...scene.objects[0], id: 'other' }],
        interactions: [
            loop,
            { ...loop, id: 'second-loop' },
            { ...loop, id: 'unrelated', actions: [{ ...loop.actions[0], objectId: 'other' }] },
        ],
    });
    const plan = {
        rules: [],
        variables: [],
        objectEdits: [{ objectId: 'card', transform: { position: [0.2, 0, 0] } }],
    };
    const { scene: next, edit } = stageAiPlan(before, [], plan);
    assert.deepEqual(
        edit.rules.map(({ after }) => after.id),
        ['motion', 'second-loop'],
    );
    for (const rule of next.interactions.slice(0, 2)) {
        assert.deepEqual(rule.movementLoop.initial.position, [0.2, 0, 0]);
        assert.deepEqual(rule.actions, loop.actions);
        assert.deepEqual(rule.workflow, loop.workflow);
        assert.deepEqual(rule.editorLayout, loop.editorLayout);
    }
    assert.equal(next.interactions[2], before.interactions[2]);
    assert.deepEqual(before.interactions[0].movementLoop.initial.position, [0, 0, 0]);
    assert.equal(aiPlanState(next, [], edit), 'applied');
    assert.equal(aiPlanState(before, [], edit), 'undone');
    assert.equal(aiPlanState({ ...next, interactions: before.interactions }, [], edit), 'changed');
    assert.equal(
        stageAiPlan(next, [], {
            rules: [],
            variables: [],
            objectEdits: [{ objectId: 'card', name: 'Tên mới' }],
        }).edit.rules.length,
        0,
    );
    const removed = stageAiPlan(before, [], { ...plan, removeRuleIds: ['motion'] });
    assert.deepEqual(
        removed.edit.rules.map(({ after }) => after.id),
        ['second-loop'],
    );
});
