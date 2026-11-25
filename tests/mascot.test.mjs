import assert from 'node:assert/strict';
import test from 'node:test';
import {
    advanceEngine,
    createAvatarEngine,
    readAvatarLibrary,
    readCharacter,
    setEngineState,
} from '@bible-strong/avatar-core';
import { characters, library } from '../src/shared/mascot/data.ts';
import { launcherLibrary } from '../src/shared/mascot/launcher-library.ts';
import { createMotionRegistry } from '../src/shared/mascot/motion.ts';
import { pointerLook } from '../src/shared/mascot/pointer-look.ts';

test('authored Boki skins and every library reference pass the real renderer parser', () => {
    assert.equal(readCharacter(characters.light).ok, true);
    assert.equal(readCharacter(characters.dark).ok, true);
    assert.equal(characters.light.colors.body, '#242424');
    assert.equal(characters.light.style.outline.color, '#ffffff');
    assert.equal(characters.dark.colors.body, '#ffffff');
    assert.equal(characters.dark.style.outline.color, '#242424');
    assert.deepEqual(readAvatarLibrary(library).problems, []);
});

test('success hands over while active search and upload remain under feature control', () => {
    const parsed = readAvatarLibrary(library).library;
    const engine = createAvatarEngine({ seed: 22, ...parsed });
    const advance = () => {
        for (let n = 0; n < 600; n++) advanceEngine(engine, 1 / 60);
    };
    setEngineState(engine, 'boki-success');
    advance();
    assert.equal(engine.state, 'boki-idle');
    for (const state of ['boki-searching', 'boki-uploading']) {
        setEngineState(engine, state);
        advance();
        assert.equal(engine.state, state);
    }
});

test('launcher uses reference hover and pressed faces while result gestures finish once', () => {
    const parsed = readAvatarLibrary(launcherLibrary);
    assert.deepEqual(parsed.problems, []);
    for (const state of ['pressed', 'success', 'error']) {
        const engine = createAvatarEngine({ seed: 22, ...parsed.library });
        setEngineState(engine, `boki-${state}`);
        for (let frame = 0; frame < 180; frame++) advanceEngine(engine, 1 / 60);
        assert.equal(engine.state, 'boki-idle', state);
    }
    assert.equal(
        launcherLibrary.states.find((state) => state.name === 'boki-hover').face,
        'inspecting',
    );
    assert.equal(
        launcherLibrary.states.find((state) => state.name === 'boki-pressed').face,
        'happy',
    );
    const hover = createAvatarEngine({ seed: 22, ...parsed.library });
    setEngineState(hover, 'boki-hover');
    for (let frame = 0; frame < 180; frame++) advanceEngine(hover, 1 / 60);
    assert.equal(hover.state, 'boki-hover', 'attention face stays while hovered');
});

test('pointer gaze stays directional across a large corner workspace', () => {
    const box = { left: 1328, top: 900, width: 64, height: 64 };
    const viewport = { width: 1440, height: 1000 };
    const left = pointerLook(100, 100, box, viewport);
    const middle = pointerLook(720, 500, box, viewport);
    const near = pointerLook(1200, 800, box, viewport);
    assert.ok(left[0] < middle[0] && middle[0] < near[0]);
    assert.ok(left[1] > middle[1] && middle[1] > near[1]);
    assert.deepEqual(pointerLook(1360, 932, box, viewport), [0, -0]);
    assert.ok(pointerLook(1439, 990, box, viewport)[0] > 0);
});

test('one animation owns attention and task work preempts decoration without losing cleanup', () => {
    const registry = createMotionRegistry();
    const idle = Symbol('assistant'),
        task = Symbol('upload');
    let changes = 0;
    const unsubscribe = registry.subscribe(() => changes++);
    const releaseIdle = registry.claim(idle, 1);
    assert.equal(registry.getSnapshot(), idle);
    const releaseTask = registry.claim(task, 2);
    assert.equal(registry.getSnapshot(), task);
    releaseTask();
    assert.equal(registry.getSnapshot(), idle);
    releaseIdle();
    assert.equal(registry.getSnapshot(), null);
    assert.equal(changes, 4);
    unsubscribe();
});
