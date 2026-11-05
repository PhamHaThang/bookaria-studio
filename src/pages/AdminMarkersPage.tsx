import { useQuery } from '@tanstack/react-query';
import { Calendar, ExternalLink, Eye, Info, Plus, Power, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    MarkerDetailModal,
    MarkerToggleModal,
    adminDate,
    libraryKeys,
    readAdminQueueSearch,
} from '@/features/admin';
import { libraryApi } from '@/features/admin/library-ui';
import { MarkerRegistrationDialog } from '@/features/admin/MarkerRegistrationDialog';
import { MarkerTestDialog } from '@/features/admin/MarkerTestDialog';
import { AdminPager, AdminReload } from '@/features/admin/ui';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';

interface AdminMarkerItemProps {
    marker: BookariaMarker;
    onViewDetail: (marker: BookariaMarker) => void;
    onToggleStatus: (marker: BookariaMarker) => void;
}

/**
 * Thẻ hiển thị một marker AR trong danh sách.
 * Chuẩn hóa thiết kế theo docs/THEME.md tương tự các trang admin khác.
 */
function AdminMarkerItem({ marker, onViewDetail, onToggleStatus }: AdminMarkerItemProps) {
    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Khu vực ảnh thumbnail + thông tin marker */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <button
                        type="button"
                        onClick={() => onViewDetail(marker)}
                        className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/40 p-1 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-16 sm:w-16"
                        title="Xem chi tiết marker"
                    >
                        <img
                            src={marker.imageUrl}
                            alt={`Marker ${marker.number}`}
                            className="h-full w-full object-contain"
                        />
                        <span
                            className={cn(
                                'absolute right-1 bottom-1 h-2.5 w-2.5 rounded-full border-2 border-surface shadow-xs',
                                marker.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/60',
                            )}
                            title={marker.isActive ? 'Đang bật' : 'Đã tắt'}
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onViewDetail(marker)}
                                className="cursor-pointer truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                Marker số #{marker.number}
                            </button>

                            <Badge
                                tone={marker.isActive ? 'success' : 'neutral'}
                                className="h-5 justify-center px-2 text-center font-normal text-[11px] leading-none"
                            >
                                {marker.isActive ? 'Đang bật' : 'Đã tắt'}
                            </Badge>

                            {marker.markerScore !== null ? (
                                <Badge
                                    tone={
                                        marker.markerScore >= 75
                                            ? 'success'
                                            : marker.markerScore >= 50
                                              ? 'info'
                                              : 'warning'
                                    }
                                    className="h-5 justify-center px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    Điểm: {marker.markerScore}/100
                                </Badge>
                            ) : (
                                <Badge
                                    tone="neutral"
                                    className="h-5 justify-center px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    Chưa có điểm
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground/80" />
                                <span>
                                    {marker.validatedAt
                                        ? `Xác thực: ${adminDate(marker.validatedAt)}`
                                        : 'Chưa ghi nhận xác thực'}
                                </span>
                            </span>
                            <span>•</span>
                            <span className="font-mono text-[11px]">
                                ID: {marker.id.slice(0, 8)}...
                            </span>
                            <span>•</span>
                            <a
                                href={marker.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                title="Mở ảnh gốc trong tab mới"
                            >
                                <span>Ảnh gốc</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Cụm nút hành động */}
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetail(marker)}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Chi tiết</span>
                    </Button>
                    <Button
                        type="button"
                        variant={marker.isActive ? 'outline' : 'secondary'}
                        size="sm"
                        onClick={() => onToggleStatus(marker)}
                        className="h-8 gap-1.5 px-2.5 text-xs"
                    >
                        <Power className="h-3.5 w-3.5" />
                        <span>{marker.isActive ? 'Tắt marker' : 'Bật marker'}</span>
                    </Button>
                </div>
            </div>
        </li>
    );
}

