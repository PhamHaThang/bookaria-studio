import { useQuery } from '@tanstack/react-query';
import {
    BookOpen,
    Calendar,
    Clock,
    Eye,
    Lock,
    Pencil,
    Plus,
    ShieldCheck,
    Trash2,
    Unlock,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import type { AdminUser } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { SearchFilter, SelectFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import {
    adminApi,
    adminDate,
    adminKeys,
    bytesLabel,
    readAdminUsersSearch,
    roleLabel,
    statusLabel,
    UserCreateModal,
    UserDeleteModal,
    UserDetailModal,
    UserLockModal,
    UserUpdateModal,
} from '../features/admin';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';

interface AdminUserItemProps {
    user: AdminUser;
    isSelf: boolean;
    onViewDetails: (userId: string) => void;
    onUpdate: (user: AdminUser) => void;
    onToggleLock: (user: AdminUser) => void;
    onDelete: (user: AdminUser) => void;
}

/**
 * Component hiển thị từng tài khoản người dùng dưới dạng thẻ thông tin trực quan,
 * phân cấp rõ ràng giữa thông tin cá nhân, vai trò, dung lượng và các nút thao tác thông qua Modal.
 */
function AdminUserItem({
    user,
    isSelf,
    onViewDetails,
    onUpdate,
    onToggleLock,
    onDelete,
}: AdminUserItemProps) {
    const usedBytes = user.storage?.usedBytes ?? 0;
    const quotaBytes = Math.max(1, user.storage?.quotaBytes ?? 1);
    const usedPercent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

    const isLocked = user.status === 'LOCKED';
    const isAdmin = user.role === 'ADMIN';

    // Tạo chữ viết tắt 1-2 ký tự cho fallback của Avatar
    const initials = (user.displayName || user.email || 'U').trim().slice(0, 2).toUpperCase();

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-sm">
            {/* Hàng trên: Thông tin tài khoản chính & Cụm nút hành động */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Avatar + Tên + Vai trò + Trạng thái + Email */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <button
                        type="button"
                        onClick={() => onViewDetails(user.id)}
                        className="relative shrink-0 rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Xem chi tiết người dùng"
                    >
                        <Avatar className="h-12 w-12 border border-border shadow-xs">
                            {user.avatarUrl && (
                                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                            )}
                            <AvatarFallback className="bg-primary/10 font-bold text-base text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        {/* Chấm trạng thái */}
                        <span
                            className={cn(
                                'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface shadow-xs',
                                isLocked ? 'bg-destructive' : 'bg-emerald-500',
                            )}
                            title={isLocked ? 'Tài khoản đã khóa' : 'Tài khoản đang hoạt động'}
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => onViewDetails(user.id)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {user.displayName}
                            </button>

                            <Badge
                                tone={isAdmin ? 'info' : 'neutral'}
                                className="px-2.5 py-0.5 font-medium text-xs"
                            >
                                {isAdmin && <ShieldCheck className="mr-1 h-3 w-3" />}
                                {roleLabel[user.role]}
                            </Badge>

                            <Badge
                                tone={isLocked ? 'danger' : 'success'}
                                className="px-2 py-0.5 font-medium text-xs"
                            >
                                {isLocked ? (
                                    <>
                                        <Lock className="mr-0.5 h-2 w-2" />
                                        {statusLabel[user.status]}
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {statusLabel[user.status]}
                                    </>
                                )}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <span className="font-mono">{user.email}</span>
                            {user.organization && (
                                <>
                                    <span>•</span>
                                    <span className="max-w-[280px] truncate font-medium text-foreground/80">
                                        {user.organization}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cụm nút hành động tinh tế, tối ưu UX với icon buttons chuẩn A11y */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                    {/* 1. Xem chi tiết tài khoản */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onViewDetails(user.id)}
                        title="Xem chi tiết tài khoản"
                        aria-label="Xem chi tiết tài khoản"
                    >
                        <Eye className="size-4" />
                    </Button>

                    {/* 2. Cập nhật thông tin */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onUpdate(user)}
                        title="Cập nhật tài khoản"
                        aria-label="Cập nhật tài khoản"
                    >
                        <Pencil className="size-4" />
                    </Button>

                    {/* 3. Khóa / Mở khóa tài khoản */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isSelf}
                        className={cn(
                            'transition-colors',
                            isLocked
                                ? 'text-success-foreground hover:bg-success hover:text-success-foreground'
                                : 'text-warning-foreground hover:bg-warning hover:text-warning-foreground',
                            isSelf && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                        )}
                        onClick={() => onToggleLock(user)}
                        title={
                            isSelf
                                ? 'Không thể tự khóa tài khoản của chính mình'
                                : isLocked
                                  ? 'Mở khóa tài khoản'
                                  : 'Khóa tài khoản'
                        }
                        aria-label={
                            isSelf
                                ? 'Không thể tự khóa tài khoản của chính mình'
                                : isLocked
                                  ? 'Mở khóa tài khoản'
                                  : 'Khóa tài khoản'
                        }
                    >
                        {isLocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                    </Button>

                    {/* 4. Xóa tài khoản */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isSelf}
                        className={cn(
                            'text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
                            isSelf && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                        )}
                        onClick={() => onDelete(user)}
                        title={
                            isSelf
                                ? 'Không thể tự vô hiệu hóa tài khoản của chính mình'
                                : 'Vô hiệu hóa tài khoản người dùng'
                        }
                        aria-label={
                            isSelf
                                ? 'Không thể tự vô hiệu hóa tài khoản của chính mình'
                                : 'Vô hiệu hóa tài khoản người dùng'
                        }
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Hàng dưới: Metadata và thanh tiến trình dung lượng thoáng đãng */}
            <div className="mt-4 flex flex-col gap-3.5 border-border/70 border-t pt-3.5 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
                {/* Thông số bên trái */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            <strong className="font-semibold text-foreground">
                                {user.bookCount}
                            </strong>{' '}
                            sách
                        </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Tạo ngày:{' '}
                            <strong className="font-medium text-foreground/90">
                                {adminDate(user.createdAt)}
                            </strong>
                        </span>
                    </span>

                    {user.lastLoginAt && (
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/80" />
                            <span>
                                Đăng nhập cuối:{' '}
                                <strong className="font-medium text-foreground/90">
                                    {adminDate(user.lastLoginAt)}
                                </strong>
                            </span>
                        </span>
                    )}
                </div>

                {/* Thanh tiến trình bên phải - Rộng rãi, không bị chen lấn */}
                <div className="flex items-center gap-3 sm:w-72">
                    <span className="shrink-0 font-medium text-muted-foreground">Lưu trữ:</span>
                    <div className="flex-1">
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
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                        <span
                            className={cn(
                                'font-semibold',
                                usedPercent >= 90 ? 'text-destructive' : 'text-foreground',
                            )}
                        >
                            {usedPercent}%
                        </span>{' '}
                        <span>
                            ({bytesLabel(usedBytes)} / {bytesLabel(quotaBytes)})
                        </span>
                    </div>
                </div>
            </div>
        </li>
    );
}

type ModalType = 'none' | 'create' | 'detail' | 'update' | 'lock' | 'delete';

export function AdminUsersPage() {
    const { user: currentAdmin } = useAuth();
    const [params] = useSearchParams(),
        query = readAdminUsersSearch(params);

    // Modal state
    const [modalState, setModalState] = useState<{
        type: ModalType;
        userId?: string;
        user?: AdminUser | null;
    }>({ type: 'none' });

    const list = useQuery({
        queryKey: adminKeys.users(currentAdmin?.id || '', query),
        queryFn: ({ signal }) => adminApi.users(query, signal),
        retry: false,
    });

    const handleViewDetails = (userId: string) => {
        setModalState({ type: 'detail', userId });
    };

    const handleUpdate = (user: AdminUser) => {
        setModalState({ type: 'update', user, userId: user.id });
    };

    const handleToggleLock = (user: AdminUser) => {
        setModalState({ type: 'lock', user, userId: user.id });
    };

    const handleDelete = (user: AdminUser) => {
        setModalState({ type: 'delete', user, userId: user.id });
    };

    const closeModal = () => {
        setModalState({ type: 'none' });
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Tiêu đề & Nút Tạo mới mở Modal */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Quản lý người dùng
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Tìm kiếm tài khoản, phân quyền Admin/Tác giả, kiểm soát dung lượng và trạng
                        thái hoạt động.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        onClick={() => setModalState({ type: 'create' })}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" data-icon="inline-start" />
                        Tạo người dùng
                    </Button>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Tìm kiếm */}
                    <Field>
                        <FieldLabel htmlFor="admin-user-q" className="font-medium text-xs">
                            Tìm kiếm
                        </FieldLabel>
                        <SearchFilter
                            className="mt-1.5"
                            placeholder="Tên hoặc email..."
                            name="q"
                            id="admin-user-q"
                            maxLength={100}
                            value={query.q}
                        />
                    </Field>

                    {/* Lọc theo Vai trò */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-role" className="font-medium text-xs">
                            Vai trò
                            <SelectFilter
                                name="role"
                                id="admin-user-role"
                                value={query.role || ''}
                                options={[
                                    { value: '', label: 'Tất cả vai trò' },
                                    { value: 'AUTHOR', label: 'Tác giả' },
                                    { value: 'ADMIN', label: 'Quản trị viên' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* Lọc theo Trạng thái */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-status" className="font-medium text-xs">
                            Trạng thái
                            <SelectFilter
                                name="status"
                                id="admin-user-status"
                                value={query.status || ''}
                                options={[
                                    { value: '', label: 'Tất cả trạng thái' },
                                    { value: 'ACTIVE', label: 'Đang hoạt động' },
                                    { value: 'LOCKED', label: 'Đã khóa' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* Sắp xếp */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-sort" className="font-medium text-xs">
                            Sắp xếp
                            <SelectFilter
                                name="sort"
                                id="admin-user-sort"
                                value={query.sort}
                                options={[
                                    { value: '-createdAt', label: 'Mới nhất trước' },
                                    { value: 'createdAt', label: 'Cũ nhất trước' },
                                    { value: 'displayName', label: 'Tên A–Z' },
                                    { value: '-displayName', label: 'Tên Z–A' },
                                    { value: 'email', label: 'Email A–Z' },
                                    { value: '-email', label: 'Email Z–A' },
                                    { value: '-storageUsedBytes', label: 'Dung lượng nhiều nhất' },
                                    { value: 'storageUsedBytes', label: 'Dung lượng ít nhất' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* Số lượng / trang */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-limit" className="font-medium text-xs">
                            Hiển thị
                            <SelectFilter
                                name="limit"
                                id="admin-user-limit"
                                value={String(query.limit)}
                                options={[
                                    { value: '5', label: '5 tài khoản / trang' },
                                    { value: '10', label: '10 tài khoản / trang' },
                                    { value: '12', label: '12 tài khoản / trang' },
                                    { value: '20', label: '20 tài khoản / trang' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                {/* Nút Xóa bộ lọc */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Sử dụng bộ lọc để thu hẹp kết quả tìm kiếm tài khoản.
                    </span>
                    <Link
                        to="/admin/users"
                        state={{ resetFilters: true }}
                        className="font-medium text-primary hover:underline"
                    >
                        Đặt lại bộ lọc
                    </Link>
                </div>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {list.isPending && (
                <LoadingState layout="admin-rows">Đang tải người dùng…</LoadingState>
            )}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

            {/* Danh sách người dùng */}
            {list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            người dùng
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {list.data.data.length ? (
                        <ul className="list-none space-y-3 p-0">
                            {list.data.data.map((item) => (
                                <AdminUserItem
                                    key={item.id}
                                    user={item}
                                    isSelf={
                                        Boolean(currentAdmin?.id) &&
                                        currentAdmin?.id.toLowerCase() === item.id.toLowerCase()
                                    }
                                    onViewDetails={handleViewDetails}
                                    onUpdate={handleUpdate}
                                    onToggleLock={handleToggleLock}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không tìm thấy tài khoản phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Thử tìm kiếm với từ khóa khác hoặc xóa bớt các điều kiện
                                        lọc.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}

                    <div className="pt-2">
                        <AdminPager
                            page={query.page}
                            meta={list.data.meta}
                            busy={list.isFetching}
                        />
                    </div>
                </div>
            )}

            {/* 1. Modal Thêm người dùng mới */}
            <UserCreateModal
                isOpen={modalState.type === 'create'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* 2. Modal Xem chi tiết người dùng */}
            <UserDetailModal
                userId={modalState.userId ?? null}
                isOpen={modalState.type === 'detail'}
                onClose={closeModal}
                onEdit={(u) => setModalState({ type: 'update', user: u, userId: u.id })}
                onLock={(u) => setModalState({ type: 'lock', user: u, userId: u.id })}
                onDelete={(u) => setModalState({ type: 'delete', user: u, userId: u.id })}
            />

            {/* 3. Modal Cập nhật người dùng */}
            <UserUpdateModal
                user={modalState.user ?? null}
                isOpen={modalState.type === 'update'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* 4. Modal Khóa / Mở khóa người dùng */}
            <UserLockModal
                user={modalState.user ?? null}
                isOpen={modalState.type === 'lock'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* 5. Modal Xác nhận xóa người dùng */}
            <UserDeleteModal
                user={modalState.user ?? null}
                isOpen={modalState.type === 'delete'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}
