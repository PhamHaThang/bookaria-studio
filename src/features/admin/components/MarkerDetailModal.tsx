import { Check, Copy, ExternalLink, Power, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { MarkerMetrics } from '../../pages/ui/MarkerMetrics';
import { adminDate } from '../model';
import { AdminDialog } from './AdminDialog';

export interface MarkerDetailModalProps {
    marker: BookariaMarker | null;
    isOpen: boolean;
    onClose: () => void;
    onToggleStatus?: (marker: BookariaMarker) => void;
    onTestMarker?: (marker: BookariaMarker) => void;
}

export function MarkerDetailModal({
    marker,
    isOpen,
    onClose,
    onToggleStatus,
    onTestMarker,
}: MarkerDetailModalProps) {
    const [copiedId, setCopiedId] = useState(false);

    if (!marker) return null;

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(marker.id);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        } catch {
            toast.error('Không sao chép được ID marker.');
        }
    };

    return (
        <AdminDialog
            open={isOpen}
            onClose={onClose}
            title={`Chi tiết marker số #${marker.number}`}
            description="Ảnh nhận diện, trạng thái cấp phát và thông tin xác thực."
        >
            <div className="-mx-1 grid min-h-0 gap-4 overflow-y-auto px-1 pb-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start">
                <div className="relative flex h-48 items-center justify-center rounded-lg border border-border bg-muted/40 p-3 sm:h-56">
                    <img
                        src={marker.imageUrl}
                        alt={`Marker số ${marker.number}`}
                        className="h-full w-full object-contain"
                    />
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 shadow-sm [--action-outline-hover:var(--bg-hover)] [--action-outline:var(--bg-surface)]"
                    >
                        <a href={marker.imageUrl} target="_blank" rel="noopener noreferrer">
                            Ảnh gốc
                            <ExternalLink data-icon="inline-end" />
                        </a>
                    </Button>
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge tone={marker.isActive ? 'success' : 'neutral'}>
                            {marker.isActive ? 'Đang bật' : 'Đã tắt'}
                        </Badge>
                        <Badge tone={marker.assessment ? 'info' : 'neutral'}>
                            {marker.assessment ? 'Đã đánh giá' : 'Chưa đánh giá'}
                        </Badge>
                    </div>
                    <dl className="m-0 grid gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="grid gap-1">
                            <dt className="text-muted-foreground text-xs">Xác thực</dt>
                            <dd className="m-0 font-medium">
                                {marker.validatedAt
                                    ? adminDate(marker.validatedAt)
                                    : 'Chưa xác thực'}
                            </dd>
                        </div>
                        <div className="grid gap-1">
                            <dt className="text-muted-foreground text-xs">Cấp phát</dt>
                            <dd className="m-0 font-medium">
                                {marker.isActive
                                    ? 'Sẵn sàng cấp cho trang mới'
                                    : 'Tạm dừng cấp phát mới'}
                            </dd>
                        </div>
                        <div className="grid gap-1">
                            <dt className="text-muted-foreground text-xs">ID marker</dt>
                            <dd className="m-0 flex min-w-0 items-center gap-1">
                                <code className="wrap-anywhere min-w-0 flex-1 text-xs">
                                    {marker.id}
                                </code>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={handleCopyId}
                                    aria-label={copiedId ? 'Đã sao chép ID' : 'Sao chép ID'}
                                    title="Sao chép ID"
                                >
                                    {copiedId ? (
                                        <Check className="text-success-foreground" />
                                    ) : (
                                        <Copy />
                                    )}
                                </Button>
                            </dd>
                        </div>
                    </dl>
                </div>
                {marker.assessment && (
                    <section className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                            <h3 className="m-0 font-semibold text-sm">Đánh giá gần nhất</h3>
                            <time
                                dateTime={marker.assessment.assessedAt}
                                className="text-muted-foreground text-xs"
                            >
                                {adminDate(marker.assessment.assessedAt)}
                            </time>
                        </div>
                        <MarkerMetrics analysis={marker.assessment} />
                    </section>
                )}
            </div>

            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button type="button" variant="outline" onClick={onClose}>
                    Đóng
                </Button>
                {onToggleStatus && (
                    <Button
                        type="button"
                        variant="outline"
                        className={marker.isActive ? 'text-destructive' : undefined}
                        onClick={() => {
                            onClose();
                            onToggleStatus(marker);
                        }}
                    >
                        <Power data-icon="inline-start" />
                        {marker.isActive ? 'Tắt marker' : 'Bật marker'}
                    </Button>
                )}
                {onTestMarker && (
                    <Button
                        type="button"
                        onClick={() => {
                            onClose();
                            onTestMarker(marker);
                        }}
                    >
                        <ScanLine data-icon="inline-start" />
                        {marker.assessment ? 'Đánh giá lại' : 'Đánh giá ảnh'}
                    </Button>
                )}
            </DialogFooter>
        </AdminDialog>
    );
}
