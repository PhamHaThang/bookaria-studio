import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    isVisibleInEditor,
    newObject,
    replaceObjectAsset,
    validatedScene,
} from '../src/features/scene/model/objects.ts';
import { SceneAudioStore } from '../src/features/scene/model/scene-audio-store.ts';
import { FakeAudio } from './helpers/fake-audio.mjs';

const asset = {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'AUDIO',
    status: 'READY',
    name: 'Nhạc nền',
    tags: ['sfx'],
};
test('insert/replace and JSON round-trip retain audio kind with safe authoring defaults', () => {
    const object = newObject('audio', 'audio', asset);
    assert.equal(object.audioKind, 'SFX');
    assert.equal(object.billboard, true);
    assert.equal(object.autoplay, false);
    assert.equal(object.visible, false);
    assert.equal(isVisibleInEditor(object), true);
    assert.equal(isVisibleInEditor({ ...newObject('text', 'hidden'), visible: false }), false);
    assert.deepEqual(object.transform.scale, [1, 1, 1]);
    const next = replaceObjectAsset(object, { ...asset, tags: ['voice'] });
    assert.equal(next.audioKind, 'VOICE');
    const round = validatedScene(
        JSON.parse(JSON.stringify({ schemaVersion: 1, objects: [next], interactions: [] })),
    );
    assert.deepEqual(round.objects, [next]);
});
test('Studio starts one audio preview at a time', async () => {
    const store = new SceneAudioStore();
    const first = new FakeAudio();
    const second = new FakeAudio();
    const releaseFirst = store.register(
        'first',
        first,
        () => {},
        () => {},
    );
    const releaseSecond = store.register(
        'second',
        second,
        () => {},
        () => {},
    );
    try {
        await store.toggle('first');
        assert.equal(first.paused, false);
        first.currentTime = 2;
        await store.toggle('second');
        assert.equal(first.paused, true);
        assert.equal(first.currentTime, 2);
        assert.equal(second.paused, false);
    } finally {
        releaseSecond();
        releaseFirst();
    }
});
test('Studio audio resumes without rewinding; removing a player ignores stale failures', async () => {
    const store = new SceneAudioStore(),
        audio = new FakeAudio(),
        errors = [],
        draws = [];
    let updates = 0;
    const unsubscribe = store.subscribe(() => updates++);
    const release = store.register(
        'a',
        audio,
        (s) => draws.push(s),
        (e) => errors.push(e),
    );
    await store.toggle('a');
    assert.equal(store.getSnapshot().get('a').playing, true);
    audio.currentTime = 12;
    await store.toggle('a');
    assert.equal(audio.currentTime, 12);
    await store.toggle('a');
    assert.equal(store.getSnapshot().get('a').currentTime, 12);
    audio.pause();
    audio.failure = true;
    await store.toggle('a');
    assert.ok(store.getSnapshot().get('a').error);
    assert.equal(errors.length, 1);
    audio.failure = false;
    await store.toggle('a');
    assert.equal(store.getSnapshot().get('a').error, null);
    audio.pause();
    let reject;
    audio.play = () => new Promise((_, r) => (reject = r));
    const pending = store.toggle('a');
    release();
    reject(Error('late'));
    await pending;
    assert.equal(store.getSnapshot().has('a'), false);
    assert.equal(errors.length, 1);
    const count = updates;
    audio.pause();
    assert.equal(updates, count);
    assert.ok(draws.length > 3);
    unsubscribe();
});
