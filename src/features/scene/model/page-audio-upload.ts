import { ContractError } from '@/shared/api/contract';
import { checkUploadRequest } from '@/shared/contracts/api/assets.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import type { AssetsApi } from '../../assets/api/assets-api';
import { uploadRequest } from '../../assets/model/form';
import { runAssetUpload, type UploadCheckpoint } from '../../assets/model/upload';

export type PageAudioKey = 'backgroundAudioAssetId' | 'narrationAssetId';
export type PageAudioUpload = {
    checkpoint: UploadCheckpoint | null;
    assetId?: string;
    ready?: Asset;
};

export function pageAudioRequest(file: Pick<File, 'name' | 'type' | 'size'>) {
    const request = uploadRequest(file);
    const check = checkUploadRequest(request);
    if (!check.ok || check.assetType !== 'AUDIO')
        throw new Error('Hãy chọn tệp âm thanh MP3 hoặc WAV.');
    return request;
}

function pause(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, 1000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
    });
}

/** Keep completed uploads and processing identities when saving page settings fails. */
export async function uploadPageAudio({
    state,
    onProcessing,
    ...options
}: Omit<Parameters<typeof runAssetUpload>[0], 'checkpoint' | 'onCheckpoint' | 'purpose'> & {
    api: Pick<AssetsApi, 'signature' | 'complete' | 'detail'>;
    state: PageAudioUpload;
    onProcessing: () => void;
}) {
    pageAudioRequest(options.file);
    const { signal } = options;
    signal.throwIfAborted();
    if (state.ready) return state.ready;
    if (!state.assetId) {
        const result = await runAssetUpload({
            ...options,
            checkpoint: state.checkpoint,
            onCheckpoint: (value) => {
                state.checkpoint = value;
            },
        });
        signal.throwIfAborted();
        if (result.asset.type !== 'AUDIO') throw new ContractError();
        state.assetId = result.asset.id;
        if (!result.processing && result.asset.status === 'READY') {
            state.ready = result.asset;
            return result.asset;
        }
    }
    onProcessing();
    const deadline = Date.now() + 90_000;
    while (true) {
        signal.throwIfAborted();
        const asset = await options.api.detail(state.assetId, signal);
        signal.throwIfAborted();
        if (asset.id !== state.assetId || asset.type !== 'AUDIO') throw new ContractError();
        if (asset.status === 'READY') {
            state.ready = asset;
            return asset;
        }
        if (asset.status === 'FAILED')
            throw new Error('Không xử lý được âm thanh. Hãy đổi tệp rồi lưu lại.');
        if (Date.now() >= deadline)
            throw new Error('Âm thanh vẫn đang xử lý. Vui lòng chờ một chút rồi bấm Lưu lại.');
        await pause(signal);
    }
}
