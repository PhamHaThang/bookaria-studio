import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { importPages } from '../src/features/pages/model/import-pages.ts';

function fixture() {
    let checkpoint = { pages: [] };
    const calls = { renders: [], uploads: [], adds: [] };
    const options = {
        bookId: 'existing-book',
        aspect: 1.5,
        indices: [2, 0],
        render: async (index, aspect) => {
            calls.renders.push([index, aspect]);
            return new File(['image'], `${index}.jpg`);
        },
        upload: async (file) => {
            calls.uploads.push(file.name);
            return `asset-${file.name}`;
        },
        add: async (bookId, body) => {
            calls.adds.push({ bookId, body });
            return { page: { id: `page-${body.imageAssetId}` } };
        },
        checkSession: () => undefined,
        onStage: () => undefined,
        onCheckpoint: (next) => {
            checkpoint = next;
        },
    };
    return {
        options,
        calls,
        state: () => checkpoint,
        run: () => importPages({ ...options, checkpoint }),
    };
}

test('appends only selected pages in user order to an existing book using its geometry', async () => {
    const f = fixture();
    assert.equal((await f.run()).pageId, 'page-asset-2.jpg');
    assert.deepEqual(f.calls.renders, [
        [2, 1.5],
        [0, 1.5],
    ]);
    assert.deepEqual(f.calls.adds, [
        { bookId: 'existing-book', body: { imageAssetId: 'asset-2.jpg' } },
        { bookId: 'existing-book', body: { imageAssetId: 'asset-0.jpg' } },
    ]);
    await f.run();
    assert.equal(f.calls.adds.length, 2);
    assert.ok(f.state().pages.every((page) => !page.file && !page.upload));
});

test('known rejection on the second page resumes with its ready asset and keeps the first page', async () => {
    const f = fixture(),
        add = f.options.add;
    let failed = false;
    f.options.add = async (bookId, body) => {
        if (!failed && body.imageAssetId === 'asset-0.jpg') {
            failed = true;
            throw new Error('Known rejection');
        }
        return add(bookId, body);
    };
    await assert.rejects(f.run(), /Known rejection/);
    assert.equal(f.state().pages.filter((page) => page.result).length, 1);
    await f.run();
    assert.equal(f.calls.adds.length, 2);
    assert.equal(f.calls.uploads.length, 2);
    assert.equal(f.calls.renders.length, 2);
});

test('upload completion retry retains its checkpoint and does not render or transfer again', async () => {
    const f = fixture();
    f.options.indices = [0];
    let first = true;
    const saved = { signature: { assetId: 'asset' }, uploaded: true };
    f.options.upload = async (_file, checkpoint, save) => {
        if (first) {
            first = false;
            save(saved);
            throw new Error('Completion failed');
        }
        assert.deepEqual(checkpoint, saved);
        return 'ready';
    };
    await assert.rejects(f.run(), /Completion failed/);
    await f.run();
    assert.equal(f.calls.renders.length, 1);
    assert.equal(f.calls.adds.length, 1);
});

test('a lost page response blocks replay even after earlier pages succeeded', async () => {
    const f = fixture(),
        add = f.options.add;
    let posts = 0;
    f.options.add = async (bookId, body) => {
        posts++;
        if (posts === 2) throw new AxiosError('Lost response', 'ERR_NETWORK');
        return add(bookId, body);
    };
    await assert.rejects(f.run(), /Lost response/);
    assert.equal(f.state().uncertain, true);
    await assert.rejects(f.run(), /Chưa xác nhận/);
    assert.equal(posts, 2);
    assert.equal(f.state().pages[0].result.page.id, 'page-asset-2.jpg');
});

test('a changed actor stops the next page mutation after an asynchronous upload', async () => {
    const f = fixture(),
        upload = f.options.upload;
    let changed = false;
    f.options.upload = async (...args) => {
        const id = await upload(...args);
        changed = true;
        return id;
    };
    f.options.checkSession = () => {
        if (changed) throw new Error('Changed actor');
    };
    await assert.rejects(f.run(), /Changed actor/);
    assert.equal(f.calls.adds.length, 0);
});

test('invalid geometry and empty selections stop before uploading or creating pages', async () => {
    const f = fixture();
    f.options.indices = [];
    await assert.rejects(f.run(), /ít nhất/);
    f.options.indices = [0];
    f.options.aspect = NaN;
    await assert.rejects(f.run(), /Khổ sách/);
    assert.equal(f.calls.renders.length, 0);
    assert.equal(f.calls.adds.length, 0);
});
