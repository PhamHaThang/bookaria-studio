import { ContractError } from '../../../shared/api/contract';
import { assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { runAssetUpload, type UploadCheckpoint } from '../../assets/model/upload';
import { blankPageImage } from './blank-page';

export interface BlankUploadCheckpoint {
    file?: File;
    upload?: UploadCheckpoint;
}
export async function uploadBlankPage({
    aspect,
    checkpoint,
    onCheckpoint,
    signal,
    onStage,
}: {
    aspect: number;
    checkpoint: BlankUploadCheckpoint;
    onCheckpoint: (checkpoint: BlankUploadCheckpoint) => void;
    signal: AbortSignal;
    onStage: (stage: string) => void;
}) {
    const file = checkpoint.file || (await blankPageImage(aspect));
    let current = { ...checkpoint, file };
    onCheckpoint(current);
    const result = await runAssetUpload({
        api: assetsApi,
        transfer: uploadFile,
        file,
        metadata: { name: 'Trang trắng', tags: [] },
        purpose: 'PAGE_IMAGE',
        signal,
        checkpoint: current.upload || null,
        onCheckpoint: (upload) => {
            current = { ...current, upload };
            onCheckpoint(current);
        },
        onStage: () => onStage('Đang chuẩn bị trang trắng…'),
        onProgress: () => undefined,
    });
    signal.throwIfAborted();
    if (result.processing || result.asset.type !== 'IMAGE' || result.asset.status !== 'READY')
        throw new ContractError();
    return result.asset.id;
}
