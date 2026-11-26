import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type AdminCreateUserBody,
    AdminCreateUserBodySchema,
} from '@/shared/contracts/api/admin.schema';
import { LIMITS } from '@/shared/contracts/common.schema';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import type { UserRole } from '@/shared/contracts/enums.schema';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/primitives/select';
import { adminApi } from '../client';
import { adminKeys } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { AdminDialog } from './AdminDialog';
import {
    initialUserStorageQuota,
    UserStorageQuotaField,
    userStorageQuotaBytes,
} from './UserStorageQuotaField';

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (userId: string) => void;
}

export function UserCreateModal({ isOpen, onClose, onSuccess }: UserCreateModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('AUTHOR');
    const [storageQuota, setStorageQuota] = useState(() => initialUserStorageQuota());

    // Validation errors per field
    const [submitted, setSubmitted] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const validateField = (fieldName: 'displayName' | 'email' | 'password', value: string) => {
        if (fieldName === 'displayName') {
            const trimmed = value.trim();
            if (!trimmed) return 'Vui lòng nhập họ tên / tên hiển thị';
            if (trimmed.length > 100) return 'Tên hiển thị tối đa 100 ký tự';
        }
        if (fieldName === 'email') {
            const trimmed = value.trim();
            if (!trimmed) return 'Vui lòng nhập địa chỉ email';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                return 'Định dạng email không hợp lệ (ví dụ: user@example.com)';
            }
        }
        if (fieldName === 'password') {
            if (!value) return 'Vui lòng nhập mật khẩu ban đầu';
            if (value.length < LIMITS.passwordMinLength) {
                return `Mật khẩu tối thiểu ${LIMITS.passwordMinLength} ký tự`;
            }
        }
        return '';
    };

    const handleChange = (fieldName: 'displayName' | 'email' | 'password', val: string) => {
        if (fieldName === 'displayName') setDisplayName(val);
        if (fieldName === 'email') setEmail(val);
        if (fieldName === 'password') setPassword(val);
        if (submitted) {
            const err = validateField(fieldName, val);
            setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
        }
    };

    const resetForm = () => {
        setDisplayName('');
        setEmail('');
        setPassword('');
        setRole('AUTHOR');
        setStorageQuota(initialUserStorageQuota());
        setSubmitted(false);
        setFieldErrors({});
        setApiError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: (body: AdminCreateUserBody) => adminApi.createUser(body),
        onSuccess: (newUser: AdminUser) => {
            toast.success(`Đã tạo tài khoản cho "${newUser.displayName}" thành công!`);
            if (currentAdmin?.id) {
                queryClient.invalidateQueries({ queryKey: adminKeys.all(currentAdmin.id) });
            }
            onSuccess?.(newUser.id);
            handleClose();
        },
        onError: (err) => {
            setApiError(errorMessage(err));
        },
    });

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setApiError(null);

        const dErr = validateField('displayName', displayName);
        const eErr = validateField('email', email);
        const pErr = validateField('password', password);

        const storageQuotaBytes = userStorageQuotaBytes(storageQuota);
        setSubmitted(true);

        if (dErr || eErr || pErr || storageQuotaBytes === null) {
            setFieldErrors({
                ...(dErr ? { displayName: dErr } : {}),
                ...(eErr ? { email: eErr } : {}),
                ...(pErr ? { password: pErr } : {}),
                ...(storageQuotaBytes === null
                    ? { storageQuotaBytes: 'Nhập dung lượng lớn hơn 0 và trong phạm vi cho phép.' }
                    : {}),
            });
            return;
        }

        const payload = {
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            role,
            storageQuotaBytes,
        };

        const result = AdminCreateUserBodySchema.safeParse(payload);

        if (!result.success) {
            const errors: Record<string, string> = {};
            for (const issue of result.error.issues) {
                const path = issue.path[0] as string;
                if (!errors[path]) {
                    errors[path] = issue.message;
                }
            }
            setFieldErrors(errors);
            return;
        }

        createMutation.mutate(result.data);
    };

    return (
        <AdminDialog
            open={isOpen}
            busy={createMutation.isPending}
            onClose={handleClose}
            title="Tạo tài khoản người dùng mới"
            description="Nhập thông tin đăng nhập, vai trò và hạn mức lưu trữ."
        >
            <Feedback error={apiError} errorMode="toast" />
            <form
                id="admin-user-create-form"
                noValidate
                onSubmit={handleSubmit}
                className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1"
            >
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {/* Tên hiển thị */}
                    <Field>
                        <FieldLabel htmlFor="create-display-name">
                            Tên hiển thị <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                            id="create-display-name"
                            value={displayName}
                            onChange={(e) => handleChange('displayName', e.target.value)}
                            placeholder="Ví dụ: Nguyễn Văn A"
                            maxLength={100}
                            disabled={createMutation.isPending}
                            className={fieldErrors.displayName ? 'border-destructive' : ''}
                            aria-invalid={Boolean(fieldErrors.displayName)}
                            aria-describedby={
                                fieldErrors.displayName ? 'create-display-name-error' : undefined
                            }
                            required
                        />
                        {fieldErrors.displayName && (
                            <FieldError id="create-display-name-error">
                                {fieldErrors.displayName}
                            </FieldError>
                        )}
                    </Field>

                    {/* Email */}
                    <Field>
                        <FieldLabel htmlFor="create-email">
                            Địa chỉ email <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                            id="create-email"
                            type="email"
                            value={email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="user@example.com"
                            disabled={createMutation.isPending}
                            className={fieldErrors.email ? 'border-destructive' : ''}
                            aria-invalid={Boolean(fieldErrors.email)}
                            aria-describedby={fieldErrors.email ? 'create-email-error' : undefined}
                            required
                        />
                        {fieldErrors.email && (
                            <FieldError id="create-email-error">{fieldErrors.email}</FieldError>
                        )}
                    </Field>

                    {/* Mật khẩu khởi tạo */}
                    <Field>
                        <FieldLabel htmlFor="create-password">
                            Mật khẩu ban đầu <span className="text-destructive">*</span>
                        </FieldLabel>
                        <PasswordInput
                            id="create-password"
                            value={password}
                            onChange={(e) => handleChange('password', e.target.value)}
                            placeholder={`Tối thiểu ${LIMITS.passwordMinLength} ký tự`}
                            minLength={LIMITS.passwordMinLength}
                            maxLength={LIMITS.passwordMaxLength}
                            disabled={createMutation.isPending}
                            className={fieldErrors.password ? 'border-destructive' : ''}
                            aria-invalid={Boolean(fieldErrors.password)}
                            aria-describedby={
                                fieldErrors.password ? 'create-password-error' : undefined
                            }
                            required
                        />
                        {fieldErrors.password && (
                            <FieldError id="create-password-error">
                                {fieldErrors.password}
                            </FieldError>
                        )}
                    </Field>

                    {/* Vai trò */}
                    <Field>
                        <FieldLabel htmlFor="create-role">Vai trò tài khoản</FieldLabel>
                        <Select
                            value={role}
                            onValueChange={(val) => setRole(val as UserRole)}
                            disabled={createMutation.isPending}
                        >
                            <SelectTrigger id="create-role">
                                <SelectValue placeholder="Chọn vai trò" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AUTHOR">Tác giả (AUTHOR)</SelectItem>
                                <SelectItem value="ADMIN">Quản trị viên (ADMIN)</SelectItem>
                            </SelectContent>
                        </Select>
                        {role === 'ADMIN' && (
                            <p className="m-0 text-warning-foreground text-xs">
                                Tài khoản Quản trị viên sẽ có toàn quyền can thiệp vào tài nguyên và
                                hệ thống.
                            </p>
                        )}
                    </Field>

                    <UserStorageQuotaField
                        id="create-quota"
                        value={storageQuota}
                        disabled={createMutation.isPending}
                        error={fieldErrors.storageQuotaBytes}
                        onChange={(value) => {
                            setStorageQuota(value);
                            if (fieldErrors.storageQuotaBytes) {
                                setFieldErrors((prev) => ({ ...prev, storageQuotaBytes: '' }));
                            }
                        }}
                    />
                </FieldGroup>
            </form>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                >
                    Hủy
                </Button>
                <Button
                    type="submit"
                    form="admin-user-create-form"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
                </Button>
            </DialogFooter>
        </AdminDialog>
    );
}
