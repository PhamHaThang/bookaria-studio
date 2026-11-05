import { useQuery } from '@tanstack/react-query';
import {
    BookOpen,
    Calendar,
    Clock,
    HardDrive,
    Lock,
    Pencil,
    ShieldCheck,
    Trash2,
    Unlock,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import type { AdminUserDetails } from '@/shared/contracts/api/admin.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { adminApi } from '../client';
import {
    adminDate,
    adminKeys,
    bytesLabel,
    roleLabel,
    statusLabel,
    visibilityLabel,
} from '../model';

interface UserDetailModalProps {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (user: AdminUserDetails) => void;
    onLock?: (user: AdminUserDetails) => void;
    onDelete?: (user: AdminUserDetails) => void;
}

export function UserDetailModal({
    userId,
    isOpen,
    onClose,
    onEdit,
    onLock,
    onDelete,
}: UserDetailModalProps) {
    const { user: currentAdmin } = useAuth();

    const {
        data: userDetails,
        isPending,
        isError,
    } = useQuery<AdminUserDetails>({
        queryKey: adminKeys.user(currentAdmin?.id || '', userId || ''),
        queryFn: ({ signal }) => {
            if (!userId) throw new Error('No user ID');
            return adminApi.user(userId, signal);
        },
        enabled: Boolean(userId && isOpen),
    });

    if (!isOpen) return null;

    const usedBytes = userDetails?.storage?.usedBytes ?? 0;
    const quotaBytes = Math.max(1, userDetails?.storage?.quotaBytes ?? 1);
    const usedPercent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

    const isLocked = userDetails?.status === 'LOCKED';
    const isAdmin = userDetails?.role === 'ADMIN';

    const initials = (userDetails?.displayName || userDetails?.email || 'U')
        .trim()
        .slice(0, 2)
        .toUpperCase();

    const isSelf = Boolean(
        currentAdmin?.id &&
            userDetails?.id &&
            currentAdmin.id.toLowerCase() === userDetails.id.toLowerCase(),
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-6 sm:p-7">
                <DialogHeader className="gap-1.5 pb-2">
                    <DialogTitle className="m-0 text-xl leading-tight">
                        Chi tiết người dùng
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Xem thông tin tài khoản, hạn mức lưu trữ và các đầu sách của tác giả.
                    </DialogDescription>
                </DialogHeader>

                {isPending && (
                    <div className="py-12">
                        <LoadingState layout="rows">Đang tải thông tin chi tiết…</LoadingState>
                    </div>
                )}

                {isError && (
                    <div className="py-12 text-center text-destructive text-sm">
                        Không thể tải thông tin người dùng. Vui lòng thử lại.
                    </div>
                )}

                {userDetails && (
                    <div className="space-y-6 pt-1">
                        {/* Khối hồ sơ chính - Tối ưu spacing, căn lề cân đối và khắc phục khoảng hụt thị giác */}
                        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs sm:p-6">
                            {/* Hàng trên: Căn giữa Avatar theo trục dọc với khối thông tin nhận diện */}
                            <div className="flex items-center gap-4 sm:gap-5">
                                <div className="relative shrink-0">
                                    <Avatar className="h-16 w-16 border-2 border-border shadow-xs">
                                        {userDetails.avatarUrl && (
                                            <AvatarImage
                                                src={userDetails.avatarUrl}
                                                alt={userDetails.displayName}
                                            />
                                        )}
                                        <AvatarFallback className="bg-primary/10 font-bold text-lg text-primary">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span
                                        className={cn(
                                            'absolute right-0.5 bottom-0.5 h-4 w-4 rounded-full border-2 border-surface shadow-xs',
                                            isLocked ? 'bg-destructive' : 'bg-emerald-500',
                                        )}
                                        title={isLocked ? 'Đã khóa' : 'Hoạt động'}
                                    />
                                </div>

                                <div className="min-w-0 flex-1 space-y-2">
                                    {/* Hàng 1: Tên người dùng và các chip badge nhỏ gọn, cân đối */}
                                    <div className="flex items-center gap-2.5">
                                        <h3 className="m-0 truncate font-bold text-foreground text-l leading-tight tracking-tight">
                                            {userDetails.displayName}
                                        </h3>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <Badge
                                                tone={isAdmin ? 'info' : 'neutral'}
                                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                            >
                                                {isAdmin && (
                                                    <ShieldCheck className="size-3 shrink-0" />
                                                )}
                                                <span>{roleLabel[userDetails.role]}</span>
                                            </Badge>
                                            <Badge
                                                tone={isLocked ? 'danger' : 'success'}
                                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                            >
                                                {isLocked ? (
                                                    <>
                                                        <Lock className="size-3 shrink-0" />
                                                        <span>
                                                            {statusLabel[userDetails.status]}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                                                        <span>
                                                            {statusLabel[userDetails.status]}
                                                        </span>
                                                    </>
                                                )}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Hàng 2: Email (giảm font size xuống 11px tinh tế) */}
                                    <p className="m-0 font-mono text-[12px] text-muted-foreground leading-normal">
                                        {userDetails.email}
                                    </p>

                                    {/* Hàng 3: Đơn vị công tác (giảm font size xuống 11px) */}
                                    {userDetails.organization && (
                                        <p className="m-0 text-[12px] text-muted-foreground leading-normal">
                                            Đơn vị công tác:{' '}
                                            <span className="font-medium text-foreground">
                                                {userDetails.organization}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Hàng dưới: Hộp ghi chú / Tiểu sử (Bio) trải đều toàn bộ chiều ngang card */}
                            {userDetails.bio && (
                                <div className="mt-4.5 rounded-[var(--radius-md)] border border-border/70 bg-muted/40 p-3.5 text-muted-foreground text-xs leading-relaxed sm:mt-5">
                                    <p className="font-normal">{userDetails.bio}</p>
                                </div>
                            )}
                        </div>

                        {/* Thống kê tài nguyên & Hoạt động - 2 Card thoáng đãng */}
                        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                            {/* Card 1: Dung lượng lưu trữ */}
                            <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4.5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 font-medium text-muted-foreground text-xs">
                                        <HardDrive className="h-4 w-4 text-primary" />
                                        <span>Dung lượng lưu trữ</span>
                                    </span>
                                    <span
                                        className={cn(
                                            'font-mono font-semibold text-xs',
                                            usedPercent >= 90
                                                ? 'text-destructive'
                                                : usedPercent >= 75
                                                  ? 'text-amber-500'
                                                  : 'text-foreground',
                                        )}
                                    >
                                        {usedPercent}% đã dùng
                                    </span>
                                </div>

                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all duration-300',
                                            usedPercent >= 90
                                                ? 'bg-destructive'
                                                : usedPercent >= 75
                                                  ? 'bg-amber-500'
                                                  : 'bg-primary',
                                        )}
                                        style={{ width: `${usedPercent}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                                    <span>
                                        Đã dùng:{' '}
                                        <strong className="text-foreground">
                                            {bytesLabel(usedBytes)}
                                        </strong>
                                    </span>
                                    <span>
                                        Hạn mức:{' '}
                                        <strong className="text-foreground">
                                            {bytesLabel(quotaBytes)}
                                        </strong>
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Hoạt động & Thời gian */}
                            <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-border bg-surface p-4.5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        <span>Tổng số sách:</span>
                                    </span>
                                    <Badge tone="neutral" className="font-semibold text-xs">
                                        {userDetails.bookCount} sách
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="h-4 w-4 text-muted-foreground/80" />
                                        <span>Ngày tham gia:</span>
                                    </span>
                                    <span className="font-medium text-foreground">
                                        {adminDate(userDetails.createdAt)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Clock className="h-4 w-4 text-muted-foreground/80" />
                                        <span>Đăng nhập cuối:</span>
                                    </span>
                                    <span className="font-medium text-foreground">
                                        {adminDate(userDetails.lastLoginAt) || 'Chưa đăng nhập'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Danh sách sách của người dùng */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-foreground text-sm">
                                    Tác phẩm đã tạo ({userDetails.books?.length ?? 0})
                                </h4>
                                <span className="text-muted-foreground text-xs">
                                    Danh sách các sách thuộc quyền sở hữu của tác giả
                                </span>
                            </div>

                            {userDetails.books && userDetails.books.length > 0 ? (
                                <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface">
                                    {userDetails.books.map((book) => (
                                        <div
                                            key={book.id}
                                            className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-muted/20"
                                        >
                                            <div className="min-w-0 flex-1 pr-4">
                                                <p className="truncate font-semibold text-foreground text-sm">
                                                    {book.title}
                                                </p>
                                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span>{book.pageCount} trang</span>
                                                    <span>•</span>
                                                    <span>{visibilityLabel[book.visibility]}</span>
                                                    <span>•</span>
                                                    <span>
                                                        Cập nhật: {adminDate(book.updatedAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge
                                                tone={book.takenDown ? 'danger' : 'neutral'}
                                                className="shrink-0 px-2.5 py-0.5 text-xs"
                                            >
                                                {book.takenDown ? 'Đã gỡ' : book.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-[var(--radius-lg)] border border-border border-dashed p-6 text-center text-muted-foreground text-xs">
                                    Tác giả này chưa tạo cuốn sách nào trên hệ thống.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-6 flex flex-col-reverse gap-3 border-border/70 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="secondary" onClick={onClose} className="px-5">
                        Đóng
                    </Button>
                    {userDetails && (
                        <div className="flex flex-wrap items-center gap-2.5">
                            {!isSelf && onDelete && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => {
                                        onClose();
                                        onDelete(userDetails);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" data-icon="inline-start" />
                                    <span>Xóa</span>
                                </Button>
                            )}

                            {!isSelf && onLock && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className={cn(
                                        'transition-colors',
                                        isLocked
                                            ? 'text-success-foreground hover:bg-success hover:text-success-foreground'
                                            : 'text-warning-foreground hover:bg-warning hover:text-warning-foreground',
                                    )}
                                    onClick={() => {
                                        onClose();
                                        onLock(userDetails);
                                    }}
                                >
                                    {isLocked ? (
                                        <Unlock className="h-4 w-4" data-icon="inline-start" />
                                    ) : (
                                        <Lock className="h-4 w-4" data-icon="inline-start" />
                                    )}
                                    <span>{isLocked ? 'Mở khóa' : 'Khóa'}</span>
                                </Button>
                            )}

                            {onEdit && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                        onClose();
                                        onEdit(userDetails);
                                    }}
                                    className="gap-1.5"
                                >
                                    <Pencil className="h-4 w-4" data-icon="inline-start" />
                                    <span>Cập nhật tài khoản</span>
                                </Button>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
