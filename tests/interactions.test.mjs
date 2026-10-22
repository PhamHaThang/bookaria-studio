import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    appendAction,
    appendRule,
    copyRule,
    moveItem,
    newAction,
    newRule,
    removeAction,
    targetObjects,
} from '../src/features/scene/model/interactions.ts';
import { newObject, removeObject } from '../src/features/scene/model/objects.ts';
import {
    ActionSchema,
    findSceneReferenceIssues,
    InteractionRuleSchema,
    PublishedSceneSchema,
    SCENE_LIMITS,
    SceneSchema,
    sceneAssetIds,
} from '../src/shared/contracts/scene.schema.ts';

const assetId = '11111111-1111-4111-8111-111111111111';
const objects = ['text', 'model', 'video', 'audio', 'hotspot'].map((type) =>
    newObject(type, type, { id: assetId, type: type.toUpperCase(), status: 'READY', name: type }),
);
const scene = () => ({
    schemaVersion: 1,
    objects: structuredClone(objects),
    interactions: [newRule('r1')],
});
test('new rules have backend-valid defaults and one action', () => {
    assert.deepEqual(InteractionRuleSchema.parse(newRule('r')), newRule('r'));
});
test('all nine action drafts serialize through the shared schema after explicit required choices', () => {
    const inputs = {
        playAudio: { assetId },
        stopAudio: {},
        playAnimation: { objectId: 'model', clip: 'Float' },
        setVisible: { objectId: 'text' },
        toggleVisible: { objectId: 'text' },
        playVideo: { objectId: 'video' },
        openUrl: { url: 'https://example.com' },
        wait: {},
        transformTo: { objectId: 'model' },
    };
    for (const [type, fields] of Object.entries(inputs)) {
        const action = { ...newAction(type), ...fields };
        assert.deepEqual(ActionSchema.parse(action), action);
        if (type !== 'wait') {
            assert.equal(action.delayMsSchema, 0);
            assert.equal('delayMs' in action, false);
        }
    }
    for (const type of [
        'playAudio',
        'playAnimation',
        'setVisible',
        'toggleVisible',
        'playVideo',
        'openUrl',
        'transformTo',
    ])
        assert.equal(ActionSchema.safeParse(newAction(type)).success, false);
});
test('target options follow backend types including untappable audio', () => {
    assert.deepEqual(
        targetObjects(objects, 'onTap').map((o) => o.type),
        ['text', 'model', 'video', 'hotspot'],
    );
    assert.deepEqual(
        targetObjects(objects, 'playAnimation').map((o) => o.type),
        ['model'],
    );
    assert.deepEqual(
        targetObjects(objects, 'playVideo').map((o) => o.type),
        ['video'],
    );
    assert.equal(targetObjects(objects, 'transformTo').length, objects.length);
});
test('copy deep-clones rule data, preserves target ids and rejects duplicate ids or cap overflow', () => {
    const rule = {
        ...newRule('r1'),
        enabled: false,
        trigger: { type: 'onTap', objectId: 'text' },
        onRetrigger: 'restart',
        actions: [{ ...newAction('transformTo'), objectId: 'text' }],
    };
    const copied = copyRule([rule], 'r1', 'r2');
    assert.equal(copied[1].id, 'r2');
    assert.equal(copied[1].enabled, false);
    assert.deepEqual(copied[1].trigger, rule.trigger);
    assert.equal(copied[1].onRetrigger, 'restart');
    copied[1].actions[0].position[0] = 5;
    assert.equal(rule.actions[0].position[0], 0);
    assert.throws(() => copyRule([rule], 'r1', 'r1'), /tồn tại/);
    assert.throws(() => copyRule([], 'r1', 'r2'), /tìm thấy/);
    const full = Array.from({ length: SCENE_LIMITS.maxRules }, (_, i) => newRule(`r${i}`));
    assert.throws(() => appendRule(full, newRule('extra')), /tối đa/);
    assert.equal(SceneSchema.safeParse({ ...scene(), interactions: full }).success, true);
});
test('reorder and delete act on exact positions without changing original values', () => {
    const actions = [
        { ...newAction('wait'), ms: 1 },
        { ...newAction('wait'), ms: 2 },
        { ...newAction('wait'), ms: 3 },
    ];
    const moved = moveItem(actions, 2, -1);
    assert.deepEqual(
        moved.map((a) => a.ms),
        [1, 3, 2],
    );
    assert.equal(moved[1], actions[2]);
    assert.deepEqual(
        actions.map((a) => a.ms),
        [1, 2, 3],
    );
    assert.equal(moveItem(actions, 0, -1), actions);
    assert.equal(moveItem(actions, -1, 1), actions);
    assert.deepEqual(
        removeAction(moved, 1).map((a) => a.ms),
        [1, 2],
    );
    assert.throws(() => removeAction([actions[0]], 0), /ít nhất/);
    assert.throws(() => appendAction(Array(20).fill(actions[0]), actions[0]), /tối đa/);
    assert.equal(appendAction(actions, newAction('wait')).length, 4);
});
test('all trigger variants and retrigger policies survive parse; disabled rules retain validation', () => {
    for (const trigger of [
        { type: 'onPageEnter' },
        { type: 'onPageLeave' },
        { type: 'onTap', objectId: 'text' },
    ]) {
        for (const onRetrigger of ['ignore', 'restart']) {
            const rule = { ...newRule('r'), trigger, onRetrigger, enabled: false };
            assert.deepEqual(InteractionRuleSchema.parse(rule), rule);
        }
    }
    assert.equal(
        InteractionRuleSchema.safeParse({
            ...newRule('r'),
            enabled: false,
            actions: [newAction('playAudio')],
        }).success,
        false,
    );
});
test('audio actions alone contribute asset uses and stop-all contributes none', () => {
    const current = {
        ...scene(),
        objects: [],
        interactions: [
            {
                ...newRule('r'),
                actions: [
                    { ...newAction('playAudio'), assetId },
                    { ...newAction('stopAudio'), assetId },
                    newAction('stopAudio'),
                ],
            },
        ],
    };
    assert.deepEqual(sceneAssetIds(current), [assetId]);
    assert.deepEqual(
        sceneAssetIds({
            ...current,
            interactions: [{ ...newRule('r'), actions: [newAction('stopAudio')] }],
        }),
        [],
    );
});
test('deleting target preserves rule, drafts accept dangling references and publication rejects even disabled rules', () => {
    const current = scene();
    current.interactions = [
        {
            ...newRule('r'),
            enabled: false,
            trigger: { type: 'onTap', objectId: 'text' },
            actions: [{ ...newAction('playVideo'), objectId: 'model' }],
        },
    ];
    const next = removeObject(current, 'text');
    assert.deepEqual(next.interactions, current.interactions);
    assert.equal(findSceneReferenceIssues(next).length, 2);
    assert.equal(SceneSchema.safeParse(next).success, true);
    assert.equal(PublishedSceneSchema.safeParse(next).success, false);
});
test('invalid URL schemes, volume, times, scale and empty transforms cannot reach save', () => {
    for (const url of ['javascript:alert(1)', 'ftp://example.com', ''])
        assert.equal(ActionSchema.safeParse({ ...newAction('openUrl'), url }).success, false);
    for (const value of [-1, 60001, 1.5, Number.NaN])
        assert.equal(ActionSchema.safeParse({ type: 'wait', ms: value }).success, false);
    assert.equal(
        ActionSchema.safeParse({ ...newAction('playAudio'), assetId, volume: 1.1 }).success,
        false,
    );
    assert.equal(
        ActionSchema.safeParse({
            ...newAction('transformTo'),
            objectId: 'text',
            position: undefined,
        }).success,
        false,
    );
    assert.equal(
        ActionSchema.safeParse({ ...newAction('transformTo'), objectId: 'text', scale: [0, 1, 1] })
            .success,
        false,
    );
    assert.equal(
        ActionSchema.safeParse({ ...newAction('setVisible'), objectId: 'text', durationMs: 10001 })
            .success,
        false,
    );
});
