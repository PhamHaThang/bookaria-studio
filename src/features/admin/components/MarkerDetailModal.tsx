import {
    Calendar,
    Check,
    Copy,
    ExternalLink,
    Hash,
    Info,
    Power,
    ScanLine,
    Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { adminDate } from '../model';

export interface MarkerDetailModalProps {
    marker: BookariaMarker | null;
    isOpen: boolean;
    onClose: () => void;
    onToggleStatus?: (marker: BookariaMarker) => void;
    onTestMarker?: (marker: BookariaMarker) => void;
}

function getMarkerQuality(score: number | null) {
    if (score === null) {
        return {
            label: 'Chưa có điểm đánh giá',
            tone: 'neutral' as const,
            description: 'Marker chưa có dữ liệu chấm điểm nhận diện tự động từ thuật toán.',
        };
    }
    if (score >= 80) {
        return {
            label: 'Xuất sắc',
            tone: 'success' as const,
            description:
                'Nhiều điểm đặc trưng, hoa văn và độ tương phản phân bố tốt. Tracking AR phản hồi nhanh và ổn định cao.',
        };
    }
    if (score >= 60) {
        return {
            label: 'Khá tốt',
            tone: 'info' as const,
            description:
                'Đủ đặc trưng hình học để nhận diện ổn định trong điều kiện ánh sáng tiêu chuẩn.',
        };
    }
    if (score >= 40) {
        return {
            label: 'Trung bình',
            tone: 'warning' as const,
            description:
                'Độ nhận diện ở mức chấp nhận được nhưng có thể khó bắt góc nghiêng hoặc môi trường thiếu sáng.',
        };
    }
    return {
        label: 'Cần cải thiện',
        tone: 'danger' as const,
        description:
            'Ít chi tiết hoặc độ tương phản thấp. Nên chọn ảnh có nhiều đường nét và góc cạnh rõ ràng hơn.',
    };
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

    const quality = getMarkerQuality(marker.markerScore);

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(marker.id);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        } catch {
            // fallback
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90dvh] max-w-lg space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <ScanLine className="h-5 w-5 shrink-0 text-primary" />
                        <span>Chi tiết Marker số #{marker.number}</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Thông tin hình ảnh, đặc trưng nhận diện và trạng thái cấp phát của marker
                        AR.
                    </DialogDescription>
                </DialogHeader>

                {/* Khung xem trước hình ảnh marker */}
                <div className="relative flex aspect-square max-h-[240px] w-full items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/20 p-4">
                    <img
                        src={marker.imageUrl}
                        alt={`Marker số ${marker.number}`}
                        className="h-full w-full object-contain drop-shadow-sm transition-transform hover:scale-105"
                    />
                    <a
                        href={marker.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-md border border-border/80 bg-surface/90 px-2 py-1 font-medium text-foreground text-xs shadow-xs backdrop-blur-xs transition hover:bg-surface"
                        title="Mở ảnh gốc trong tab mới"
                    >
                        <span>Ảnh gốc</span>
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                {/* Huy hiệu trạng thái & Điểm số */}
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={marker.isActive ? 'success' : 'neutral'} className="px-2.5 py-0.5">
                        {marker.isActive ? 'Đang bật' : 'Đã tắt'}
                    </Badge>
                    <Badge tone={quality.tone} className="px-2.5 py-0.5">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {marker.markerScore !== null
                            ? `Điểm: ${marker.markerScore}/100 (${quality.label})`
                            : quality.label}
                    </Badge>
                </div>

                {/* Đánh giá chất lượng nhận diện */}
                <div className="rounded-[var(--radius-md)] border border-border/70 bg-surface/60 p-3 text-xs">
                    <p className="font-medium text-foreground">Đánh giá chất lượng nhận diện AR</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">
                        {quality.description}
                    </p>
                </div>

                {/* Danh sách thông số kỹ thuật */}
                <div className="space-y-2.5 rounded-[var(--radius-md)] border border-border bg-muted/20 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2 border-border/60 border-b pb-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Hash className="h-3.5 w-3.5" />
                            Số thứ tự marker
                        </span>
                        <span className="font-semibold text-foreground">#{marker.number}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-border/60 border-b pb-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            Ghi nhận xác thực
                        </span>
                        <span className="font-medium text-foreground">
                            {marker.validatedAt
                                ? adminDate(marker.validatedAt)
                                : 'Chưa ghi nhận xác thực'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-border/60 border-b pb-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Info className="h-3.5 w-3.5" />
                            Quy tắc cấp phát
                        </span>
                        <span
                            className={
                                marker.isActive
                                    ? 'font-medium text-success'
                                    : 'font-medium text-muted-foreground'
                            }
                        >
                            {marker.isActive
                                ? 'Sẵn sàng cấp cho trang mới'
                                : 'Tạm dừng cấp phát mới'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-muted-foreground">Mã định danh (ID):</span>
                        <div className="flex items-center gap-1.5">
                            <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {marker.id}
                            </code>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyId}
                                className="h-6 w-6 p-0"
                                title="Sao chép ID"
                            >
                                {copiedId ? (
                                    <Check className="h-3.5 w-3.5 text-success" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2 flex flex-wrap items-center justify-between gap-2 border-border/60 border-t pt-3">
                    <div className="flex items-center gap-2">
                        {onToggleStatus && (
                            <Button
                                type="button"
                                variant={marker.isActive ? 'outline' : 'secondary'}
                                size="sm"
                                className="h-8 gap-1.5 px-3 text-xs"
                                onClick={() => {
                                    onClose();
                                    onToggleStatus(marker);
                                }}
                            >
                                <Power className="h-3.5 w-3.5" />
                                <span>{marker.isActive ? 'Tắt marker' : 'Bật marker'}</span>
                            </Button>
                        )}
                        {onTestMarker && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 px-3 text-xs"
                                onClick={() => {
                                    onClose();
                                    onTestMarker(marker);
                                }}
                            >
                                <ScanLine className="h-3.5 w-3.5" />
                                <span>Thử nghiệm</span>
                            </Button>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-4 text-xs"
                        onClick={onClose}
                    >
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
