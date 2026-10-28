import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { createBookWithPages } from '../src/features/books/model/create-book.ts';
import {
    mergeImageFiles,
    pageFit,
    selectedPages,
    validateImportFiles,
} from '../src/features/books/model/import-source.ts';

test('adding image batches keeps chosen files, deduplicates repeated files and sorts naturally', () => {
    const first = new File(['first'], '10.png', { type: 'image/png', lastModified: 1 });
    const same = new File(['first'], '10.png', { type: 'image/png', lastModified: 1 });
    const second = new File(['second'], '2.png', { type: 'image/png', lastModified: 2 });
    const previous = [first];
    assert.deepEqual(mergeImageFiles(previous, [same, second]), [second, first]);
    assert.deepEqual(previous, [first]);
});

test('adding a batch applies limits to the combined selection without changing the previous files', () => {
    const previous = Array.from({ length: 100 }, (_, index) => new File(['x'], `${index}.png`));
    assert.throws(() => mergeImageFiles(previous, [new File(['y'], 'extra.png')]), /100/);
    assert.equal(previous.length, 100);
    assert.throws(
        () => mergeImageFiles(previous.slice(0, 1), [new File(['x'], 'wrong.webp')]),
        /PDF, JPG và PNG/,
    );
});

test('a new PDF belongs to replacement rather than an appended image selection', () => {
    assert.throws(() => mergeImageFiles([], [new File(['pdf'], 'book.pdf')]), /Đổi tài liệu/);
    const first = new File(['a'], 'same.png', { lastModified: 1 });
    const edited = new File(['b'], 'same.png', { lastModified: 2 });
    assert.deepEqual(mergeImageFiles([first], [edited]), [first, edited]);
});

