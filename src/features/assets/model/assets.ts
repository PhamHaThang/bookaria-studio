import { apiClient } from '../../../shared/api/client';
import { createAssetsApi } from '../api/assets-api';

export const assetsApi = createAssetsApi(apiClient);
export const assetKeys = {
    all: ['assets'] as const,
    lists: (userId: string) => ['assets', userId, 'list'] as const,
    list: (userId: string, query: object) => ['assets', userId, 'list', query] as const,
    detail: (userId: string, id: string) => ['assets', userId, 'detail', id] as const,
    usages: (userId: string, id: string) => ['assets', userId, 'usages', id] as const,
    categories: (userId: string) => ['assets', userId, 'categories'] as const,
};
export const assetTypeLabels = {
    MODEL: 'Mô hình 3D',
    IMAGE: 'Hình ảnh',
    AUDIO: 'Âm thanh',
    VIDEO: 'Video',
};
export const assetStatusLabels = {
    PROCESSING: 'Đang xử lý',
    READY: 'Sẵn sàng',
    FAILED: 'Xử lý thất bại',
};
