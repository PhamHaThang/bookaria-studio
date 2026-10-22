import { apiClient } from '../../../shared/api/client';
import { createBooksApi } from '../api/books-api';

export const booksApi = createBooksApi(apiClient);
export const bookKeys = {
    all: ['books'] as const,
    list: (userId: string, view: string, query: object) => ['books', userId, view, query] as const,
    detail: (userId: string, id: string) => ['books', userId, 'detail', id] as const,
};
