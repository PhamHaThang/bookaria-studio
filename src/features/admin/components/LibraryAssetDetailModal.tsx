import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Calendar,
    ExternalLink,
    Eye,
    FileImage,
    FileText,
    Film,
    HardDrive,
    Music2,
    Pencil,
    Shield,
    Tag,
    Trash2,
    User,
} from 'lucide-react';
import { assetKeys, assetsApi, assetTypeLabels } from '@/features/assets';
import { useAuth } from '@/features/auth';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { adminDate } from '../model';

export interface LibraryAssetDetailModalProps {
    assetId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (asset: Asset) => void;
    onDelete?: (asset: Asset) => void;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    IMAGE: FileImage,
    AUDIO: Music2,
    MODEL: Box,
    VIDEO: Film,
};

export function LibraryAssetDetailModal({
    assetId,
    isOpen,
    onClose,
    onEdit,
    onDelete,
}: LibraryAssetDetailModalProps) {
    const { user } = useAuth();

    const detailQuery = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => {
            if (!assetId) return null;
            return assetsApi.detail(assetId, signal);
        },
        enabled: Boolean(isOpen && assetId),
    });

    const categoriesQuery = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: isOpen,
    });

    const asset = detailQuery.data;
    const isLoading = detailQuery.isLoading;
    const isError = detailQuery.isError;

    const category = categoriesQuery.data?.find((c) => c.id === asset?.categoryId);
    const TypeIcon = asset?.type ? typeIcons[asset.type] || FileText : FileText;

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <DialogContent className="max-h-[90dvh] max-w-2xl space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-1">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground sm:text-lg">
                        <Eye className="h-4.5 w-4.5 shrink-0 text-primary" />
                        <span>Chi tiết tài nguyên dùng chung</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Xem thông tin tệp, giấy phép, tác giả gốc và bản xem trước của tài nguyên
                        trong thư viện.
                    </DialogDescription>
                </DialogHeader>

                {isLoading && (
                    <div className="flex h-56 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Spinner className="h-6 w-6" />
                        <span className="text-xs">Đang tải thông tin tài nguyên...</span>
                    </div>
                )}

                {isError && (
                    <div className="py-2">
                        <Feedback
                            error={
                                detailQuery.error instanceof Error
                                    ? detailQuery.error.message
                                    : 'Không thể tải thông tin tài nguyên.'
                            }
                        />
                    </div>
                )}

                {asset && (
                    <div className="space-y-4">
                        {/* Khu vực xem trước tài nguyên */}
                        <div className="flex max-h-72 min-h-[160px] w-full items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-muted/25 p-3">
                            {asset.type === 'IMAGE' ? (
                                <img
                                    src={asset.url}
                                    alt={asset.name}
                                    className="max-h-64 w-auto rounded object-contain shadow-xs"
                                    loading="lazy"
                                />
                            ) : asset.type === 'AUDIO' ? (
                                <div className="flex w-full max-w-md flex-col items-center gap-3 py-4 text-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Music2 className="h-6 w-6" />
                                    </div>
                                    <p className="font-medium text-foreground text-xs">
                                        {asset.name}
                                    </p>
                                    <audio
                                        src={asset.url}
                                        controls
                                        preload="metadata"
                                        className="h-9 w-full max-w-sm"
                                    >
                                        <track kind="captions" />
                                    </audio>
                                </div>
                            ) : asset.type === 'VIDEO' ? (
                                <video src={asset.url} controls className="max-h-64 w-auto rounded">
                                    <track kind="captions" />
                                </video>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                                    <TypeIcon className="h-10 w-10 text-primary/70" />
                                    <span className="font-medium text-foreground text-xs">
                                        {asset.name}
                                    </span>
                                    <span className="text-[11px]">
                                        Mô hình 3D định dạng .{asset.format.toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Thẻ thông tin tổng hợp */}
                        <div className="space-y-3 rounded-lg border border-border/80 bg-surface/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-border/60 border-b pb-3">
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-base text-foreground sm:text-lg">
                                        {asset.name}
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground">
                                        ID: <span className="font-mono">{asset.id}</span>
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge
                                        tone="neutral"
                                        className="h-5 px-2 font-normal text-[11px]"
                                    >
                                        <TypeIcon className="mr-1 h-3 w-3" />
                                        {assetTypeLabels[asset.type] || asset.type}
                                    </Badge>
                                    <Badge tone="info" className="h-5 px-2 font-normal text-[11px]">
                                        {asset.format.toUpperCase()}
                                    </Badge>
                                    {category && (
                                        <Badge
                                            tone="success"
                                            className="h-5 px-2 font-normal text-[11px]"
                                        >
                                            {category.name}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Chi tiết thông số dạng lưới 2 cột */}
                            <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <HardDrive className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                                    <span>Dung lượng:</span>
                                    <strong className="font-medium text-foreground">
                                        {formatBytes(asset.sizeBytes)}
                                    </strong>
                                </div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                                    <span>Tác giả gốc:</span>
                                    <strong className="font-medium text-foreground">
                                        {asset.authorName || 'Chưa rõ'}
                                    </strong>
                                </div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                                    <span>Giấy phép:</span>
                                    <strong className="font-medium text-foreground">
                                        {asset.license || 'Chưa cung cấp'}
                                    </strong>
                                </div>

                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                                    <span>Ngày tạo:</span>
                                    <strong className="font-medium text-foreground">
                                        {adminDate(asset.createdAt)}
                                    </strong>
                                </div>
                            </div>

                            {/* Nguồn liên kết nếu có */}
                            {asset.sourceUrl && (
                                <div className="flex items-center gap-2 pt-1 text-xs">
                                    <span className="shrink-0 text-muted-foreground">
                                        Nguồn gốc:
                                    </span>
                                    <a
                                        href={asset.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                                    >
                                        <span className="truncate">{asset.sourceUrl}</span>
                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                </div>
                            )}

                            {/* Nhãn Tags nếu có */}
                            {asset.tags && asset.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Tag className="h-3 w-3" />
                                        Nhãn:
                                    </span>
                                    {asset.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] text-foreground/80"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="flex-row items-center justify-between border-border/60 border-t pt-3">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={onClose}
                    >
                        Đóng
                    </Button>

                    {asset && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-muted-foreground text-xs hover:text-foreground"
                                asChild
                            >
                                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                    <span>Mở tệp gốc</span>
                                </a>
                            </Button>

                            {onEdit && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => {
                                        onClose();
                                        onEdit(asset);
                                    }}
                                >
                                    <Pencil className="mr-1 h-3.5 w-3.5" />
                                    <span>Sửa thông tin</span>
                                </Button>
                            )}

                            {onDelete && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => {
                                        onClose();
                                        onDelete(asset);
                                    }}
                                >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    <span>Xóa</span>
                                </Button>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
