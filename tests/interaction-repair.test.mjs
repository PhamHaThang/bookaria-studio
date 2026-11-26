import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makePreviewPayload } from '../src/features/preview/model/preview.ts';
import { previewFailure } from '../src/features/preview/model/preview-problem.ts';
import {
    objectRemovalImpact,
    playableInteractions,
} from '../src/features/scene/model/interaction-health.ts';
import { memoryDefinitions } from '../src/features/scene/model/memory-variables.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { removeSelection } from '../src/features/scene/model/selection.ts';
import {
    PublishedSceneSchema,
    SceneSchema,
    WorkflowVariablesSchema,
} from '../src/shared/contracts/scene.schema.ts';

const id = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const page = {
    id,
    title: 'Trang thử',
    image: { url: 'https://example.test/page.png' },
    settings: {
        backgroundAudioAssetId: null,
        narrationAssetId: null,
        backgroundLoop: true,
        lighting: 'neutral',
    },
};
const book = { id, title: 'Sách thử', pageAspect: 1.4 };
const question = (questionId) => ({
    type: 'askQuestion',
    question: {
        questionId,
        title: 'Câu hỏi',
        choices: [
            { id: 'yes', text: 'Có' },
            { id: 'no', text: 'Không' },
        ],
        correctChoiceId: 'yes',
    },
});
function fixture() {
    return SceneSchema.parse({
        schemaVersion: 1,
        objects: [newObject('text', 'target'), newObject('text', 'other')],
        interactions: [
            {
                id: 'ask',
                name: 'Câu hỏi theo đối tượng',
                trigger: { type: 'onTap', objectId: 'target' },
                actions: [question('q1')],
            },
            {
                id: 'answer',
                name: 'Câu hỏi tiếp theo',
                trigger: { type: 'onAnswer', questionId: 'q1' },
                actions: [question('q2')],
            },
            {
                id: 'finish',
                trigger: { type: 'onAnswer', questionId: 'q2' },
                actions: [{ type: 'wait', ms: 1 }],
            },
            {
                id: 'good',
                name: 'Luồng còn hoạt động',
                trigger: { type: 'onPageEnter' },
                actions: [{ type: 'setState', key: 'score', operation: 'increment', value: 1 }],
            },
        ],
    });
}
test('object deletion lists dependent question flows and removes them only with explicit choice', () => {
    const scene = fixture();
    const before = structuredClone(scene);
    assert.deepEqual(
        objectRemovalImpact(scene, ['target']).map((rule) => rule.id),
        ['ask', 'answer', 'finish'],
    );
    assert.deepEqual(removeSelection(scene, ['target']).interactions, scene.interactions);
    const removed = removeSelection(scene, ['target'], true);
    assert.deepEqual(
        removed.interactions.map((rule) => rule.id),
        ['good'],
    );
    assert.deepEqual(
        removed.objects.map((object) => object.id),
        ['other'],
    );
    assert.equal(PublishedSceneSchema.safeParse(removed).success, true);
    assert.deepEqual(scene, before);
});
test('deletion detects action/condition references without removing unrelated pre-existing failures', () => {
    const scene = fixture();
    scene.interactions.push(
        {
            id: 'action',
            enabled: true,
            trigger: { type: 'onPageEnter' },
            actions: [{ type: 'setVisible', objectId: 'target', value: true }],
        },
        {
            id: 'condition',
            enabled: true,
            trigger: { type: 'onPageEnter' },
            actions: [
                { type: 'condition', test: { type: 'visible', objectId: 'target', value: true } },
            ],
        },
        {
            id: 'unrelated',
            enabled: true,
            trigger: { type: 'onAnswer', questionId: 'already-missing' },
            actions: [{ type: 'wait', ms: 1 }],
        },
    );
    const removed = removeSelection(scene, ['target'], true);
    assert.deepEqual(
        removed.interactions.map((rule) => rule.id),
        ['good', 'unrelated'],
    );
});
test('page preview skips broken flows and their dependents without changing the publication draft', async () => {
    const scene = removeSelection(fixture(), ['target']);
    const before = structuredClone(scene);
    const payload = await makePreviewPayload(
        page,
        book,
        scene,
        async () => assert.fail('no assets expected'),
        new AbortController().signal,
        { allowInvalidInteractions: true },
    );
    assert.deepEqual(
        payload.page.scene.interactions.map((rule) => rule.id),
        ['good'],
    );
    assert.deepEqual(
        new Set(payload.problems.map((problem) => problem.ruleId)),
        new Set(['ask', 'answer', 'finish']),
    );
    assert.deepEqual(scene, before);
    assert.equal(PublishedSceneSchema.safeParse(scene).success, false);
});
test('strict isolated preview points to the broken event and does not offer retry', async () => {
    const scene = removeSelection(fixture(), ['target']);
    await assert.rejects(
        makePreviewPayload(
            page,
            book,
            scene,
            async () => assert.fail('no downloads on validation failure'),
            new AbortController().signal,
        ),
        (error) => {
            const problem = previewFailure(error);
            assert.equal(problem.retryable, false);
            assert.deepEqual(problem.repair, {
                kind: 'interaction',
                ruleId: 'ask',
                actionIndex: null,
            });
            assert.match(problem.message, /Câu hỏi theo đối tượng.*Sự kiện bắt đầu/);
            assert.doesNotMatch(problem.message, /"code"|"path"/);
            return true;
        },
    );
});
test('disabled broken flows stay in the draft but never enter the execution copy', () => {
    const scene = removeSelection(fixture(), ['target']);
    scene.interactions = scene.interactions.map((rule) => ({ ...rule, enabled: false }));
    assert.deepEqual(playableInteractions(scene).scene.interactions, []);
    assert.equal(PublishedSceneSchema.safeParse(scene).success, false);
});
test('generated names avoid declared names and normalized legacy key collisions without merging identities', () => {
    const declared = [{ key: 'custom_score', name: 'ĐIỂM SỐ', type: 'number', initialValue: 0 }];
    const scene = fixture();
    scene.interactions[3].actions.push(
        { type: 'setState', key: 'foo.bar', operation: 'set', value: true },
        { type: 'setState', key: 'foo_bar', operation: 'set', value: false },
    );
    const definitions = memoryDefinitions(declared, [scene]);
    assert.equal(WorkflowVariablesSchema.safeParse(definitions).success, true);
    assert.equal(definitions.find((item) => item.key === 'score').name, 'Điểm số (2)');
    assert.equal(definitions.find((item) => item.key === 'foo.bar').name, 'foo bar');
    assert.equal(definitions.find((item) => item.key === 'foo_bar').name, 'foo bar (2)');
    assert.equal(definitions[0].name, 'ĐIỂM SỐ');
    assert.equal(definitions.length, 4);
});
test('invalid explicit names are reported before downloading assets and keep user names unchanged', async () => {
    const definitions = [
        { key: 'a', name: 'Trùng', type: 'number', initialValue: 0 },
        { key: 'b', name: 'trùng', type: 'number', initialValue: 0 },
    ];
    const scene = SceneSchema.parse({
        schemaVersion: 1,
        objects: [],
        interactions: [
            {
                id: 'audio',
                trigger: { type: 'onPageEnter' },
                actions: [{ type: 'playAudio', assetId }],
            },
        ],
    });
    await assert.rejects(
        makePreviewPayload(
            page,
            { ...book, workflowVariables: definitions },
            scene,
            async () => assert.fail('validation must happen before downloads'),
            new AbortController().signal,
        ),
        (error) => {
            assert.equal(previewFailure(error).repair.kind, 'memory');
            assert.equal(previewFailure(error).retryable, false);
            return true;
        },
    );
    assert.equal(definitions[1].name, 'trùng');
});
test('download and graphics failures retain retry', () => {
    assert.equal(previewFailure(new Error('Không tải được ảnh.')).retryable, true);
});
