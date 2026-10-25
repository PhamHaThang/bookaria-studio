import { checkUploadRequest } from '../../../shared/contracts/api/assets.schema';
import type { AssetType } from '../../../shared/contracts/enums.schema';
import { uploadRequest } from '../../assets/model/form';

export const importAccept: Record<AssetType, string> = {
    MODEL: '.glb,.gltf',
    IMAGE: '.jpg,.jpeg,.png,.webp',
    AUDIO: '.mp3,.wav',
    VIDEO: '.mp4',
};
export const importHint: Record<AssetType, string> = {
    MODEL: 'GLB hoặc GLTF nhúng đầy đủ texture · tối đa 10 MB',
    IMAGE: 'JPG, PNG hoặc WebP · tối đa 10 MB',
    AUDIO: 'MP3 hoặc WAV · tối đa 100 MB',
    VIDEO: 'MP4 · tối đa 100 MB',
};
export function validateImport(file: Pick<File, 'name' | 'type' | 'size'>, type: AssetType) {
    const check = checkUploadRequest(uploadRequest(file));
    if (!check.ok || check.assetType !== type)
        throw new Error('Loại tệp không phù hợp. Hãy chọn đúng định dạng được hướng dẫn.');
}

/** A single-file upload cannot resolve sidecar buffers or textures. Fail before transfer. */
export function readModelDocument(data: ArrayBuffer) {
    let json: string;
    const view = new DataView(data);
    if (data.byteLength >= 4 && view.getUint32(0, true) === 0x46546c67) {
        if (
            data.byteLength < 20 ||
            view.getUint32(4, true) !== 2 ||
            view.getUint32(8, true) !== data.byteLength
        )
            throw new Error('Tệp GLB không hợp lệ. Hãy xuất lại mô hình theo glTF 2.0.');
        const length = view.getUint32(12, true);
        if (view.getUint32(16, true) !== 0x4e4f534a || length > data.byteLength - 20)
            throw new Error('Không đọc được nội dung GLB. Hãy chọn lại tệp.');
        json = new TextDecoder().decode(data.slice(20, 20 + length));
    } else json = new TextDecoder().decode(data);
    let document: {
        asset?: { version?: string };
        buffers?: { uri?: string }[];
        images?: { uri?: string }[];
    };
    try {
        document = JSON.parse(json);
    } catch {
        throw new Error('Không đọc được mô hình. Hãy chọn GLB hoặc GLTF hợp lệ.');
    }
    if (!document || typeof document !== 'object' || document.asset?.version !== '2.0')
        throw new Error('Chỉ hỗ trợ mô hình glTF 2.0. Hãy xuất lại tệp GLB.');
    for (const resources of [document.buffers, document.images]) {
        if (resources !== undefined && !Array.isArray(resources))
            throw new Error('Dữ liệu mô hình không hợp lệ.');
        if (
            resources?.some(
                (resource) =>
                    !resource ||
                    (resource.uri !== undefined &&
                        (typeof resource.uri !== 'string' || !resource.uri.startsWith('data:'))),
            )
        )
            throw new Error(
                'Mô hình đang dùng tệp texture hoặc dữ liệu bên ngoài. Hãy xuất thành một tệp GLB hoặc GLTF nhúng đầy đủ dữ liệu.',
            );
    }
    return document;
}
