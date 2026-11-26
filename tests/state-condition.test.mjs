import assert from 'node:assert/strict';
import test from 'node:test';
import { blockChoices } from '../src/features/scene/model/interaction-blocks.ts';
import { ruleToFlow } from '../src/features/scene/model/interaction-flow.ts';
import { actionPalette, actionTitle } from '../src/features/scene/model/interaction-palette.ts';
import { workflowTargetChoices } from '../src/features/scene/model/interaction-targets.ts';
import {
    templateRule,
    templateUnavailable,
} from '../src/features/scene/model/interaction-templates.ts';
import { defaultWorkflowTrigger } from '../src/features/scene/model/interactions.ts';
import {
    memoryDefinitions,
    memorySummary,
    memoryUses,
} from '../src/features/scene/model/memory-variables.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { SceneSchema } from '../src/shared/contracts/scene.schema.ts';

test('points template uses a memory event and a single action without a conditional branch', () => {
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [newObject('text', 'reward')],
        interactions: [],
    });
    assert.equal(templateUnavailable('unlock', scene.objects, { type: 'page' }), undefined);
    const rule = templateRule('unlock', 'unlock', scene, {}, { type: 'page' });
    assert.deepEqual(rule.trigger, defaultWorkflowTrigger('onStateCondition', scene));
    assert.equal(rule.actions.length, 1);
    assert.equal(rule.actions[0].type, 'setVisible');
    const flow = ruleToFlow(rule);
    assert.equal(flow.nodes.length, 2);
    assert.equal(flow.edges.length, 1);
    assert.equal(workflowTargetChoices(undefined, rule.trigger, scene, {}, []), null);
});

test('trigger-only memory usage is inferred, named and protected as an event usage', () => {
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'reactive',
                trigger: {
                    type: 'onStateCondition',
                    test: { type: 'variable', key: 'mission', operator: 'eq', value: 'done' },
                },
                actions: [{ type: 'wait', ms: 0 }],
            },
        ],
    });
    const definitions = memoryDefinitions([], [scene]);
    assert.equal(definitions.length, 1);
    assert.equal(definitions[0].type, 'string');
    const uses = memoryUses('mission', [{ id: 'page', title: null, scene }]);
    assert.equal(uses.length, 1);
    assert.equal(uses[0].index, -1);
    const name = [{ ...definitions[0], name: 'Nhiệm vụ' }];
    assert.equal(memorySummary(scene.interactions[0].trigger, name), 'Khi “Nhiệm vụ” bằng done');
});

test('new-action menus omit waitUntil while old steps retain their editing choices', () => {
    assert.equal(
        actionPalette.some((item) => item.type === 'waitUntil'),
        false,
    );
    const scene = { schemaVersion: 1, objects: [], interactions: [] };
    const trigger = { type: 'onPageEnter' };
    assert.equal(
        blockChoices({ type: 'wait', ms: 0 }, trigger, scene, {}).options.some(
            (item) => item.value === 'waitUntil',
        ),
        false,
    );
    const old = {
        type: 'waitUntil',
        test: { type: 'variable', key: 'score', operator: 'gte', value: 3 },
    };
    assert.equal(blockChoices(old, trigger, scene, {}).value, 'waitUntil');
    assert.equal(
        blockChoices(old, trigger, scene, {}).options.some((item) => item.value === 'waitUntil'),
        true,
    );
    assert.equal(actionTitle(old), 'Chờ đến khi điều kiện đúng');
});
