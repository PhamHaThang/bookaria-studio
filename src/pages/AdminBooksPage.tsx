import { useQuery } from '@tanstack/react-query';
import {
    BookOpen,
    CheckCircle2,
    Clock,
    ExternalLink,
    Eye,
    Flag,
    RotateCcw,
    ShieldAlert,
    Tag,
    User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import type { AdminBookItem } from '@/shared/contracts/api/admin.schema';
import type { ModerationItem } from '@/shared/contracts/dto.schema';
import type { ReportReason } from '@/shared/contracts/enums.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { SearchFilter, SelectFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import {
    adminApi,
    adminDate,
    adminKeys,
    BookDismissModal,
    BookModerationDetailModal,
    BookReinstateModal,
    BookTakedownModal,
    readAdminBooksSearch,
    readAdminQueueSearch,
    reportLabel,
    visibilityLabel,
} from '../features/admin';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';

interface AdminModerationItemProps {
    item: ModerationItem;
    onViewDetails: (bookId: string) => void;
    onTakedown: (book: { id: string; title: string; author?: { displayName: string } }) => void;
    onDismiss: (book: { id: string; title: string; reportCount?: number }) => void;
}

/**
 * Thẻ hiển thị một đầu sách có báo cáo vi phạm trong hàng chờ kiểm duyệt.
 * Thiết kế chuẩn hóa theo Design System: bố cục gọn gàng, nút bấm dạng icon có Accessibility (A11y).
 */
