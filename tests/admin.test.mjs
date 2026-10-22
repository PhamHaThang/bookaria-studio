import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createAdminApi } from '../src/features/admin/api.ts';
import {
    adminKeys,
    readAdminBooksSearch,
    readAdminQueueSearch,
    readAdminUsersSearch,
    userChanges,
} from '../src/features/admin/model.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const stamp = '2026-10-23T00:00:00.000Z';
const user = {
    id,
    email: 'test@example.com',
    displayName: 'An',
    avatarUrl: null,
    organization: null,
    bio: null,
    role: 'AUTHOR',
    status: 'ACTIVE',
    emailVerified: false,
    storage: { usedBytes: 0, quotaBytes: 1073741824 },
    bookCount: 0,
    lastLoginAt: null,
    createdAt: stamp,
    updatedAt: stamp,
};
const book = {
    id,
    title: 'Sách thử',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: true,
    pageCount: 0,
    updatedAt: stamp,
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

test('admin URL filters preserve valid values, reject unknown enum/sort and bound search', () => {
    const query = readAdminUsersSearch(
        new URLSearchParams('page=2&q= An &role=ADMIN&status=LOCKED&sort=-storageUsedBytes'),
    );
    assert.equal(query.page, 2);
    assert.equal(query.q, 'An');
    assert.equal(query.role, 'ADMIN');
    assert.equal(query.status, 'LOCKED');
    assert.equal(query.sort, '-storageUsedBytes');
    const fallback = readAdminUsersSearch(
        new URLSearchParams('page=-1&role=ROOT&status=DELETED&sort=oops'),
    );
    assert.equal(fallback.page, 1);
    assert.equal(fallback.role, undefined);
    assert.equal(fallback.status, undefined);
    assert.equal(fallback.sort, '-createdAt');
    assert.equal(readAdminUsersSearch(new URLSearchParams({ q: 'x'.repeat(120) })).q.length, 100);
    assert.equal(readAdminBooksSearch(new URLSearchParams()).visibility, 'PUBLIC');
    assert.equal(
        readAdminBooksSearch(new URLSearchParams('visibility=PRIVATE')).visibility,
        'PRIVATE',
    );
    assert.equal(readAdminBooksSearch(new URLSearchParams('visibility=oops')).visibility, 'PUBLIC');
    assert.equal(readAdminQueueSearch(new URLSearchParams('page=2')).page, 2);
    assert.notDeepEqual(adminKeys.user(id, other), adminKeys.user(other, id));
});
test('admin user updates only send changed fields and keep exact byte quota', () => {
    assert.deepEqual(
        userChanges(user, { role: 'AUTHOR', status: 'ACTIVE', quota: '1073741824', reason: ' ' }),
        {},
    );
    assert.deepEqual(
        userChanges(user, { role: 'ADMIN', status: 'LOCKED', quota: '1234567', reason: ' lý do ' }),
        { role: 'ADMIN', status: 'LOCKED', storageQuotaBytes: 1234567, reason: 'lý do' },
    );
});
test('admin reads validate envelopes, filters and cancellation using backend schemas', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return response(config, page([user]));
        },
    });
    const signal = new AbortController().signal;
    assert.equal(
        (await createAdminApi(http).users({ page: 1, limit: 12, role: 'ADMIN' }, signal)).data[0]
            .id,
        id,
    );
    assert.equal(calls[0].url, '/admin/users');
    assert.equal(calls[0].params.role, 'ADMIN');
    assert.equal(calls[0].signal, signal);
    await assert.rejects(() => createAdminApi(http).users({ role: 'ROOT' }));
    assert.equal(calls.length, 1);
    http.defaults.adapter = async (config) =>
        response(config, page([{ ...user, storage: { usedBytes: -1, quotaBytes: 1 } }]));
    await assert.rejects(() => createAdminApi(http).users({}), ContractError);
});
test('admin detail rejects invalid ids before HTTP and mismatched user identity', async () => {
    let calls = 0;
    const api = createAdminApi(
        axios.create({
            adapter: async (config) => {
                calls++;
                return response(config, { data: { ...user, books: [] } });
            },
        }),
    );
    await assert.rejects(() => api.user('../other'));
    assert.equal(calls, 0);
    assert.equal((await api.user(id)).id, id);
    await assert.rejects(() => api.user(other), ContractError);
});
test('admin create enforces201 and schema limits before sending credentials', async () => {
    const calls = [];
    let status = 201;
    const api = createAdminApi(
        axios.create({
            adapter: async (config) => {
                calls.push(config);
                return response(config, { data: user }, status);
            },
        }),
    );
    const body = {
        email: ' NEW@example.com ',
        password: 'Testing123!',
        displayName: 'An',
        role: 'AUTHOR',
    };
    await api.createUser(body);
    assert.equal(calls[0].url, '/admin/users');
    assert.equal(JSON.parse(calls[0].data).email, 'new@example.com');
    await assert.rejects(() => api.createUser({ ...body, password: '123' }));
    await assert.rejects(() => api.createUser({ ...body, storageQuotaBytes: 0 }));
    assert.equal(calls.length, 1);
    status = 200;
    await assert.rejects(() => api.createUser(body), ContractError);
});
test('admin patch requires reason for status/role and validates result identity without replay', async () => {
    const calls = [];
    const api = createAdminApi(
        axios.create({
            adapter: async (config) => {
                calls.push(config);
                return response(config, {
                    data: {
                        user: { id, status: 'LOCKED', role: 'AUTHOR', storageQuotaBytes: 1234 },
                    },
                });
            },
        }),
    );
    await assert.rejects(() => api.updateUser(id, { status: 'LOCKED' }));
    await assert.rejects(() => api.updateUser(id, {}));
    assert.equal(calls.length, 0);
    await api.updateUser(id, { status: 'LOCKED', reason: 'Kiểm thử' });
    assert.equal(calls[0].method, 'patch');
    assert.equal(JSON.parse(calls[0].data).reason, 'Kiểm thử');
    await assert.rejects(() => api.updateUser(other, { storageQuotaBytes: 1234 }), ContractError);
    let attempts = 0;
    const lost = createAdminApi(
        axios.create({
            adapter: async () => {
                attempts++;
                throw Error('lost response');
            },
        }),
    );
    await assert.rejects(() => lost.updateUser(id, { storageQuotaBytes: 1234 }));
    assert.equal(attempts, 1);
});
test('moderation list and detail use their distinct schemas', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            const data =
                config.url === '/admin/moderation'
                    ? page([
                          {
                              book: {
                                  id,
                                  title: 'Sách thử',
                                  author: { id: other, displayName: 'An' },
                              },
                              reportCount: 1,
                              reasons: ['COPYRIGHT'],
                              lastReportedAt: stamp,
                          },
                      ])
                    : config.url === '/admin/books'
                      ? page([
                            { ...book, author: { id: other, displayName: 'An' }, reportCount: 0 },
                        ])
                      : {
                            data: {
                                book: {
                                    ...book,
                                    author: { id: other, displayName: 'An' },
                                    description: null,
                                    takenDownReason: 'Kiểm thử',
                                    pages: [],
                                },
                                reports: [],
                            },
                        };
            return response(config, data);
        },
    });
    const api = createAdminApi(http),
        signal = new AbortController().signal;
    assert.equal(
        (await api.moderation({ page: 1, limit: 12 }, signal)).data[0].reasons[0],
        'COPYRIGHT',
    );
    assert.equal((await api.books({ visibility: 'PRIVATE' }, signal)).data[0].takenDown, true);
    assert.equal((await api.book(id, signal)).book.id, id);
    assert.ok(calls.every((call) => call.signal === signal));
    assert.equal(calls[1].params.visibility, 'PRIVATE');
});
test('moderation actions require takedown reason and validate each response shape and status', async () => {
    const calls = [];
    let status = 200;
    const api = createAdminApi(
        axios.create({
            adapter: async (config) => {
                calls.push(config);
                const data = config.url.endsWith('/takedown')
                    ? { book: { id, visibility: 'PRIVATE', takenDown: true }, resolvedReports: 2 }
                    : config.url.endsWith('/reinstate')
                      ? { book: { ...book, visibility: 'UNLISTED', takenDown: false } }
                      : { dismissedReports: 2 };
                return response(config, { data }, status);
            },
        }),
    );
    await assert.rejects(() => api.takedown(id, { reason: ' ' }));
    assert.equal(calls.length, 0);
    assert.equal((await api.takedown(id, { reason: ' Lý do ' })).resolvedReports, 2);
    assert.equal(JSON.parse(calls[0].data).reason, 'Lý do');
    assert.equal((await api.reinstate(id, {})).book.visibility, 'UNLISTED');
    assert.equal((await api.dismiss(id, { note: 'Đã kiểm tra' })).dismissedReports, 2);
    assert.equal(calls[2].url, `/admin/books/${id}/reports/dismiss`);
    status = 202;
    await assert.rejects(() => api.dismiss(id, {}), ContractError);
});
test('dashboard accepts honest zero metrics and refuses malformed aggregates', async () => {
    let data = {
        users: 0,
        publishedBooks: 0,
        storageUsedBytes: 0,
        failedJobs24h: 0,
        openReports: 0,
        publishedPerDay: [],
        auditActionsToday: [],
    };
    const http = axios.create({ adapter: async (config) => response(config, { data }) });
    assert.equal((await createAdminApi(http).dashboard()).users, 0);
    data = { ...data, users: -1 };
    await assert.rejects(() => createAdminApi(http).dashboard(), ContractError);
});
