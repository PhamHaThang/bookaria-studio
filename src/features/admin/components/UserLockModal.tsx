import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { AdminUpdateUserBodySchema } from '@/shared/contracts/api/admin.schema';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { AdminDialog } from './AdminDialog';
import { UserSummary } from './UserSummary';

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
        <AdminDialog
            open={isOpen}
            busy={lockMutation.isPending}
            onClose={onClose}
            title={isLocking ? 'Khóa tài khoản người dùng' : 'Mở khóa tài khoản người dùng'}
            description={
                isLocking
                    ? 'Khóa tài khoản sẽ đăng xuất người dùng khỏi mọi thiết bị và chuyển sách công khai sang riêng tư.'
                    : 'Người dùng có thể đăng nhập lại sau khi được mở khóa.'
            }
            className="max-w-[min(480px,calc(100vw-32px))]"
        >
            <Feedback error={apiError} errorMode="toast" />
            <form
                id="admin-user-lock-form"
                onSubmit={handleSubmit}
                className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1"
            >
                <UserSummary user={user} />

                {isSelf && (
                    <Alert tone="danger" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            Không thể tự khóa tài khoản
                        </span>
                        <p className="m-0 mt-1">
                            Bạn không thể tự khóa tài khoản quản trị mà bạn đang sử dụng.
                        </p>
                    </Alert>
                )}

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
                                const val = e.target.value;
                                setReason(val);
                                if (fieldError && val.trim()) setFieldError(null);
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
            </form>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={lockMutation.isPending}
                >
                    Hủy
                </Button>
                <Button
                    type="submit"
                    form="admin-user-lock-form"
                    variant={isLocking ? 'destructive' : 'default'}
                    disabled={isSelf || lockMutation.isPending || !reason.trim()}
                >
                    {lockMutation.isPending
                        ? 'Đang xử lý…'
                        : isLocking
                          ? 'Khóa tài khoản'
                          : 'Mở khóa tài khoản'}
                </Button>
            </DialogFooter>
        </AdminDialog>
    );
}
