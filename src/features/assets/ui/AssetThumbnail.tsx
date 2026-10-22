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
        <span className="asset-thumbnail" aria-hidden="true">
            {url && !failed ? (
                <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
            ) : (
                <Icon size={28} />
            )}
        </span>
    );
}
