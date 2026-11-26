import assert from 'node:assert/strict';
import test from 'node:test';
import {
    audioActionChoices,
    workflowTargetChoices,
} from '../src/features/scene/model/interaction-targets.ts';

const text = { id: 'text', type: 'text', name: 'Tiêu đề' };
const video = { id: 'video', type: 'video', name: 'Đoạn phim', assetId: 'v' };
const model = { id: 'model', type: 'model', name: 'Mô hình', assetId: 'm' };
const audio = { id: 'audio', type: 'audio', name: 'Lời thoại', assetId: 'a' };
const scene = { schemaVersion: 1, objects: [text, video, model, audio], interactions: [] };
const trigger = { type: 'onTap', objectId: 'text' };
const assets = { m: { meta: { animations: ['Idle'] } }, a: { type: 'AUDIO', meta: {} } };

test('event node offers current page and scene objects, excluding audio as a tap source', () => {
    const choices = workflowTargetChoices(undefined, trigger, scene, assets);
    assert.equal(choices.value, 'object:text');
    assert.equal(choices.options[0].value, 'page');
    assert.ok(!choices.options.some((item) => item.value === 'object:audio'));
    assert.equal(
        workflowTargetChoices(undefined, { type: 'onMarkerFound' }, scene, assets).value,
        'page',
    );
    assert.equal(
        workflowTargetChoices(undefined, { type: 'onTap', objectId: '' }, scene, assets).value,
        '',
    );
});

test('media actions only offer compatible targets and keep missing references explicit', () => {
    const videoAction = { type: 'playVideo', objectId: 'video', delayMsSchema: 0 };
    assert.deepEqual(
        workflowTargetChoices(videoAction, trigger, scene, assets).options.map(
            (item) => item.value,
        ),
        ['object:video'],
    );
    const animation = {
        type: 'playAnimation',
        objectId: 'model',
        clip: 'Idle',
        loop: false,
        delayMsSchema: 0,
    };
    assert.equal(
        workflowTargetChoices(animation, trigger, scene, assets).options[0].disabled,
        false,
    );
    assert.equal(workflowTargetChoices(animation, trigger, scene, {}).options[0].disabled, true);
    const missing = workflowTargetChoices(
        { ...videoAction, objectId: 'removed' },
        trigger,
        scene,
        assets,
    );
    assert.equal(missing.value, 'object:removed');
    assert.equal(missing.options[0].disabled, true);
});

test('audio chooser deduplicates shared files and can represent stop-all or an external library asset', () => {
    const duplicated = { ...scene, objects: [...scene.objects, { ...audio, id: 'audio-copy' }] };
    const stop = workflowTargetChoices(
        { type: 'stopAudio', delayMsSchema: 0 },
        trigger,
        duplicated,
        assets,
    );
    assert.equal(stop.value, 'all-audio');
    assert.equal(stop.options.filter((item) => item.value.startsWith('object:')).length, 1);
    const external = workflowTargetChoices(
        { type: 'playAudio', assetId: 'external', delayMsSchema: 0 },
        trigger,
        scene,
        {},
    );
    assert.equal(external.value, 'asset:external');
    assert.ok(external.options.some((item) => item.value === 'asset:external'));
});

test('only object conditions and specific-page navigation need an inline target selector', () => {
    const condition = {
        type: 'condition',
        test: { type: 'visible', objectId: 'text', value: true },
    };
    assert.equal(workflowTargetChoices(condition, trigger, scene, assets).value, 'object:text');
    assert.equal(workflowTargetChoices({ type: 'wait', ms: 0 }, trigger, scene, assets), null);
    assert.equal(
        workflowTargetChoices(
            { type: 'setState', key: 'score', operation: 'increment', value: 1 },
            trigger,
            scene,
            assets,
        ),
        null,
    );
    const navigation = { type: 'navigate', navigation: { target: 'page', pageId: 'page-2' } };
    const choices = workflowTargetChoices(navigation, trigger, scene, assets, [
        { id: 'page-2', title: null, orderIndex: 1 },
    ]);
    assert.equal(choices.value, 'page:page-2');
    assert.equal(choices.options[0].label, 'Trang 2');
    assert.equal(
        workflowTargetChoices(
            { ...navigation, navigation: { target: 'next' } },
            trigger,
            scene,
            assets,
        ),
        null,
    );
});

test('audio guidance cannot clear a selected playback target and stop-all remains a real operation', () => {
    const selected = { type: 'playAudio', assetId: audio.assetId, delayMsSchema: 0 };
    assert.ok(
        !audioActionChoices(selected, scene.objects, assets).options.some(
            (option) => option.value === '',
        ),
    );
    const empty = audioActionChoices({ ...selected, assetId: '' }, scene.objects, assets);
    assert.equal(empty.value, '');
    assert.equal(empty.options.find((option) => option.value === '').disabled, true);
    const inline = workflowTargetChoices({ ...selected, assetId: '' }, trigger, scene, assets);
    assert.equal(inline.options.filter((option) => option.value === '').length, 1);
    assert.equal(inline.options[0].label, empty.options[0].label);
    assert.equal(inline.options[0].disabled, true);
    const stop = audioActionChoices({ type: 'stopAudio', delayMsSchema: 0 }, scene.objects, assets);
    assert.equal(stop.options[0].value, 'all-audio');
    assert.notEqual(stop.options[0].disabled, true);
});

test('an audio selected from the library keeps its readable name once metadata is available', () => {
    const action = { type: 'playAudio', assetId: 'external', delayMsSchema: 0 };
    const choices = audioActionChoices(action, scene.objects, {}, 'Sóng biển.wav');
    assert.equal(choices.value, 'external');
    assert.equal(
        choices.options.find((option) => option.value === 'external').label,
        'Sóng biển.wav',
    );
    assert.equal(choices.options.find((option) => option.value === 'external').disabled, false);
});

test('clearing a stop-audio selection is incomplete and never silently stops every sound', () => {
    const cleared = { type: 'stopAudio', assetId: '', delayMsSchema: 0 };
    const choices = audioActionChoices(cleared, scene.objects, assets);
    assert.equal(choices.value, '');
    assert.equal(choices.options.find((option) => option.value === '').disabled, true);
    const node = workflowTargetChoices(cleared, trigger, scene, assets);
    assert.equal(node.value, '');
    assert.ok(node.options.some((option) => option.value === 'all-audio' && !option.disabled));
    assert.equal(
        audioActionChoices({ type: 'stopAudio', delayMsSchema: 0 }, scene.objects, assets).value,
        'all-audio',
    );
});