test('PDF ranges deduplicate and preserve document order; blank means every page', () => {
    assert.deepEqual(selectedPages('', 3), [0, 1, 2]);
    assert.deepEqual(selectedPages('5, 1-3, 2', 5), [0, 1, 2, 4]);
    for (const value of ['0', '1-6', '4-2', '1,', '1.5', 'abc', '-1'])
        assert.throws(() => selectedPages(value, 5));
    assert.throws(() => selectedPages('', 101));
});
test('only one bounded PDF or bounded JPG/PNG images can be selected', () => {
    const file = (name, size = 1) => ({ name, size });
    assert.equal(validateImportFiles([file('Book.PDF')]).kind, 'pdf');
    for (const input of [
        [],
        [file('x.pdf'), file('a.png')],
        [file('a.webp')],
        [file('a.jpg', 0)],
        [file('a.pdf', 51 * 1024 * 1024)],
        [file('a.png', 11 * 1024 * 1024)],
    ])
        assert.throws(() => validateImportFiles(input));
});
test('image filenames use natural numeric order without mutating the file selection', () => {
    const files = ['10.png', '2.png', '1.png'].map((name) => ({ name, size: 10 }));
    assert.deepEqual(
        validateImportFiles(files).files.map((file) => file.name),
        ['1.png', '2.png', '10.png'],
    );
    assert.equal(files[0].name, '10.png');
});
test('page fitting preserves every edge and caps output dimensions across custom ratios', () => {
    for (const aspect of [0.2, 1, Math.SQRT2, 5])
        for (const [width, height] of [
            [2000, 100],
            [100, 2000],
            [1200, 1700],
        ]) {
            const fit = pageFit(width, height, aspect);
            assert.ok(fit.width <= 1600 && fit.height <= 2400);
            assert.ok(fit.x >= -0.001 && fit.y >= -0.001);
            assert.ok(fit.drawWidth <= fit.width + 0.001 && fit.drawHeight <= fit.height + 0.001);
            assert.ok(Math.abs(fit.drawWidth / fit.drawHeight - width / height) < 0.001);
        }
    assert.throws(() => pageFit(0, 100, 1));
});
function fixture() {
    let state = { pages: [] },
        creates = 0,
        uploads = 0,
        adds = 0,
        renders = 0;
    const options = {
        body: { title: 'Test', pageFormat: 'A4', language: 'vi', source: { type: 'BLANK' } },
        indices: [0, 2],
        create: async () => {
            creates++;
            return { book: { id: 'book' } };
        },
        detail: async () => ({ pageAspect: Math.SQRT2 }),
        render: async (index) => {
            renders++;
            return new File(['test'], `${index}.jpg`, { type: 'image/jpeg' });
        },
        upload: async (file) => {
            uploads++;
            return `asset-${file.name}`;
        },
        add: async (_id, body) => {
            adds++;
            return {
                page: {
                    id: body.imageAssetId,
                    orderIndex: adds,
                    markerMode: 'NONE',
                    markerNumber: null,
                },
            };
        },
        checkSession: () => undefined,
        onStage: () => undefined,
        onCheckpoint: (value) => {
            state = value;
        },
    };
    return {
        options,
        run: () => createBookWithPages({ ...options, checkpoint: state }),
        state: () => state,
        counts: () => ({ creates, uploads, adds, renders }),
    };
}
test('completed imports return their first page without repeated book/page writes', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(result.pageId, 'asset-0.jpg');
    await f.run();
    assert.deepEqual(f.counts(), { creates: 1, uploads: 2, adds: 2, renders: 2 });
    assert.ok(f.state().pages.every((page) => !page.file && !page.upload));
});
test('a known add failure resumes at the interrupted page using its ready asset', async () => {
    const f = fixture(),
        add = f.options.add;
    let fail = true;
    f.options.add = async (...args) => {
        if (args[1].imageAssetId === 'asset-2.jpg' && fail) {
            fail = false;
            throw new Error('Known validation');
        }
        return add(...args);
    };
    await assert.rejects(f.run(), /Known validation/);
    assert.equal(f.state().pages[0].result.page.id, 'asset-0.jpg');
    await f.run();
    assert.deepEqual(f.counts(), { creates: 1, uploads: 2, adds: 2, renders: 2 });
});
test('a lost book response blocks another non-idempotent create', async () => {
    const f = fixture();
    let posts = 0;
    f.options.create = async () => {
        posts++;
        throw new AxiosError('Lost', 'ERR_NETWORK');
    };
    await assert.rejects(f.run(), /Lost/);
    await assert.rejects(f.run(), /Chưa xác nhận/);
    assert.equal(posts, 1);
    assert.equal(f.state().uncertain, true);
    assert.equal(f.counts().uploads, 0);
});
test('a lost page response preserves the book and blocks replay', async () => {
    const f = fixture();
    let posts = 0;
    f.options.add = async () => {
        posts++;
        throw new AxiosError('Lost', 'ERR_NETWORK');
    };
    await assert.rejects(f.run(), /Lost/);
    await assert.rejects(f.run(), /Chưa xác nhận/);
    assert.equal(posts, 1);
    assert.equal(f.state().bookId, 'book');
    assert.equal(f.state().pages[0].imageAssetId, 'asset-0.jpg');
});
test('an upload retry retains its cloud checkpoint and never re-renders the interrupted page', async () => {
    const f = fixture();
    let first = true;
    const saved = { signature: { assetId: 'asset' }, uploaded: true };
    f.options.upload = async (_file, checkpoint, save) => {
        if (first) {
            first = false;
            save(saved);
            throw new Error('Complete failed');
        }
        assert.deepEqual(checkpoint, saved);
        return 'ready';
    };
    f.options.indices = [0];
    await assert.rejects(f.run(), /Complete failed/);
    await f.run();
    assert.equal(f.counts().renders, 1);
    assert.equal(f.counts().creates, 1);
});
test('a changed session stops before the next page write', async () => {
    const f = fixture();
    let changed = false;
    const upload = f.options.upload;
    f.options.upload = async (...args) => {
        const id = await upload(...args);
        changed = true;
        return id;
    };
    f.options.checkSession = () => {
        if (changed) throw new Error('Changed actor');
    };
    await assert.rejects(f.run(), /Changed actor/);
    assert.equal(f.counts().adds, 0);
});

test('cover failure resumes on the same book before importing any pages', async () => {
    const f = fixture();
    let attempts = 0;
    f.options.saveCover = async (id) => {
        assert.equal(id, 'book');
        attempts++;
        if (attempts === 1) throw new Error('Cover save failed');
    };
    await assert.rejects(f.run(), /Cover save failed/);
    assert.equal(f.state().bookId, 'book');
    assert.equal(f.counts().uploads, 0);
    await f.run();
    assert.equal(attempts, 2);
    assert.equal(f.counts().creates, 1);
    assert.equal(f.state().coverSaved, true);
});

test('a saved cover is not repeated when a later page import is resumed', async () => {
    const f = fixture();
    let covers = 0,
        first = true;
    const add = f.options.add;
    f.options.saveCover = async () => {
        covers++;
    };
    f.options.add = async (...args) => {
        if (first) {
            first = false;
            throw new Error('Page failed');
        }
        return add(...args);
    };
    await assert.rejects(f.run(), /Page failed/);
    assert.equal(f.state().coverSaved, true);
    await f.run();
    assert.equal(covers, 1);
    assert.equal(f.counts().creates, 1);
    assert.equal(f.counts().uploads, 2);
});

test('session change after cover persistence stops before page writes', async () => {
    const f = fixture();
    let changed = false;
    f.options.saveCover = async () => {
        changed = true;
    };
    f.options.checkSession = () => {
        if (changed) throw new Error('Changed actor');
    };
    await assert.rejects(f.run(), /Changed actor/);
    assert.equal(f.counts().adds, 0);
    assert.equal(f.counts().uploads, 0);
});
