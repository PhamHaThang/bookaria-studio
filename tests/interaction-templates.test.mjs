import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyInteraction,
    interactionProblems,
    interactionTemplates,
    templateRule,
    templateUnavailable,
    updateTemplateActions,
} from '../src/features/scene/model/interaction-templates.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { PublishedSceneSchema, SCENE_LIMITS } from '../src/shared/contracts/scene.schema.ts';

const aid = '11111111-1111-4111-8111-111111111111';
const mid = '22222222-2222-4222-8222-222222222222';
const vid = '33333333-3333-4333-8333-333333333333';
const asset = (id, type) => ({ id, type, status: 'READY', name: type });
const assets = {
    [aid]: { type: 'AUDIO', url: 'https://example.com/voice.mp3', meta: { durationSec: 3 } },
    [mid]: {
        type: 'MODEL',
        url: 'https://example.com/model.glb',
        meta: { animations: ['Idle', 'Walk'], triangles: 10 },
    },
};
function fixture() {
    return {
        schemaVersion: 1,
        objects: [
            { ...newObject('text', 'button'), name: 'Con mèo' },
            { ...newObject('text', 'answer'), name: 'Thông tin', visible: false },
            newObject('audio', 'voice', asset(aid, 'AUDIO')),
            newObject('model', 'cat', asset(mid, 'MODEL')),
            newObject('video', 'video', asset(vid, 'VIDEO')),
        ],
        interactions: [],
    };
}

test('all templates compile to the existing backend scene schema without adding unsupported actions', () => {
    for (const t of interactionTemplates) {
        const scene = fixture(),
            rule = templateRule(t.id, 'rule', scene, assets, { type: 'all' });
        if (t.id === 'link') rule.actions[0].url = 'https://bookaria.example/learn';
        assert.deepEqual(interactionProblems(rule, scene), [], t.id);
        const applied = applyInteraction(scene, rule);
        assert.equal(PublishedSceneSchema.safeParse(applied).success, true, t.id);
        assert.equal(scene.interactions.length, 0, 'draft stays untouched');
    }
});
test('a reveal template separates the visible tap source and hidden content in one undoable scene update', () => {
    const scene = fixture();
    scene.objects[1].visible = true;
    const rule = templateRule('reveal', 'reveal', scene, assets, {
        type: 'object',
        objectId: 'button',
    });
    assert.equal(rule.trigger.objectId, 'button');
    assert.equal(rule.actions[0].objectId, 'answer');
    const applied = applyInteraction(scene, rule, 'answer');
    assert.equal(applied.objects.find((o) => o.id === 'answer').visible, false);
    assert.equal(scene.objects.find((o) => o.id === 'answer').visible, true);
    assert.equal(applied.objects.find((o) => o.id === 'button').visible, true);
    assert.throws(() => applyInteraction(scene, rule, 'button'), /cần hiện/);
});
test('focus returns to the authored scale and keeps proportions, including very small and large model scales', () => {
    const scene = fixture();
    scene.objects[3].transform.scale = [0.001, 200, 3];
    const rule = templateRule('focus', 'focus', scene, assets, { type: 'object', objectId: 'cat' });
    assert.deepEqual(rule.actions[0].scale, [0.00125, 250, 3.75]);
    assert.deepEqual(rule.actions[2].scale, [0.001, 200, 3]);
    assert.equal(rule.onRetrigger, 'ignore');
    assert.deepEqual(scene.objects[3].transform.scale, [0.001, 200, 3]);
});
test('incomplete resources, deleted objects, invalid times and unsafe links cannot alter a saved scene', () => {
    const scene = fixture(),
        snapshot = structuredClone(scene);
    const rule = templateRule('listen', 'sound', scene, {}, { type: 'all' });
    rule.actions[0].assetId = '';
    assert.match(interactionProblems(rule, scene)[0], /âm thanh/);
    assert.throws(() => applyInteraction(scene, rule));
    const link = templateRule('link', 'link', scene, assets, { type: 'all' });
    link.actions[0].url = 'javascript:alert(1)';
    assert.throws(() => applyInteraction(scene, link), /liên kết/);
    const missing = templateRule('reveal', 'missing', scene, assets, { type: 'all' });
    missing.actions[0].objectId = 'deleted';
    assert.throws(() => applyInteraction(scene, missing), /đối tượng/);
    const delay = templateRule('enter', 'delay', scene, assets, { type: 'all' });
    delay.actions[0].delayMsSchema = NaN;
    assert.throws(() => applyInteraction(scene, delay), /thông số/);
    assert.deepEqual(scene, snapshot);
});
test('editing replaces one interaction in place and creation respects the page limit', () => {
    const scene = fixture(),
        rule = templateRule('toggle', 'one', scene, assets, { type: 'all' });
    scene.interactions = [rule];
    const edited = applyInteraction(scene, { ...rule, name: 'Đáp án' });
    assert.equal(edited.interactions.length, 1);
    assert.equal(edited.interactions[0].name, 'Đáp án');
    assert.equal(scene.interactions[0].name, rule.name);
    scene.interactions = Array.from({ length: SCENE_LIMITS.maxRules }, (_, i) => ({
        ...rule,
        id: `rule-${i}`,
    }));
    assert.throws(() => applyInteraction(scene, rule), /giới hạn/);
    assert.equal(
        applyInteraction(scene, { ...rule, id: 'rule-0' }).interactions.length,
        SCENE_LIMITS.maxRules,
    );
});
test('template prerequisites explain missing objects and honor page/object scopes', () => {
    assert.match(
        templateUnavailable(
            'video',
            fixture().objects.filter((o) => o.type !== 'video'),
            { type: 'all' },
        ),
        /video/,
    );
    assert.match(
        templateUnavailable('reveal', [newObject('text', 'only')], { type: 'all' }),
        /một nội dung/,
    );
    assert.match(
        templateUnavailable('enter', fixture().objects, { type: 'object', objectId: 'button' }),
        /trang/,
    );
    assert.equal(
        templateRule('leave', 'leave', fixture(), assets, { type: 'page' }).trigger.type,
        'onPageLeave',
    );
    assert.equal(
        templateRule('custom', 'custom', fixture(), assets, { type: 'page' }).trigger.type,
        'onPageEnter',
    );
});

test('retargeting an observation template keeps enlarge and return on the same object', () => {
    const scene = fixture();
    scene.objects[3].transform.scale = [0.2, 0.3, 0.4];
    const rule = templateRule('focus', 'zoom', scene, assets, {
        type: 'object',
        objectId: 'button',
    });
    const after = structuredClone(rule.actions);
    after[0].objectId = 'cat';
    const paired = updateTemplateActions('focus', rule.actions, after, scene.objects);
    assert.deepEqual(paired[0].scale, [0.25, 0.375, 0.5]);
    assert.equal(paired[2].objectId, 'cat');
    assert.deepEqual(paired[2].scale, [0.2, 0.3, 0.4]);
    assert.equal(rule.actions[2].objectId, 'button');
});
