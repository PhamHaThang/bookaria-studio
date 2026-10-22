import axios, { type AxiosInstance } from 'axios';
import { expectStatus, readData, readPage } from '../../shared/api/contract';
import {
    AuthorProfileSchema,
    PublicBookCardSchema,
    type PublicBooksQuery,
    PublicBooksQuerySchema,
} from '../../shared/contracts/api/public.schema';
import { HttpUrlSchema, IdSchema, SlugSchema } from '../../shared/contracts/common.schema';

export function createDiscoveryHttp(baseURL: string) {
    // XHR always includes same-origin cookies; the fetch adapter maps false to omit.
    return axios.create({
        baseURL,
        adapter: 'fetch',
        withCredentials: false,
        withXSRFToken: false,
        timeout: 15000,
    });
}

export function createDiscoveryApi(http: AxiosInstance) {
    return {
        async books(query: PublicBooksQuery, signal?: AbortSignal) {
            const response = await http.get('/public/books', {
                params: PublicBooksQuerySchema.parse(query),
                signal,
            });
            expectStatus(response, 200);
            return readPage(response, PublicBookCardSchema);
        },
        async author(id: string, signal?: AbortSignal) {
            const response = await http.get(`/public/authors/${IdSchema.parse(id)}`, { signal });
            expectStatus(response, 200);
            return readData(response, AuthorProfileSchema);
        },
    };
}

export function publishedReaderUrl(slug: string) {
    const origin = new URL(
        HttpUrlSchema.parse(import.meta.env?.VITE_VIEWER_ORIGIN || 'https://viewer.localhost:5174'),
    );
    return new URL(`/b/${SlugSchema.parse(slug)}`, origin.origin).href;
}