export function AdminMarkersPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readAdminQueueSearch(params);

    const [testingOpen, setTestingOpen] = useState(false);
    const [detailMarker, setDetailMarker] = useState<BookariaMarker | null>(null);
    const [toggleMarker, setToggleMarker] = useState<BookariaMarker | null>(null);

    const isRegistering = params.get('register') === '1';

    const list = useQuery({
        queryKey: libraryKeys.markers(user?.id || '', query),
        queryFn: ({ signal }) => libraryApi.markers(query, signal),
    });

    const handleOpenRegister = () => {
        setTestingOpen(false);
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.set('register', '1');
                return next;
            },
            { replace: true },
        );
    };

    const handleCloseRegister = () => {
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('register');
                return next;
            },
            { replace: true },
        );
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header đồng bộ chuẩn thiết kế THEME.md */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl tracking-tight">Bộ marker Bookaria</h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Quản lý marker dùng để nhận diện trang sách thực tế và đồng bộ hiển thị AR.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" onClick={() => setTestingOpen(true)}>
                        <ScanLine data-icon="inline-start" className="h-4 w-4" />
                        Thử điểm marker
                    </Button>
                    <Button onClick={handleOpenRegister}>
                        <Plus data-icon="inline-start" className="h-4 w-4" />
                        Đăng ký marker
                    </Button>
                </div>
            </div>

            {/* Thông báo nguyên tắc cấp phát marker */}
            <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border/80 bg-surface/60 p-4 text-muted-foreground text-xs shadow-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="space-y-1">
                    <p className="font-medium text-foreground text-xs">
                        Quy tắc cấp phát marker hệ thống
                    </p>
                    <p className="leading-relaxed">
                        Bật marker để hệ thống tự động cấp phát cho các trang sách AR mới khi người
                        dùng biên tập nội dung. Tắt marker sẽ ngừng việc cấp phát mới; các trang sách
                        hoặc phiên bản đã sử dụng marker này trước đây sẽ không bị thay đổi.
                    </p>
                </div>
            </div>

            {/* Trạng thái tải dữ liệu và lỗi */}
            {list.isPending && <LoadingState layout="rows">Đang tải marker…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

            {list.isSuccess && (
                <>
                    {/* Thanh số lượng & Làm mới dữ liệu */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-muted-foreground text-sm">
                            Hiển thị{' '}
                            <strong className="font-medium text-foreground">
                                {list.data.data.length}
                            </strong>{' '}
                            trên{' '}
                            <strong className="font-medium text-foreground">
                                {list.data.meta.total}
                            </strong>{' '}
                            marker
                        </p>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {/* Danh sách marker */}
                    {list.data.data.length > 0 ? (
                        <ul className="m-0 list-none space-y-3 p-0">
                            {list.data.data.map((marker) => (
                                <AdminMarkerItem
                                    key={marker.id}
                                    marker={marker}
                                    onViewDetail={(m) => setDetailMarker(m)}
                                    onToggleStatus={(m) => setToggleMarker(m)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state rounded-[var(--radius-lg)] border border-border border-dashed px-5 py-16 text-center">
                            <EmptyHeader>
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                                    <ScanLine className="h-6 w-6" />
                                </div>
                                <EmptyTitle>
                                    <h2 className="font-semibold text-lg">
                                        Chưa có marker Bookaria nào
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p className="mt-1 text-muted-foreground text-sm">
                                        Đăng ký ảnh marker để hệ thống tự tạo nhận diện AR và cấp số
                                        marker vào thư viện.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            <div className="mt-4 flex justify-center gap-2">
                                <Button onClick={handleOpenRegister}>
                                    <Plus data-icon="inline-start" className="h-4 w-4" />
                                    Đăng ký marker đầu tiên
                                </Button>
                            </div>
                        </Empty>
                    )}

                    {/* Phân trang */}
                    <AdminPager page={query.page} meta={list.data.meta} busy={list.isFetching} />
                </>
            )}

            {/* Modal đăng ký marker */}
            {isRegistering && <MarkerRegistrationDialog onClose={handleCloseRegister} />}

            {/* Modal thử điểm chất lượng marker */}
            {testingOpen && <MarkerTestDialog onClose={() => setTestingOpen(false)} />}

            {/* Modal xem chi tiết marker */}
            <MarkerDetailModal
                marker={detailMarker}
                isOpen={Boolean(detailMarker)}
                onClose={() => setDetailMarker(null)}
                onToggleStatus={(m) => {
                    setDetailMarker(null);
                    setToggleMarker(m);
                }}
                onTestMarker={() => {
                    setDetailMarker(null);
                    setTestingOpen(true);
                }}
            />

            {/* Modal xác nhận bật/tắt marker */}
            <MarkerToggleModal
                marker={toggleMarker}
                isOpen={Boolean(toggleMarker)}
                onClose={() => setToggleMarker(null)}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}
