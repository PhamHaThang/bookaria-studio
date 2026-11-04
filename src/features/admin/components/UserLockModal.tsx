import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, ShieldAlert, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { AdminUpdateUserBodySchema } from '@/shared/contracts/api/admin.schema';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys } from '../model';

interface UserLockModalProps {
    user: AdminUser | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function UserLockModal({ user, isOpen, onClose, onSuccess }: UserLockModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const isSelf = Boolean(
        currentAdmin?.id && user?.id && currentAdmin.id.toLowerCase() === user.id.toLowerCase(),
    );

    const isLocking = user?.status !== 'LOCKED';
    const nextStatus = isLocking ? 'LOCKED' : 'ACTIVE';

    const [reason, setReason] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setFieldError(null);
            setApiError(null);
        }
    }, [isOpen]);

    const lockMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error('Không tìm thấy tài khoản');
            return adminApi.updateUser(user.id, {
                status: nextStatus,
                reason: reason.trim(),
            });
        },
        onSuccess: () => {
            toast.success(
                isLocking
                    ? `Đã khóa tài khoản "${user?.displayName}" thành công.`
                    : `Đã mở khóa tài khoản "${user?.displayName}" thành công.`,
            );
            if (currentAdmin?.id) {
                queryClient.invalidateQueries({ queryKey: adminKeys.all(currentAdmin.id) });
            }
            onSuccess?.();
            onClose();
        },
        onError: (err) => {
            setApiError(errorMessage(err));
        },
    });

    if (!user) return null;

    const initials = (user.displayName || user.email || 'U').trim().slice(0, 2).toUpperCase();

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFieldError(null);
        setApiError(null);

        if (!reason.trim()) {
            setFieldError('Vui lòng nhập lý do để lưu vào nhật ký kiểm toán hệ thống.');
            return;
        }

        const parseResult = AdminUpdateUserBodySchema.safeParse({
            status: nextStatus,
            reason: reason.trim(),
        });

        if (!parseResult.success) {
            setFieldError(parseResult.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
            return;
        }

        lockMutation.mutate();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !lockMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-w-lg p-6 sm:p-7">
                <DialogHeader className="pb-1">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {isLocking ? (
                            <>
                                <Lock className="h-5 w-5 text-destructive" />
                                <span>Khóa tài khoản người dùng</span>
                            </>
                        ) : (
                            <>
                                <Unlock className="h-5 w-5 text-emerald-500" />
                                <span>Mở khóa tài khoản người dùng</span>
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        {isLocking
                            ? 'Khóa tài khoản sẽ đăng xuất người dùng khỏi mọi thiết bị và chuyển sách công khai về chế độ riêng tư.'
                            : 'Mở khóa sẽ khôi phục quyền truy cập cho phép người dùng đăng nhập lại vào hệ thống.'}
                    </DialogDescription>
                </DialogHeader>

                {/* Banner tóm tắt người dùng */}
                <div className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-muted/20 p-4">
                    <Avatar className="h-12 w-12 border border-border shadow-xs">
                        {user.avatarUrl && (
                            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                        )}
                        <AvatarFallback className="bg-primary/10 font-bold text-base text-primary">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate font-semibold text-base text-foreground">
                            {user.displayName}
                        </p>
                        <p className="truncate font-mono text-muted-foreground text-xs">
                            {user.email}
                        </p>
                    </div>
                </div>

                {isSelf && (
                    <Alert tone="danger" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            Không thể tự khóa tài khoản
                        </span>
                        <p className="mt-1">
                            Bạn không thể tự khóa tài khoản quản trị mà bạn đang sử dụng.
                        </p>
                    </Alert>
                )}

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="lock-reason">
                                <span>
                                    Lý do {isLocking ? 'khóa' : 'mở khóa'}{' '}
                                    <span className="text-destructive">*</span>
                                </span>
                            </FieldLabel>
                            <Textarea
                                id="lock-reason"
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (fieldError) setFieldError(null);
                                }}
                                placeholder={
                                    isLocking
                                        ? 'Ví dụ: Vi phạm quy định xuất bản sách hoặc theo yêu cầu xử lý khiếu nại…'
                                        : 'Ví dụ: Đã giải quyết xong khiếu nại, mở lại tài khoản theo yêu cầu…'
                                }
                                rows={3}
                                maxLength={500}
                                disabled={isSelf || lockMutation.isPending}
                                className={fieldError ? 'border-destructive' : ''}
                                required
                            />
                            {fieldError && <FieldError>{fieldError}</FieldError>}
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="mt-5 flex items-center justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={lockMutation.isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            variant={isLocking ? 'destructive' : 'default'}
                            disabled={isSelf || lockMutation.isPending}
                        >
                            {lockMutation.isPending
                                ? 'Đang xử lý…'
                                : isLocking
                                  ? 'Khóa tài khoản'
                                  : 'Mở khóa tài khoản'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
