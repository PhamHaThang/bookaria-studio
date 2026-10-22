import { createHttpClient } from './http';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
// Auth installs its token/refresh interceptors on this instance during application startup.
export const apiClient = createHttpClient(apiBaseUrl);
