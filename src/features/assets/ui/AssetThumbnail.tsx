import { Box, FileImage, Film, Music2 } from 'lucide-react';
import { useState } from 'react';
import type { Asset } from '../../../shared/contracts/dto.schema';

const icons = { MODEL: Box, IMAGE: FileImage, AUDIO: Music2, VIDEO: Film };
export function AssetThumbnail({ asset }: { asset: Asset }) {
    const [failed, setFailed] = useState(false);
    const Icon = icons[asset.type];
    const url =
        asset.thumbnailUrl ||
        (asset.type === 'IMAGE' && asset.status === 'READY' ? asset.url : null);
    return (
        <span
            className="asset-thumbnail grid size-16 overflow-hidden rounded-[var(--radius-md)] bg-[var(--bg-cover)] text-[var(--text-cover)] [place-items:center] max-[540px]:row-[span_2] max-[540px]:size-12 [&_img]:size-full [&_img]:object-cover [.scene-asset-picker_&]:h-[135px] [.scene-asset-picker_&]:w-full [.scene-asset-picker_&]:grid-cols-[minmax(0,_1fr)] [.scene-asset-picker_&]:grid-rows-[minmax(0,_1fr)] [.scene-asset-picker_&]:rounded-[10px] [.scene-asset-picker_&_img]:h-[135px] [.scene-asset-picker_&_img]:max-h-full [.scene-asset-picker_&_img]:min-h-0 [.scene-asset-picker_&_img]:min-w-0 [.scene-asset-picker_&_img]:object-contain [.scene-picker-list_&]:shrink-0 max-[600px]:[.scene-picker-list_&]:hidden"
            aria-hidden="true"
        >
            {url && !failed ? (
                <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <Icon size={28} />
            )}
        </span>
    );
}
