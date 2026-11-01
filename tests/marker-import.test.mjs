import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminLibraryApi } from '../src/features/admin/library-api.ts';
import {
    mergeMarkerImages,
    registerMarkerImage,
    validateMarkerImage,
} from '../src/features/admin/marker-import.ts';

const file = (name) => new File(['data'], name, { lastModified: 1 });
const signature = {
    imagePublicId: 'image',
    mindPublicId: 'mind',
    image: {
        uploadUrl: 'https://api.cloudinary.com/test/image/upload',
        fields: {},
        expiresAt: '2099-01-01T00:00:00Z',
    },
    mind: {
        uploadUrl: 'https://api.cloudinary.com/test/raw/upload',
        fields: {},
        expiresAt: '2099-01-01T00:00:00Z',
    },
};
const noop = async () => {};
test('images append and deduplicate, sort naturally and never request a mind file from the user', () => {
    const initial = mergeMarkerImages([], [file('BKA-10.png'), file('BKA-2.JPG')]);
    const result = mergeMarkerImages(initial, [file('BKA-1.webp'), file('BKA-2.JPG')]);
    assert.deepEqual(
        result.map((x) => x.name),
        ['BKA-1', 'BKA-2', 'BKA-10'],
    );
    assert.equal(initial.length, 2);
    assert.throws(
        () => mergeMarkerImages(result, [new File(['different'], 'BKA-1.png')]),
        /nhiều ảnh/,
    );
    assert.throws(() => mergeMarkerImages(result, [file('one.mind')]), /chọn ảnh/);
    assert.throws(() => mergeMarkerImages(result, [new File([], 'empty.png')]), /rỗng/);
});
test('validates decoded image shape before compiling and releases the bitmap', async () => {
    const original = globalThis.createImageBitmap;
    let released = 0;
    try {
        globalThis.createImageBitmap = async () => ({
            width: 200,
            height: 100,
            close() {
                released++;
            },
        });
        await assert.rejects(validateMarkerImage(file('one.png')), /vuông/);
        assert.equal(released, 1);
        globalThis.createImageBitmap = async () => ({
            width: 1024,
            height: 1024,
            close() {
                released++;
            },
        });
        await validateMarkerImage(file('one.png'));
        assert.equal(released, 2);
    } finally {
        globalThis.createImageBitmap = original;
    }
});
test('automatically compiles once, resumes a failed registration without recompiling or resending files', async () => {
    let item = mergeMarkerImages([], [file('one.png')])[0],
        compiled = 0,
        prepared = 0,
        transferred = 0,
        registered = 0;
    const bodies = [];
    const compile = async () => {
        compiled++;
        return file('generated.mind');
    };
    const api = {
        prepareMarkerUpload: async () => {
            prepared++;
            return signature;
        },
        importMarker: async (body) => {
            registered++;
            bodies.push(body);
            if (registered === 1) throw Error('connection lost');
            return { id: 'created' };
        },
    };
    const transfer = async () => {
        transferred++;
    };
    const checkpoint = (value) => {
        item = { ...item, checkpoint: value };
    };
    await assert.rejects(
        registerMarkerImage(
            item,
            false,
            api,
            transfer,
            compile,
            new AbortController().signal,
            checkpoint,
            () => {},
            () => {},
            noop,
        ),
        /connection lost/,
    );
    const result = await registerMarkerImage(
        item,
        false,
        api,
        transfer,
        compile,
        new AbortController().signal,
        checkpoint,
        () => {},
        () => {},
        noop,
    );
    assert.equal(result.id, 'created');
    assert.equal(compiled, 1);
    assert.equal(prepared, 1);
    assert.equal(transferred, 2);
    assert.deepEqual(bodies, [
        { imagePublicId: 'image', mindPublicId: 'mind', isActive: false },
        { imagePublicId: 'image', mindPublicId: 'mind', isActive: false },
    ]);
});
test('failed transfer resumes only the missing file and cancellation never registers', async () => {
    let item = mergeMarkerImages([], [file('one.png')])[0],
        attempts = 0,
        registered = 0;
    const api = {
        prepareMarkerUpload: async () => signature,
        importMarker: async () => {
            registered++;
            return {};
        },
    };
    const send = async () => {
        attempts++;
        if (attempts === 2) throw Error('upload failed');
    };
    const update = (value) => {
        item = { ...item, checkpoint: value };
    };
    const compile = async () => file('generated.mind');
    await assert.rejects(
        registerMarkerImage(
            item,
            true,
            api,
            send,
            compile,
            new AbortController().signal,
            update,
            () => {},
            () => {},
            noop,
        ),
        /upload failed/,
    );
    assert.equal(item.checkpoint.imageDone, true);
    assert.equal(item.checkpoint.mindDone, false);
    await registerMarkerImage(
        item,
        true,
        api,
        send,
        compile,
        new AbortController().signal,
        update,
        () => {},
        () => {},
        noop,
    );
    assert.equal(attempts, 3);
    assert.equal(registered, 1);
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
        registerMarkerImage(
            item,
            true,
            api,
            send,
            compile,
            abort.signal,
            update,
            () => {},
            () => {},
            noop,
        ),
    );
    assert.equal(registered, 1);
});
test('admin upload API validates request and response contracts and sends cancellation', async () => {
    const calls = [],
        id = '11111111-1111-4111-8111-111111111111',
        signal = new AbortController().signal;
    const api = createAdminLibraryApi({
        post: async (path, body, options) => {
            calls.push({ path, body, options });
            return {
                status: path.endsWith('register') ? 201 : 200,
                data: {
                    data: path.endsWith('register')
                        ? {
                              id,
                              number: 3,
                              imageUrl: 'https://example.com/marker.png',
                              markerScore: null,
                              isActive: false,
                              validatedAt: null,
                          }
                        : {
                              ...signature,
                              image: {
                                  ...signature.image,
                                  fields: {
                                      api_key: 'k',
                                      public_id: 'image',
                                      timestamp: 1,
                                      signature: 's',
                                  },
                              },
                              mind: {
                                  ...signature.mind,
                                  fields: {
                                      api_key: 'k',
                                      public_id: 'mind',
                                      timestamp: 1,
                                      signature: 's',
                                  },
                              },
                          },
                },
            };
        },
    });
    await api.prepareMarkerUpload({ imageFormat: 'png', imageBytes: 10, mindBytes: 10 }, signal);
    await api.importMarker({ imagePublicId: 'image', mindPublicId: 'mind' }, signal);
    assert.equal(calls[0].path, '/admin/bookaria-markers/upload-signature');
    assert.equal(calls[1].path, '/admin/bookaria-markers/register');
    assert.equal(calls[1].body.isActive, false);
    assert.equal(calls[0].options.signal, signal);
    await assert.rejects(
        api.prepareMarkerUpload({ imageFormat: 'svg', imageBytes: 1, mindBytes: 1 }, signal),
    );
    assert.equal(calls.length, 2);
});
