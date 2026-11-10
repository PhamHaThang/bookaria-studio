import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/shared/ui/primitives/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys, roleLabel, statusLabel } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';

interface UserDeleteModalProps {
    user: AdminUser | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function UserDeleteModal({ user, isOpen, onClose, onSuccess }: UserDeleteModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const isSelf = Boolean(
        currentAdmin?.id && user?.id && currentAdmin.id.toLowerCase() === user.id.toLowerCase(),
    );

    const [isConfirmed, setIsConfirmed] = useState(false);
    const [reason, setReason] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ reason?: string; confirm?: string }>({});
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsConfirmed(false);
            setReason('');
            setFieldErrors({});
            setApiError(null);
        }
    }, [isOpen]);

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!user?.id) throw new Error('Không tìm thấy tài khoản');
            return adminApi.updateUser(user.id, {
                status: 'LOCKED',
                reason: `[VÔ HIỆU HÓA TÀI KHOẢN] ${reason.trim()}`,
            });
        },
        onSuccess: () => {
            toast.success(`Đã vô hiệu hóa tài khoản "${user?.displayName}".`);
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
        setFieldErrors({});
        setApiError(null);

        const errors: { reason?: string; confirm?: string } = {};

        if (!reason.trim()) {
            errors.reason =
                'Vui lòng nhập lý do vô hiệu hóa để lưu lại vào hồ sơ kiểm toán hệ thống.';
        }

        if (!isConfirmed) {
            errors.confirm =
                'Vui lòng tích chọn xác nhận để tiếp tục thao tác vô hiệu hóa tài khoản.';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        deleteMutation.mutate();
    };

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !deleteMutation.isPending) {
                    onClose();
                }
            }}
        >
            <AlertDialogContent className="max-h-[88dvh] max-w-md overflow-y-auto p-5 sm:p-6">
                <AlertDialogHeader className="gap-1 pb-0.5">
                    <AlertDialogTitle className="m-0 flex items-center gap-2 text-destructive text-lg leading-tight sm:text-xl">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        Xác nhận vô hiệu hóa tài khoản
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm leading-relaxed sm:text-sm">
                        Tài khoản sẽ bị khóa, mọi phiên đăng nhập sẽ bị thu hồi và các đầu sách công
                        khai sẽ được chuyển về chế độ riêng tư. Có thể mở khóa lại từ quản lý tài
                        khoản; dữ liệu không bị xóa.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Banner tóm tắt người dùng nhỏ gọn, chống tràn viền */}
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-3 shadow-xs">
                    <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 border border-border shadow-xs">
                            {user.avatarUrl && (
                                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                            )}
                            <AvatarFallback className="bg-primary/10 font-bold text-primary text-sm">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span
                            className={cn(
                                'absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-surface shadow-xs',
                                user.status === 'LOCKED' ? 'bg-destructive' : 'bg-emerald-500',
                            )}
                            title={user.status === 'LOCKED' ? 'Đã khóa' : 'Hoạt động'}
                        />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                            <p className="m-0 truncate font-semibold text-foreground text-sm leading-tight">
                                {user.displayName}
                            </p>
                            <div className="flex shrink-0 items-center gap-1">
                                <Badge
                                    tone={user.role === 'ADMIN' ? 'info' : 'neutral'}
                                    className="h-5 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                                >
                                    {roleLabel[user.role]}
                                </Badge>
                                <Badge
                                    tone={user.status === 'LOCKED' ? 'danger' : 'success'}
                                    className="h-5 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                                >
                                    {statusLabel[user.status]}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                            <span className="truncate">{user.email}</span>
                            {user.organization && (
                                <>
                                    <span>•</span>
                                    <span className="truncate font-medium font-sans text-foreground/80">
                                        {user.organization}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {isSelf ? (
                    <Alert tone="danger" className="py-1.5 text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            Không thể vô hiệu hóa tài khoản của chính mình
                        </span>
                        <p className="mt-1">
                            Hệ thống không cho phép quản trị viên tự vô hiệu hóa tài khoản của mình.
                        </p>
                    </Alert>
                ) : (
                    <Alert tone="danger" className="-mb-2 py-2.5 text-xs">
                        <span>
                            Hành động này không thể hoàn tác trực tiếp trên giao diện. Xin vui lòng
                            kiểm tra kỹ lưỡng trước khi xác nhận.
                        </span>
                    </Alert>
                )}

                {apiError && (
                    <Alert tone="danger" className="py-2 text-xs">
                        {apiError}
                    </Alert>
                )}

                {!isSelf && (
                    <form onSubmit={handleSubmit} className="space-y-3.5 pt-0.5">
                        <FieldGroup className="gap-2">
                            {/* Lý do vô hiệu hóa */}
                            <Field>
                                <FieldLabel htmlFor="delete-reason" className="text-xs">
                                    <span>
                                        Lý do vô hiệu hóa tài khoản{' '}
                                        <span className="text-destructive">*</span>
                                    </span>
                                </FieldLabel>
                                <Textarea
                                    id="delete-reason"
                                    value={reason}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setReason(val);
                                        if (fieldErrors.reason && val.trim()) {
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                reason: undefined,
                                            }));
                                        }
                                    }}
                                    onBlur={() => {
                                        if (!reason.trim()) {
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                reason: 'Vui lòng nhập lý do vô hiệu hóa để lưu lại vào hồ sơ kiểm toán hệ thống.',
                                            }));
                                        }
                                    }}
                                    placeholder="Ví dụ: Theo yêu cầu của người dùng hoặc vi phạm nghiêm trọng chính sách cộng đồng…"
                                    rows={2}
                                    maxLength={500}
                                    disabled={deleteMutation.isPending}
                                    className={fieldErrors.reason ? 'border-destructive' : ''}
                                />
                                {fieldErrors.reason && (
                                    <FieldError>{fieldErrors.reason}</FieldError>
                                )}
                            </Field>

                            {/* Tích chọn xác nhận an toàn */}
                            <Field>
                                <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/20 bg-destructive/5 p-3 transition-colors">
                                    <Checkbox
                                        id="confirm-delete-checkbox"
                                        checked={isConfirmed}
                                        onCheckedChange={(checked) => {
                                            setIsConfirmed(Boolean(checked));
                                            if (fieldErrors.confirm) {
                                                setFieldErrors((prev) => ({
                                                    ...prev,
                                                    confirm: undefined,
                                                }));
                                            }
                                        }}
                                        disabled={deleteMutation.isPending}
                                        className="mt-0.5"
                                    />
                                    <label
                                        htmlFor="confirm-delete-checkbox"
                                        className="cursor-pointer select-none text-foreground text-xs leading-normal"
                                    >
                                        Tôi đã đọc cảnh báo và xác nhận muốn vô hiệu hóa tài khoản
                                        của{' '}
                                        <strong className="text-foreground">
                                            {user.displayName}
                                        </strong>
                                        .
                                    </label>
                                </div>
                                {fieldErrors.confirm && (
                                    <FieldError>{fieldErrors.confirm}</FieldError>
                                )}
                            </Field>
                        </FieldGroup>

                        <AlertDialogFooter className="mt-5 flex items-center justify-end gap-2.5 border-border/60 border-t pt-3.5">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={onClose}
                                disabled={deleteMutation.isPending}
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                                disabled={
                                    deleteMutation.isPending || !isConfirmed || !reason.trim()
                                }
                            >
                                <Trash2 className="h-4 w-4" data-icon="inline-start" />
                                {deleteMutation.isPending
                                    ? 'Đang vô hiệu hóa…'
                                    : 'Xác nhận vô hiệu hóa tài khoản'}
                            </Button>
                        </AlertDialogFooter>
                    </form>
                )}

                {isSelf && (
                    <AlertDialogFooter className="mt-4 border-border/60 border-t pt-3">
                        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                            Đóng
                        </Button>
                    </AlertDialogFooter>
                )}
            </AlertDialogContent>
        </AlertDialog>
    );
}
