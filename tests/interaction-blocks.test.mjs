import assert from 'node:assert/strict';
import test from 'node:test';
import {
    actionOperationChoices,
    actionVariant,
    blockChoices,
    blockGroup,
    blockGroups,
    changeActionOperation,
    changeBlockAction,
} from '../src/features/scene/model/interaction-blocks.ts';
import { actionPalette, paletteAction } from '../src/features/scene/model/interaction-palette.ts';
import {
    canAssignStepObject,
    stepReferencesObject,
} from '../src/features/scene/model/interaction-references.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { ActionSchema } from '../src/shared/contracts/scene.schema.ts';

const text = newObject('text', 'text');
const scene = { schemaVersion: 1, objects: [text], interactions: [] };
const trigger = { type: 'onPageEnter' };

test('every existing action belongs to one of five grouped blocks without changing its schema', () => {
    assert.equal(blockGroups.length, 5);
    assert.equal(blockGroup(), 'trigger');
    for (const item of actionPalette) {
        const action = paletteAction(item.id, text, scene.objects, {});
        const choices = blockChoices(action, trigger, scene, {});
        assert.ok(
            choices.options.some((option) => option.value === choices.value),
            item.id,
        );
        assert.equal(changeBlockAction(action, actionVariant(action), scene, {}, []), action);
    }
    assert.equal(blockChoices(undefined, trigger, scene, {}).options.length, 7);
});

test('inline action changes preserve compatible object targets and disallow cross-group or unavailable actions', () => {
    const show = {
        type: 'setVisible',
        objectId: text.id,
        value: true,
        durationMs: 350,
        delayMsSchema: 80,
    };
    assert.deepEqual(changeBlockAction(show, 'hide', scene, {}, []), { ...show, value: false });
    const move = changeBlockAction(show, 'move', scene, {}, []);
    assert.equal(move.objectId, text.id);
    assert.equal(ActionSchema.safeParse(move).success, true);
    assert.throws(() => changeBlockAction(show, 'playVideo', scene, {}, []), /video/);
    assert.throws(() => changeBlockAction(show, 'condition', scene, {}, []));
    const choices = blockChoices(show, trigger, scene, {});
    assert.equal(choices.options.find((option) => option.value === 'playAnimation').disabled, true);
    assert.equal(choices.options.find((option) => option.value === 'playVideo').disabled, true);
    assert.ok(!choices.options.some((option) => option.value === 'openUrl'));
});

test('condition and state subtypes remain in their groups with valid defaults', () => {
    const condition = {
        type: 'condition',
        test: { type: 'variable', key: 'score', operator: 'gte', value: 1 },
        delayMsSchema: 0,
    };
    const count = changeBlockAction(condition, 'interactionCount', scene, {}, []);
    assert.equal(count.test.objectId, text.id);
    assert.equal(ActionSchema.safeParse(count).success, true);
    const state = {
        type: 'setState',
        key: 'completed',
        operation: 'set',
        value: false,
        delayMsSchema: 0,
    };
    const increment = changeBlockAction(state, 'increment', scene, {}, []);
    assert.equal(increment.key, state.key);
    assert.equal(increment.value, 1);
    assert.equal(ActionSchema.safeParse(increment).success, true);
    assert.equal(changeBlockAction(increment, 'toggle', scene, {}, []).value, true);
});

test('navigation groups URL, page choices and ending without mixing action schemas', () => {
    const link = { type: 'openUrl', url: 'https://example.com', delayMsSchema: 80 };
    const next = changeBlockAction(link, 'next', scene, {}, []);
    assert.equal(next.navigation.target, 'next');
    assert.equal(next.delayMsSchema, 80);
    assert.equal(ActionSchema.safeParse(next).success, true);
    const page = changeBlockAction(next, 'page', scene, {}, [{ id: 'page-2' }]);
    assert.equal(page.navigation.pageId, 'page-2');
    assert.equal('url' in page, false);
    assert.equal(changeBlockAction(page, 'openUrl', scene, {}, []).type, 'openUrl');
});

