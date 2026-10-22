import axios from 'axios';
import type { UploadSignature } from '../../../shared/contracts/api/assets.schema';

// A separate transport: never attach the Studio bearer token or API cookies to Cloudinary.
const uploadHttp = axios.create({ withCredentials: false, timeout: 300_000 });

export function uploadFormData(signature: UploadSignature, file: File) {
    const form = new FormData();
    for (const [key, value] of Object.entries(signature.fields)) {
        if (typeof value !== 'string' && typeof value !== 'number') {
            throw new Error('Tham số tải tệp chưa hợp lệ. Vui lòng thử lại.');
        }
        form.set(key, String(value));
    }
    form.set('file', file);
    return form;
}

export async function uploadFile(
    signature: UploadSignature,
    file: File,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
) {
    const url = new URL(signature.uploadUrl);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'api.cloudinary.com' ||
        url.port ||
        url.username ||
        url.password
    ) {
        throw new Error('Địa chỉ tải tệp không hợp lệ. Vui lòng liên hệ nhóm hỗ trợ.');
    }
    try {
        await uploadHttp.post(url.href, uploadFormData(signature, file), {
            signal,
            headers: { Authorization: undefined },
            onUploadProgress: ({ loaded, total }) => {
                if (total) onProgress(Math.min(100, Math.round((loaded * 100) / total)));
            },
        });
    } catch (error) {
        if (signal.aborted || axios.isCancel(error)) throw error;
        throw new Error('Chưa tải được tệp. Kiểm tra kết nối rồi bấm Thử lại.');
    }
}
