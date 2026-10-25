import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readModelDocument, validateImport } from '../src/features/scene/model/import-asset.ts';

const encode = (value) => new TextEncoder().encode(JSON.stringify(value)).buffer;
const valid = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'data:application/octet-stream;base64,AAAA' }],
    images: [{ uri: 'data:image/png;base64,AAAA' }],
};
function glb(document) {
    const json = new TextEncoder().encode(JSON.stringify(document)),
        length = Math.ceil(json.byteLength / 4) * 4,
        data = new ArrayBuffer(20 + length),
        view = new DataView(data);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, data.byteLength, true);
    view.setUint32(12, length, true);
    view.setUint32(16, 0x4e4f534a, true);
    new Uint8Array(data, 20).fill(32);
    new Uint8Array(data, 20).set(json);
    return data;
}
test('accepts embedded glTF and binary GLB without external dependencies', () => {
    assert.deepEqual(readModelDocument(encode(valid)), valid);
    assert.deepEqual(readModelDocument(glb(valid)), valid);
});
test('rejects sidecar buffers and remote textures before preview or upload', () => {
    for (const uri of [
        'texture.png',
        '../mesh.bin',
        'https://example.com/texture.png',
        '//example.com/x',
        'blob:foo',
    ]) {
        assert.throws(
            () => readModelDocument(encode({ ...valid, images: [{ uri }] })),
            /bên ngoài/,
        );
        assert.throws(() => readModelDocument(glb({ ...valid, buffers: [{ uri }] })), /bên ngoài/);
    }
});
test('rejects corrupt or unsupported models with readable errors', () => {
    for (const data of [
        encode(null),
        encode({}),
        encode({ asset: { version: '1.0' } }),
        new ArrayBuffer(0),
        encode({ ...valid, images: {} }),
    ])
        assert.throws(() => readModelDocument(data));
    const invalid = glb(valid);
    new DataView(invalid).setUint32(8, 5, true);
    assert.throws(() => readModelDocument(invalid), /GLB/);
});
test('rejects wrong file type and oversize uploads using backend contract limits', () => {
    validateImport({ name: 'm.glb', type: '', size: 100 }, 'MODEL');
    assert.throws(
        () => validateImport({ name: 'image.png', type: 'image/png', size: 100 }, 'MODEL'),
        /không phù hợp/,
    );
    assert.throws(
        () => validateImport({ name: 'large.glb', type: '', size: 11 * 1024 * 1024 }, 'MODEL'),
        /vượt giới hạn/,
    );
});
