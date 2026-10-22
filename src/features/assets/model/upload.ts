import type {
    CompleteAssetBody,
    UploadSignature,
} from '../../../shared/contracts/api/assets.schema';
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

/** Keep the checkpoint in memory so a failed complete request never re-uploads the file. */
export async function runAssetUpload({
    api,
    transfer,
    file,
    metadata,
    signal,
    checkpoint,
    onCheckpoint,
    onStage,
    onProgress,
}: {
    api: Pick<AssetsApi, 'signature' | 'complete'>;
    transfer: Transfer;
    file: File;
    metadata: CompleteAssetBody;
    signal: AbortSignal;
    checkpoint: UploadCheckpoint | null;
    onCheckpoint: (checkpoint: UploadCheckpoint) => void;
    onStage: (stage: UploadStage) => void;
    onProgress: (percent: number) => void;
}) {
    const request = uploadRequest(file);
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
    return api.complete(current.signature.assetId, metadata, signal);
}
