import axios from 'axios';

export function createHttpClient(baseURL: string) {
    return axios.create({ baseURL, withCredentials: true, timeout: 15_000 });
}
