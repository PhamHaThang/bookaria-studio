import assert from 'node:assert/strict';
import test from 'node:test';
import { flowToRule, ruleToFlow } from '../src/features/scene/model/interaction-flow.ts';
import { templateRule } from '../src/features/scene/model/interaction-templates.ts';
import { copyRule, copyStepAction } from '../src/features/scene/model/interactions.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import {
    InteractionRuleSchema,
    PublishedSceneSchema,
} from '../src/shared/contracts/scene.schema.ts';
import { InteractionRunner } from '../src/shared/scene-runtime/InteractionRunner.ts';
import { WorkflowState } from '../src/shared/scene-runtime/WorkflowState.ts';

const scene = {
    schemaVersion: 1,
    objects: [newObject('text', 'source'), newObject('text', 'content')],
    interactions: [],
};
const quiz = () => {
    const rule = templateRule('quiz', 'quiz', scene, {}, { type: 'all' });
    return InteractionRuleSchema.parse(flowToRule(ruleToFlow(rule), rule));
};

test('quiz template awards points only once, retains completion and supports wrong answers before retry', async () => {
    const rule = quiz(),
        state = new WorkflowState();
    let answer = 'no';
    const runner = new InteractionRunner([rule], () => {}, assert.fail, undefined, {
        state,
        question: async () => answer,
    });
    await runner.run(rule.id);
    assert.equal(state.snapshot().values.score, undefined);
    answer = 'yes';
    await runner.run(rule.id);
    assert.equal(state.snapshot().values.score, 1);
    await runner.run(rule.id);
    assert.equal(state.snapshot().values.score, 1);
    answer = 'no';
    await runner.run(rule.id);
    answer = 'yes';
    await runner.run(rule.id);
    assert.equal(
        state.snapshot().values.score,
        1,
        'a wrong answer cannot reset an awarded mission',
    );
    runner.dispose();
});

test('copying a quiz or question changes question identity and updates only its internal references', () => {
    const original = quiz(),
        copied = copyRule([original], original.id, 'copy')[1];
    const first = original.actions.find((action) => action.type === 'askQuestion').question
        .questionId;
    const second = copied.actions.find((action) => action.type === 'askQuestion').question
        .questionId;
    assert.notEqual(first, second);
    assert.equal(
        copied.actions.find(
            (action) => action.type === 'condition' && action.test.type === 'answer',
        ).test.questionId,
        second,
    );
    assert.equal(
        PublishedSceneSchema.safeParse({ ...scene, interactions: [original, copied] }).success,
        true,
    );
    const copiedQuestion = copyStepAction(
        original.actions.find((action) => action.type === 'askQuestion'),
    );
    assert.notEqual(copiedQuestion.question.questionId, first);
    assert.equal(
        original.actions.find((action) => action.type === 'askQuestion').question.questionId,
        first,
    );
});
