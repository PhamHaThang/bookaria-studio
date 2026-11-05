import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Lock, Pencil, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type AdminUpdateUserBody,
    AdminUpdateUserBodySchema,
} from '@/shared/contracts/api/admin.schema';
import { LIMITS } from '@/shared/contracts/common.schema';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import type { UserRole, UserStatus } from '@/shared/contracts/enums.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
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
import { Input } from '@/shared/ui/primitives/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/primitives/select';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys, bytesLabel, roleLabel, statusLabel, userChanges } from '../model';

interface UserUpdateModalProps {
    user: AdminUser | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const STORAGE_PRESETS = [
    { label: '500 MiB', bytes: LIMITS.defaultQuotaBytes },
    { label: '1 GiB', bytes: 1024 * 1024 * 1024 },
    { label: '2 GiB', bytes: 2 * 1024 * 1024 * 1024 },
    { label: '5 GiB', bytes: 5 * 1024 * 1024 * 1024 },
];

export function UserUpdateModal({ user, isOpen, onClose, onSuccess }: UserUpdateModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const isSelf = Boolean(
        currentAdmin?.id && user?.id && currentAdmin.id.toLowerCase() === user.id.toLowerCase(),
    );

    // Form states
    const [role, setRole] = useState<UserRole>('AUTHOR');
    const [status, setStatus] = useState<UserStatus>('ACTIVE');
    const [storageQuotaBytes, setStorageQuotaBytes] = useState<number>(LIMITS.defaultQuotaBytes);
    const [customStorage, setCustomStorage] = useState(false);
    const [reason, setReason] = useState('');

    // Error states
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // Synchronize initial state whenever user opens
    useEffect(() => {
        if (user && isOpen) {
            setRole(user.role);
            setStatus(user.status);
            const quota = user.storage?.quotaBytes ?? LIMITS.defaultQuotaBytes;
            setStorageQuotaBytes(quota);
            setCustomStorage(!STORAGE_PRESETS.some((p) => p.bytes === quota));
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

    const initials = (user.displayName || user.email || 'U').trim().slice(0, 2).toUpperCase();

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFieldErrors({});
        setApiError(null);

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
            setApiError('Bạn chưa thay đổi thông tin nào của người dùng.');
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
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !updateMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto p-6 sm:p-7">
                <DialogHeader className="gap-1.5 pb-1">
                    <DialogTitle className="m-0 flex items-center gap-2 text-xl leading-tight">
                        <Pencil className="h-5 w-5 text-primary" />
                        Cập nhật tài khoản người dùng
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Chỉnh sửa vai trò quản trị, trạng thái hoạt động hoặc điều chỉnh hạn mức lưu
                        trữ.
                    </DialogDescription>
                </DialogHeader>

                {/* Banner tóm tắt người dùng chuẩn hóa đồng bộ */}
                <div className="flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs">
                    <div className="relative shrink-0">
                        <Avatar className="h-12 w-12 border border-border shadow-xs">
                            {user.avatarUrl && (
                                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                            )}
                            <AvatarFallback className="bg-primary/10 font-bold text-base text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span
                            className={cn(
                                'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface shadow-xs',
                                user.status === 'LOCKED' ? 'bg-destructive' : 'bg-emerald-500',
                            )}
                            title={user.status === 'LOCKED' ? 'Đã khóa' : 'Hoạt động'}
                        />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                            <p className="m-0 truncate font-semibold text-base text-foreground leading-tight">
                                {user.displayName}
                            </p>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <Badge
                                    tone={user.role === 'ADMIN' ? 'info' : 'neutral'}
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    {roleLabel[user.role]}
                                </Badge>
                                <Badge
                                    tone={user.status === 'LOCKED' ? 'danger' : 'success'}
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    {statusLabel[user.status]}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span className="font-mono">{user.email}</span>
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

                {isSelf && (
                    <Alert tone="warning" className="text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                            <ShieldAlert className="h-4 w-4" />
                            Bạn đang chỉnh sửa tài khoản của chính mình
                        </span>
                        <p className="mt-1">
                            Để đảm bảo an toàn hệ thống, bạn không thể tự thay đổi vai trò hoặc tự
                            khóa tài khoản của mình.
                        </p>
                    </Alert>
                )}

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-5 pt-1">
                    <FieldGroup className="gap-5">
                        {/* Vai trò */}
                        <Field>
                            <FieldLabel htmlFor="edit-role">
                                <span className="flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                    Vai trò tài khoản
                                </span>
                            </FieldLabel>
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
                                <p className="text-[11px] text-warning-foreground">
                                    Thay đổi vai trò yêu cầu bắt buộc phải nhập lý do bên dưới.
                                </p>
                            )}
                        </Field>

                        {/* Trạng thái */}
                        <Field>
                            <FieldLabel htmlFor="edit-status">
                                <span className="flex items-center gap-1.5">
                                    {status === 'LOCKED' ? (
                                        <Lock className="h-3.5 w-3.5 text-destructive" />
                                    ) : (
                                        <UserCheck className="h-3.5 w-3.5 text-success-foreground" />
                                    )}
                                    Trạng thái hoạt động
                                </span>
                            </FieldLabel>
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
                                <p className="text-[11px] text-destructive">
                                    Khóa tài khoản sẽ thu hồi mọi phiên đăng nhập và chuyển toàn bộ
                                    sách công khai về riêng tư.
                                </p>
                            )}
                        </Field>

                        {/* Hạn mức dung lượng */}
                        <Field>
                            <FieldLabel htmlFor="edit-quota">
                                <span className="flex items-center gap-1.5">
                                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                                    Hạn mức lưu trữ: {bytesLabel(storageQuotaBytes)}
                                </span>
                            </FieldLabel>

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
                                        disabled={updateMutation.isPending}
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
                                    disabled={updateMutation.isPending}
                                    onClick={() => setCustomStorage(true)}
                                >
                                    Tùy chỉnh (byte)
                                </Button>
                            </div>

                            {customStorage && (
                                <div className="mt-2">
                                    <Input
                                        id="edit-quota"
                                        type="number"
                                        min={1}
                                        step={1048576}
                                        value={storageQuotaBytes}
                                        onChange={(e) => {
                                            const val = Math.max(1, Number(e.target.value));
                                            setStorageQuotaBytes(val);
                                        }}
                                        disabled={updateMutation.isPending}
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

                        {/* Lý do thay đổi */}
                        <Field>
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
                                    setReason(e.target.value);
                                    if (fieldErrors.reason) {
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

                    <DialogFooter className="mt-6 flex items-center justify-end gap-3 border-border/60 border-t pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={updateMutation.isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button type="submit" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
