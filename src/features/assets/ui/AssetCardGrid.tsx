import { ArrowUpRight, Clapperboard } from 'lucide-react';
import type { Asset } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import {
    Card,
    CardAction,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { assetStatusLabels, assetTypeLabels } from '../model/assets';
import { assetDuration } from './AssetPreviewMedia';
import { AssetThumbnail } from './AssetThumbnail';

const gridClass = 'grid list-none grid-cols-2 gap-3 p-0 sm:gap-5 md:grid-cols-3 xl:grid-cols-4';
const studioGridClass =
    'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,205px),1fr))] gap-4 p-0';
const previewClass = 'relative block aspect-[1.45] overflow-hidden bg-muted';
const cardClass = 'h-full gap-0 py-0';

export function AssetCardGrid({
    assets,
    busy,
    onPreview,
    scope = 'library',
}: {
    assets: Asset[];
    busy: boolean;
    onPreview: (asset: Asset) => void;
    scope?: 'mine' | 'library';
}) {
    const personal = scope === 'mine';
    return (
        <ul
            className={personal ? studioGridClass : gridClass}
            aria-label={personal ? 'Tài nguyên của tôi' : 'Tài nguyên trong thư viện'}
            aria-busy={busy}
        >
            {assets.map((asset) => (
                <li key={asset.id} className="min-w-0">
                    <Card
                        size="sm"
                        className={cn(
                            cardClass,
                            'group/asset relative focus-within:border-input hover:border-input motion-safe:transition-colors motion-safe:duration-200',
                        )}
                    >
                        <div className={previewClass}>
                            <AssetThumbnail
                                asset={asset}
                                variant="card"
                                className="bg-muted motion-safe:[&_img]:transition-transform motion-safe:[&_img]:duration-200 motion-safe:group-hover/asset:[&_img]:scale-[1.04] motion-safe:group-focus-within/asset:[&_img]:scale-[1.04]"
                            />
                            {(personal || asset.status !== 'READY') && (
                                <Badge
                                    className={cn(
                                        'absolute top-2',
                                        personal ? 'right-2' : 'left-2',
                                    )}
                                    tone={
                                        asset.status === 'READY'
                                            ? 'success'
                                            : asset.status === 'FAILED'
                                              ? 'danger'
                                              : 'warning'
                                    }
                                >
                                    {assetStatusLabels[asset.status]}
                                </Badge>
                            )}
                            {asset.status === 'READY' && asset.meta.durationSec !== undefined && (
                                <Badge className="absolute right-2 bottom-2 bg-surface tabular-nums">
                                    {assetDuration(asset.meta.durationSec)}
                                </Badge>
                            )}
                        </div>
                        <CardHeader className="min-w-0 py-3 sm:px-4 sm:py-4">
                            <CardTitle className="min-w-0" asChild>
                                <h2 className="m-0">
                                    <button
                                        type="button"
                                        onClick={() => onPreview(asset)}
                                        aria-label={`Xem tài nguyên ${asset.name}`}
                                        aria-haspopup="dialog"
                                        className="block w-full truncate text-left outline-none after:absolute after:inset-0 focus-visible:after:rounded-[var(--radius-card)] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                                    >
                                        {asset.name}
                                    </button>
                                </h2>
                            </CardTitle>
                            <CardAction aria-hidden="true">
                                <ArrowUpRight className="size-4 text-muted-foreground group-hover/asset:text-foreground" />
                            </CardAction>
                            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <span>{assetTypeLabels[asset.type]}</span>
                                <span>{formatBytes(asset.sizeBytes)}</span>
                            </CardDescription>
                            {asset.type === 'MODEL' && Boolean(asset.meta.animations?.length) && (
                                <p className="m-0 flex items-center gap-1.5 text-muted-foreground text-xs">
                                    <Clapperboard className="size-3.5" aria-hidden="true" />
                                    Có hoạt ảnh
                                </p>
                            )}
                            {personal && asset.tags.length > 0 && (
                                <p
                                    className="m-0 truncate text-muted-foreground text-xs"
                                    title={asset.tags.join(', ')}
                                >
                                    {asset.tags.map((tag) => `#${tag}`).join(' ')}
                                </p>
                            )}
                        </CardHeader>
                    </Card>
                </li>
            ))}
        </ul>
    );
}

export function AssetCardGridSkeleton({ scope = 'library' }: { scope?: 'mine' | 'library' }) {
    return (
        <div role="status" className="@container">
            <span className="sr-only">Đang tải tài nguyên…</span>
            <div className={scope === 'mine' ? studioGridClass : gridClass} aria-hidden="true">
                {['a', 'b', 'c', 'd'].map((item, index) => (
                    <Card
                        key={item}
                        size="sm"
                        className={cn(
                            cardClass,
                            (scope === 'mine'
                                ? [
                                      '',
                                      '@max-[426px]:hidden',
                                      '@max-[647px]:hidden',
                                      '@max-[868px]:hidden',
                                  ]
                                : ['', '', 'max-md:hidden', 'max-xl:hidden'])[index],
                        )}
                    >
                        <Skeleton className="aspect-[1.45] rounded-none" />
                        <CardHeader className="gap-2 py-3 sm:px-4 sm:py-4">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        </div>
    );
}
