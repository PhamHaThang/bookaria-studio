import { apiClient } from '../../../shared/api/client';
import { createPagesApi } from '../api/pages-api';

export const pagesApi = createPagesApi(apiClient);
export const pageKeys = {
    all: ['pages'] as const,
    list: (userId: string, bookId: string) => ['pages', userId, 'list', bookId] as const,
    detail: (userId: string, pageId: string) => ['pages', userId, 'detail', pageId] as const,
};
export { markerWarningText, movedPageIds, uncertainWrite } from './operations';
