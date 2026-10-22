import {
    checkUploadRequest,
    type UploadSignature,
} from '../../../shared/contracts/api/assets.schema';
import type { AssetsApi } from '../../assets/api/assets-api';

export interface MindCheckpoint {
    source: string;
    file: File;
    signature: UploadSignature | null;
    uploaded: boolean;
}
export async function prepareMarkerUpload({
    source,
    signal,
    checkpoint,
    onCheckpoint,
    compile,
    api,
    transfer,
    onProgress,
    onStage,
}: {
    source: string;
    signal: AbortSignal;
    checkpoint: MindCheckpoint | null;
    onCheckpoint: (value: MindCheckpoint) => void;
    compile: (
        source: string,
        signal: AbortSignal,
        progress: (value: number) => void,
    ) => Promise<File>;
    api: Pick<AssetsApi, 'signature'>;
    transfer: (
        signature: UploadSignature,
        file: File,
        signal: AbortSignal,
        progress: (value: number) => void,
    ) => Promise<void>;
    onProgress: (value: number) => void;
    onStage: (stage: 'compiling' | 'uploading-marker') => void;
}) {
    signal.throwIfAborted();
    let current = checkpoint?.source === source ? checkpoint : null;
    if (!current) {
        onStage('compiling');
        const file = await compile(source, signal, onProgress);
        signal.throwIfAborted();
        current = { source, file, signature: null, uploaded: false };
        onCheckpoint(current);
    }
    const request = {
        purpose: 'MARKER_MIND' as const,
        fileName: current.file.name,
        mimeType: current.file.type,
        sizeBytes: current.file.size,
    };
    if (!current.file.size || !checkUploadRequest(request).ok)
        throw new Error('Dữ liệu nhận diện vượt giới hạn 5 MB hoặc không hợp lệ.');
    if (!current.uploaded) {
        onStage('uploading-marker');
        if (!current.signature || Date.parse(current.signature.expiresAt) <= Date.now()) {
            current = { ...current, signature: await api.signature(request, signal) };
            onCheckpoint(current);
        }
        signal.throwIfAborted();
        if (!current.signature) throw new Error('Chưa cấp được quyền tải dữ liệu nhận diện.');
        await transfer(current.signature, current.file, signal, onProgress);
        signal.throwIfAborted();
        current = { ...current, uploaded: true };
        onCheckpoint(current);
    }
    // A .mind is not an Asset: there is deliberately no /complete request.
    const publicId = current.signature?.fields.public_id;
    if (typeof publicId !== 'string' || !publicId.endsWith('.mind'))
        throw new Error('Mã dữ liệu nhận diện chưa hợp lệ.');
    return publicId;
}
