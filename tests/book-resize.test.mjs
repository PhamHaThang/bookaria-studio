import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    prepareBookResize,
    requestedPageAspect,
} from '../src/features/books/model/resize-pages.ts';
import { importPages } from '../src/features/pages/model/import-pages.ts';

const oldAspect = 297 / 210;
test('metadata and physical width changes leave page delivery unchanged', () => {
    const book = { pageFormat: 'A4', pageAspect: oldAspect };
    assert.equal(requestedPageAspect(book, { title: 'New' }), oldAspect);
    assert.equal(requestedPageAspect(book, { pageFormat: 'A4' }), oldAspect);
    assert.equal(requestedPageAspect(book, { pageFormat: 'CUSTOM', pageAspect: 0.5 }), 0.5);
    assert.equal(requestedPageAspect(book, { pageFormat: 'A5' }), 1.4189);
});
test('an import uploads only the original and resumes its checkpoint, without rendering another image', async () => {
    let checkpoint = { pages: [] },
        originals = 0,
        fail = true;
    const uploads = [],
        adds = [];
    const options = {
        bookId: 'book',
        aspect: 1.5,
        indices: [0],
        checkSession: () => {},
        onStage: () => {},
        onCheckpoint: (next) => (checkpoint = next),
        render: async () => {
            originals++;
            return new File(['original'], 'original.png');
        },
        upload: async (file) => {
            uploads.push(file.name);
            if (fail) {
                fail = false;
                throw Error('network');
            }
            return 'original-id';
        },
        add: async (_id, body) => {
            adds.push(body);
            return { page: { id: 'page' } };
        },
    };
    await assert.rejects(importPages({ ...options, checkpoint }), /network/);
    await importPages({ ...options, checkpoint });
    assert.equal(originals, 1);
    assert.deepEqual(uploads, ['original.png', 'original.png']);
    assert.deepEqual(adds, [{ imageAssetId: 'original-id' }]);
});
function fixture() {
    const plan = {
        pageAspect: oldAspect,
        pages: [
            {
                pageId: 'a',
                expectedImageAssetId: 'source-a',
                markerMode: 'CUSTOM_MARKER',
                layout: { assetId: 'source-a', url: 'cached-a', width: 1600, height: 800 },
            },
            {
                pageId: 'b',
                expectedImageAssetId: 'source-b',
                markerMode: 'NONE',
                layout: { assetId: 'source-b', url: 'cached-b', width: 1600, height: 800 },
            },
        ],
    };
    const calls = [],
        state = {},
        controller = new AbortController();
    const options = {
        book: { id: 'book', pageFormat: 'A4', pageAspect: oldAspect, pages: plan.pages },
        body: { pageFormat: 'CUSTOM', pageAspect: 0.5 },
        state,
        signal: controller.signal,
        onStage: () => {},
        layouts: async (id, aspect) => {
            calls.push({ layout: [id, aspect] });
            return plan;
        },
        prepareMind: async (url, pending) => {
            calls.push({ mind: url });
            pending.mind = { source: url };
            return 'new.mind';
        },
    };
    return { options, calls, state, controller, plan };
}
test('one batch layout request reuses source assets and only rebuilds custom recognition', async () => {
    const f = fixture(),
        result = await prepareBookResize(f.options);
    assert.deepEqual(f.calls, [{ layout: ['book', 0.5] }, { mind: 'cached-a' }]);
    assert.deepEqual(result.pageImages, [
        {
            pageId: 'a',
            expectedImageAssetId: 'source-a',
            expectedMarkerMode: 'CUSTOM_MARKER',
            markerMindPublicId: 'new.mind',
        },
        {
            pageId: 'b',
            expectedImageAssetId: 'source-b',
            expectedMarkerMode: 'NONE',
        },
    ]);
});
test('a failed compilation keeps its retry state and never mutates page records', async () => {
    const f = fixture();
    let fail = true;
    const prepare = f.options.prepareMind;
    f.options.prepareMind = async (...args) => {
        if (fail) {
            fail = false;
            throw Error('compiler');
        }
        return prepare(...args);
    };
    await assert.rejects(prepareBookResize(f.options), /compiler/);
    const pending = Object.values(f.state)[0];
    assert.equal((await prepareBookResize(f.options)).pageImages.length, 2);
    assert.equal(pending, Object.values(f.state)[0]);
    assert.equal(f.plan.pages[0].expectedImageAssetId, 'source-a');
});
test('abort and concurrent geometry changes stop before compiling', async () => {
    const f = fixture();
    f.controller.abort();
    await assert.rejects(prepareBookResize(f.options));
    assert.deepEqual(f.calls, []);
    const g = fixture();
    g.plan.pageAspect = 1;
    await assert.rejects(prepareBookResize(g.options), /nơi khác/);
    assert.equal(g.calls.length, 1);
});
