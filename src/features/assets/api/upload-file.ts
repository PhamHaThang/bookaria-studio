import axios from 'axios';
import type { UploadSignature } from '../../../shared/contracts/api/assets.schema';

// R2 uploads never receive Studio credentials or API cookies.
type UploadTarget = Pick<UploadSignature, 'uploadUrl' | 'method' | 'headers'>;
const uploadHttp = axios.create({ withCredentials: false, timeout: 300_000 });

export async function uploadFile(
    signature: UploadTarget,
    file: File,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
) {
    const url = new URL(signature.uploadUrl);
    if (
        url.protocol !== 'https:' ||
        !/^[a-z0-9]+(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(url.hostname) ||
        url.port ||
        url.username ||
        url.password ||
        signature.method !== 'PUT'
    )
        throw new Error('Địa chỉ tải tệp không hợp lệ. Vui lòng liên hệ nhóm hỗ trợ.');
    const allowed = new Set([
        'content-type',
        'if-none-match',
        'x-amz-meta-format',
        'cache-control',
    ]);
    for (const [key, value] of Object.entries(signature.headers)) {
        if (!allowed.has(key.toLowerCase()) || typeof value !== 'string')
            throw new Error('Tham số tải tệp chưa hợp lệ. Vui lòng thử lại.');
    }
    try {
        await uploadHttp.put(url.href, file, {
            signal,
            headers: signature.headers,
            onUploadProgress: ({ loaded, total }) => {
                if (total) onProgress(Math.min(100, Math.round((loaded * 100) / total)));
            },
        });
    } catch (error) {
        if (signal.aborted || axios.isCancel(error)) throw error;
        // A retry after a lost response may find the immutable object already uploaded.
        if (axios.isAxiosError(error) && error.response?.status === 412) return;
        throw new Error('Chưa tải được tệp. Kiểm tra kết nối rồi bấm Thử lại.');
    }
}
