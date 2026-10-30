import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { PageSchema, PageSummarySchema } from '@/shared/contracts/dto.schema';
import { PageSettingsSchema, SceneSchema } from '@/shared/contracts/scene.schema';
import { startBookAutosave } from '../src/features/book-draft/model/autosave.ts';
import { BookDraftStore } from '../src/features/book-draft/model/book-draft-store.ts';
import { DraftRecordSchema } from '../src/features/book-draft/model/draft-model.ts';
import { newObject } from '../src/features/scene/model/objects.ts';

const uid = '10000000-0000-4000-8000-000000000001',
    book = '10000000-0000-4000-8000-000000000002',
    image = '10000000-0000-4000-8000-000000000003';
const p1 = '10000000-0000-4000-8000-000000000004',
    p2 = '10000000-0000-4000-8000-000000000005';
function page(id, orderIndex) {
    return PageSchema.parse({
        id,
        bookId: book,
        orderIndex,
        title: `Page ${orderIndex + 1}`,
        thumbnailUrl: 'https://fake.test/page.png',
        markerMode: 'NONE',
        markerNumber: null,
        markerScore: null,
        markerWarnings: [],
        objectCount: 0,
        image: { assetId: image, url: 'https://fake.test/page.png', width: 640, height: 960 },
        markerReport: null,
        bookariaMarker: null,
        settings: {},
        scene: { schemaVersion: 1, objects: [] },
        revision: 0,
        assets: {},
        updatedAt: new Date().toISOString(),
    });
}
const stores = [];
afterEach(() => {
    for (const store of stores.splice(0)) store.dispose();
});
async function fixture(overrides = {}) {
    let snapshot = {
        bookId: book,
        revision: 'a'.repeat(64),
        geometry: { pageFormat: 'A4', pageAspect: Math.SQRT2, pageWidthMm: 210 },
        pages: [PageSummarySchema.parse(page(p1, 0)), PageSummarySchema.parse(page(p2, 1))],
        pageRevisions: { [p1]: 0, [p2]: 0 },
    };
    const remote = new Map([
            [p1, page(p1, 0)],
            [p2, page(p2, 1)],
        ]),
        disk = new Map();
    const storage = {
        read: mock.fn(async (key) => structuredClone(disk.get(key))),
        write: mock.fn(async (key, value) => {
            disk.set(key, structuredClone(value));
        }),
        remove: mock.fn(async (key) => {
            disk.delete(key);
        }),
    };
    const deps = {
        storage,
        read: mock.fn(async () => structuredClone(snapshot)),
        page: mock.fn(async (id) => structuredClone(remote.get(id))),
        message: (error) => (error instanceof Error ? error.message : 'Error'),
        uncertain: (error) => error instanceof Error && error.message === 'network',
        conflict: (error) => error instanceof Error && error.message === 'conflict',
        removeAsset: mock.fn(async () => {}),
        imageLayout: mock.fn(async (_book, id) => ({
            assetId: id,
            url: 'https://fake.test/layout.png',
            width: 640,
            height: 960,
        })),
        save: mock.fn(async (_id, body) => {
            const changed = [];
            for (const update of body.changes) {
                const old = remote.get(update.id) || page(update.id, 0);
                const next = {
                    ...old,
                    ...update,
                    image: update.imageAssetId
                        ? { ...old.image, assetId: update.imageAssetId }
                        : old.image,
                    revision: old.revision + (update.scene ? 1 : 0),
                };
                remote.set(update.id, next);
                changed.push(next);
            }
            const pages = body.order.map((id, orderIndex) => ({
                ...remote.get(id),
                orderIndex,
            }));
            snapshot = {
                ...snapshot,
                revision: (snapshot.revision[0] === 'a' ? 'b' : 'c').repeat(64),
                pages: pages.map((page) => PageSummarySchema.parse(page)),
                pageRevisions: Object.fromEntries(pages.map((page) => [page.id, page.revision])),
            };
            return { snapshot, pages: changed, warnings: [], jobs: [] };
        }),
    };
    Object.assign(deps, overrides);
    function make() {
        const store = new BookDraftStore(uid, book, deps);
        stores.push(store);
        return store;
    }
    const store = make();
    await store.initialize();
    await store.loadPage(p1);
    store.activate(p1);
    return {
        store,
        deps,
        disk,
        make,
        remote,
        getSnapshot: () => snapshot,
        setRemote: (next) => {
            snapshot = next;
        },
    };
}
function withText(text) {
    return SceneSchema.parse({
        schemaVersion: 1,
        objects: [{ ...newObject('text', 'text'), text }],
    });
}
const uploaded = {
    id: image,
    type: 'IMAGE',
    url: 'https://fake.test/page.png',
    thumbnailUrl: 'https://fake.test/page.png',
    meta: { width: 640, height: 960 },
};
describe('book working drafts', () => {
    it('loads pages lazily and preserves stable page references across status-only updates', async () => {
        const { store, deps } = await fixture();
        assert.equal(deps.page.mock.callCount(), 1);
        assert.equal(store.getSnapshot().dirty, false);
        assert.equal(store.getPage(p1), store.getPage(p1));
        assert.equal(store.getPage(p2), undefined);
    });
    it('keeps scene edits, rename, creation and order local, then commits every changed page once', async () => {
        const { store, deps } = await fixture();
        store.setScene(p1, withText('First'));
        store.renamePage(p2, 'Second');
        const created = await store.addPage(uploaded);
        store.reorder([created.page.id, p2, p1]);
        assert.equal(deps.save.mock.callCount(), 0);
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(await store.save(), true);
        const body = deps.save.mock.calls[0].arguments[1];
        assert.deepEqual(body.order, [created.page.id, p2, p1]);
        assert.equal(body.changes.length, 3);
        assert.deepEqual(
            body.changes.find((page) => page.id === p2),
            { id: p2, title: 'Second' },
        );
        assert.equal(store.getSnapshot().dirty, false);
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('keeps edits on multiple pages and saves settings with their asset references', async () => {
        const { store, deps } = await fixture();
        await store.loadPage(p2);
        store.setScene(p1, withText('One'));
        store.setScene(p2, withText('Two'));
        store.patchPage(p2, { settings: PageSettingsSchema.parse({ lighting: 'warm' }) });
        assert.equal(store.getPage(p1)?.scene.objects[0]?.text, { text: 'One' }.text);
        assert.equal(await store.save(), true);
        assert.deepEqual(
            deps.save.mock.calls[0].arguments[1].changes.map((page) => page.id),
            [p1, p2],
        );
    });
    it('supports local duplicate/delete and undo after a successful save', async () => {
        const { store, deps } = await fixture();
        store.setScene(p1, withText('Saved'));
        await store.save();
        store.undo();
        assert.equal(store.getPage(p1)?.scene.objects.length, 0);
        assert.equal(store.getSnapshot().dirty, true);
        store.redo();
        assert.equal(store.getSnapshot().dirty, false);
        const copy = await store.duplicatePage(p1);
        assert.deepEqual(store.getPage(copy.page.id)?.scene, store.getPage(p1)?.scene);
        await store.removePage(copy.page.id);
        assert.equal(store.getSnapshot().dirty, false);
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('groups transform frames into one history entry', async () => {
        const { store } = await fixture();
        store.begin();
        store.setScene(p1, withText('A'));
        store.setScene(p1, withText('B'));
        store.end();
        store.undo();
        assert.equal(store.getPage(p1)?.scene.objects.length, 0);
        assert.equal(store.getSnapshot().canUndo, false);
    });
    it('recovers page order, new identities and scenes from a versioned local checkpoint', async () => {
        const { store, make, deps } = await fixture();
        store.setScene(p1, withText('Recover'));
        const added = await store.addPage(uploaded);
        await store.flush();
        const second = make();
        await second.initialize();
        assert.notEqual(second.getSnapshot().recovery, null);
        second.restore();
        assert.deepEqual(second.getPage(p1)?.scene, store.getPage(p1)?.scene);
        assert.notEqual(second.getPage(added.page.id), undefined);
        assert.equal(deps.save.mock.callCount(), 0);
    });
    it('preserves a conflicting draft and never overwrites the remote revision', async () => {
        const { store, make, setRemote, getSnapshot, deps } = await fixture();
        store.setScene(p1, withText('Keep'));
        await store.flush();
        setRemote({ ...getSnapshot(), revision: 'f'.repeat(64) });
        const second = make();
        await second.initialize();
        second.restore();
        assert.equal(second.getSnapshot().conflict, true);
        assert.equal(await second.save(), false);
        assert.equal(deps.save.mock.callCount(), 0);
        assert.equal(
            second.exportDraft().working.overrides[p1].scene.objects[0].text,
            {
                text: 'Keep',
            }.text,
        );
    });
    it('persists an uncertain attempt and retries the same identities when reconciling a lost response', async () => {
        const { store, deps, make, setRemote, getSnapshot } = await fixture();
        const added = await store.addPage(uploaded);
        deps.save.mock.mockImplementationOnce(async () => {
            throw new Error('network');
        });
        assert.equal(await store.save(), false);
        await store.flush();
        assert.equal(store.getSnapshot().uncertain, true);
        setRemote({ ...getSnapshot(), revision: 'b'.repeat(64) });
        const second = make();
        await second.initialize();
        second.restore();
        assert.equal(second.getSnapshot().uncertain, true);
        await second.readLatest(false);
        assert.equal(second.getSnapshot().dirty, false);
        const calls = deps.save.mock.calls;
        assert.deepEqual(calls[1].arguments[1], calls[0].arguments[1]);
        assert.ok(calls[1].arguments[1].order.includes(added.page.id));
    });
    it('does not reconcile an obsolete attempt after the user resumes editing', async () => {
        const { store, deps, setRemote, getSnapshot } = await fixture();
        store.setScene(p1, withText('First attempt'));
        deps.save.mock.mockImplementationOnce(async () => {
            throw new Error('network');
        });
        await store.save();
        await store.readLatest(false);
        assert.equal(store.getSnapshot().uncertain, false);
        store.setScene(p1, withText('Continued editing'));
        setRemote({ ...getSnapshot(), revision: 'b'.repeat(64) });
        await store.readLatest(false);
        assert.equal(deps.save.mock.callCount(), 1);
        assert.equal(store.getSnapshot().conflict, true);
        assert.equal(store.getPage(p1).scene.objects[0].text, 'Continued editing');
    });
    it('keeps the last valid local scene when a numeric input is temporarily empty', async () => {
        const { store, disk } = await fixture();
        store.setScene(p1, withText('Valid'));
        await store.flush();
        store.setScene(p1, (scene) => ({
            ...scene,
            objects: scene.objects.map((object) => ({
                ...object,
                transform: { ...object.transform, position: [Number.NaN, 0, 0] },
            })),
        }));
        await store.flush();
        const saved = DraftRecordSchema.parse(disk.get(store.key));
        assert.deepEqual(
            saved.working.overrides[p1].scene.objects[0].transform.position,
            [0, 0, 0],
        );
        assert.equal(await store.save(), false);
        assert.ok(store.getSnapshot().error.includes('Trang 1'));
    });
    it('uses the newly read server scene as the valid checkpoint after discarding an older draft', async () => {
        const { store, remote, setRemote, getSnapshot, disk } = await fixture();
        store.setScene(p1, withText('Old draft'));
        await store.flush();
        const latest = { ...remote.get(p1), scene: withText('New server content'), revision: 2 };
        remote.set(p1, latest);
        setRemote({
            ...getSnapshot(),
            revision: 'e'.repeat(64),
            pageRevisions: { [p1]: 2, [p2]: 0 },
        });
        await store.readLatest(true);
        store.setScene(p1, (scene) => ({
            ...scene,
            objects: scene.objects.map((object) => ({
                ...object,
                transform: { ...object.transform, position: [Number.NaN, 0, 0] },
            })),
        }));
        await store.flush();
        assert.equal(
            DraftRecordSchema.parse(disk.get(store.key)).working.overrides[p1].scene.objects[0]
                .text,
            'New server content',
        );
    });
    it('allows saving without local storage and warns instead of losing the in-memory draft', async () => {
        const { store, deps } = await fixture();
        deps.storage.write.mock.mockImplementation(async () => {
            throw new Error('quota');
        });
        store.setScene(p1, withText('Safe'));
        assert.equal(await store.save(), true);
        assert.notEqual(store.getSnapshot().storageWarning, null);
    });
    it('deletes queued local checkpoints after an explicit discard, including delayed writes', async () => {
        const { store, disk } = await fixture();
        store.setScene(p1, withText('Discard'));
        const writing = store.flush();
        store.abandon();
        await writing;
        await store.flush();
        assert.equal(disk.has(store.key), false);
        assert.equal(store.getSnapshot().dirty, false);
    });
    it('never restores a record for another account', async () => {
        const { store, make, disk } = await fixture();
        store.setScene(p1, withText('Private'));
        await store.flush();
        const record = DraftRecordSchema.parse(disk.get(store.key));
        disk.set(store.key, { ...record, userId: '10000000-0000-4000-8000-000000000099' });
        const second = make();
        await second.initialize();
        assert.equal(second.getSnapshot().recovery, null);
        assert.equal(second.getSnapshot().dirty, false);
    });
    it('retains deleted page content in undo even after committing the deletion', async () => {
        const { store } = await fixture();
        await store.removePage(p1);
        await store.save();
        store.undo();
        assert.notEqual(store.getPage(p1), undefined);
        assert.deepEqual(
            store.getSnapshot().working?.pages.map((page) => page.id),
            [p1, p2],
        );
        assert.equal(store.getSnapshot().dirty, true);
    });
    it('does not reset a restored draft when React reconnects provider effects', async () => {
        const { store, make, deps } = await fixture();
        store.setScene(p1, withText('Restored'));
        await store.flush();
        const second = make();
        await second.initialize();
        second.restore();
        second.dispose();
        await second.initialize();
        assert.equal(second.getSnapshot().recovery, null);
        assert.equal(second.getPage(p1).scene.objects[0].text, 'Restored');
        assert.equal(second.getSnapshot().dirty, true);
        assert.equal(deps.read.mock.callCount(), 2);
    });
    it('accepts an in-flight save after provider effects reconnect', async () => {
        const { store, deps, getSnapshot } = await fixture();
        let release;
        deps.save.mock.mockImplementation(
            async () =>
                new Promise((resolve) => {
                    release = resolve;
                }),
        );
        store.setScene(p1, withText('In flight'));
        const saving = store.save();
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(typeof release, 'function');
        store.dispose();
        await store.initialize();
        release({
            snapshot: {
                ...getSnapshot(),
                revision: 'b'.repeat(64),
                pageRevisions: { [p1]: 1, [p2]: 0 },
            },
            pages: [{ ...store.getPage(p1), revision: 1 }],
            warnings: [],
            jobs: [],
        });
        assert.equal(await saving, true);
        assert.equal(store.getSnapshot().saving, false);
        assert.equal(store.getSnapshot().dirty, false);
    });
    it('retains edits on a newly created page instead of merging a stale summary scene', async () => {
        const { store } = await fixture();
        const created = await store.addPage(uploaded);
        store.setScene(created.page.id, withText('New page content'));
        assert.equal(store.getPage(created.page.id).scene.objects[0].text, 'New page content');
        assert.equal(await store.save(), true);
        assert.equal(store.getPage(created.page.id).scene.objects[0].text, 'New page content');
    });
    it('uses canonical asset URLs from the save response instead of stale picker references', async () => {
        const { store, deps, getSnapshot } = await fixture();
        const model = {
            ...uploaded,
            type: 'MODEL',
            status: 'READY',
            name: 'Model',
            tags: [],
            url: 'https://fake.test/old.glb',
        };
        store.registerAsset(model);
        store.setScene(
            p1,
            SceneSchema.parse({ schemaVersion: 1, objects: [newObject('model', 'model', model)] }),
        );
        const canonical = {
            type: 'MODEL',
            url: 'https://fake.test/current.glb',
            thumbnailUrl: null,
            meta: {},
        };
        deps.save.mock.mockImplementationOnce(async () => ({
            snapshot: {
                ...getSnapshot(),
                revision: 'b'.repeat(64),
                pageRevisions: { [p1]: 1, [p2]: 0 },
            },
            pages: [{ ...store.getPage(p1), revision: 1, assets: { [image]: canonical } }],
            warnings: [],
            jobs: [],
        }));
        assert.equal(await store.save(), true);
        assert.equal(store.getPage(p1).assets[image].url, canonical.url);
    });
    it('validates every changed page when saving from a different active page', async () => {
        const { store, deps } = await fixture();
        await store.loadPage(p2);
        store.setScene(p1, withText('Valid'));
        store.setScene(p2, (scene) => ({
            ...scene,
            objects: [
                {
                    ...newObject('text', 'bad'),
                    transform: {
                        position: [Number.NaN, 0, 0],
                        rotation: [0, 0, 0],
                        scale: [1, 1, 1],
                    },
                },
            ],
        }));
        assert.equal(await store.save(), false);
        assert.equal(deps.save.mock.callCount(), 0);
        assert.ok(store.getSnapshot().error.includes('Trang 2'));
    });
});

const whiteId = '10000000-0000-4000-8000-000000000009';
const whiteAsset = {
    ...uploaded,
    id: whiteId,
    name: 'Trang trắng',
    status: 'READY',
    sizeBytes: 12000,
    format: 'png',
    tags: [],
    license: null,
    authorName: null,
    sourceUrl: null,
    scope: 'mine',
    categoryId: null,
    createdAt: '2026-10-30T00:00:00.000Z',
};
const blankDeps = () => ({
    blankPageUrl: 'https://fake.test/blank.png',
    prepareBlankImage: mock.fn(async () => whiteAsset),
});
const settle = async () => {
    for (let i = 0; i < 60; i++) await Promise.resolve();
};
const deferred = () => {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

describe('instant blank pages and background saves', () => {
    it('creates, duplicates and restores blank pages without uploading or requesting layout', async () => {
        const { store, deps, make } = await fixture(blankDeps());
        const first = store.addBlankPage().page.id;
        const second = (await store.duplicatePage(first)).page.id;
        assert.equal(store.getPage(first).image.assetId, undefined);
        assert.equal(store.getPage(first).image.url, 'https://fake.test/blank.png');
        assert.equal(deps.imageLayout.mock.callCount(), 0);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 0);
        assert.equal(deps.save.mock.callCount(), 0);
        await store.flush();
        store.dispose();
        const restored = make();
        await restored.initialize();
        restored.restore();
        assert.equal(restored.getPage(second).image.assetId, undefined);
        assert.equal(await restored.save(), true);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 1);
        const changes = deps.save.mock.calls[0].arguments[1].changes;
        for (const id of [first, second])
            assert.equal(changes.find((c) => c.id === id).imageAssetId, whiteId);
        assert.equal(restored.getSnapshot().dirty, false);
    });
    it('does not prepare an image for a blank page removed before saving', async () => {
        const { store, deps } = await fixture(blankDeps());
        const id = store.addBlankPage().page.id;
        await store.removePage(id);
        assert.equal(await store.save(), true);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 0);
        assert.equal(deps.save.mock.callCount(), 0);
    });
    it('uses an explicitly replaced background without preparing an unused white image', async () => {
        const { store, deps } = await fixture(blankDeps());
        const id = store.addBlankPage().page.id;
        store.registerAsset(uploaded);
        store.patchPage(id, {
            image: { assetId: image, url: uploaded.url, width: 640, height: 960 },
        });
        assert.equal(await store.save(), true);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 0);
        assert.equal(deps.save.mock.calls[0].arguments[1].changes[0].imageAssetId, image);
    });
    it('retains a retryable upload checkpoint without marking a book write uncertain', async () => {
        const options = blankDeps(),
            checkpoint = {
                signature: {
                    assetId: whiteId,
                    uploadUrl: 'https://fake.test/upload',
                    fields: {
                        api_key: 'test',
                        public_id: 'draft/test',
                        timestamp: 1,
                        signature: 'test',
                    },
                    expiresAt: '2026-11-01T00:00:00.000Z',
                },
                uploaded: true,
            };
        options.prepareBlankImage = mock.fn(async (_aspect, saved, onCheckpoint) => {
            if (!saved) {
                onCheckpoint(checkpoint);
                throw new Error('network');
            }
            assert.deepEqual(saved, checkpoint);
            return whiteAsset;
        });
        const { store, deps, make } = await fixture(options);
        store.addBlankPage();
        assert.equal(await store.save(), false);
        assert.equal(store.getSnapshot().uncertain, false);
        assert.equal(deps.save.mock.callCount(), 0);
        await store.flush();
        store.dispose();
        const restored = make();
        await restored.initialize();
        restored.restore();
        assert.equal(await restored.save(), true);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 2);
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('defers the book commit if the user resumes work during blank upload and reuses the completed image', async () => {
        const { store, deps } = await fixture(blankDeps());
        store.addBlankPage();
        assert.equal(await store.save('auto', () => false), false);
        assert.equal(deps.save.mock.callCount(), 0);
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(await store.save(), true);
        assert.equal(deps.prepareBlankImage.mock.callCount(), 1);
    });
    it('keeps scene, title, order and new-page edits made while autosave is in flight', async () => {
        const { store, deps } = await fixture(blankDeps());
        const gate = deferred(),
            save = deps.save;
        deps.save = mock.fn(async (...args) => {
            await gate.promise;
            return save(...args);
        });
        store.setScene(p1, withText('Sent'));
        const saving = store.save('auto');
        await settle();
        assert.equal(store.getSnapshot().autosaving, true);
        store.setScene(p1, withText('Newer'));
        store.renamePage(p2, 'Renamed during save');
        const id = store.addBlankPage().page.id;
        store.reorder([id, p2, p1]);
        gate.resolve();
        assert.equal(await saving, true);
        assert.equal(store.getPage(p1).scene.objects[0].text, 'Newer');
        assert.equal(
            store.getSnapshot().working.pages.find((p) => p.id === p2).title,
            'Renamed during save',
        );
        assert.deepEqual(
            store.getSnapshot().working.pages.map((p) => p.id),
            [id, p2, p1],
        );
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(await store.save(), true);
        assert.equal(deps.save.mock.callCount(), 2);
        assert.equal(store.getSnapshot().dirty, false);
    });
    it('does not treat a concurrent scene edit as already saved by a title-only acknowledgment', async () => {
        const { store, deps } = await fixture();
        const gate = deferred(),
            save = deps.save;
        deps.save = mock.fn(async (...args) => {
            await gate.promise;
            return save(...args);
        });
        store.renamePage(p1, 'Sent title');
        const pending = store.save('auto');
        await settle();
        store.setScene(p1, withText('Not yet sent'));
        gate.resolve();
        await pending;
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(store.getPage(p1).scene.objects[0].text, 'Not yet sent');
        await store.save();
        assert.equal(
            deps.save.mock.calls[1].arguments[1].changes[0].scene.objects[0].text,
            'Not yet sent',
        );
    });
    it('retains page deletion and undo during autosave and queues a manual save without overlap', async () => {
        const { store, deps } = await fixture();
        const gate = deferred(),
            save = deps.save;
        let active = 0,
            peak = 0;
        deps.save = mock.fn(async (...args) => {
            active++;
            peak = Math.max(peak, active);
            await gate.promise;
            try {
                return await save(...args);
            } finally {
                active--;
            }
        });
        store.setScene(p1, withText('Sent'));
        const pending = store.save('auto');
        await settle();
        store.setScene(p1, withText('Undo me'));
        store.undo();
        await store.removePage(p2);
        const manual = store.save();
        gate.resolve();
        assert.equal(await pending, true);
        assert.equal(await manual, true);
        assert.equal(peak, 1);
        assert.equal(deps.save.mock.callCount(), 2);
        assert.equal(store.getSnapshot().dirty, false);
        assert.equal(store.getSnapshot().working.pages.length, 1);
    });
    it('keeps newer edits through a lost acknowledgment, reload and idempotent reconciliation', async () => {
        const { store, deps, make } = await fixture();
        const gate = deferred(),
            save = deps.save;
        let result;
        deps.save = mock.fn(async (...args) => {
            if (!result) {
                result = await save(...args);
                await gate.promise;
                throw new Error('network');
            }
            return result;
        });
        store.setScene(p1, withText('Committed'));
        const pending = store.save('auto');
        await settle();
        store.setScene(p1, withText('Still local'));
        gate.resolve();
        await pending;
        await store.flush();
        store.dispose();
        const restored = make();
        await restored.initialize();
        restored.restore();
        await restored.readLatest(false);
        assert.equal(restored.getSnapshot().uncertain, false);
        assert.equal(restored.getSnapshot().dirty, true);
        assert.equal(restored.getPage(p1).scene.objects[0].text, 'Still local');
    });
});

describe('idle book autosave', () => {
    it('batches rapid edits five seconds after the last edit', async (t) => {
        const { store, deps } = await fixture();
        t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
        const auto = startBookAutosave(store);
        t.after(() => auto.stop());
        store.renamePage(p1, 'First');
        t.mock.timers.tick(4000);
        await settle();
        store.renamePage(p1, 'Latest');
        t.mock.timers.tick(4999);
        await settle();
        assert.equal(deps.save.mock.callCount(), 0);
        t.mock.timers.tick(1);
        await settle();
        assert.equal(deps.save.mock.callCount(), 1);
        assert.equal(store.getSnapshot().dirty, false);
        t.mock.timers.tick(30000);
        await settle();
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('pauses for open UI and active transforms, then saves once they finish', async (t) => {
        const { store, deps } = await fixture();
        t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
        let modal = true;
        const auto = startBookAutosave(store, { isBlocked: () => modal });
        t.after(() => auto.stop());
        store.renamePage(p1, 'Changed');
        t.mock.timers.tick(5000);
        await settle();
        assert.equal(deps.save.mock.callCount(), 0);
        modal = false;
        store.setAutosavePaused('settings', true);
        t.mock.timers.tick(500);
        await settle();
        assert.equal(deps.save.mock.callCount(), 0);
        store.setAutosavePaused('settings', false);
        store.begin();
        t.mock.timers.tick(500);
        await settle();
        assert.equal(deps.save.mock.callCount(), 0);
        store.end();
        t.mock.timers.tick(500);
        await settle();
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('keeps invalid numeric input local and does not submit until it becomes valid', async (t) => {
        const { store, deps } = await fixture();
        t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
        const auto = startBookAutosave(store);
        t.after(() => auto.stop());
        const scene = withText('Text');
        scene.objects[0].transform.position[0] = NaN;
        store.setScene(p1, scene);
        t.mock.timers.tick(5000);
        await settle();
        assert.equal(deps.save.mock.callCount(), 0);
        store.setScene(p1, withText('Valid'));
        t.mock.timers.tick(5000);
        await settle();
        assert.equal(deps.save.mock.callCount(), 1);
    });
    it('stops automatic retries after an ambiguous network failure while retaining the draft', async (t) => {
        const { store, deps } = await fixture({
            save: mock.fn(async () => {
                throw new Error('network');
            }),
        });
        t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
        const auto = startBookAutosave(store);
        t.after(() => auto.stop());
        store.renamePage(p1, 'Local');
        t.mock.timers.tick(5000);
        await settle();
        assert.equal(store.getSnapshot().uncertain, true);
        t.mock.timers.tick(60000);
        await settle();
        assert.equal(deps.save.mock.callCount(), 1);
        assert.equal(store.getSnapshot().dirty, true);
    });
});

describe('autosave exit boundaries', () => {
    it('retains the exact pending attempt when undo makes the working copy temporarily clean', async () => {
        const { store, deps, disk } = await fixture();
        const gate = deferred(),
            save = deps.save;
        deps.save = mock.fn(async (...args) => {
            await gate.promise;
            return save(...args);
        });
        store.setScene(p1, withText('Pending'));
        const saving = store.save('auto');
        await settle();
        store.undo();
        assert.equal(store.getSnapshot().dirty, false);
        await store.flush();
        assert.equal(
            disk.get(`${uid}:${book}`).pending.changes[0].scene.objects[0].text,
            'Pending',
        );
        gate.resolve();
        await saving;
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(store.getPage(p1).scene.objects.length, 0);
    });
    it('rechecks the idle boundary after checkpoint persistence before sending a commit', async () => {
        const { store, deps } = await fixture();
        const gate = deferred(),
            write = deps.storage.write;
        let held = false,
            ready = true;
        deps.storage.write = mock.fn(async (key, value) => {
            await write(key, value);
            if (value.pending && !held) {
                held = true;
                await gate.promise;
            }
        });
        store.renamePage(p1, 'Local');
        const pending = store.save('auto', () => ready);
        await settle();
        assert.equal(held, true);
        ready = false;
        gate.resolve();
        assert.equal(await pending, false);
        assert.equal(deps.save.mock.callCount(), 0);
        assert.equal(store.getSnapshot().dirty, true);
        assert.equal(await store.save(), true);
    });
    it('waits for an in-flight autosave before discarding only the remaining local edits', async () => {
        const { store, deps, disk } = await fixture();
        const gate = deferred(),
            save = deps.save;
        deps.save = mock.fn(async (...args) => {
            await gate.promise;
            return save(...args);
        });
        store.setScene(p1, withText('Saved'));
        const pending = store.save('auto');
        await settle();
        store.setScene(p1, withText('Discard'));
        const leaving = store.abandon();
        gate.resolve();
        await pending;
        await leaving;
        await settle();
        assert.equal(store.getSnapshot().dirty, false);
        assert.equal(store.getPage(p1).scene.objects[0].text, 'Saved');
        assert.equal(disk.size, 0);
    });
});
