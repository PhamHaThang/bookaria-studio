import { ContractError } from '../../../shared/api/contract';
import { checkUploadRequest } from '../../../shared/contracts/api/assets.schema';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { uploadRequest } from './form';
import { runAssetUpload } from './upload';

export type ImagePurpose = 'ASSET' | 'AVATAR';
export function imageUploadRequest(
    file: Pick<File, 'name' | 'type' | 'size'>,
    purpose: ImagePurpose,
) {
    const request = uploadRequest(file);
    const check = checkUploadRequest(request);
    if (!check.ok || check.assetType !== 'IMAGE')
        throw new Error('Hãy chọn ảnh JPG, PNG hoặc WebP.');
    return uploadRequest(file, purpose);
}

export async function saveUploadedImage({
    readyAsset,
    onReady,
    save,
    onSaving,
    ...upload
}: Parameters<typeof runAssetUpload>[0] & {
    purpose: ImagePurpose;
    readyAsset: Asset | null;
    onReady: (asset: Asset) => void;
    save: (assetId: string) => Promise<void>;
    onSaving: () => void;
}) {
    imageUploadRequest(upload.file, upload.purpose);
    upload.signal.throwIfAborted();
    let asset = readyAsset;
    if (!asset) {
        const result = await runAssetUpload(upload);
        upload.signal.throwIfAborted();
        if (result.processing || result.asset.type !== 'IMAGE' || result.asset.status !== 'READY')
            throw new ContractError();
        asset = result.asset;
        onReady(asset);
    }
    upload.signal.throwIfAborted();
    onSaving();
    await save(asset.id);
}
