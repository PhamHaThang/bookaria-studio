import assert from 'node:assert/strict';
import test from 'node:test';
import {
    moveScopedRule,
    rulesInScope,
    scopedAction,
    scopedRule,
} from '../src/features/scene/model/interaction-scope.ts';
import { newRule } from '../src/features/scene/model/interactions.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { InteractionRuleSchema } from '../src/shared/contracts/scene.schema.ts';

const text = newObject('text', 'cat');
const video = newObject('video', 'video', {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'VIDEO',
    status: 'READY',
    name: 'Video',
});
const audio = newObject('audio', 'audio', {
    id: '22222222-2222-4222-8222-222222222222',
    type: 'AUDIO',
    status: 'READY',
    name: 'Audio',
});
const tap = (id, objectId) => ({ ...newRule(id), trigger: { type: 'onTap', objectId } });

test('scope groups by starting event, including disabled rules and deleted sources, without cloning rule data', () => {
    const page = {
        ...newRule('page'),
        actions: [
            { type: 'setVisible', objectId: 'cat', value: true, durationMs: 0, delayMsSchema: 0 },
        ],
    };
    const cat = { ...tap('cat-rule', 'cat'), enabled: false },
        missing = tap('missing', 'deleted');
    const rules = [page, cat, missing];
    assert.deepEqual(rulesInScope(rules, { type: 'page' }), [page]);
    assert.deepEqual(rulesInScope(rules, { type: 'object', objectId: 'cat' }), [cat]);
    assert.deepEqual(rulesInScope(rules, { type: 'object', objectId: 'deleted' }), [missing]);
    assert.equal(rulesInScope(rules, { type: 'all' })[1], cat);
    assert.equal(rules.length, 3);
});

test('a contextual rule uses the selected tappable source and stays compatible with the backend schema', () => {
    const rule = scopedRule('new', { type: 'object', objectId: text.id }, [text]);
    assert.deepEqual(rule.trigger, { type: 'onTap', objectId: text.id });
    assert.ok(InteractionRuleSchema.safeParse(rule).success);
    assert.throws(
        () => scopedRule('bad', { type: 'object', objectId: audio.id }, [audio]),
        /có thể chạm/,
    );
    assert.throws(
        () => scopedRule('bad', { type: 'object', objectId: 'gone' }, [text]),
        /có thể chạm/,
    );
    assert.equal(scopedRule('page', { type: 'page' }, []).trigger.type, 'onPageEnter');
});

test('filtered reordering preserves unrelated rules in their original slots', () => {
    const rules = [
        newRule('page-1'),
        tap('cat-1', 'cat'),
        tap('dog', 'dog'),
        newRule('page-2'),
        tap('cat-2', 'cat'),
    ];
    const scope = { type: 'object', objectId: 'cat' };
    const moved = moveScopedRule(rules, scope, 'cat-2', -1);
    assert.deepEqual(
        moved.map((rule) => rule.id),
        ['page-1', 'cat-2', 'dog', 'page-2', 'cat-1'],
    );
    assert.deepEqual(
        rules.map((rule) => rule.id),
        ['page-1', 'cat-1', 'dog', 'page-2', 'cat-2'],
    );
    assert.equal(moved[0], rules[0]);
    assert.equal(moveScopedRule(rules, scope, 'cat-1', -1), rules);
    assert.equal(moveScopedRule(rules, scope, 'gone', 1), rules);
});

test('new actions preselect only compatible targets and copy the current position', () => {
    const object = { ...text, transform: { ...text.transform, position: [0.3, 0.4, 0.5] } };
    const action = scopedAction('transformTo', object);
    assert.equal(action.objectId, object.id);
    assert.deepEqual(action.position, object.transform.position);
    action.position[0] = 10;
    assert.equal(object.transform.position[0], 0.3);
    assert.equal(scopedAction('setVisible', text).objectId, text.id);
    assert.equal(scopedAction('playVideo', text).objectId, '');
    assert.equal(scopedAction('playVideo', video).objectId, video.id);
    assert.equal(scopedAction('playAnimation', text).objectId, '');
    assert.equal(scopedAction('wait', text).ms, 500);
});
