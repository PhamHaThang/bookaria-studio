import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { AdminDialog } from './AdminDialog';

export interface MarkerToggleModalProps {
    marker: BookariaMarker | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (updatedMarker: BookariaMarker) => void;
}

export function MarkerToggleModal({ marker, isOpen, onClose, onSuccess }: MarkerToggleModalProps) {
    const queryClient = useQueryClient();
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setApiError(null);
        }
    }, [isOpen]);

    const toggleMutation = useMutation({
        mutationFn: async () => {
            if (!marker) throw new Error('Không tìm thấy thông tin marker.');
            return libraryApi.setMarker(marker.id, { isActive: !marker.isActive });
        },
        onSuccess: (updated) => {
            toast.success(`Đã ${updated.isActive ? 'bật' : 'tắt'} marker số ${updated.number}.`);
            void queryClient.invalidateQueries({
                predicate: (query) =>
                    query.queryKey[0] === 'admin' && query.queryKey[2] === 'markers',
            });
            onSuccess?.(updated);
            onClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    if (!marker) return null;

    const willBeActive = !marker.isActive;

    return (
        <AdminDialog
            open={isOpen}
            busy={toggleMutation.isPending}
            onClose={onClose}
            title={`${willBeActive ? 'Bật' : 'Tắt'} marker số #${marker.number}?`}
            description={
                willBeActive
                    ? 'Marker sẽ được cấp phát cho các trang sách AR mới.'
                    : 'Marker sẽ ngừng cấp phát cho trang mới. Các trang đã dùng marker vẫn hiển thị AR như trước.'
            }
            className="max-w-[min(480px,calc(100vw-32px))]"
        >
            <Feedback error={apiError} errorMode="toast" />
            <div className="flex min-h-0 items-center gap-3 overflow-y-auto rounded-lg bg-muted/40 p-3">
                <img
                    src={marker.imageUrl}
                    alt=""
                    className="size-11 shrink-0 rounded-md border border-border bg-surface object-contain p-1"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">Marker số #{marker.number}</span>
                    <Badge tone={marker.isActive ? 'success' : 'neutral'}>
                        {marker.isActive ? 'Đang bật' : 'Đã tắt'}
                    </Badge>
                </div>
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button
                    type="button"
                    variant="outline"
                    disabled={toggleMutation.isPending}
                    onClick={onClose}
                >
                    Hủy
                </Button>
                <Button
                    type="button"
                    variant={willBeActive ? 'default' : 'destructive'}
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate()}
                >
                    {toggleMutation.isPending
                        ? 'Đang xử lý…'
                        : willBeActive
                          ? 'Bật marker'
                          : 'Tắt marker'}
                </Button>
            </DialogFooter>
        </AdminDialog>
    );
}
