import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AssetThumbnail, assetKeys, assetTypeLabels } from '@/features/assets';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';

export interface LibraryAssetDeleteModalProps {
    asset: Asset | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function LibraryAssetDeleteModal({
    asset,
    isOpen,
    onClose,
    onSuccess,
}: LibraryAssetDeleteModalProps) {
    const queryClient = useQueryClient();
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsConfirmed(false);
            setApiError(null);
        }
    }, [isOpen]);

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!asset) throw new Error('Không tìm thấy tài nguyên');
            return libraryApi.remove(asset.id);
        },
        onSuccess: () => {
            toast.success(`Đã xóa tài nguyên "${asset?.name}" khỏi thư viện dùng chung.`);
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
            void queryClient.invalidateQueries({ queryKey: assetKeys.all });
            onSuccess?.();
            onClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    const handleDelete = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        deleteMutation.mutate();
    };

    if (!asset) return null;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open: boolean) => {
                if (!open && !deleteMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[88dvh] max-w-[420px] space-y-4 overflow-y-auto p-5">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <Trash2 className="h-4.5 w-4.5 shrink-0 text-destructive" />
                        <span>Xóa khỏi thư viện dùng chung</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Tài nguyên sẽ bị gỡ bỏ hoàn toàn khỏi thư viện công cộng và không thể chọn
                        trong sách mới.
                    </DialogDescription>
                </DialogHeader>

                {/* Thẻ tóm tắt tài nguyên */}
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/40 p-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/60">
                        <AssetThumbnail asset={asset} variant="compact" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-foreground text-sm">
                                {asset.name}
                            </span>
                            <Badge tone="neutral" className="h-4.5 px-1.5 font-normal text-[10px]">
                                {assetTypeLabels[asset.type] || asset.type}
                            </Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                            {formatBytes(asset.sizeBytes)} • Tác giả:{' '}
                            {asset.authorName || 'Chưa rõ'}
                        </p>
                    </div>
                </div>

                {/* Cảnh báo ràng buộc */}
                <Alert
                    variant="destructive"
                    className="m-0 border-destructive/20 bg-destructive/5 p-3 text-xs"
                >
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    <AlertTitle className="mb-1 font-medium text-destructive text-xs">
                        Ràng buộc hệ thống
                    </AlertTitle>
                    <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
                        Máy chủ sẽ từ chối xóa nếu tài nguyên này vẫn đang được tham chiếu trong bất
                        kỳ bản nháp hoặc cuốn sách nào đã xuất bản.
                    </AlertDescription>
                </Alert>

                {/* Tích chọn xác nhận an toàn */}
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 transition-colors">
                    <Checkbox
                        id="confirm-delete-library-asset"
                        checked={isConfirmed}
                        onCheckedChange={(checked) => setIsConfirmed(Boolean(checked))}
                        disabled={deleteMutation.isPending}
                        className="mt-0.5"
                    />
                    <label
                        htmlFor="confirm-delete-library-asset"
                        className="cursor-pointer select-none text-foreground text-xs leading-normal"
                    >
                        Tôi xác nhận muốn xóa tài nguyên{' '}
                        <strong className="font-semibold text-foreground">{asset.name}</strong> khỏi
                        thư viện dùng chung.
                    </label>
                </div>

                {apiError && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-destructive text-xs leading-relaxed">
                        {apiError}
                    </div>
                )}

                <DialogFooter className="mt-1 flex-row justify-end gap-2 border-border/60 border-t pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={onClose}
                        disabled={deleteMutation.isPending}
                    >
                        Hủy bỏ
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 px-3.5 font-medium text-xs"
                        disabled={deleteMutation.isPending || !isConfirmed}
                        onClick={handleDelete}
                    >
                        {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
