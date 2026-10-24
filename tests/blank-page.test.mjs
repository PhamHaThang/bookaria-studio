import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { blankPageDimensions, createBlankPage } from '../src/features/pages/model/blank-page.ts';

test('blank print pages preserve fixed and custom aspect ratios without unbounded canvases', () => {
    assert.deepEqual(blankPageDimensions(Math.SQRT2), { width: 1200, height: 1697 });
    assert.deepEqual(blankPageDimensions(1), { width: 1200, height: 1200 });
    assert.deepEqual(blankPageDimensions(0.2), { width: 1200, height: 240 });
    for (const aspect of [NaN, Infinity, 0, -1, 5.01])
        assert.throws(() => blankPageDimensions(aspect));
});

function fixture() {
    let checkpoint = {};
    let uploads = 0,
        writes = 0;
    const result = {
        page: { id: 'new-page', orderIndex: 1, markerMode: 'NONE', markerNumber: null },
    };
    const options = {
        bookId: 'book',
        afterPageId: 'previous',
        upload: async () => {
            uploads++;
            return 'blank-image';
        },
        add: async (bookId, body) => {
            writes++;
            assert.equal(bookId, 'book');
            assert.deepEqual(body, { imageAssetId: 'blank-image', afterPageId: 'previous' });
            return result;
        },
        onCheckpoint: (value) => {
            checkpoint = value;
        },
    };
    return {
        options,
        result,
        call: () => createBlankPage({ ...options, checkpoint }),
        state: () => ({ checkpoint, uploads, writes }),
    };
}

test('a confirmed page is returned on reuse without another upload or add POST', async () => {
    const f = fixture();
    assert.deepEqual(await f.call(), f.result);
    assert.deepEqual(await f.call(), f.result);
    assert.equal(f.state().uploads, 1);
    assert.equal(f.state().writes, 1);
});

test('known validation failure reuses the ready image on retry', async () => {
    const f = fixture(),
        original = f.options.add;
    let first = true;
    f.options.add = async (...args) => {
        if (first) {
            first = false;
            throw new Error('validation');
        }
        return original(...args);
    };
    await assert.rejects(f.call(), /validation/);
    assert.equal(f.state().checkpoint.imageAssetId, 'blank-image');
    await f.call();
    assert.equal(f.state().uploads, 1);
});

test('a lost add response blocks replay even when the caller requests retry', async () => {
    const f = fixture();
    let posts = 0;
    f.options.add = async () => {
        posts++;
        throw new AxiosError('Lost response', 'ERR_NETWORK');
    };
    await assert.rejects(f.call(), /Lost response/);
    assert.equal(f.state().checkpoint.uncertain, true);
    await assert.rejects(f.call(), /Chưa xác nhận/);
    assert.equal(posts, 1);
    assert.equal(f.state().uploads, 1);
});

test('upload failure never creates a page referencing an unfinished asset', async () => {
    const f = fixture();
    f.options.upload = async () => {
        throw new Error('upload failed');
    };
    await assert.rejects(f.call(), /upload failed/);
    assert.equal(f.state().writes, 0);
    assert.deepEqual(f.state().checkpoint, {});
});
