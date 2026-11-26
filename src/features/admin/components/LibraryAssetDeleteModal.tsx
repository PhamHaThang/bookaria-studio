import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { assetKeys } from '@/features/assets';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { LibraryAssetDialog, LibraryAssetSummary } from './LibraryAssetDialog';

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
        <LibraryAssetDialog
            open={isOpen}
            busy={deleteMutation.isPending}
            title="Xóa tài nguyên?"
            description="Tài nguyên sẽ bị xóa khỏi thư viện dùng chung."
            onClose={onClose}
        >
            <Feedback error={apiError} errorMode="toast" />
            <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 pb-1">
                <div className="rounded-lg bg-muted/40 p-3">
                    <LibraryAssetSummary asset={asset} />
                </div>
                <p className="m-0 text-muted-foreground text-sm">
                    Tài nguyên đang được dùng trong bản nháp hoặc sách đã xuất bản chưa thể xóa.
                </p>
                <div className="flex items-start gap-2.5">
                    <Checkbox
                        id="confirm-delete-library-asset"
                        className="mt-0.5"
                        checked={isConfirmed}
                        onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                        disabled={deleteMutation.isPending}
                    />
                    <label
                        htmlFor="confirm-delete-library-asset"
                        className="m-0 cursor-pointer text-sm"
                    >
                        Tôi xác nhận muốn xóa tài nguyên này.
                    </label>
                </div>
            </div>
            <DialogFooter className="mt-0 shrink-0 border-0 pt-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                >
                    Hủy
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteMutation.isPending || !isConfirmed}
                    onClick={handleDelete}
                >
                    {deleteMutation.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
                </Button>
            </DialogFooter>
        </LibraryAssetDialog>
    );
}
