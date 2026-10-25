import { Box, FileImage, Film, Music2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Spinner } from '@/shared/ui/primitives/spinner';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { cn } from '../../../shared/lib/cn';

const icons = { MODEL: Box, IMAGE: FileImage, AUDIO: Music2, VIDEO: Film };
export function AssetThumbnail({
    asset,
    variant = 'compact',
}: {
    asset: Asset;
    variant?: 'compact' | 'card';
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const Icon = icons[asset.type];
    const url =
        asset.thumbnailUrl ||
        (asset.type === 'IMAGE' && asset.status === 'READY' ? asset.url : null);
    return (
        <span
            className={cn(
                'asset-thumbnail grid place-items-center overflow-hidden',
                variant === 'card'
                    ? 'h-full w-full bg-surface text-muted-foreground'
                    : 'size-16 rounded-[var(--radius-md)] bg-[var(--bg-cover)] text-[var(--text-cover)] max-[540px]:row-span-2 max-[540px]:size-12',
            )}
            aria-hidden="true"
        >
            {asset.status === 'PROCESSING' ? (
                <Spinner className={variant === 'card' ? 'size-8' : 'size-6'} aria-hidden="true" />
            ) : asset.status === 'FAILED' ? (
                <TriangleAlert
                    size={variant === 'card' ? 32 : 28}
                    className="text-danger-foreground"
                    aria-hidden="true"
                />
            ) : url && url !== failedUrl ? (
                <img
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={cn(
                        'size-full min-h-0 min-w-0',
                        variant === 'card' ? 'object-contain p-3' : 'object-cover',
                    )}
                    onError={() => setFailedUrl(url)}
                />
            ) : (
                <Icon size={variant === 'card' ? 32 : 28} />
            )}
        </span>
    );
}
