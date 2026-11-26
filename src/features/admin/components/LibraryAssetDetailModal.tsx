import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { assetKeys, assetsApi, assetTypeLabels } from '@/features/assets';
import { AssetFilePreview, AssetPreviewState } from '@/features/assets/ui/AssetPreviewMedia';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { adminDate } from '../model';
import { LibraryAssetDialog } from './LibraryAssetDialog';

export interface LibraryAssetDetailModalProps {
    assetId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (asset: Asset) => void;
    onDelete?: (asset: Asset) => void;
}

export function LibraryAssetDetailModal({
    assetId,
    isOpen,
    onClose,
    onEdit,
    onDelete,
}: LibraryAssetDetailModalProps) {
    const { user } = useAuth();
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => (assetId ? assetsApi.detail(assetId, signal) : null),
        enabled: Boolean(isOpen && assetId),
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: isOpen,
    });
    const asset = detail.data;
    const category = categories.data?.find((item) => item.id === asset?.categoryId);

    return (
        <LibraryAssetDialog
            open={isOpen}
            title="Chi tiết tài nguyên"
            description="Xem tệp, thông tin tác giả và giấy phép sử dụng."
            className="max-w-[min(680px,calc(100vw-32px))]"
            onClose={onClose}
        >
            <div className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1">
                {detail.isLoading && (
                    <LoadingState layout="detail">Đang tải thông tin tài nguyên…</LoadingState>
                )}
                {detail.isError && (
                    <div className="flex flex-col items-start gap-3">
                        <p className="m-0 text-muted-foreground text-sm">
                            {errorMessage(detail.error)}
                        </p>
                        <Button
                            variant="outline"
                            disabled={detail.isFetching}
                            onClick={() => void detail.refetch()}
                        >
                            Thử tải lại
                        </Button>
                    </div>
                )}
                {asset && (
                    <>
                        <section
                            aria-label="Xem trước tài nguyên"
                            className="h-[clamp(220px,38dvh,360px)] overflow-hidden rounded-lg border border-border bg-muted/40"
                        >
                            {asset.status === 'READY' ? (
                                <AssetFilePreview key={`${asset.id}:${asset.url}`} asset={asset} />
                            ) : (
                                <AssetPreviewState
                                    title={
                                        asset.status === 'FAILED'
                                            ? 'Chưa xem trước được tài nguyên'
                                            : 'Tài nguyên đang được chuẩn bị'
                                    }
                                    description={
                                        asset.status === 'FAILED'
                                            ? 'Bạn có thể thử mở tệp gốc.'
                                            : 'Thử tải lại khi tài nguyên đã sẵn sàng.'
                                    }
                                    retry={
                                        asset.status === 'FAILED' || detail.isFetching
                                            ? undefined
                                            : () => void detail.refetch()
                                    }
                                />
                            )}
                        </section>
                        <div className="grid gap-2">
                            <h3 className="wrap-anywhere m-0 font-semibold text-base">
                                {asset.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge>
                                    {assetTypeLabels[asset.type]} · {asset.format.toUpperCase()}
                                </Badge>
                                {category && <Badge>{category.name}</Badge>}
                            </div>
                        </div>
                        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                            <div>
                                <dt className="text-muted-foreground text-xs">Dung lượng</dt>
                                <dd className="m-0 mt-0.5">{formatBytes(asset.sizeBytes)}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs">Ngày tạo</dt>
                                <dd className="m-0 mt-0.5">{adminDate(asset.createdAt)}</dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-muted-foreground text-xs">Tác giả gốc</dt>
                                <dd className="wrap-anywhere m-0 mt-0.5">
                                    {asset.authorName || 'Chưa cung cấp'}
                                </dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-muted-foreground text-xs">Giấy phép</dt>
                                <dd className="wrap-anywhere m-0 mt-0.5">
                                    {asset.license || 'Chưa cung cấp'}
                                </dd>
                            </div>
                            {asset.sourceUrl && (
                                <div className="col-span-2 min-w-0">
                                    <dt className="text-muted-foreground text-xs">Nguồn gốc</dt>
                                    <dd className="m-0">
                                        <a
                                            href={asset.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex max-w-full items-center gap-1.5 hover:underline"
                                        >
                                            <span className="truncate">{asset.sourceUrl}</span>
                                            <ExternalLink
                                                className="size-3.5 shrink-0"
                                                aria-hidden="true"
                                            />
                                        </a>
                                    </dd>
                                </div>
                            )}
                            {asset.tags.length > 0 && (
                                <div className="col-span-2">
                                    <dt className="text-muted-foreground text-xs">Nhãn</dt>
                                    <dd className="m-0 mt-1 flex flex-wrap gap-1.5">
                                        {[...new Set(asset.tags)].map((tag) => (
                                            <Badge key={tag}>{tag}</Badge>
                                        ))}
                                    </dd>
                                </div>
                            )}
                            <div className="col-span-2">
                                <dt className="text-muted-foreground text-xs">Mã tài nguyên</dt>
                                <dd className="wrap-anywhere m-0 mt-0.5 font-mono text-xs">
                                    {asset.id}
                                </dd>
                            </div>
                        </dl>
                    </>
                )}
            </div>
            {asset && (
                <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                    {onDelete && (
                        <Button
                            type="button"
                            variant="outline"
                            className="mr-auto text-destructive hover:text-destructive"
                            onClick={() => onDelete(asset)}
                        >
                            Xóa
                        </Button>
                    )}
                    <Button variant="outline" asChild>
                        <a href={asset.url} target="_blank" rel="noopener noreferrer">
                            Mở tệp gốc
                            <ExternalLink data-icon="inline-end" aria-hidden="true" />
                        </a>
                    </Button>
                    {onEdit && (
                        <Button type="button" onClick={() => onEdit(asset)}>
                            Chỉnh sửa
                        </Button>
                    )}
                </DialogFooter>
            )}
        </LibraryAssetDialog>
    );
}
