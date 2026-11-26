import { useQuery } from '@tanstack/react-query';
import { Box, Copy, ExternalLink, FileImage, Film, Music2, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Badge as TagBadge } from '@/shared/ui/primitives/badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Separator } from '@/shared/ui/primitives/separator';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { assetKeys, assetStatusLabels, assetsApi, assetTypeLabels } from '../model/assets';

import { AssetFilePreview, AssetPreviewState, assetDuration } from './AssetPreviewMedia';

const icons = { MODEL: Box, IMAGE: FileImage, AUDIO: Music2, VIDEO: Film };

export function LibraryAssetPreview({
    asset: initial,
    onClose,
}: {
    asset: Asset;
    onClose: () => void;
}) {
    return <AssetPreviewDialog assetId={initial.id} asset={initial} onClose={onClose} />;
}

/** Read-only asset details shared by the catalog and the scene inspector. */
export function AssetPreviewDialog({
    assetId,
    asset: initial,
    onClose,
}: {
    assetId: string;
    asset?: Asset;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const opener = useRef(document.activeElement as HTMLElement | null);
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId),
        queryFn: ({ signal }) => assetsApi.detail(assetId, signal),
        initialData: initial,
        staleTime: 0,
        refetchInterval: (query) =>
            !query.state.error && query.state.data?.status === 'PROCESSING' ? 3000 : false,
        retry: false,
    });
    const asset = detail.data || initial;
    const Icon = asset ? icons[asset.type] : Box;
    const available = asset?.status === 'READY' && !detail.isError;
    const credit = [asset?.authorName, asset?.license, asset?.sourceUrl].filter(Boolean).join('\n');
    async function copyCredit() {
        try {
            await navigator.clipboard.writeText(credit);
            toast.success('Đã sao chép thông tin ghi nguồn.');
        } catch {
            toast.error('Chưa sao chép được thông tin. Vui lòng thử lại.');
        }
    }
    const facts = asset
        ? [
              { label: 'Định dạng', value: asset.format.toUpperCase() },
              { label: 'Dung lượng', value: formatBytes(asset.sizeBytes) },
              ...(asset.meta.width && asset.meta.height
                  ? [
                        {
                            label: 'Kích thước',
                            value: `${asset.meta.width.toLocaleString('vi-VN')} × ${asset.meta.height.toLocaleString('vi-VN')} px`,
                        },
                    ]
                  : []),
              ...(asset.meta.durationSec !== undefined
                  ? [{ label: 'Thời lượng', value: assetDuration(asset.meta.durationSec) }]
                  : []),
              ...(asset.type === 'MODEL' && asset.meta.animations?.length
                  ? [{ label: 'Hoạt ảnh', value: `${asset.meta.animations.length} chuyển động` }]
                  : []),
          ]
        : [];
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                showCloseButton={false}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
                }}
                className="flex h-[min(760px,calc(100dvh-32px))] max-w-[min(1120px,calc(100vw-32px))] flex-col overflow-hidden p-0"
            >
                <header className="flex shrink-0 items-center gap-4 border-border border-b px-5 py-4 sm:px-6">
                    <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <DialogHeader className="min-w-0 flex-1 gap-1">
                        <DialogTitle className="m-0 line-clamp-2 break-words">
                            {asset?.name || 'Xem tài nguyên'}
                        </DialogTitle>
                        <DialogDescription>
                            {asset
                                ? assetTypeLabels[asset.type]
                                : 'Xem trước và thông tin tệp đã gắn trên trang.'}
                        </DialogDescription>
                    </DialogHeader>
                    {asset && (
                        <Badge
                            className="max-sm:hidden"
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
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" aria-label="Đóng">
                            <X />
                        </Button>
                    </DialogClose>
                </header>
                {!asset ? (
                    <div className="min-h-0 flex-1" aria-busy={detail.isPending}>
                        {detail.isError ? (
                            <AssetPreviewState
                                title="Chưa tải được tài nguyên"
                                description={errorMessage(detail.error)}
                                retry={() => void detail.refetch()}
                            />
                        ) : (
                            <div
                                role="status"
                                className="grid h-full grid-cols-[minmax(0,1fr)_300px] gap-6 p-6"
                            >
                                <span className="sr-only">Đang tải tài nguyên…</span>
                                <Skeleton className="h-full" />
                                <div className="flex flex-col gap-4">
                                    <Skeleton className="h-5 w-2/3" />
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-full" />
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,1fr)_minmax(0,0.8fr)] md:grid-cols-[minmax(0,1fr)_300px] md:grid-rows-[minmax(0,1fr)]">
                        <section
                            aria-label="Xem trước tài nguyên"
                            className="min-h-0 min-w-0 overflow-hidden bg-background"
                        >
                            {detail.isError ? (
                                <AssetPreviewState
                                    title="Chưa tải được tài nguyên"
                                    description={errorMessage(detail.error)}
                                    retry={() => void detail.refetch()}
                                />
                            ) : asset.status === 'PROCESSING' ? (
                                <AssetPreviewState
                                    title="Tài nguyên đang được xử lý"
                                    description="Phần xem trước sẽ tự cập nhật khi tài nguyên sẵn sàng."
                                    processing
                                />
                            ) : asset.status === 'FAILED' ? (
                                <AssetPreviewState
                                    title="Chưa xử lý được tài nguyên"
                                    description={
                                        asset.error ||
                                        'Tệp này hiện chưa sẵn sàng. Vui lòng chọn tài nguyên khác.'
                                    }
                                />
                            ) : (
                                <AssetFilePreview key={`${asset.id}:${asset.url}`} asset={asset} />
                            )}
                        </section>
                        <aside
                            aria-label="Thông tin tài nguyên"
                            className="flex min-h-0 flex-col gap-6 overflow-y-auto border-border border-t p-5 md:border-t-0 md:border-l md:p-6"
                        >
                            <section className="flex flex-col gap-4">
                                <h2 className="m-0 font-semibold text-sm">Thông tin tài nguyên</h2>
                                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
                                    {facts.map(({ label, value }) => (
                                        <div key={label} className="contents">
                                            <dt className="text-muted-foreground">{label}</dt>
                                            <dd className="break-words text-right tabular-nums">
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                            {credit && (
                                <>
                                    <Separator />
                                    <section className="flex flex-col gap-4">
                                        <h2 className="m-0 font-semibold text-sm">
                                            Nguồn và giấy phép
                                        </h2>
                                        <dl className="flex flex-col gap-4 text-sm">
                                            {asset.authorName && (
                                                <div className="flex flex-col gap-1">
                                                    <dt className="text-muted-foreground">
                                                        Tác giả
                                                    </dt>
                                                    <dd className="break-words">
                                                        {asset.authorName}
                                                    </dd>
                                                </div>
                                            )}
                                            {asset.license && (
                                                <div className="flex flex-col gap-1">
                                                    <dt className="text-muted-foreground">
                                                        Giấy phép
                                                    </dt>
                                                    <dd className="break-words">{asset.license}</dd>
                                                </div>
                                            )}
                                        </dl>
                                        {asset.sourceUrl && (
                                            <Button
                                                variant="link"
                                                className="h-auto justify-start p-0"
                                                asChild
                                            >
                                                <a
                                                    href={asset.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Xem nguồn tài nguyên
                                                    <ExternalLink data-icon="inline-end" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => void copyCredit()}
                                        >
                                            <Copy data-icon="inline-start" />
                                            Sao chép ghi nguồn
                                        </Button>
                                    </section>
                                </>
                            )}
                            {asset.tags.length > 0 && (
                                <section className="flex flex-col gap-3">
                                    <h2 className="m-0 font-semibold text-sm">Nhãn</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {asset.tags.map((tag) => (
                                            <TagBadge
                                                key={tag}
                                                variant="outline"
                                                className="max-w-full whitespace-normal break-words"
                                            >
                                                {tag}
                                            </TagBadge>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </aside>
                    </div>
                )}
                <footer className="flex shrink-0 items-center justify-end gap-3 border-border border-t px-5 py-4 sm:px-6">
                    <DialogClose asChild>
                        <Button variant="outline">Đóng</Button>
                    </DialogClose>
                    {available && asset ? (
                        <Button asChild>
                            <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink data-icon="inline-start" />
                                Mở tệp gốc
                            </a>
                        </Button>
                    ) : (
                        <Button disabled>
                            <ExternalLink data-icon="inline-start" />
                            Mở tệp gốc
                        </Button>
                    )}
                </footer>
            </DialogContent>
        </Dialog>
    );
}
