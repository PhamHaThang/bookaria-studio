import {
    CompleteAssetBodySchema,
    checkUploadRequest,
    UpdateAssetBodySchema,
    UploadSignatureBodySchema,
} from '../../../shared/contracts/api/assets.schema';
import { formatBytes } from '../../../shared/lib/format';

const fallbackMime: Record<string, string> = {
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
};
export function uploadRequest(
    file: Pick<File, 'name' | 'type' | 'size'>,
    purpose: 'ASSET' | 'AVATAR' = 'ASSET',
) {
    if (file.size === 0) throw new Error('Tệp trống. Hãy chọn tệp có nội dung.');
    const mimeType =
        file.type || fallbackMime[file.name.split('.').pop()?.toLowerCase() || ''] || '';
    const body = UploadSignatureBodySchema.parse({
        purpose,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
    });
    const check = checkUploadRequest(body);
    if (!check.ok)
        throw new Error(
            check.code === 'FILE_TOO_LARGE'
                ? `Tệp vượt giới hạn ${formatBytes(check.maxBytes || 0)} cho loại tài nguyên này.`
                : 'Chọn GLB/GLTF, JPG/PNG/WebP, MP3/WAV hoặc MP4.',
        );
    return body;
}
export function parseTags(value: string) {
    return [
        ...new Set(
            value
                .split(',')
                .map((tag) => tag.trim().toLowerCase())
                .filter(Boolean),
        ),
    ];
}
export function completeAssetForm(form: FormData) {
    return CompleteAssetBodySchema.parse({
        name: String(form.get('name') || '').trim() || undefined,
        tags: parseTags(String(form.get('tags') || '')),
    });
}
export function updateAssetForm(form: FormData) {
    return UpdateAssetBodySchema.parse({
        name: String(form.get('name') || '').trim(),
        tags: parseTags(String(form.get('tags') || '')),
        sourceUrl: String(form.get('sourceUrl') || '').trim() || null,
        license: String(form.get('license') || '').trim() || null,
        authorName: String(form.get('authorName') || '').trim() || null,
    });
}
