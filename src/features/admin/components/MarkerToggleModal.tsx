import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
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
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !toggleMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent
                className="max-h-[90dvh] max-w-md space-y-4 overflow-y-auto p-5 sm:p-6"
                onEscapeKeyDown={(e) => {
                    if (toggleMutation.isPending) e.preventDefault();
                }}
                onPointerDownOutside={(e) => {
                    if (toggleMutation.isPending) e.preventDefault();
                }}
            >
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <Power
                            className={cn(
                                'h-5 w-5 shrink-0',
                                willBeActive ? 'text-emerald-500' : 'text-amber-500',
                            )}
                        />
                        <span>
                            {marker.isActive ? 'Tắt' : 'Bật'} marker số #{marker.number}?
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        {marker.isActive
                            ? 'Marker này sẽ ngừng cấp phát cho các trang sách AR mới.'
                            : 'Marker này sẽ được kích hoạt để cấp phát cho các trang sách AR mới.'}
                    </DialogDescription>
                </DialogHeader>

                {apiError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{apiError}</AlertDescription>
                    </Alert>
                )}

                {/* Tóm tắt marker */}
                <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3 shadow-xs">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 p-1">
                        <img
                            src={marker.imageUrl}
                            alt=""
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm">
                                Marker số #{marker.number}
                            </span>
                            <Badge
                                tone={marker.isActive ? 'success' : 'neutral'}
                                className="h-5 px-1.5 text-[10px]"
                            >
                                {marker.isActive ? 'Hiện đang bật' : 'Hiện đang tắt'}
                            </Badge>
                        </div>
                        <p className="truncate text-muted-foreground text-xs">
                            {marker.markerScore !== null
                                ? `Điểm chất lượng: ${marker.markerScore}/100`
                                : 'Chưa có điểm đánh giá'}
                        </p>
                    </div>
                </div>

                {/* Hướng dẫn chi tiết */}
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
                    {marker.isActive ? (
                        <p>
                            Marker sẽ <strong>không được cấp phát cho các trang sách mới</strong>{' '}
                            khi người dùng tạo nội dung. Các trang sách hoặc phiên bản đã sử dụng
                            marker này trước đây sẽ <strong>không bị thay đổi</strong>.
                        </p>
                    ) : (
                        <p>
                            Marker sẽ <strong>được cấp phát cho các trang sách mới</strong> nếu đáp
                            ứng đủ điều kiện chất lượng nhận diện từ hệ thống máy chủ.
                        </p>
                    )}
                </div>

                <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-border/60 border-t pt-3">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={onClose}
                        className="h-8 px-3 text-xs"
                    >
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        variant={marker.isActive ? 'outline' : 'default'}
                        size="sm"
                        disabled={toggleMutation.isPending}
                        onClick={() => toggleMutation.mutate()}
                        className="h-8 px-4 text-xs"
                    >
                        {toggleMutation.isPending
                            ? 'Đang xử lý…'
                            : marker.isActive
                              ? 'Xác nhận tắt'
                              : 'Xác nhận bật'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
