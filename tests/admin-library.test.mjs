import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createAdminLibraryApi } from '../src/features/admin/library-api.ts';
import {
    excludedParents,
    libraryChanges,
    libraryFields,
    libraryKeys,
    readLibrarySearch,
} from '../src/features/admin/library-model.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111',
    other = '22222222-2222-4222-8222-222222222222',
    third = '33333333-3333-4333-8333-333333333333';
const asset = {
    id,
    type: 'IMAGE',
    url: 'https://example.com/test.png',
    thumbnailUrl: null,
    meta: { width: 100, height: 100 },
    name: 'Tệp thử',
    status: 'READY',
    sizeBytes: 1234,
    format: 'png',
    tags: [],
    license: 'CC0',
    authorName: 'Playwright',
    sourceUrl: null,
    scope: 'library',
    categoryId: null,
    createdAt: '2026-10-23T00:00:00.000Z',
};
const category = { id, name: 'Danh mục thử', parentId: null, sortOrder: 0 };
const marker = {
    id,
    number: 123,
    imageUrl: 'https://example.com/marker.png',
    markerScore: null,
    isActive: true,
    validatedAt: null,
};
const response = (config, data, status = 200) => ({
    config,
    data,
    status,
    statusText: 'OK',
    headers: {},
});
const page = (data) => ({
    data,
    meta: { page: 1, limit: 12, total: data.length, totalPages: data.length ? 1 : 0 },
});

