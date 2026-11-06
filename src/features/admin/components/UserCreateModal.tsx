import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, KeyRound, Mail, Plus, ShieldCheck, User } from 'lucide-react';
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
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
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
import { adminKeys, bytesLabel } from '../model';

interface UserCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (userId: string) => void;
}

const STORAGE_PRESETS = [
    { label: '500 MiB (Mặc định)', bytes: LIMITS.defaultQuotaBytes },
    { label: '1 GiB', bytes: 1024 * 1024 * 1024 },
    { label: '2 GiB', bytes: 2 * 1024 * 1024 * 1024 },
    { label: '5 GiB', bytes: 5 * 1024 * 1024 * 1024 },
];

export function UserCreateModal({ isOpen, onClose, onSuccess }: UserCreateModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>('AUTHOR');
    const [storageQuotaBytes, setStorageQuotaBytes] = useState<number>(LIMITS.defaultQuotaBytes);
    const [customStorage, setCustomStorage] = useState(false);

    // Validation errors per field
    const [touched, setTouched] = useState<Record<string, boolean>>({});
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

    const handleBlur = (fieldName: 'displayName' | 'email' | 'password', val: string) => {
        setTouched((prev) => ({ ...prev, [fieldName]: true }));
        const err = validateField(fieldName, val);
        setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
    };

    const handleChange = (fieldName: 'displayName' | 'email' | 'password', val: string) => {
        if (fieldName === 'displayName') setDisplayName(val);
        if (fieldName === 'email') setEmail(val);
        if (fieldName === 'password') setPassword(val);
        if (touched[fieldName] || fieldErrors[fieldName]) {
            const err = validateField(fieldName, val);
            setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
        }
    };

    const resetForm = () => {
        setDisplayName('');
        setEmail('');
        setPassword('');
        setRole('AUTHOR');
        setStorageQuotaBytes(LIMITS.defaultQuotaBytes);
        setCustomStorage(false);
        setTouched({});
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

        setTouched({ displayName: true, email: true, password: true });

        if (dErr || eErr || pErr) {
            setFieldErrors({
                ...(dErr ? { displayName: dErr } : {}),
                ...(eErr ? { email: eErr } : {}),
                ...(pErr ? { password: pErr } : {}),
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
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !createMutation.isPending) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto p-6 sm:p-7">
                <DialogHeader className="gap-1.5 pb-1">
                    <DialogTitle className="m-0 flex items-center gap-2 text-xl leading-tight">
                        <Plus className="h-5 w-5 text-primary" />
                        Tạo tài khoản người dùng mới
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Thêm tài khoản vào hệ thống với vai trò và dung lượng lưu trữ tương ứng.
                    </DialogDescription>
                </DialogHeader>

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 pt-1">
                    <FieldGroup className="gap-5">
                        {/* Tên hiển thị */}
                        <Field>
                            <FieldLabel htmlFor="create-display-name">
                                <span className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    Tên hiển thị <span className="text-destructive">*</span>
                                </span>
                            </FieldLabel>
                            <Input
                                id="create-display-name"
                                value={displayName}
                                onChange={(e) => handleChange('displayName', e.target.value)}
                                onBlur={() => handleBlur('displayName', displayName)}
                                placeholder="Ví dụ: Nguyễn Văn A"
                                maxLength={100}
                                disabled={createMutation.isPending}
                                className={fieldErrors.displayName ? 'border-destructive' : ''}
                                required
                            />
                            {fieldErrors.displayName && (
                                <FieldError>{fieldErrors.displayName}</FieldError>
                            )}
                        </Field>

                        {/* Email */}
                        <Field>
                            <FieldLabel htmlFor="create-email">
                                <span className="flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    Địa chỉ email <span className="text-destructive">*</span>
                                </span>
                            </FieldLabel>
                            <Input
                                id="create-email"
                                type="email"
                                value={email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                onBlur={() => handleBlur('email', email)}
                                placeholder="user@example.com"
                                disabled={createMutation.isPending}
                                className={fieldErrors.email ? 'border-destructive' : ''}
                                required
                            />
                            {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
                        </Field>

                        {/* Mật khẩu khởi tạo */}
                        <Field>
                            <FieldLabel htmlFor="create-password">
                                <span className="flex items-center gap-1.5">
                                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                    Mật khẩu ban đầu <span className="text-destructive">*</span>
                                </span>
                            </FieldLabel>
                            <PasswordInput
                                id="create-password"
                                value={password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                onBlur={() => handleBlur('password', password)}
                                placeholder={`Tối thiểu ${LIMITS.passwordMinLength} ký tự`}
                                minLength={LIMITS.passwordMinLength}
                                maxLength={LIMITS.passwordMaxLength}
                                disabled={createMutation.isPending}
                                className={fieldErrors.password ? 'border-destructive' : ''}
                                required
                            />
                            {fieldErrors.password && (
                                <FieldError>{fieldErrors.password}</FieldError>
                            )}
                        </Field>

                        {/* Vai trò */}
                        <Field>
                            <FieldLabel htmlFor="create-role">
                                <span className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                    Vai trò tài khoản
                                </span>
                            </FieldLabel>
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
                                <p className="text-[11px] text-warning-foreground">
                                    Tài khoản Quản trị viên sẽ có toàn quyền can thiệp vào tài
                                    nguyên và hệ thống.
                                </p>
                            )}
                        </Field>

                        {/* Hạn mức dung lượng */}
                        <Field>
                            <FieldLabel htmlFor="create-quota">
                                <span className="flex items-center gap-1.5">
                                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                                    Hạn mức lưu trữ: {bytesLabel(storageQuotaBytes)}
                                </span>
                            </FieldLabel>

                            {/* Preset Buttons */}
                            <div className="flex flex-wrap gap-2">
                                {STORAGE_PRESETS.map((preset) => (
                                    <Button
                                        key={preset.bytes}
                                        type="button"
                                        size="xs"
                                        variant={
                                            !customStorage && storageQuotaBytes === preset.bytes
                                                ? 'default'
                                                : 'secondary'
                                        }
                                        disabled={createMutation.isPending}
                                        onClick={() => {
                                            setStorageQuotaBytes(preset.bytes);
                                            setCustomStorage(false);
                                        }}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <Button
                                    type="button"
                                    size="xs"
                                    variant={customStorage ? 'default' : 'secondary'}
                                    disabled={createMutation.isPending}
                                    onClick={() => setCustomStorage(true)}
                                >
                                    Tùy chỉnh (byte)
                                </Button>
                            </div>

                            {customStorage && (
                                <div className="mt-2">
                                    <Input
                                        id="create-quota"
                                        type="number"
                                        min={1}
                                        step={1048576}
                                        value={storageQuotaBytes}
                                        onChange={(e) => {
                                            const val = Math.max(1, Number(e.target.value));
                                            setStorageQuotaBytes(val);
                                        }}
                                        disabled={createMutation.isPending}
                                        placeholder="Nhập số byte"
                                    />
                                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                        = {bytesLabel(storageQuotaBytes)}
                                    </p>
                                </div>
                            )}

                            {fieldErrors.storageQuotaBytes && (
                                <FieldError>{fieldErrors.storageQuotaBytes}</FieldError>
                            )}
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="mt-6 flex items-center justify-end gap-3 border-border/60 border-t pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleClose}
                            disabled={createMutation.isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
