import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import { Alert } from '@/shared/ui/Alert';
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
import { adminKeys } from '../model';

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
                reason: `[XÓA TÀI KHOẢN] ${reason.trim()}`,
            });
        },
        onSuccess: () => {
            toast.success(`Đã vô hiệu hóa và xóa tài khoản "${user?.displayName}" khỏi hệ thống.`);
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
            errors.reason = 'Vui lòng nhập lý do xóa để lưu lại vào hồ sơ kiểm toán hệ thống.';
        }

        if (!isConfirmed) {
            errors.confirm = 'Vui lòng tích chọn xác nhận để tiếp tục thao tác xóa tài khoản.';
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
            <AlertDialogContent className="max-w-lg p-6 sm:p-7">
                <AlertDialogHeader className="pb-1">
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive text-xl">
                        <AlertTriangle className="h-5 w-5" />
                        Xác nhận xóa tài khoản người dùng
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
                        Thao tác này mang tính phá hủy. Tài khoản sẽ bị đóng băng vĩnh viễn, mọi
                        phiên đăng nhập sẽ bị thu hồi và các đầu sách công khai sẽ được chuyển về
                        chế độ riêng tư.
                    </AlertDialogDescription>
                </AlertDialogHeader>

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

                {isSelf ? (
                    <Alert tone="danger" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            Không thể xóa tài khoản của chính mình
                        </span>
                        <p className="mt-1">
                            Hệ thống không cho phép quản trị viên tự xóa tài khoản của mình.
                        </p>
                    </Alert>
                ) : (
                    <Alert tone="danger" className="text-xs">
                        <span>
                            Hành động này không thể hoàn tác trực tiếp trên giao diện. Xin vui lòng
                            kiểm tra kỹ lưỡng trước khi xác nhận.
                        </span>
                    </Alert>
                )}

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                {!isSelf && (
                    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                        <FieldGroup className="gap-4">
                            {/* Lý do xóa */}
                            <Field>
                                <FieldLabel htmlFor="delete-reason">
                                    <span>
                                        Lý do xóa tài khoản{' '}
                                        <span className="text-destructive">*</span>
                                    </span>
                                </FieldLabel>
                                <Textarea
                                    id="delete-reason"
                                    value={reason}
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                        if (fieldErrors.reason) {
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                reason: undefined,
                                            }));
                                        }
                                    }}
                                    placeholder="Ví dụ: Theo yêu cầu của người dùng hoặc vi phạm nghiêm trọng chính sách cộng đồng…"
                                    rows={3}
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
                                <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border/80 bg-muted/20 p-3.5 transition-colors">
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
                                        className="cursor-pointer select-none text-foreground text-xs leading-relaxed"
                                    >
                                        Tôi đã đọc cảnh báo và xác nhận muốn vô hiệu hóa vĩnh viễn
                                        tài khoản của{' '}
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

                        <AlertDialogFooter className="mt-6 flex items-center justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={onClose}
                                disabled={deleteMutation.isPending}
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 className="h-4 w-4" data-icon="inline-start" />
                                {deleteMutation.isPending ? 'Đang xóa…' : 'Xác nhận xóa tài khoản'}
                            </Button>
                        </AlertDialogFooter>
                    </form>
                )}

                {isSelf && (
                    <AlertDialogFooter className="mt-4">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Đóng
                        </Button>
                    </AlertDialogFooter>
                )}
            </AlertDialogContent>
        </AlertDialog>
    );
}
