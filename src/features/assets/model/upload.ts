import { isAxiosError } from 'axios';
import type {
    CompleteAssetBody,
    UploadSignature,
} from '../../../shared/contracts/api/assets.schema';
import { ApiErrorSchema } from '../../../shared/contracts/error.schema';
import type { AssetsApi } from '../api/assets-api';
import { uploadRequest } from './form';

export type UploadStage = 'signing' | 'uploading' | 'completing';
export interface UploadCheckpoint {
    signature: UploadSignature;
    uploaded: boolean;
}
type Transfer = (
    signature: UploadSignature,
    file: File,
    signal: AbortSignal,
    progress: (percent: number) => void,
) => Promise<void>;

/** Retry uncertain completions against the same immutable upload. */
export async function runAssetUpload<Completion>({
    api,
    transfer,
    file,
    metadata,
    signal,
    checkpoint,
    onCheckpoint,
    onStage,
    onProgress,
    purpose = 'ASSET',
}: {
    api: {
        signature: AssetsApi['signature'];
        complete: (
            id: string,
            metadata: CompleteAssetBody,
            signal: AbortSignal,
        ) => Promise<Completion>;
    };
    transfer: Transfer;
    file: File;
    metadata: CompleteAssetBody;
    signal: AbortSignal;
    checkpoint: UploadCheckpoint | null;
    onCheckpoint: (checkpoint: UploadCheckpoint | null) => void;
    onStage: (stage: UploadStage) => void;
    onProgress: (percent: number) => void;
    purpose?: Parameters<typeof uploadRequest>[1];
}) {
    const request = uploadRequest(file, purpose);
    signal.throwIfAborted();
    let current = checkpoint;
    if (!current || (!current.uploaded && Date.parse(current.signature.expiresAt) <= Date.now())) {
        onStage('signing');
        current = { signature: await api.signature(request, signal), uploaded: false };
        signal.throwIfAborted();
        onCheckpoint(current);
    }
    if (!current.uploaded) {
        onStage('uploading');
        await transfer(current.signature, file, signal, onProgress);
        signal.throwIfAborted();
        current = { ...current, uploaded: true };
        onCheckpoint(current);
    }
    signal.throwIfAborted();
    onStage('completing');
    try {
        return await api.complete(current.signature.assetId, metadata, signal);
    } catch (error) {
        if (!isAxiosError(error)) throw error;
        const response = ApiErrorSchema.safeParse(error.response?.data);
        if (
            response.success &&
            ['QUOTA_EXCEEDED', 'FILE_TOO_LARGE', 'FILE_TYPE_NOT_ALLOWED', 'NOT_FOUND'].includes(
                response.data.error.code,
            )
        ) {
            onCheckpoint(null);
        }
        throw error;
    }
}
