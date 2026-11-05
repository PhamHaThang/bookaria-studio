import { useQuery } from '@tanstack/react-query';
import {
    Ban,
    BookOpen,
    Calendar,
    CheckCircle2,
    Eye,
    Flag,
    RotateCcw,
    ShieldAlert,
    User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { AdminBookDetail } from '@/shared/contracts/api/admin.schema';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { adminApi } from '../client';
import { adminDate, adminKeys, reportLabel, reportStatusLabel, visibilityLabel } from '../model';

export interface BookModerationDetailModalProps {
    bookId: string | null;
    isOpen: boolean;
    onClose: () => void;
    // biome-ignore lint/suspicious/noExplicitAny: accepts either AdminBookItem or ModerationItem['book']
    onTakedown?: (book: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: accepts either AdminBookItem or ModerationItem['book']
    onDismiss?: (book: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: accepts either AdminBookItem or ModerationItem['book']
    onReinstate?: (book: any) => void;
}

export function BookModerationDetailModal({
    bookId,
    isOpen,
    onClose,
    onTakedown,
    onDismiss,
    onReinstate,
}: BookModerationDetailModalProps) {
    const { user: currentAdmin } = useAuth();

    const {
        data: bookDetails,
        isPending,
        isError,
        error,
    } = useQuery<AdminBookDetail>({
        queryKey: adminKeys.book(currentAdmin?.id || '', bookId || ''),
        queryFn: ({ signal }) => {
            if (!bookId) throw new Error('Không tìm thấy mã sách.');
            return adminApi.book(bookId, signal);
        },
        enabled: Boolean(bookId && isOpen),
        retry: false,
    });

    if (!isOpen) return null;

    const book = bookDetails?.book;
    const reports = bookDetails?.reports ?? [];
    const pages = book?.pages ?? [];
    const openReportsCount = reports.filter((r) => r.status === 'OPEN').length;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[92dvh] max-w-2xl space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <Eye className="h-5 w-5 shrink-0 text-primary" />
                        <span>Chi tiết kiểm duyệt sách</span>
                    </DialogTitle>
                    <DialogDescription className="m-0 text-muted-foreground text-xs leading-normal">
                        Xem thông tin đầu sách, danh sách các báo cáo vi phạm và xem trước nội dung
                        các trang.
                    </DialogDescription>
                </DialogHeader>

                {isPending && <LoadingState layout="detail">Đang tải thông tin sách…</LoadingState>}

                {isError && <Feedback error={errorMessage(error)} />}

                {book && (
                    <div className="space-y-4">
                        {/* Banner tóm tắt đầu sách */}
                        <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
                            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
                                {/* Thumbnail / Icon sách */}
                                <div className="relative shrink-0">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/40 shadow-xs">
                                        <BookOpen className="h-5 w-5 text-primary/80" />
                                    </div>
                                    <span
                                        className={cn(
                                            'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface shadow-xs',
                                            book.takenDown
                                                ? 'bg-destructive'
                                                : openReportsCount > 0
                                                  ? 'bg-amber-500'
                                                  : 'bg-emerald-500',
                                        )}
                                        title={
                                            book.takenDown
                                                ? 'Sách đã bị gỡ'
                                                : openReportsCount > 0
                                                  ? 'Có báo cáo chờ xử lý'
                                                  : 'Trạng thái bình thường'
                                        }
                                    />
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="m-0 truncate font-semibold text-base text-foreground leading-tight">
                                            {book.title}
                                        </h3>
                                        <Badge
                                            tone="neutral"
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
                                        {openReportsCount > 0 && (
                                            <Badge
                                                tone="warning"
                                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                            >
                                                <Flag className="h-2.5 w-2.5" />
                                                {openReportsCount} báo cáo mở
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            Tác giả:{' '}
                                            <Link
                                                to={`/admin/users/${book.author.id}`}
                                                className="font-medium text-foreground hover:text-primary hover:underline"
                                            >
                                                {book.author.displayName}
                                            </Link>
                                        </span>
                                        <span>•</span>
                                        <span className="inline-flex items-center gap-1">
                                            <BookOpen className="h-3 w-3" />
                                            {book.pageCount} trang
                                        </span>
                                        <span>•</span>
                                        <span className="font-mono text-muted-foreground/80">
                                            ID: {book.id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Mô tả sách nếu có */}
                            {book.description && (
                                <div className="mt-3 border-border/70 border-t pt-2.5">
                                    <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                                        {book.description}
                                    </p>
                                </div>
                            )}

                            {/* Lý do đã bị gỡ nếu có */}
                            {book.takenDown && book.takenDownReason && (
                                <div className="mt-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-destructive text-xs">
                                    <span className="flex items-center gap-1.5 font-medium">
                                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                        Lý do đã gỡ trước đó:
                                    </span>
                                    <p className="m-0 mt-1 text-[11px] text-foreground/90 leading-relaxed">
                                        {book.takenDownReason}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Danh sách báo cáo vi phạm */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h4 className="m-0 font-semibold text-foreground text-xs tracking-tight">
                                    Danh sách báo cáo vi phạm ({reports.length})
                                </h4>
                                {openReportsCount > 0 && onDismiss && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-success-foreground text-xs hover:bg-success hover:text-success-foreground"
                                        onClick={() => {
                                            onClose();
                                            onDismiss({
                                                id: book.id,
                                                title: book.title,
                                                reportCount: openReportsCount,
                                            });
                                        }}
                                    >
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Bỏ qua tất cả
                                    </Button>
                                )}
                            </div>

                            {reports.length > 0 ? (
                                <ul className="m-0 list-none space-y-2 p-0">
                                    {reports.map((report) => (
                                        <li
                                            key={report.id}
                                            className="rounded-md border border-border bg-surface p-2.5 text-xs shadow-xs"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge
                                                        tone={
                                                            report.reason === 'INAPPROPRIATE'
                                                                ? 'danger'
                                                                : 'warning'
                                                        }
                                                        className="h-4.5 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                                                    >
                                                        {reportLabel[report.reason]}
                                                    </Badge>
                                                    <Badge
                                                        tone={
                                                            report.status === 'OPEN'
                                                                ? 'warning'
                                                                : 'neutral'
                                                        }
                                                        className="h-4.5 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                                                    >
                                                        {reportStatusLabel[report.status]}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        Gửi: {adminDate(report.createdAt)}
                                                    </span>
                                                    {report.handledAt && (
                                                        <span>
                                                            • Đã xử lý:{' '}
                                                            {adminDate(report.handledAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {report.note && (
                                                <div className="mt-1.5 rounded bg-muted/40 p-2 text-[11px] text-foreground/90 italic">
                                                    “{report.note}”
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="rounded-md border border-border border-dashed p-3 text-center text-muted-foreground text-xs">
                                    Không có báo cáo nào được ghi nhận cho đầu sách này.
                                </p>
                            )}
                        </div>

                        {/* Danh sách các trang sách xem trước */}
                        <div className="space-y-2.5">
                            <h4 className="m-0 font-semibold text-foreground text-xs tracking-tight">
                                Xem trước trang ({pages.length} trang)
                            </h4>
                            {pages.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                    {pages.map((page) => (
                                        <div
                                            key={page.id}
                                            className="group overflow-hidden rounded-md border border-border bg-surface text-center shadow-xs transition-colors hover:border-primary/40"
                                        >
                                            <div className="relative flex aspect-3/4 items-center justify-center bg-muted/30">
                                                {page.thumbnailUrl ? (
                                                    <img
                                                        src={page.thumbnailUrl}
                                                        alt={`Trang ${page.orderIndex + 1}`}
                                                        className="h-full w-full object-contain"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                                                )}
                                                <span className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.2 font-mono text-[9px] text-white">
                                                    #{page.orderIndex + 1}
                                                </span>
                                            </div>
                                            <div className="p-1.5">
                                                <p className="m-0 truncate font-medium text-foreground text-xs">
                                                    {page.title || `Trang ${page.orderIndex + 1}`}
                                                </p>
                                                <p className="m-0 text-[10px] text-muted-foreground">
                                                    {page.objectCount} đối tượng
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="rounded-md border border-border border-dashed p-3 text-center text-muted-foreground text-xs">
                                    Chưa có dữ liệu trang cho bản nháp này.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-border border-t pt-3.5">
                    <div className="flex items-center gap-2">
                        {book && (
                            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                                <Link to={`/admin/books/${book.id}`}>Chi tiết đầy đủ</Link>
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {book && !book.takenDown && onTakedown && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-destructive text-xs hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                    onClose();
                                    onTakedown(book);
                                }}
                            >
                                <Ban className="mr-1 h-3.5 w-3.5" />
                                Gỡ sách
                            </Button>
                        )}
                        {book?.takenDown && onReinstate && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-success-foreground text-xs hover:bg-success hover:text-success-foreground"
                                onClick={() => {
                                    onClose();
                                    onReinstate(book);
                                }}
                            >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                Khôi phục
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={onClose}
                        >
                            Đóng
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
