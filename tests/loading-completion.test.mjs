import assert from 'node:assert/strict';
import test from 'node:test';
import { finishLoadingAnimation } from '../src/shared/ui/loading-completion.ts';

test('loading completes the current cycle, fades, and cancels safely', (t) => {
    const media = new EventTarget();
    media.matches = false;
    const doc = new EventTarget();
    doc.hidden = false;
    t.mock.method(globalThis, 'setTimeout', () => 1);
    t.mock.method(globalThis, 'clearTimeout', () => {});
    t.mock.method(performance, 'now', () => 2000);
    const old = {
        document: globalThis.document,
        matchMedia: globalThis.matchMedia,
        getComputedStyle: globalThis.getComputedStyle,
    };
    Object.assign(globalThis, {
        document: doc,
        matchMedia: () => media,
        getComputedStyle: () => ({ display: 'block' }),
    });
    t.after(() => Object.assign(globalThis, old));
    const image = {
        src: '/light-loading-loop.svg',
        dataset: { loadingStarted: '1000' },
        getClientRects: () => [1],
    };
    const host = {
        querySelectorAll: () => [image],
        setAttribute: t.mock.fn(),
        removeAttribute: t.mock.fn(),
    };
    let done = 0;
    const cancel = finishLoadingAnimation(host, () => done++);
    assert.equal(setTimeout.mock.calls[0].arguments[1], 3800);
    setTimeout.mock.calls[0].arguments[0]();
    assert.equal(host.setAttribute.mock.callCount(), 1);
    assert.equal(setTimeout.mock.calls[1].arguments[1], 180);
    assert.equal(done, 0);
    setTimeout.mock.calls[1].arguments[0]();
    assert.equal(done, 1);
    cancel();
    const abandoned = finishLoadingAnimation(host, () => done++);
    abandoned();
    media.matches = true;
    media.dispatchEvent(new Event('change'));
    assert.equal(done, 1, 'cancel removes listeners and its pending completion');
    finishLoadingAnimation(host, () => done++);
    assert.equal(done, 2, 'reduced motion completes immediately');
    media.matches = false;
    finishLoadingAnimation(host, () => done++);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(done, 3, 'hidden documents never wait for throttled animation');
    doc.hidden = false;
    delete image.dataset.loadingStarted;
    finishLoadingAnimation(host, () => done++);
    assert.equal(done, 4, 'a fast load without a running animation completes immediately');
});
