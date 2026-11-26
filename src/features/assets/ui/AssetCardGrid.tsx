import { ArrowUpRight, Box, Clapperboard } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ModelGeneration } from '@/shared/contracts/api/assets.schema';
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
import { Progress } from '@/shared/ui/primitives/progress';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { assetStatusLabels, assetTypeLabels } from '../model/assets';
import { assetDuration } from './AssetPreviewMedia';
import { AssetThumbnail } from './AssetThumbnail';

const gridClass = 'grid list-none grid-cols-2 gap-3 p-0 sm:gap-5 md:grid-cols-3 xl:grid-cols-4';
const studioGridClass =
    'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,205px),1fr))] gap-4 p-0';
const previewClass = 'relative block aspect-[1.45] overflow-hidden bg-muted';
const cardClass = 'h-full gap-0 py-0';

function PendingModelCard({ job, focus }: { job: ModelGeneration; focus: boolean }) {
    const card = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const target = card.current;
        if (!focus || !target) return;

        // Both the app and the Studio layout can temporarily make the card inert.
        const focusWhenReady = () => {
            const inertAncestor = target.closest('[inert]');
            if (inertAncestor) {
                observer.observe(inertAncestor, { attributeFilter: ['inert'] });
                return;
            }
            observer.disconnect();
            target.focus({ preventScroll: true });
            target.scrollIntoView({ block: 'nearest' });
        };
        const observer = new MutationObserver(focusWhenReady);
        focusWhenReady();
        return () => observer.disconnect();
    }, [focus]);
    const failed = job.status === 'FAILED';
    const queued = job.status === 'QUEUED';
    const label = queued ? 'Đang chờ tạo 3D' : 'Đang tạo mô hình 3D';
    return (
        <Card ref={card} tabIndex={focus ? -1 : undefined} size="sm" className={cardClass}>
            <div className={cn(previewClass, 'grid place-items-center')}>
                {failed ? (
                    <Box className="size-8 text-muted-foreground" aria-hidden="true" />
                ) : (
                    <span
                        aria-hidden="true"
                        data-slot="generation-spinner"
                        className={cn(
                            'size-9 rounded-full border-[3px] motion-safe:animate-spin',
                            queued
                                ? 'border-border border-t-muted-foreground'
                                : 'border-border border-t-foreground',
                        )}
                    />
                )}
            </div>
            <CardHeader className="min-w-0 gap-2 py-3 sm:px-4 sm:py-4">
                <CardTitle asChild>
                    <h2 className="m-0 truncate" title={job.name}>
                        3D từ ảnh: {job.name}
                    </h2>
                </CardTitle>
                <CardDescription className="col-span-full flex flex-col gap-2 text-xs">
                    {failed ? (
                        <span className="text-destructive" role="status">
                            {job.error?.message || 'Không tạo được mô hình. Hãy thử ảnh khác.'}
                        </span>
                    ) : (
                        <>
                            <Progress
                                value={job.progress}
                                aria-label={`Tiến độ tạo 3D từ ${job.name}`}
                                className="h-1.5"
                            />
                            <span className="flex justify-between gap-2" role="status">
                                <span>{label}</span>
                                <span className="font-medium tabular-nums">{job.progress}%</span>
                            </span>
                        </>
                    )}
                </CardDescription>
            </CardHeader>
        </Card>
    );
}

export function AssetCardGrid({
    assets,
    busy,
    onPreview,
    scope = 'library',
    generating = [],
    focusModelJob,
}: {
    assets: Asset[];
    busy: boolean;
    onPreview: (asset: Asset) => void;
    scope?: 'mine' | 'library';
    generating?: ModelGeneration[];
    focusModelJob?: string;
}) {
    const personal = scope === 'mine';
    return (
        <ul
            className={personal ? studioGridClass : gridClass}
            aria-label={personal ? 'Tài nguyên của tôi' : 'Tài nguyên trong thư viện'}
            aria-busy={busy}
        >
            {generating.map((job) => (
                <li key={job.id} className="min-w-0">
                    <PendingModelCard job={job} focus={job.id === focusModelJob} />
                </li>
            ))}
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
                                className={cn(
                                    'bg-muted',
                                    asset.type !== 'IMAGE' &&
                                        'motion-safe:[&_img]:transition-transform motion-safe:[&_img]:duration-200 motion-safe:group-hover/asset:[&_img]:scale-[1.04] motion-safe:group-focus-within/asset:[&_img]:scale-[1.04]',
                                )}
                            />
                            {((personal && asset.type !== 'IMAGE') || asset.status !== 'READY') && (
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
                                <span>{asset.format.toUpperCase()}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatBytes(asset.sizeBytes)}</span>
                            </CardDescription>
                            <div className="col-span-full mt-1 flex h-5 min-w-0 flex-wrap content-start gap-1 overflow-clip *:h-5 *:whitespace-nowrap">
                                <Badge className="py-0.5">{assetTypeLabels[asset.type]}</Badge>
                                {asset.type === 'MODEL' &&
                                    Boolean(asset.meta.animations?.length) && (
                                        <Badge tone="info" className="py-0.5">
                                            <Clapperboard aria-hidden="true" />
                                            Có hoạt ảnh
                                        </Badge>
                                    )}
                                {personal &&
                                    asset.tags.map((tag) => (
                                        <Badge key={tag} className="py-0.5">
                                            {tag}
                                        </Badge>
                                    ))}
                            </div>
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
                        <CardHeader className="py-3 sm:px-4 sm:py-4">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="mt-1 h-5 w-16 rounded-full" />
                        </CardHeader>
                    </Card>
                ))}
            </div>
        </div>
    );
}
