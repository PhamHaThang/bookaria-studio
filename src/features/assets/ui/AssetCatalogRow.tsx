import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { assetStatusLabels, assetTypeLabels } from '../model/assets';
import { AssetThumbnail } from './AssetThumbnail';

export function AssetCatalogRow({ asset, onPreview }: { asset: Asset; onPreview: () => void }) {
    return (
        <li className="border-border border-b">
            <button
                type="button"
                onClick={onPreview}
                aria-label={`Xem tài nguyên ${asset.name}`}
                className="group grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-5 rounded-md py-5 text-left outline-none transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 max-[540px]:grid-cols-[48px_minmax(0,1fr)] max-[540px]:gap-x-4 max-[540px]:gap-y-2"
            >
                <AssetThumbnail asset={asset} />
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-semibold text-base underline-offset-4 group-hover:underline">
                        {asset.name}
                    </span>
                    <span className="text-muted-foreground text-xs">
                        {assetTypeLabels[asset.type]} — {formatBytes(asset.sizeBytes)}
                    </span>
                    {asset.tags.length > 0 && (
                        <span className="flex flex-wrap gap-x-2 gap-y-1 break-words text-muted-foreground text-xs">
                            {asset.tags.slice(0, 4).map((tag) => (
                                <span key={tag}>#{tag}</span>
                            ))}
                        </span>
                    )}
                </span>
                <Badge
                    tone={
                        asset.status === 'READY'
                            ? 'success'
                            : asset.status === 'FAILED'
                              ? 'danger'
                              : 'warning'
                    }
                    className="max-[540px]:col-start-2 max-[540px]:w-fit"
                >
                    {assetStatusLabels[asset.status]}
                </Badge>
            </button>
        </li>
    );
}
