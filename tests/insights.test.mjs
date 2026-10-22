import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createNotificationsApi, notificationTarget } from '../src/features/notifications/api.ts';
import { readNotificationSearch } from '../src/features/notifications/model.ts';
import { createStatsApi } from '../src/features/stats/api.ts';
import { readStatsRange } from '../src/features/stats/model.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const stats = {
    range: '7d',
    totals: { opens: 0, sessions: 0, taps: 0, scanTimeouts: 0 },
    opensByDay: [{ date: '2026-10-23', opens: 0 }],
    byPage: [],
    byDevice: [],
};
const item = {
    id,
    type: 'JOB_SUCCEEDED',
    title: 'Tác vụ hoàn tất',
    body: null,
    link: `/books/${id}`,
    readAt: null,
    createdAt: '2026-10-23T00:00:00.000Z',
};
const response = (config, data, status = 200) => ({
    config,
    data,
    status,
    statusText: 'OK',
    headers: {},
});

test('stats forwards book id, range and cancellation and validates zero-valued data', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return response(config, { data: stats });
        },
    });
    const signal = new AbortController().signal;
    assert.equal((await createStatsApi(http).book(id, { range: '7d' }, signal)).totals.sessions, 0);
    assert.equal(calls[0].url, `/books/${id}/stats`);
    assert.equal(calls[0].params.range, '7d');
    assert.equal(calls[0].signal, signal);
    await assert.rejects(() => createStatsApi(http).book('../another-user', { range: '7d' }));
    await assert.rejects(() => createStatsApi(http).book(id, { range: '365d' }));
    assert.equal(calls.length, 1);
});
test('stats refuses a valid response for the wrong period and malformed counters', async () => {
    let data = stats;
    const http = axios.create({ adapter: async (config) => response(config, { data }) });
    await assert.rejects(() => createStatsApi(http).book(id, { range: '30d' }), ContractError);
    data = { ...stats, totals: { ...stats.totals, opens: -1 } };
    await assert.rejects(() => createStatsApi(http).book(id, { range: '7d' }), ContractError);
});
test('stats range survives URL state and defaults unsupported values to30days', () => {
    assert.equal(readStatsRange(new URLSearchParams()), '30d');
    assert.equal(readStatsRange(new URLSearchParams('range=90d')), '90d');
    assert.equal(readStatsRange(new URLSearchParams('range=7d')), '7d');
    assert.equal(readStatsRange(new URLSearchParams('range=all')), '30d');
});
test('notifications parses string boolean input once and preserves pagination and AbortSignal', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return response(config, {
                data: [item],
                meta: { page: 2, limit: 12, total: 13, totalPages: 2 },
            });
        },
    });
    const signal = new AbortController().signal;
    const api = createNotificationsApi(http);
    const query = readNotificationSearch(new URLSearchParams('unread=true&page=2'));
    assert.equal((await api.list(query, signal)).data[0].readAt, null);
    assert.equal(calls[0].params.unread, true);
    assert.equal(calls[0].params.page, 2);
    assert.equal(calls[0].signal, signal);
    await api.list({ page: 1, unread: 'false' });
    assert.equal(calls[1].params.unread, false);
    assert.equal(readNotificationSearch(new URLSearchParams('page=-2&unread=oops')).page, 1);
    assert.equal(readNotificationSearch(new URLSearchParams('unread=oops')).unread, undefined);
});
test('mark-read validates ids and all scope, requires204 and does not retry on uncertain failure', async () => {
    const calls = [];
    let status = 204;
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return response(config, null, status);
        },
    });
    const api = createNotificationsApi(http);
    await api.read({ ids: [id] });
    assert.deepEqual(JSON.parse(calls[0].data), { ids: [id] });
    await api.read({ all: true });
    assert.deepEqual(JSON.parse(calls[1].data), { all: true });
    await assert.rejects(() => api.read({ ids: [] }));
    await assert.rejects(() => api.read({ all: false }));
    assert.equal(calls.length, 2);
    status = 200;
    await assert.rejects(() => api.read({ ids: [id] }), ContractError);
    let failures = 0;
    http.defaults.adapter = async () => {
        failures++;
        throw Error('response lost');
    };
    await assert.rejects(() => api.read({ all: true }));
    assert.equal(failures, 1);
});
test('notification links only open recognized Studio routes and reject external/script/encoded redirects', () => {
    for (const link of [
        `/books/${id}`,
        `/books/${id}/stats`,
        `/books/${id}/pages/${id}`,
        `/assets/${id}`,
        '/profile',
        '/notifications',
    ])
        assert.equal(notificationTarget(link), link);
    for (const link of [
        null,
        'javascript:alert(1)',
        'https://evil.example/books',
        '//evil.example',
        '/\\evil.example',
        '/books/../../login',
        `/books/${id}?next=https://evil.example`,
        `/books/${id}%2f..`,
        `/books/${id}\n`,
        '/admin/users',
    ])
        assert.equal(notificationTarget(link), null);
});
test('notification response validation rejects unknown types and broken envelopes', async () => {
    const http = axios.create({
        adapter: async (config) =>
            response(config, {
                data: [{ ...item, type: 'UNKNOWN' }],
                meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
            }),
    });
    await assert.rejects(() => createNotificationsApi(http).list({}), ContractError);
});
