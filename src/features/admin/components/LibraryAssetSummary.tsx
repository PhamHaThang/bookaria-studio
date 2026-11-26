import { AssetThumbnail, assetTypeLabels } from '@/features/assets';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';

export function LibraryAssetSummary({ asset }: { asset: Asset }) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-3">
            <AssetThumbnail
                asset={asset}
                className="size-11 shrink-0 rounded-lg border border-border bg-muted text-muted-foreground max-[540px]:size-11 [&_svg]:size-5"
            />
            <span className="grid min-w-0 gap-0.5 text-left">
                <span className="truncate font-medium text-foreground text-sm">{asset.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                    {assetTypeLabels[asset.type]} · {formatBytes(asset.sizeBytes)}
                </span>
            </span>
        </span>
    );
}
