import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { createDiscoveryApi, createDiscoveryHttp } from '../src/features/discovery/api.ts';
import {
    publicBookAgeLabel,
    publicBookInfoLocation,
    publicBookInfoUrl,
    withoutPublicBookInfo,
} from '../src/features/discovery/public-book-info.ts';
import { readDiscoverySearch } from '../src/features/discovery/search.ts';
import { ContractError } from '../src/shared/api/contract.ts';

const id = '11111111-1111-4111-8111-111111111111';
const book = {
    slug: 'public-book',
    title: 'Khám phá cùng Bookaria',
    description: 'Sách tương tác.',
    author: { id, displayName: 'An' },
    coverUrl: null,
    language: 'vi',
    ageMin: 0,
    ageMax: 8,
    version: { id, versionNo: 1, publishedAt: '2026-11-03T00:00:00Z' },
    manifestUrl: 'https://example.com/manifest.json',
    pageCount: 10,
    arPageCount: 4,
    downloadBytes: 1200,
    printPdfUrl: null,
};

test('book detail overlay preserves discovery filters, pagination and hash for closing and Back', () => {
    const location = {
        pathname: '/library',
        search: '?q=cat&age=0&page=3&sort=popular',
        hash: '#books',
    };
    const detail = publicBookInfoLocation(location, book.slug);
    assert.equal(new URLSearchParams(detail.search).get('book'), book.slug);
    assert.deepEqual(
        readDiscoverySearch(new URLSearchParams(detail.search)),
        readDiscoverySearch(new URLSearchParams(location.search)),
    );
    assert.equal(withoutPublicBookInfo(detail), '/library?q=cat&age=0&page=3&sort=popular#books');
    assert.equal(location.search, '?q=cat&age=0&page=3&sort=popular');
    assert.equal(
        publicBookInfoLocation({ pathname: `/authors/${id}`, search: '', hash: '' }, book.slug)
            .pathname,
        `/authors/${id}`,
    );
    assert.equal(
        publicBookInfoUrl('https://studio.example.com', book.slug),
        'https://studio.example.com/library?book=public-book',
    );
    assert.throws(() => publicBookInfoLocation(location, '../private'));
    assert.throws(() => publicBookInfoUrl('https://studio.example.com', 'javascript:alert(1)'));
});

test('public book detail validates the response, forwards cancellation and never downloads content', async () => {
    const calls = [];
    const http = axios.create({
        adapter: async (config) => {
            calls.push(config);
            return { config, status: 200, statusText: 'OK', headers: {}, data: { data: book } };
        },
    });
    const api = createDiscoveryApi(http),
        signal = new AbortController().signal;
    assert.deepEqual(await api.book(book.slug, signal), book);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/public/books/public-book');
    assert.equal(calls[0].signal, signal);
    await assert.rejects(() => api.book('../private'));
    assert.equal(calls.length, 1);
});

test('book detail rejects invalid metadata and unsafe content URLs', async () => {
    for (const invalid of [
        { ...book, manifestUrl: 'javascript:alert(1)' },
        { ...book, description: 42 },
        { ...book, pageCount: -1 },
    ]) {
        const http = axios.create({
            adapter: async (config) => ({
                config,
                status: 200,
                statusText: 'OK',
                headers: {},
                data: { data: invalid },
            }),
        });
        await assert.rejects(() => createDiscoveryApi(http).book(book.slug), ContractError);
    }
});

test('public book detail transport stays anonymous for signed-in visitors too', async () => {
    const requests = [],
        http = createDiscoveryHttp('https://example.com/api/v1');
    http.defaults.env.fetch = async (input) => {
        requests.push(input);
        return Response.json({ data: book });
    };
    await createDiscoveryApi(http).book(book.slug);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].credentials, 'omit');
    assert.equal(requests[0].headers.get('Authorization'), null);
    assert.equal(requests[0].headers.get('X-XSRF-TOKEN'), null);
});

test('age labels distinguish missing limits and preserve age zero', () => {
    assert.equal(publicBookAgeLabel({ ageMin: 0, ageMax: 8 }), '0–8 tuổi');
    assert.equal(publicBookAgeLabel({ ageMin: 0, ageMax: null }), 'Từ 0 tuổi');
    assert.equal(publicBookAgeLabel({ ageMin: null, ageMax: 8 }), 'Đến 8 tuổi');
    assert.equal(publicBookAgeLabel({ ageMin: 8, ageMax: 8 }), '8 tuổi');
    assert.equal(publicBookAgeLabel({ ageMin: null, ageMax: null }), 'Chưa ghi độ tuổi');
});