function AdminModerationItem({
    item,
    onViewDetails,
    onTakedown,
    onDismiss,
}: AdminModerationItemProps) {
    const primaryReason = item.reasons[0];

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-sm">
            {/* Hàng trên: Thông tin chính & Cụm nút hành động */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Thumbnail sách + Tiêu đề + Badges + Tác giả */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <button
                        type="button"
                        onClick={() => onViewDetails(item.book.id)}
                        className="relative shrink-0 rounded-[var(--radius-md)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Xem chi tiết báo cáo sách"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 shadow-xs">
                            <BookOpen className="h-6 w-6 text-primary/80" />
                        </div>
                        {/* Chấm trạng thái có báo cáo chờ */}
                        <span
                            className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface bg-amber-500 shadow-xs"
                            title="Có báo cáo vi phạm cần xử lý"
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => onViewDetails(item.book.id)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {item.book.title}
                            </button>

                            <Badge
                                tone="warning"
                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                            >
                                <Flag className="h-2.5 w-2.5" />
                                {item.reportCount} báo cáo
                            </Badge>

                            {primaryReason && (
                                <Badge
                                    tone={primaryReason === 'INAPPROPRIATE' ? 'danger' : 'neutral'}
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    {reportLabel[primaryReason]}
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <span>Tác giả:</span>
                            <Link
                                to={`/admin/users/${item.book.author.id}`}
                                className="font-medium text-foreground/90 hover:text-primary hover:underline"
                            >
                                {item.book.author.displayName}
                            </Link>
                            <span>•</span>
                            <span className="truncate text-muted-foreground">
                                Lý do: {item.reasons.map((r) => reportLabel[r]).join(', ')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Cụm 4 nút hành động chuẩn hóa A11y & Design tokens */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                    {/* 1. Xem chi tiết báo cáo */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onViewDetails(item.book.id)}
                        title="Xem chi tiết báo cáo"
                        aria-label="Xem chi tiết báo cáo"
                    >
                        <Eye className="size-4" />
                    </Button>

                    {/* 2. Gỡ sách vi phạm */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-warning-foreground transition-colors hover:bg-warning hover:text-warning-foreground"
                        onClick={() => onTakedown(item.book)}
                        title="Gỡ sách vi phạm"
                        aria-label="Gỡ sách vi phạm"
                    >
                        <ShieldAlert className="size-4" />
                    </Button>

                    {/* 3. Bỏ qua tất cả báo cáo */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-success-foreground transition-colors hover:bg-success hover:text-success-foreground"
                        onClick={() => onDismiss(item.book)}
                        title="Bỏ qua các báo cáo đang mở"
                        aria-label="Bỏ qua các báo cáo đang mở"
                    >
                        <CheckCircle2 className="size-4" />
                    </Button>

                    {/* 4. Mở trang quản trị chuyên sâu */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        asChild
                        title="Mở trang chi tiết sách"
                        aria-label="Mở trang chi tiết sách"
                    >
                        <Link to={`/admin/books/${item.book.id}`}>
                            <ExternalLink className="size-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Hàng dưới: Thông số metadata và phím tắt thao tác nhanh */}
            <div className="mt-4 flex flex-col gap-3.5 border-border/70 border-t pt-3.5 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Báo cáo gần nhất:{' '}
                            <strong className="font-medium text-foreground/90">
                                {adminDate(item.lastReportedAt)}
                            </strong>
                        </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Flag className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            <strong className="font-semibold text-foreground">
                                {item.reportCount}
                            </strong>{' '}
                            lượt báo cáo
                        </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            <strong className="font-semibold text-foreground">
                                {item.reasons.length}
                            </strong>{' '}
                            nhóm lý do
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onViewDetails(item.book.id)}
                    >
                        Xử lý ngay
                    </Button>
                </div>
            </div>
        </li>
    );
}

type ModerationModalState = {
    type: 'none' | 'detail' | 'takedown' | 'dismiss' | 'reinstate';
    bookId?: string;
    book?: {
        id: string;
        title: string;
        author?: { displayName: string };
        reportCount?: number;
    } | null;
};

/**
 * Trang Quản lý điều hành viên / Hàng chờ kiểm duyệt (/admin/moderation hoặc /admin/moderator).
 * Đồng bộ hóa giao diện 100% với AdminUsersPage: bộ lọc, bảng dữ liệu, phân trang và hệ thống Modal.
 */
export function AdminModerationPage() {
    const { user: currentAdmin } = useAuth();
    const [params] = useSearchParams(),
        query = readAdminQueueSearch(params);

    const [modalState, setModalState] = useState<ModerationModalState>({ type: 'none' });

    const list = useQuery({
        queryKey: adminKeys.queue(currentAdmin?.id || '', {
            page: query.page,
            limit: query.limit,
        }),
        queryFn: ({ signal }) =>
            adminApi.moderation({ page: query.page, limit: query.limit }, signal),
        retry: false,
    });

    const closeModal = () => {
        setModalState({ type: 'none' });
    };

    const handleViewDetails = (bookId: string) => {
        setModalState({ type: 'detail', bookId });
    };

    const handleTakedown = (book: {
        id: string;
        title: string;
        author?: { displayName: string };
    }) => {
        setModalState({ type: 'takedown', book, bookId: book.id });
    };

    const handleDismiss = (book: {
        id: string;
        title: string;
        reportCount?: number;
        author?: { displayName: string };
    }) => {
        setModalState({ type: 'dismiss', book, bookId: book.id });
    };

    // Client-side filtering khi người dùng tìm kiếm theo tên/tác giả hoặc lý do
    const rawItems = list.data?.data ?? [];
    const displayedItems = rawItems.filter((item) => {
        if (query.q) {
            const needle = query.q.toLowerCase();
            const matchTitle = item.book.title.toLowerCase().includes(needle);
            const matchAuthor = item.book.author.displayName.toLowerCase().includes(needle);
            if (!matchTitle && !matchAuthor) return false;
        }
        if (query.reason) {
            if (!item.reasons.includes(query.reason as ReportReason)) return false;
        }
        return true;
    });

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Tiêu đề & Hành động phụ */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Hàng chờ kiểm duyệt
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Tiếp nhận, kiểm tra và xử lý các báo cáo vi phạm nội dung sách được gửi từ
                        độc giả.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" asChild className="gap-2">
                        <Link to="/admin/books">
                            <BookOpen className="h-4 w-4" />
                            Tra cứu tất cả sách
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ với AdminUsersPage */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Tìm kiếm */}
                    <Field>
                        <FieldLabel htmlFor="admin-queue-q" className="font-medium text-xs">
                            Tìm trong trang hiện tại
                        </FieldLabel>
                        <SearchFilter
                            className="mt-1.5"
                            placeholder="Tên sách hoặc tác giả..."
                            name="q"
                            id="admin-queue-q"
                            maxLength={100}
                            value={query.q}
                        />
                    </Field>

                    {/* Lọc theo Lý do báo cáo */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-queue-reason" className="font-medium text-xs">
                            Lý do báo cáo trong trang hiện tại
                            <SelectFilter
                                name="reason"
                                id="admin-queue-reason"
                                value={query.reason || ''}
                                options={[
                                    { value: '', label: 'Tất cả lý do' },
                                    { value: 'INAPPROPRIATE', label: 'Nội dung không phù hợp' },
                                    { value: 'COPYRIGHT', label: 'Vi phạm bản quyền' },
                                    { value: 'OTHER', label: 'Lý do khác' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* Hiển thị / trang */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-queue-limit" className="font-medium text-xs">
                            Hiển thị
                            <SelectFilter
                                name="limit"
                                id="admin-queue-limit"
                                value={String(query.limit)}
                                options={[
                                    { value: '5', label: '5 sách / trang' },
                                    { value: '10', label: '10 sách / trang' },
                                    { value: '12', label: '12 sách / trang' },
                                    { value: '20', label: '20 sách / trang' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Báo cáo vi phạm đang mở được tự động nhóm theo từng đầu sách.
                    </span>
                    <Link
                        to="/admin/moderation"
                        state={{ resetFilters: true }}
                        className="font-medium text-primary hover:underline"
                    >
                        Đặt lại bộ lọc
                    </Link>
                </div>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {list.isPending && (
                <LoadingState layout="rows">Đang tải báo cáo kiểm duyệt…</LoadingState>
            )}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

            {/* Danh sách sách có báo cáo */}
            {list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{displayedItems.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            sách có báo cáo chờ xử lý
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {displayedItems.length ? (
                        <ul className="list-none space-y-3 p-0">
                            {displayedItems.map((item) => (
                                <AdminModerationItem
                                    key={item.book.id}
                                    item={item}
                                    onViewDetails={handleViewDetails}
                                    onTakedown={handleTakedown}
                                    onDismiss={handleDismiss}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có báo cáo đang chờ</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Tất cả các báo cáo đã được giải quyết hoặc chưa có khiếu nại
                                        mới từ độc giả.
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

            {/* Modal xem chi tiết kiểm duyệt sách */}
            <BookModerationDetailModal
                bookId={modalState.bookId ?? null}
                isOpen={modalState.type === 'detail'}
                onClose={closeModal}
                onTakedown={handleTakedown}
                onDismiss={handleDismiss}
            />

            {/* Modal xác nhận gỡ sách */}
            <BookTakedownModal
                book={modalState.book ?? null}
                isOpen={modalState.type === 'takedown'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* Modal bỏ qua báo cáo */}
            <BookDismissModal
                book={modalState.book ?? null}
                isOpen={modalState.type === 'dismiss'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}

interface AdminBookItemCardProps {
    book: AdminBookItem;
    onViewDetails: (bookId: string) => void;
    onTakedown: (book: AdminBookItem) => void;
    onReinstate: (book: AdminBookItem) => void;
    onDismiss: (book: AdminBookItem) => void;
}

/**
 * Thẻ hiển thị một đầu sách trong trang tra cứu sách kiểm duyệt.
 */
function AdminBookItemCard({
    book,
    onViewDetails,
    onTakedown,
    onReinstate,
    onDismiss,
}: AdminBookItemCardProps) {
    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Thumbnail sách + Tiêu đề + Badges + Tác giả */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <button
                        type="button"
                        onClick={() => onViewDetails(book.id)}
                        className="relative shrink-0 rounded-[var(--radius-md)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Xem chi tiết sách"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 shadow-xs">
                            <BookOpen className="h-6 w-6 text-primary/80" />
                        </div>
                        {/* Chấm trạng thái */}
                        <span
                            className={cn(
                                'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface shadow-xs',
                                book.takenDown
                                    ? 'bg-destructive'
                                    : book.reportCount > 0
                                      ? 'bg-amber-500'
                                      : book.visibility === 'PUBLIC'
                                        ? 'bg-emerald-500'
                                        : 'bg-muted-foreground/60',
                            )}
                            title={
                                book.takenDown
                                    ? 'Đã bị gỡ'
                                    : book.reportCount > 0
                                      ? 'Có báo cáo chờ'
                                      : visibilityLabel[book.visibility]
                            }
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => onViewDetails(book.id)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {book.title}
                            </button>

                            <Badge
                                tone={book.visibility === 'PUBLIC' ? 'neutral' : 'warning'}
                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                            >
                                {visibilityLabel[book.visibility]}
                            </Badge>

                            {book.takenDown && (
                                <Badge
                                    tone="danger"
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    Đã bị gỡ
                                </Badge>
                            )}

                            {book.reportCount > 0 && (
                                <Badge
                                    tone="warning"
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    <Flag className="h-2.5 w-2.5" />
                                    {book.reportCount} báo cáo
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <span>Tác giả:</span>
                            <Link
                                to={`/admin/users/${book.author.id}`}
                                className="font-medium text-foreground/90 hover:text-primary hover:underline"
                            >
                                {book.author.displayName}
                            </Link>
                            <span>•</span>
                            <span>{book.pageCount} trang</span>
                            <span>•</span>
                            <span className="font-mono text-muted-foreground/80">
                                ID: {book.id}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Cụm nút hành động tinh tế */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                    {/* 1. Xem chi tiết & kiểm duyệt */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onViewDetails(book.id)}
                        title="Xem chi tiết sách"
                        aria-label="Xem chi tiết sách"
                    >
                        <Eye className="size-4" />
                    </Button>

                    {/* 2. Gỡ sách hoặc Khôi phục */}
                    {!book.takenDown ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-warning-foreground transition-colors hover:bg-warning hover:text-warning-foreground"
                            onClick={() => onTakedown(book)}
                            title="Gỡ sách vi phạm"
                            aria-label="Gỡ sách vi phạm"
                        >
                            <ShieldAlert className="size-4" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-success-foreground transition-colors hover:bg-success hover:text-success-foreground"
                            onClick={() => onReinstate(book)}
                            title="Khôi phục quyền hiển thị"
                            aria-label="Khôi phục quyền hiển thị"
                        >
                            <RotateCcw className="size-4" />
                        </Button>
                    )}

                    {/* 3. Bỏ qua báo cáo nếu có */}
                    {book.reportCount > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-success-foreground transition-colors hover:bg-success hover:text-success-foreground"
                            onClick={() => onDismiss(book)}
                            title="Bỏ qua các báo cáo đang mở"
                            aria-label="Bỏ qua các báo cáo đang mở"
                        >
                            <CheckCircle2 className="size-4" />
                        </Button>
                    )}

                    {/* 4. Mở trang chi tiết */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        asChild
                        title="Mở trang quản trị chuyên sâu"
                        aria-label="Mở trang quản trị chuyên sâu"
                    >
                        <Link to={`/admin/books/${book.id}`}>
                            <ExternalLink className="size-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Hàng dưới: Metadata */}
            <div className="mt-4 flex flex-col gap-3.5 border-border/70 border-t pt-3.5 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Quy mô:{' '}
                            <strong className="font-semibold text-foreground">
                                {book.pageCount}
                            </strong>{' '}
                            trang
                        </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Tác giả:{' '}
                            <strong className="font-medium text-foreground/90">
                                {book.author.displayName}
                            </strong>
                        </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Flag className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Báo cáo vi phạm:{' '}
                            <strong
                                className={cn(
                                    'font-semibold',
                                    book.reportCount > 0
                                        ? 'text-warning-foreground'
                                        : 'text-foreground',
                                )}
                            >
                                {book.reportCount}
                            </strong>
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onViewDetails(book.id)}
                    >
                        Kiểm duyệt
                    </Button>
                </div>
            </div>
        </li>
    );
}

/**
 * Trang Tra cứu & Duyệt sách (/admin/books).
 * Thiết kế đồng bộ chuẩn hóa với AdminUsersPage.
 */
export function AdminBooksPage() {
    const { user: currentAdmin } = useAuth();
    const [params] = useSearchParams(),
        query = readAdminBooksSearch(params);

    const [modalState, setModalState] = useState<ModerationModalState>({ type: 'none' });

    const list = useQuery({
        queryKey: adminKeys.books(currentAdmin?.id || '', query),
        queryFn: ({ signal }) => adminApi.books(query, signal),
        retry: false,
    });

    const closeModal = () => {
        setModalState({ type: 'none' });
    };

    const handleViewDetails = (bookId: string) => {
        setModalState({ type: 'detail', bookId });
    };

    const handleTakedown = (book: AdminBookItem) => {
        setModalState({ type: 'takedown', book, bookId: book.id });
    };

    const handleReinstate = (book: AdminBookItem) => {
        setModalState({ type: 'reinstate', book, bookId: book.id });
    };

    const handleDismiss = (book: AdminBookItem) => {
        setModalState({ type: 'dismiss', book, bookId: book.id });
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Tiêu đề & Điều hướng */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Tra cứu & Duyệt sách
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Tìm sách theo quyền hiển thị để kiểm tra nội dung, gỡ sách vi phạm hoặc khôi
                        phục hiển thị.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" asChild className="gap-2">
                        <Link to="/admin/moderation">
                            <Flag className="h-4 w-4" />
                            Hàng chờ kiểm duyệt
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Tên sách */}
                    <Field>
                        <FieldLabel htmlFor="admin-book-q" className="font-medium text-xs">
                            Tên sách
                        </FieldLabel>
                        <SearchFilter
                            className="mt-1.5"
                            placeholder="Nhập tên sách..."
                            id="admin-book-q"
                            name="q"
                            value={query.q}
                            maxLength={100}
                        />
                    </Field>

                    {/* Quyền hiển thị */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-book-visibility" className="font-medium text-xs">
                            Quyền hiển thị
                            <SelectFilter
                                id="admin-book-visibility"
                                name="visibility"
                                value={query.visibility}
                                options={[
                                    { value: 'PUBLIC', label: 'Công khai' },
                                    { value: 'UNLISTED', label: 'Qua liên kết' },
                                    { value: 'PRIVATE', label: 'Riêng tư' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* Hiển thị / trang */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-book-limit" className="font-medium text-xs">
                            Hiển thị
                            <SelectFilter
                                id="admin-book-limit"
                                name="limit"
                                value={String(query.limit)}
                                options={[
                                    { value: '5', label: '5 sách / trang' },
                                    { value: '10', label: '10 sách / trang' },
                                    { value: '12', label: '12 sách / trang' },
                                    { value: '20', label: '20 sách / trang' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Sách bị gỡ được chuyển sang riêng tư. Chọn “Riêng tư” để tra cứu và khôi
                        phục.
                    </span>
                    <Link
                        to="/admin/books"
                        state={{ resetFilters: true }}
                        className="font-medium text-primary hover:underline"
                    >
                        Đặt lại bộ lọc
                    </Link>
                </div>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {list.isPending && <LoadingState layout="rows">Đang tải sách…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

            {/* Danh sách sách */}
            {list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            đầu sách
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {list.data.data.length ? (
                        <ul className="list-none space-y-3 p-0">
                            {list.data.data.map((book) => (
                                <AdminBookItemCard
                                    key={book.id}
                                    book={book}
                                    onViewDetails={handleViewDetails}
                                    onTakedown={handleTakedown}
                                    onReinstate={handleReinstate}
                                    onDismiss={handleDismiss}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có sách phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Thử tìm kiếm với từ khóa khác hoặc thay đổi quyền hiển thị.
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

            {/* Modal xem chi tiết kiểm duyệt sách */}
            <BookModerationDetailModal
                bookId={modalState.bookId ?? null}
                isOpen={modalState.type === 'detail'}
                onClose={closeModal}
                onTakedown={handleTakedown}
                onReinstate={handleReinstate}
                onDismiss={handleDismiss}
            />

            {/* Modal xác nhận gỡ sách */}
            <BookTakedownModal
                book={modalState.book ?? null}
                isOpen={modalState.type === 'takedown'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* Modal khôi phục sách */}
            <BookReinstateModal
                book={modalState.book ?? null}
                isOpen={modalState.type === 'reinstate'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* Modal bỏ qua báo cáo */}
            <BookDismissModal
                book={modalState.book ?? null}
                isOpen={modalState.type === 'dismiss'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}