test('library URL filters validate ids/enums and isolate per-admin caches', () => {
    const query = readLibrarySearch(
        new URLSearchParams(`page=2&q= Test &type=IMAGE&categoryId=${id}`),
    );
    assert.equal(query.page, 2);
    assert.equal(query.q, 'Test');
    assert.equal(query.categoryId, id);
    assert.equal(query.type, 'IMAGE');
    const invalid = readLibrarySearch(new URLSearchParams('page=-1&type=pdf&categoryId=bad'));
    assert.equal(invalid.page, 1);
    assert.equal(invalid.type, undefined);
    assert.equal(invalid.categoryId, undefined);
    assert.notDeepEqual(libraryKeys.list(id, query), libraryKeys.list(other, query));
});
test('category parent exclusion handles descendants, siblings and corrupt cycles without recursion', () => {
    const rows = [
        category,
        { ...category, id: other, parentId: id },
        { ...category, id: third, parentId: other },
    ];
    assert.deepEqual([...excludedParents(rows, id)], [id, other, third]);
    assert.deepEqual([...excludedParents(rows, third)], [third]);
    assert.equal(
        excludedParents(
            [
                { ...category, parentId: other },
                { ...category, id: other, parentId: id },
            ],
            id,
        ).size,
        2,
    );
});
test('metadata preserves explicit clears and minimal patch without guessed license', () => {
    const data = new FormData();
    for (const [k, v] of Object.entries({
        name: 'Tệp thử',
        license: 'CC0',
        authorName: 'Playwright',
        tags: ' one, two , ',
        categoryId: '',
        sourceUrl: '',
    }))
        data.set(k, v);
    const fields = libraryFields(data);
    assert.deepEqual(fields.tags, ['one', 'two']);
    assert.equal(fields.sourceUrl, null);
    assert.equal(fields.categoryId, null);
    assert.deepEqual(libraryChanges({ ...asset, tags: ['one', 'two'] }, fields), {});
    assert.deepEqual(
        libraryChanges(
            { ...asset, sourceUrl: 'https://example.com/source', categoryId: id },
            fields,
        ),
        { categoryId: null, sourceUrl: null, tags: ['one', 'two'] },
    );
});
test('admin library list checks scope, query and cancellation', async () => {
    let data = page([asset]);
    const calls = [],
        http = axios.create({
            adapter: async (config) => {
                calls.push(config);
                return response(config, data);
            },
        }),
        api = createAdminLibraryApi(http),
        signal = new AbortController().signal;
    assert.equal((await api.library({ page: 1, limit: 12, type: 'IMAGE' }, signal)).data[0].id, id);
    assert.equal(calls[0].url, '/admin/library/assets');
    assert.equal(calls[0].signal, signal);
    assert.equal(calls[0].params.type, 'IMAGE');
    data = page([{ ...asset, scope: 'mine' }]);
    await assert.rejects(() => api.library({}), ContractError);
});
test('promotion validates attribution before POST and enforces201 and returned identity', async () => {
    let status = 201,
        data = asset;
    const calls = [],
        api = createAdminLibraryApi(
            axios.create({
                adapter: async (config) => {
                    calls.push(config);
                    return response(config, { data }, status);
                },
            }),
        );
    const body = { assetId: id, name: 'Tệp thử', license: 'CC0', authorName: 'Playwright' };
    await assert.rejects(() => api.promote({ ...body, license: '' }));
    await assert.rejects(() => api.promote({ ...body, authorName: '' }));
    assert.equal(calls.length, 0);
    await api.promote(body);
    assert.equal(calls[0].url, '/admin/library/assets');
    assert.equal(JSON.parse(calls[0].data).assetId, id);
    status = 200;
    await assert.rejects(() => api.promote(body), ContractError);
    status = 201;
    data = { ...asset, id: other };
    await assert.rejects(() => api.promote(body), ContractError);
});
test('shared update allows null category/source and empty tags but rejects empty patch, bad identity and status', async () => {
    const calls = [];
    let status = 200,
        data = asset;
    const api = createAdminLibraryApi(
        axios.create({
            adapter: async (config) => {
                calls.push(config);
                return response(config, { data }, status);
            },
        }),
    );
    await assert.rejects(() => api.update(id, {}));
    await assert.rejects(() => api.update('../id', { name: 'Test' }));
    assert.equal(calls.length, 0);
    await api.update(id, { categoryId: null, sourceUrl: null, tags: [] });
    assert.deepEqual(JSON.parse(calls[0].data), { categoryId: null, sourceUrl: null, tags: [] });
    data = { ...asset, id: other };
    await assert.rejects(() => api.update(id, { name: 'Test' }), ContractError);
    data = asset;
    status = 202;
    await assert.rejects(() => api.update(id, { name: 'Test' }), ContractError);
});
test('shared/category deletion requires204, valid id and no automatic retry', async () => {
    let status = 204,
        attempts = 0;
    const http = axios.create({
            adapter: async (config) => {
                attempts++;
                return response(config, null, status);
            },
        }),
        api = createAdminLibraryApi(http);
    await api.remove(id);
    await api.removeCategory(id);
    assert.equal(attempts, 2);
    await assert.rejects(() => api.remove('../id'));
    assert.equal(attempts, 2);
    status = 200;
    await assert.rejects(() => api.remove(id), ContractError);
    http.defaults.adapter = async () => {
        attempts++;
        throw Error('response lost');
    };
    const before = attempts;
    await assert.rejects(() => api.removeCategory(id));
    assert.equal(attempts, before + 1);
});
test('category writes validate create201, parent reset, integer order bounds and returned id', async () => {
    let status = 201,
        data = category;
    const calls = [],
        api = createAdminLibraryApi(
            axios.create({
                adapter: async (config) => {
                    calls.push(config);
                    return response(config, { data }, status);
                },
            }),
        );
    await api.createCategory({ name: 'Test', parentId: null });
    assert.equal(calls[0].url, '/admin/asset-categories');
    status = 200;
    await api.updateCategory(id, { parentId: null, sortOrder: -32768 });
    assert.deepEqual(JSON.parse(calls[1].data), { parentId: null, sortOrder: -32768 });
    await assert.rejects(() => api.updateCategory(id, { sortOrder: 32768 }));
    await assert.rejects(() => api.updateCategory(id, {}));
    data = { ...category, id: other };
    await assert.rejects(() => api.updateCategory(id, { name: 'Test' }), ContractError);
});
test('marker list and registration preserve zero score and signed seed, require references/unique number shape', async () => {
    const calls = [];
    let status = 200,
        data = page([marker]);
    const api = createAdminLibraryApi(
            axios.create({
                adapter: async (config) => {
                    calls.push(config);
                    return response(config, data, status);
                },
            }),
        ),
        signal = new AbortController().signal;
    await api.markers({ page: 1, limit: 12 }, signal);
    assert.equal(calls[0].signal, signal);
    status = 201;
    data = { data: marker };
    await api.createMarker({
        number: 123,
        seed: -23,
        imagePublicId: 'test/image',
        mindPublicId: 'test/target.mind',
        markerScore: 0,
    });
    const body = JSON.parse(calls[1].data);
    assert.equal(body.markerScore, 0);
    assert.equal(body.seed, -23);
    await assert.rejects(() => api.createMarker({ ...body, number: 0 }));
    await assert.rejects(() => api.createMarker({ ...body, imagePublicId: '' }));
    await assert.rejects(() => api.createMarker({ ...body, markerScore: 6 }));
    assert.equal(calls.length, 2);
});
test('marker toggle distinguishes false from missing and validates result identity', async () => {
    let data = { ...marker, isActive: false };
    const calls = [],
        api = createAdminLibraryApi(
            axios.create({
                adapter: async (config) => {
                    calls.push(config);
                    return response(config, { data });
                },
            }),
        );
    await api.setMarker(id, { isActive: false });
    assert.equal(JSON.parse(calls[0].data).isActive, false);
    await assert.rejects(() => api.setMarker(id, {}));
    data = { ...marker, id: other };
    await assert.rejects(() => api.setMarker(id, { isActive: true }), ContractError);
});
