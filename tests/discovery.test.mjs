import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import {
    createDiscoveryApi,
    createDiscoveryHttp,
    publishedReaderUrl,
} from '../src/features/discovery/api.ts';
import { readDiscoverySearch, updateDiscoverySearch } from '../src/features/discovery/search.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const card = {
    slug: 'public-book',
    title: 'Sách thật',
    author: { id, displayName: 'An' },
    coverUrl: null,
    language: 'vi',
    ageMin: 0,
    ageMax: null,
    arPageCount: 2,
};

test('discovery search keeps age zero, ignores invalid parameters and bounds text', () => {
    assert.equal(readDiscoverySearch(new URLSearchParams('age=0')).age, 0);
    const query = readDiscoverySearch(
        new URLSearchParams({
            page: '-1',
            age: '19',
            language: 'javascript:',
            sort: 'title',
            q: 'x'.repeat(200),
        }),
    );
    assert.equal(query.page, 1);
    assert.equal(query.age, undefined);
    assert.equal(query.language, undefined);
    assert.equal(query.sort, 'newest');
    assert.equal(query.q.length, 100);
    assert.equal(
        readDiscoverySearch(new URLSearchParams('language=en-US&page=2')).language,
        'en-US',
    );
});
test('changing filters resets pagination while Back/Forward URL state remains serializable', () => {
    const before = new URLSearchParams('page=4&q=cat&sort=popular');
    const after = updateDiscoverySearch(before, { age: '0', q: '' });
    assert.equal(before.get('page'), '4');
    assert.equal(after.has('page'), false);
    assert.equal(after.has('q'), false);
    assert.equal(after.get('age'), '0');
    assert.equal(after.get('sort'), 'popular');
    assert.equal(updateDiscoverySearch(after, { page: '2' }).get('page'), '2');
});
test('discovery API validates both cards and author response and forwards cancellation', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return {
                config,
                status: 200,
                statusText: 'OK',
                headers: {},
                data: config.url.includes('/authors/')
                    ? {
                          data: {
                              author: {
                                  id,
                                  displayName: 'An',
                                  organization: null,
                                  bio: null,
                                  avatarUrl: null,
                              },
                              books: [card],
                          },
                      }
                    : { data: [card], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } },
            };
        },
    });
    const api = createDiscoveryApi(http),
        signal = new AbortController().signal;
    assert.equal(
        (await api.books(readDiscoverySearch(new URLSearchParams('age=0')), signal)).data[0].ageMin,
        0,
    );
    assert.equal(calls[0].signal, signal);
    assert.equal(calls[0].params.age, 0);
    assert.equal((await api.author(id, signal)).author.displayName, 'An');
    await assert.rejects(() => api.author('../me'));
});
test('discovery rejects unsafe URLs and invalid response envelopes', async () => {
    const http = axios.create({
        adapter: async (config) => ({
            config,
            status: 200,
            statusText: 'OK',
            headers: {},
            data: {
                data: [{ ...card, coverUrl: 'javascript:alert(1)' }],
                meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
            },
        }),
    });
    await assert.rejects(
        () => createDiscoveryApi(http).books(readDiscoverySearch(new URLSearchParams())),
        ContractError,
    );
    assert.equal(publishedReaderUrl('public-book'), 'https://viewer.localhost:5174/b/public-book');
    assert.throws(() => publishedReaderUrl('../private'));
});

test('public production transport omits same-origin credentials and XSRF headers', async () => {
    const requests = [];
    const http = createDiscoveryHttp('https://example.com/api/v1');
    http.defaults.env.fetch = async (input) => {
        requests.push(input);
        return Response.json({ data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } });
    };
    await createDiscoveryApi(http).books(readDiscoverySearch(new URLSearchParams()));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].credentials, 'omit');
    assert.equal(requests[0].headers.get('Authorization'), null);
    assert.equal(requests[0].headers.get('X-XSRF-TOKEN'), null);
    assert.equal(http.defaults.withXSRFToken, false);
});
