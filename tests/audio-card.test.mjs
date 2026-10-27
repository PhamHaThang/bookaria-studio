import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SceneObjectSchema } from '../src/shared/contracts/scene.schema.ts';
import { audioTime, createAudioCard, observeAudio } from '../src/shared/scene/audio-card.ts';
import { audioKindFromTags, facesCamera } from '../src/shared/scene/audio-kind.ts';

import { FakeAudio } from './helpers/fake-audio.mjs';

test('fixed audio roles normalize legacy tags and old cards remain camera-facing', () => {
    for (const kind of ['BGM', 'SFX', 'VOICE'])
        assert.equal(audioKindFromTags(['old', kind.toLowerCase()]), kind);
    assert.equal(audioKindFromTags(['music']), 'BGM');
    assert.equal(facesCamera({ type: 'audio', billboard: false }), true);
    assert.equal(facesCamera({ type: 'model', billboard: false }), false);
    assert.equal(audioTime(62.8), '1:02');
    assert.equal(audioTime(Infinity), '0:00');
});
test('native audio events report pause/resume, buffering, errors and detach cleanly', async () => {
    const audio = new FakeAudio(),
        states = [];
    const stop = observeAudio(audio, (s) => states.push(s));
    assert.equal(states.at(-1).playing, false);
    await audio.play();
    audio.dispatchEvent(new Event('waiting'));
    assert.equal(states.at(-1).waiting, true);
    audio.currentTime = 7;
    audio.pause();
    assert.equal(states.at(-1).currentTime, 7);
    assert.equal(states.at(-1).waiting, false);
    await audio.play();
    assert.equal(states.at(-1).playing, true);
    audio.error = { code: 4 };
    audio.dispatchEvent(new Event('error'));
    assert.ok(states.at(-1).error);
    const count = states.length;
    stop();
    audio.pause();
    assert.equal(states.length, count);
});
test('audio cards render role/title, map the play hit, throttle redraw and dispose once', async () => {
    const saved = globalThis.document,
        drawn = [];
    const ctx = new Proxy(
        {
            measureText: (text) => ({ width: text.length * 16 }),
            fillText: (text) => drawn.push(text),
        },
        { get: (t, k) => t[k] ?? (() => {}) },
    );
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    let card;
    try {
        card = createAudioCard(
            SceneObjectSchema.parse({
                id: 'audio',
                type: 'audio',
                assetId: '11111111-1111-4111-8111-111111111111',
                audioKind: 'VOICE',
                name: 'Lời kể tiếng Việt',
                transform: {},
            }),
            42,
        );
        assert.ok(drawn.includes('VOICE'));
        assert.ok(drawn.includes('Lời kể tiếng Việt'));
        assert.ok(card.isPlayHit({ x: 72 / 768, y: 1 - 273 / 360 }));
        assert.equal(card.isPlayHit({ x: 0.7, y: 0.7 }), false);
        const state = { playing: true, waiting: false, currentTime: 1, duration: 42, error: null };
        card.setPlayback(state);
        const count = drawn.length;
        card.setPlayback({ ...state, currentTime: 1.1 });
        assert.equal(drawn.length, count);
        card.setPlayback({ ...state, currentTime: 2 });
        assert.ok(drawn.length > count);
        card.setTitle('Nhạc mới');
        assert.ok(drawn.includes('Nhạc mới'));
        const mesh = card.group.children[0];
        let disposed = 0;
        mesh.material.map.addEventListener('dispose', () => disposed++);
        card.dispose();
        assert.equal(disposed, 1);
        const after = drawn.length;
        card.setPlayback({ ...state, currentTime: 3 });
        assert.equal(drawn.length, after);
    } finally {
        globalThis.document = saved;
    }
});
