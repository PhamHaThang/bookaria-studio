import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type AdminUpdateUserBody,
    AdminUpdateUserBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import type { UserRole, UserStatus } from '@/shared/contracts/enums.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/primitives/select';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys, userChanges } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { AdminDialog } from './AdminDialog';
import {
    initialUserStorageQuota,
    UserStorageQuotaField,
    userStorageQuotaBytes,
} from './UserStorageQuotaField';
import { UserSummary } from './UserSummary';

interface UserUpdateModalProps {
    user: AdminUser | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function UserUpdateModal({ user, isOpen, onClose, onSuccess }: UserUpdateModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const isSelf = Boolean(
        currentAdmin?.id && user?.id && currentAdmin.id.toLowerCase() === user.id.toLowerCase(),
    );

    // Form states
    const [role, setRole] = useState<UserRole>('AUTHOR');
    const [status, setStatus] = useState<UserStatus>('ACTIVE');
    const [storageQuota, setStorageQuota] = useState(() => initialUserStorageQuota());
    const [reason, setReason] = useState('');

    // Error states
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // Synchronize initial state whenever user opens
    useEffect(() => {
        if (user && isOpen) {
            setRole(user.role);
            setStatus(user.status);
            setStorageQuota(initialUserStorageQuota(user.storage.quotaBytes));
            setReason('');
            setFieldErrors({});
            setApiError(null);
        }
    }, [user, isOpen]);

    const updateMutation = useMutation({
        mutationFn: (body: AdminUpdateUserBody) => {
            if (!user?.id) throw new Error('Không tìm thấy tài khoản');
            return adminApi.updateUser(user.id, body);
        },
        onSuccess: (_result) => {
            toast.success(`Đã cập nhật thông tin tài khoản thành công!`);
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
        setFieldErrors({});
        setApiError(null);

        const storageQuotaBytes = userStorageQuotaBytes(storageQuota);
        if (storageQuotaBytes === null) {
            setFieldErrors({
                storageQuotaBytes: 'Nhập dung lượng lớn hơn 0 và trong phạm vi cho phép.',
            });
            return;
        }

        // Compute changes compared to original user
        const diff = userChanges(user, {
            role,
            status,
            quota: String(storageQuotaBytes),
            reason,
        });

        const isStatusOrRoleChanged = diff.role !== undefined || diff.status !== undefined;
        const isQuotaChanged = diff.storageQuotaBytes !== undefined;

        if (!isStatusOrRoleChanged && !isQuotaChanged) {
            toast.info('Bạn chưa thay đổi thông tin nào của người dùng.', {
                id: `admin-user-unchanged-${user.id}`,
            });
            return;
        }

        const parseResult = AdminUpdateUserBodySchema.safeParse(diff);
        if (!parseResult.success) {
            const errors: Record<string, string> = {};
            for (const issue of parseResult.error.issues) {
                const path = issue.path[0] as string;
                if (!errors[path]) {
                    errors[path] = issue.message;
                }
            }
            setFieldErrors(errors);
            return;
        }

        updateMutation.mutate(parseResult.data);
    };

    const hasCriticalChange = role !== user.role || status !== user.status;

    return (
        <AdminDialog
            open={isOpen}
            busy={updateMutation.isPending}
            onClose={onClose}
            title="Cập nhật tài khoản người dùng"
            description="Điều chỉnh vai trò, trạng thái và hạn mức lưu trữ."
        >
            <Feedback error={apiError} errorMode="toast" />
            <form
                id="admin-user-update-form"
                noValidate
                onSubmit={handleSubmit}
                className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1"
            >
                <UserSummary user={user} />

                {isSelf && (
                    <Alert tone="warning" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            Bạn đang chỉnh sửa tài khoản của chính mình
                        </span>
                        <p className="m-0 mt-1">
                            Để đảm bảo an toàn hệ thống, bạn không thể tự thay đổi vai trò hoặc tự
                            khóa tài khoản của mình.
                        </p>
                    </Alert>
                )}

                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {/* Vai trò */}
                    <Field>
                        <FieldLabel htmlFor="edit-role">Vai trò tài khoản</FieldLabel>
                        <Select
                            value={role}
                            onValueChange={(val) => setRole(val as UserRole)}
                            disabled={isSelf || updateMutation.isPending}
                        >
                            <SelectTrigger id="edit-role">
                                <SelectValue placeholder="Chọn vai trò" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AUTHOR">Tác giả (AUTHOR)</SelectItem>
                                <SelectItem value="ADMIN">Quản trị viên (ADMIN)</SelectItem>
                            </SelectContent>
                        </Select>
                        {role !== user.role && (
                            <p className="m-0 text-warning-foreground text-xs">
                                Thay đổi vai trò yêu cầu bắt buộc phải nhập lý do bên dưới.
                            </p>
                        )}
                    </Field>

                    {/* Trạng thái */}
                    <Field>
                        <FieldLabel htmlFor="edit-status">Trạng thái hoạt động</FieldLabel>
                        <Select
                            value={status}
                            onValueChange={(val) => setStatus(val as UserStatus)}
                            disabled={isSelf || updateMutation.isPending}
                        >
                            <SelectTrigger id="edit-status">
                                <SelectValue placeholder="Chọn trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Hoạt động (ACTIVE)</SelectItem>
                                <SelectItem value="LOCKED">Đã khóa (LOCKED)</SelectItem>
                            </SelectContent>
                        </Select>
                        {status === 'LOCKED' && status !== user.status && (
                            <p className="m-0 text-destructive text-xs">
                                Khóa tài khoản sẽ thu hồi mọi phiên đăng nhập và chuyển toàn bộ sách
                                công khai về riêng tư.
                            </p>
                        )}
                    </Field>

                    <UserStorageQuotaField
                        id="edit-quota"
                        value={storageQuota}
                        disabled={updateMutation.isPending}
                        error={fieldErrors.storageQuotaBytes}
                        onChange={(value) => {
                            setStorageQuota(value);
                            if (fieldErrors.storageQuotaBytes) {
                                setFieldErrors((prev) => ({ ...prev, storageQuotaBytes: '' }));
                            }
                        }}
                    />

                    {/* Lý do thay đổi */}
                    <Field className="sm:col-span-2">
                        <FieldLabel htmlFor="edit-reason">
                            <span>
                                Lý do thay đổi{' '}
                                {hasCriticalChange ? (
                                    <span className="text-destructive">* (Bắt buộc)</span>
                                ) : (
                                    <span className="font-normal text-muted-foreground">
                                        (Không bắt buộc)
                                    </span>
                                )}
                            </span>
                        </FieldLabel>
                        <Textarea
                            id="edit-reason"
                            value={reason}
                            onChange={(e) => {
                                const val = e.target.value;
                                setReason(val);
                                if (fieldErrors.reason && val.trim()) {
                                    setFieldErrors((prev) => ({ ...prev, reason: '' }));
                                }
                            }}
                            placeholder={
                                hasCriticalChange
                                    ? 'Nhập lý do đổi vai trò hoặc khóa/mở khóa tài khoản…'
                                    : 'Ghi chú lý do thay đổi hạn mức…'
                            }
                            rows={3}
                            maxLength={500}
                            disabled={updateMutation.isPending}
                            className={fieldErrors.reason ? 'border-destructive' : ''}
                            required={hasCriticalChange}
                        />
                        {fieldErrors.reason && <FieldError>{fieldErrors.reason}</FieldError>}
                    </Field>
                </FieldGroup>
            </form>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                >
                    Hủy
                </Button>
                <Button
                    type="submit"
                    form="admin-user-update-form"
                    disabled={updateMutation.isPending}
                >
                    {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                </Button>
            </DialogFooter>
        </AdminDialog>
    );
}