test('object highlights include trigger, action, condition and audio references without treating every node as related', () => {
    const root = { type: 'onTap', objectId: text.id };
    assert.equal(stepReferencesObject(undefined, root, text), true);
    assert.equal(stepReferencesObject({ type: 'wait', ms: 0 }, root, text), false);
    const condition = {
        type: 'condition',
        test: { type: 'visible', objectId: text.id, value: true },
        delayMsSchema: 0,
    };
    assert.equal(stepReferencesObject(condition, root, text), true);
    assert.equal(canAssignStepObject(condition, text, {}), true);
    assert.equal(canAssignStepObject({ type: 'wait', ms: 0 }, text, {}), false);
    assert.equal(
        canAssignStepObject({ type: 'playVideo', objectId: text.id, delayMsSchema: 0 }, text, {}),
        false,
    );
    const audio = { type: 'audio', id: 'audio', assetId: '33333333-3333-4333-8333-333333333333' };
    assert.equal(stepReferencesObject({ type: 'stopAudio', delayMsSchema: 0 }, root, audio), true);
    assert.equal(
        stepReferencesObject(
            { type: 'playAudio', assetId: 'other', delayMsSchema: 0 },
            root,
            audio,
        ),
        false,
    );
    assert.equal(canAssignStepObject(undefined, audio, {}), false);
});

test('action functions are seven families and legacy variants retain their operation', () => {
    const options = blockChoices({ type: 'wait', ms: 0 }, trigger, scene, {}).options;
    assert.deepEqual(
        options.map((option) => option.value).sort(),
        [
            'visibility',
            'audio',
            'transform',
            'playVideo',
            'playAnimation',
            'askQuestion',
            'wait',
        ].sort(),
    );
    for (const [id, family, operation] of [
        ['show', 'visibility', 'show'],
        ['hide', 'visibility', 'hide'],
        ['toggleVisible', 'visibility', 'toggleVisible'],
        ['playAudio', 'audio', 'playAudio'],
        ['stopAudio', 'audio', 'stopAudio'],
        ['move', 'transform'],
        ['rotate', 'transform'],
        ['scale', 'transform'],
    ]) {
        const action = paletteAction(id, text, scene.objects, {});
        assert.equal(actionVariant(action), family);
        assert.equal(actionOperationChoices(action)?.value, operation);
        assert.equal(changeBlockAction(action, family, scene, {}, []), action);
    }
});

test('visibility operations retain target, fade and delay without leaking incompatible fields', () => {
    const show = {
        type: 'setVisible',
        objectId: text.id,
        value: true,
        durationMs: 350,
        delayMsSchema: 80,
    };
    const hidden = changeActionOperation(show, 'hide');
    const toggled = changeBlockAction(hidden, 'operation:toggleVisible', scene, {}, []);
    assert.deepEqual(toggled, {
        type: 'toggleVisible',
        objectId: text.id,
        durationMs: 350,
        delayMsSchema: 80,
    });
    assert.equal('value' in toggled, false);
    assert.deepEqual(changeActionOperation(toggled, 'show'), show);
    assert.ok(ActionSchema.safeParse(toggled).success);
    assert.throws(() => changeActionOperation(show, 'stopAudio'));
});

test('audio operations preserve the chosen asset and delay, while stop-all requires a target before playing', () => {
    const play = {
        type: 'playAudio',
        assetId: '33333333-3333-4333-8333-333333333333',
        loop: true,
        volume: 0.4,
        delayMsSchema: 300,
    };
    const stop = changeActionOperation(play, 'stopAudio');
    assert.deepEqual(stop, {
        type: 'stopAudio',
        assetId: '33333333-3333-4333-8333-333333333333',
        delayMsSchema: 300,
    });
    assert.ok(ActionSchema.safeParse(stop).success);
    const resumed = changeActionOperation(stop, 'playAudio');
    assert.equal(resumed.assetId, play.assetId);
    assert.equal(resumed.delayMsSchema, play.delayMsSchema);
    assert.ok(ActionSchema.safeParse(resumed).success);
    const all = { type: 'stopAudio', delayMsSchema: 0 };
    assert.equal(changeBlockAction(all, 'audio', scene, {}, []), all);
    assert.equal(ActionSchema.safeParse(changeActionOperation(all, 'playAudio')).success, false);
});

test('combined movement retains every enabled transform and timing when choosing its family or reloading', () => {
    const movement = {
        type: 'transformTo',
        objectId: text.id,
        position: [0.2, 0.1, 0],
        rotation: [0, 0, 45],
        scale: [2, 2, 2],
        durationMs: 850,
        easing: 'easeOut',
        delayMsSchema: 200,
    };
    assert.equal(changeBlockAction(movement, 'transform', scene, {}, []), movement);
    assert.deepEqual(ActionSchema.parse(JSON.parse(JSON.stringify(movement))), movement);
    const next = changeBlockAction(
        { type: 'setVisible', objectId: text.id, value: true, durationMs: 50, delayMsSchema: 200 },
        'transform',
        scene,
        {},
        [],
    );
    assert.equal(next.type, 'transformTo');
    assert.equal(next.objectId, text.id);
    assert.equal(next.delayMsSchema, 200);
    assert.ok(ActionSchema.safeParse(next).success);
});
