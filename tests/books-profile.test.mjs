import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createBooksApi } from '../src/features/books/api/books-api.ts';
import { createBookForm, updateBookForm } from '../src/features/books/model/form.ts';
import { readBookSearch, updateBookSearch } from '../src/features/books/model/search.ts';
import { createProfileApi } from '../src/features/profile/api/profile-api.ts';
import { ContractError } from '../src/shared/api/contract.ts';
import { errorMessage } from '../src/shared/api/errors.ts';

const id = '11111111-1111-4111-8111-111111111111';
const book = {
    id,
    title: 'Sách mẫu',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: false,
    pageCount: 0,
    updatedAt: '2026-10-21T00:00:00.000Z',
};
function fixture(responder, status = 200) {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return { data: responder(config), status, statusText: '', headers: {}, config };
        },
    });
    return { books: createBooksApi(http), profile: createProfileApi(http), calls };
}
function form(values = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
        title: 'Sách mới',
        description: '',
        topic: '',
        language: 'vi',
        pageFormat: 'A4',
        ageMin: '',
        ageMax: '',
        ...values,
    }))
        data.set(key, value);
    return data;
}
test('book list validates both rows and pagination metadata', async () => {
    const { books, calls } = fixture(() => ({
        data: [book],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    }));
    const result = await books.list({ q: '  Sách ', page: 1, limit: 12 });
    assert.equal(result.data[0].id, id);
    assert.equal(calls[0].params.q, 'Sách');
});
test('malformed list metadata never enters the cache', async () => {
    const { books } = fixture(() => ({ data: [book], meta: { total: 'one' } }));
    await assert.rejects(books.list({}), ContractError);
});
test('invalid create fields and UUIDs are rejected before HTTP', async () => {
    const { books, calls } = fixture(() => ({}));
    await assert.rejects(books.create({ title: '  ' }));
    await assert.rejects(books.detail('not-a-uuid'));
    assert.equal(calls.length, 0);
});
test('book create parses the actual nested create result', async () => {
    const { books, calls } = fixture(() => ({ data: { book } }), 201);
    const result = await books.create({ title: ' New title ' });
    assert.equal(result.book.id, id);
    const sent = JSON.parse(calls[0].data);
    assert.equal(sent.title, 'New title');
    assert.deepEqual(sent.source, { type: 'BLANK' });
});
test('delete accepts only the documented empty 204', async () => {
    const ok = fixture(() => undefined, 204);
    await ok.books.remove(id);
    const bad = fixture(() => ({}), 200);
    await assert.rejects(bad.books.remove(id), ContractError);
});
test('trash requires deletedAt and restore validates the restored summary', async () => {
    const { books } = fixture(() => ({
        data: [book],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    }));
    await assert.rejects(books.trash({}), ContractError);
    const valid = fixture(() => ({ data: book }));
    assert.equal((await valid.books.restore(id)).id, id);
});
test('invalid URL filters fall back to safe values', () => {
    const query = readBookSearch(new URLSearchParams('page=-1&status=BAD&sort=sql&q=hello'));
    assert.equal(query.page, 1);
    assert.equal(query.status, undefined);
    assert.equal(query.sort, '-updatedAt');
    assert.equal(query.q, 'hello');
});
test('changing search or status resets pagination but moving page preserves filters', () => {
    const params = new URLSearchParams('q=AR&status=DRAFT&page=4');
    const filtered = updateBookSearch(params, { status: 'PUBLISHED' });
    assert.equal(filtered.get('page'), null);
    assert.equal(filtered.get('q'), 'AR');
    const paged = updateBookSearch(params, { page: '2' });
    assert.equal(paged.get('status'), 'DRAFT');
    assert.equal(paged.get('page'), '2');
    assert.equal(params.get('page'), '4');
});
test('create form enforces custom ratio and age order using backend schema', () => {
    assert.throws(() => createBookForm(form({ pageFormat: 'CUSTOM' })));
    assert.throws(() => createBookForm(form({ ageMin: '10', ageMax: '5' })));
    assert.equal(createBookForm(form({ pageFormat: 'CUSTOM', pageAspect: '1.5' })).pageAspect, 1.5);
});
test('clearing ages in edit sends null to remove previous values', () => {
    const body = updateBookForm(form());
    assert.equal(body.ageMin, null);
    assert.equal(body.ageMax, null);
});
test('profile update validates before HTTP and rejects malformed success DTO', async () => {
    const { profile, calls } = fixture(() => ({ data: { displayName: 'An' } }));
    await assert.rejects(profile.update({ displayName: ' ' }));
    assert.equal(calls.length, 0);
    await assert.rejects(profile.update({ displayName: 'An' }), ContractError);
});
test('change password validates UTF-8 byte limit and handles 204', async () => {
    const { profile, calls } = fixture(() => undefined, 204);
    await assert.rejects(profile.changePassword({ newPassword: 'ế'.repeat(25) }));
    assert.equal(calls.length, 0);
    await profile.changePassword({
        currentPassword: 'old-password',
        newPassword: 'New-password-123',
    });
    assert.equal(calls.length, 1);
});

test('server field validation shows the useful field message', () => {
    const error = new axios.AxiosError('bad', undefined, undefined, undefined, {
        data: {
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Dữ liệu chưa hợp lệ.',
                requestId: 'test',
                details: [{ path: 'currentPassword', message: 'Mật khẩu hiện tại không đúng.' }],
            },
        },
        status: 400,
        statusText: '',
        headers: {},
        config: {},
    });
    assert.equal(errorMessage(error), 'Mật khẩu hiện tại không đúng.');
});
