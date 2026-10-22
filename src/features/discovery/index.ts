import { createDiscoveryApi, createDiscoveryHttp } from './api';

// Public reads never install Studio's token/refresh interceptors or send cookies.
const http = createDiscoveryHttp(import.meta.env.VITE_API_BASE_URL || '/api/v1');
export const discoveryApi = createDiscoveryApi(http);
