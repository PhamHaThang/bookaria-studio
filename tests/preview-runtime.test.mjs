import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InteractionRunner, sleep } from '../src/shared/scene-runtime/InteractionRunner.ts';

const action = (value) => ({
    type: 'openUrl',
    url: `https://example.com/${value}`,
    delayMsSchema: 0,
});
const rule = (overrides = {}) => ({
    id: 'r1',
    name: 'R',
    enabled: true,
    trigger: { type: 'onTap', objectId: 'object' },
    onRetrigger: 'ignore',
    actions: [action(1), { type: 'wait', ms: 5 }, action(2)],
    ...overrides,
});
test('ordered commands await execution and waits; delay uses the actual backend key', async () => {
    const calls = [];
    const runner = new InteractionRunner(
        [
            rule({
                actions: [{ ...action(1), delayMsSchema: 7 }, { type: 'wait', ms: 9 }, action(2)],
            }),
        ],
        async (a) => {
            calls.push(a.url);
        },
        () => {},
        async (ms) => {
            calls.push(ms);
        },
    );
    await runner.fire({ type: 'onTap', objectId: 'object' });
    assert.deepEqual(calls, [7, 'https://example.com/1', 9, 'https://example.com/2']);
    runner.dispose();
});
test('only matching enabled triggers fire and page-enter/leave stay independent', async () => {
    const calls = [];
    const runner = new InteractionRunner(
        [
            rule(),
            rule({ id: 'disabled', enabled: false }),
            rule({ id: 'enter', trigger: { type: 'onPageEnter' }, actions: [action('enter')] }),
            rule({ id: 'leave', trigger: { type: 'onPageLeave' }, actions: [action('leave')] }),
        ],
        (a) => {
            calls.push(a.url);
        },
    );
    await runner.fire({ type: 'onTap', objectId: 'other' });
    assert.equal(calls.length, 0);
    await runner.fire({ type: 'onPageEnter' });
    await runner.fire({ type: 'onPageLeave' });
    assert.deepEqual(calls, ['https://example.com/enter', 'https://example.com/leave']);
    runner.dispose();
});
test('ignore returns existing run and does not execute a second chain', async () => {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const calls = [];
    const runner = new InteractionRunner(
        [rule()],
        (a) => {
            calls.push(a.url);
        },
        () => {},
        () => gate,
    );
    const first = runner.run('r1');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(runner.run('r1'), first);
    release();
    await first;
    assert.equal(calls.length, 2);
    runner.dispose();
});
test('restart aborts old delay and a finishing old task cannot unregister its replacement', async () => {
    const gates = [],
        calls = [];
    const runner = new InteractionRunner(
        [rule({ onRetrigger: 'restart', actions: [{ type: 'wait', ms: 5 }, action(1)] })],
        (a) => {
            calls.push(a.url);
        },
        () => {},
        (_ms, signal) =>
            new Promise((resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason), { once: true });
                gates.push(resolve);
            }),
    );
    const old = runner.run('r1');
    await Promise.resolve();
    const next = runner.run('r1');
    await Promise.resolve();
    await old;
    gates[1]();
    await next;
    assert.deepEqual(calls, ['https://example.com/1']);
    runner.dispose();
});
test('cancelAll and dispose cancel timers and prevent delayed side effects', async () => {
    const calls = [];
    const runner = new InteractionRunner(
        [rule({ actions: [{ type: 'wait', ms: 60000 }, action(1)] })],
        (a) => {
            calls.push(a.url);
        },
    );
    const task = runner.run('r1');
    await Promise.resolve();
    runner.dispose();
    await task;
    await runner.run('r1');
    assert.deepEqual(calls, []);
    const abort = new AbortController();
    const delayed = sleep(60000, abort.signal);
    abort.abort();
    await assert.rejects(delayed);
});
test('one action failure stops its chain, reports once, and allows a later explicit retry', async () => {
    const errors = [],
        calls = [];
    const runner = new InteractionRunner(
        [rule()],
        (a) => {
            calls.push(a.url);
            throw new Error('missing clip');
        },
        (message) => errors.push(message),
    );
    await runner.run('r1');
    await runner.run('r1');
    assert.equal(calls.length, 2);
    assert.deepEqual(errors, ['missing clip', 'missing clip']);
    runner.dispose();
});
test('concurrent different rules are independent and disabled manual runs are ignored', async () => {
    const calls = [];
    const runner = new InteractionRunner(
        [
            rule({ actions: [action(1)] }),
            rule({ id: 'r2', actions: [action(2)] }),
            rule({ id: 'r3', enabled: false }),
        ],
        (a) => {
            calls.push(a.url);
        },
    );
    await Promise.all([runner.run('r1'), runner.run('r2'), runner.run('r3')]);
    assert.deepEqual(calls.sort(), ['https://example.com/1', 'https://example.com/2']);
    runner.dispose();
});
