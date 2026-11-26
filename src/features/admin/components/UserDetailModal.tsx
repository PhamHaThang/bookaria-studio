import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, Clock, HardDrive, Lock, Pencil, Unlock } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { bookStatusLabels } from '@/features/books';
import type { AdminUserDetails } from '@/shared/contracts/api/admin.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { adminApi } from '../client';
import { adminDate, adminKeys, bytesLabel, visibilityLabel } from '../model';
import { AdminDialog } from './AdminDialog';
import { UserSummary } from './UserSummary';

interface UserDetailModalProps {
    userId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (user: AdminUserDetails) => void;
    onLock?: (user: AdminUserDetails) => void;
}

export function UserDetailModal({ userId, isOpen, onClose, onEdit, onLock }: UserDetailModalProps) {
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
    const isSelf = Boolean(
        currentAdmin?.id &&
            userDetails?.id &&
            currentAdmin.id.toLowerCase() === userDetails.id.toLowerCase(),
    );

    return (
        <AdminDialog
            open={isOpen}
            onClose={onClose}
            title="Chi tiết người dùng"
            description="Thông tin tài khoản, dung lượng lưu trữ và sách đã tạo."
            className="max-w-[min(680px,calc(100vw-32px))]"
        >
            <div className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1">
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
                    <div className="flex flex-col gap-4">
                        <UserSummary user={userDetails} />
                        {userDetails.bio && (
                            <p className="m-0 text-muted-foreground text-sm">{userDetails.bio}</p>
                        )}
                        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                            <div className="space-y-3 rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
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

                                <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
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

                            <div className="space-y-2.5 rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                        <span>Tổng số sách:</span>
                                    </span>
                                    <Badge tone="neutral" className="font-semibold text-xs">
                                        {userDetails.bookCount} sách
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Calendar className="h-4 w-4 text-muted-foreground/80" />
                                        <span>Ngày tham gia:</span>
                                    </span>
                                    <span className="font-medium text-foreground">
                                        {adminDate(userDetails.createdAt)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
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

                        <div className="flex flex-col gap-2">
                            <h3 className="m-0 font-semibold text-foreground text-sm">
                                Tác phẩm đã tạo ({userDetails.books?.length ?? 0})
                            </h3>

                            {userDetails.books && userDetails.books.length > 0 ? (
                                <div className="divide-y divide-border rounded-lg border border-border">
                                    {userDetails.books.map((book) => (
                                        <div
                                            key={book.id}
                                            className="flex items-center justify-between gap-2 p-3 text-xs"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="m-0 font-medium text-foreground text-sm">
                                                    {book.title}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
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
                                                {book.takenDown
                                                    ? 'Đã gỡ'
                                                    : bookStatusLabels[book.status]}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="m-0 rounded-lg bg-muted/40 p-3 text-muted-foreground text-sm">
                                    Tác giả này chưa tạo cuốn sách nào trên hệ thống.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button variant="outline" onClick={onClose}>
                    Đóng
                </Button>
                {userDetails && !isSelf && onLock && (
                    <Button
                        variant="outline"
                        className={isLocked ? undefined : 'text-destructive'}
                        onClick={() => {
                            onClose();
                            onLock(userDetails);
                        }}
                    >
                        {isLocked ? (
                            <Unlock data-icon="inline-start" />
                        ) : (
                            <Lock data-icon="inline-start" />
                        )}
                        {isLocked ? 'Mở khóa' : 'Khóa'}
                    </Button>
                )}
                {userDetails && onEdit && (
                    <Button
                        onClick={() => {
                            onClose();
                            onEdit(userDetails);
                        }}
                    >
                        <Pencil data-icon="inline-start" />
                        Cập nhật tài khoản
                    </Button>
                )}
            </DialogFooter>
        </AdminDialog>
    );
}
