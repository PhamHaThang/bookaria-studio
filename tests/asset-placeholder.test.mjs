import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Box3, Color, MathUtils, Vector3 } from 'three';
import {
    createAssetPlaceholder,
    waitForVideo,
} from '../src/features/scene/model/asset-placeholder.ts';
import { newObject } from '../src/features/scene/model/objects.ts';
import { SceneLoadStore } from '../src/features/scene/model/scene-load-store.ts';

const id = '11111111-1111-4111-8111-111111111111';
const asset = (type) => ({
    id,
    type,
    status: 'READY',
    name: 'Tài nguyên',
    url: 'https://example.com/model.glb',
    meta: { width: 800, height: 1600 },
});
test('unknown model placeholder stays at the authored origin with readable page-relative size even for tiny scale', () => {
    const spec = newObject('model', 'pending-model', asset('MODEL'));
    spec.transform = {
        position: [0.2, 0.1, 0.05],
        rotation: [90, 0, 0],
        scale: [0.001, 0.001, 0.001],
    };
    const before = JSON.stringify(spec),
        placeholder = createAssetPlaceholder(spec, asset('MODEL'), 1.4, new Color('#252525'));
    const group = placeholder.group;
    group.position.fromArray(spec.transform.position);
    group.rotation.set(...spec.transform.rotation.map(MathUtils.degToRad));
    group.scale.fromArray(spec.transform.scale);
    group.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(group),
        size = bounds.getSize(new Vector3());
    assert.ok(
        Math.abs(size.x - 0.4) < 1e-6 &&
            Math.abs(size.y - 0.56) < 1e-6 &&
            Math.abs(size.z - 0.4) < 1e-6,
    );
    assert.ok(Math.abs(bounds.min.z - 0.05) < 1e-6);
    assert.equal(JSON.stringify(spec), before);
    assert.equal(group.name, 'bookaria-asset-placeholder');
    const material = group.children[1].material;
    placeholder.pulse(1, true);
    assert.equal(material.opacity, 0.55);
    let disposed = 0;
    for (const node of group.children) {
        node.geometry.addEventListener('dispose', () => disposed++);
    }
    placeholder.dispose();
    assert.equal(disposed, 2);
});

test('image/video use flat placeholders with asset aspect; other object types do not get a spatial placeholder', () => {
    for (const type of ['image', 'video']) {
        const spec = newObject(type, type, asset(type.toUpperCase()));
        const placeholder = createAssetPlaceholder(
            spec,
            asset(type.toUpperCase()),
            1,
            new Color('#252525'),
        );
        const size = placeholder.bounds.getSize(new Vector3());
        assert.equal(size.x, 1);
        assert.equal(size.y, 2);
        assert.equal(size.z, 0);
        placeholder.dispose();
    }
    assert.equal(
        createAssetPlaceholder(newObject('text', 'text'), undefined, 1, new Color()),
        undefined,
    );
});

test('renderer loading/error snapshots remain immutable, are cleared on readiness, and unsubscribe cleanly', () => {
    const store = new SceneLoadStore(),
        empty = store.getSnapshot();
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.set('model', { status: 'loading' });
    const loading = store.getSnapshot();
    store.set('model', { status: 'failed', message: 'Mất kết nối' });
    assert.equal(empty.size, 0);
    assert.equal(loading.get('model').status, 'loading');
    assert.equal(store.getSnapshot().get('model').status, 'failed');
    store.set('model');
    assert.equal(store.getSnapshot().size, 0);
    assert.equal(calls, 3);
    unsubscribe();
    store.set('model', { status: 'loading' });
    store.clear();
    assert.equal(calls, 3);
    assert.equal(store.getSnapshot().size, 0);
});

test('video placeholder waits for a drawable frame and stops waiting after cancellation or failure', async () => {
    const video = () => Object.assign(new EventTarget(), { readyState: 0, error: null });
    const first = video(),
        controller = new AbortController();
    let ready = false;
    const waiting = waitForVideo(first, controller.signal).then(() => {
        ready = true;
    });
    first.dispatchEvent(new Event('loadedmetadata'));
    await Promise.resolve();
    assert.equal(ready, false);
    first.dispatchEvent(new Event('loadeddata'));
    await waiting;
    assert.equal(ready, true);
    const removed = video(),
        abort = new AbortController(),
        pending = waitForVideo(removed, abort.signal);
    abort.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    removed.dispatchEvent(new Event('loadeddata'));
    const broken = video(),
        failed = waitForVideo(broken, new AbortController().signal);
    broken.dispatchEvent(new Event('error'));
    await assert.rejects(failed, /Không tải được video/);
});
