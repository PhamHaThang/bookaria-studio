import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { AdminBookDetail } from '@/shared/contracts/api/admin.schema';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/primitives/select';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { RetryNotice } from '@/shared/ui/RetryNotice';
import { adminApi } from '../client';
import {
    adminDate,
    adminKeys,
    adminPageMarkerLabel,
    reportLabel,
    reportStatusLabel,
    visibilityLabel,
} from '../model';
import { AdminDialog } from './AdminDialog';
import type { BookTarget } from './BookModerationActionDialog';

const pagePreviewHeight = 'h-[clamp(8rem,23dvh,13.5rem)] md:h-[clamp(10rem,29dvh,14rem)]';

function BookModerationPreviewSkeleton() {
    return (
        <div className="grid min-w-0 gap-2.5" aria-hidden="true">
            <div className="flex min-h-5 items-center justify-between gap-2">
                <Skeleton className="hidden h-4 w-28 md:block" />
                <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
                <div className={`grid place-items-center bg-muted/50 p-2 ${pagePreviewHeight}`}>
                    <Skeleton className="aspect-[210/297] h-full max-w-full rounded-sm" />
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                    <div className="grid min-w-0 flex-1 gap-1.5">
                        <Skeleton className="h-4 w-22 max-w-full" />
                        <Skeleton className="h-3 w-28 max-w-full" />
                    </div>
                    <Skeleton className="h-9 w-28 shrink-0" />
                </div>
            </div>
        </div>
    );
}

function BookModerationSkeleton() {
    return (
        <div role="status" aria-busy="true" className="grid gap-3 sm:gap-4">
            <span className="sr-only">Đang tải thông tin sách…</span>
            <div className="grid gap-2 rounded-xl bg-muted/50 p-3" aria-hidden="true">
                <div className="flex items-start gap-3">
                    <Skeleton className="size-10 shrink-0 rounded-lg sm:size-12" />
                    <div className="grid flex-1 gap-1.5">
                        <Skeleton className="h-5 w-40 max-w-full" />
                        <Skeleton className="h-3.5 w-25 max-w-full" />
                        <div className="flex gap-1.5">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-22 rounded-full" />
                        </div>
                    </div>
                </div>
                <Skeleton className="hidden h-4 w-1/2 md:block" />
                <Skeleton className="hidden h-3 w-36 md:block" />
            </div>
            <div
                className="flex gap-2 rounded-lg border border-border p-1 md:hidden"
                aria-hidden="true"
            >
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
            </div>
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-6">
                <div className="grid min-w-0 gap-2.5" aria-hidden="true">
                    <Skeleton className="hidden h-4 w-28 md:block" />
                    {['first', 'second'].map((id) => (
                        <div
                            key={id}
                            className={`gap-2 rounded-xl border border-border px-3 py-2.5 ${id === 'second' ? 'hidden md:grid' : 'grid'}`}
                        >
                            <div className="flex gap-1.5">
                                <Skeleton className="h-5 w-24 rounded-full" />
                                <Skeleton className="h-5 w-18 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-32" />
                            <div className="flex min-h-8 items-center justify-between gap-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-8 w-28" />
                            </div>
                        </div>
                    ))}
                    <div className="grid gap-1 md:hidden">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                </div>
                <div className="hidden min-w-0 md:block">
                    <BookModerationPreviewSkeleton />
                </div>
            </div>
        </div>
    );
}

type ModerationReport = AdminBookDetail['reports'][number];

function BookModerationReports({
    reports,
    activeReportId,
    onPreview,
}: {
    reports: ModerationReport[];
    activeReportId?: string;
    onPreview: (report: ModerationReport) => void;
}) {
    return (
        <section className="grid min-w-0 content-start gap-2.5">
            <h3 className="m-0 hidden font-semibold text-sm md:block">
                Báo cáo vi phạm ({reports.length})
            </h3>
            {reports.length ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                    {reports.map((report) => (
                        <li
                            key={report.id}
                            className="grid gap-1.5 rounded-xl border border-border px-3 py-2.5"
                        >
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                    tone={report.reason === 'INAPPROPRIATE' ? 'danger' : 'neutral'}
                                >
                                    {reportLabel[report.reason]}
                                </Badge>
                                <Badge tone={report.status === 'OPEN' ? 'warning' : 'neutral'}>
                                    {reportStatusLabel[report.status]}
                                </Badge>
                            </div>
                            {report.note && <p className="m-0 text-sm">{report.note}</p>}
                            <p className="m-0 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
                                <span>Gửi {adminDate(report.createdAt)}</span>
                                {report.handledAt && (
                                    <span>Đã xử lý {adminDate(report.handledAt)}</span>
                                )}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="text-muted-foreground text-xs">
                                    {report.version
                                        ? `Bản v${report.version.number}`
                                        : 'Chưa ghi phiên bản'}
                                </span>
                                {(report.version || report.pageId) && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            report.id === activeReportId ? 'secondary' : 'ghost'
                                        }
                                        onClick={() => onPreview(report)}
                                    >
                                        {report.pageId ? 'Xem trang báo cáo' : 'Xem phiên bản'}
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="m-0 rounded-xl bg-muted/50 p-3 text-muted-foreground text-sm">
                    Sách chưa có báo cáo.
                </p>
            )}
        </section>
    );
}

function BookModerationPages({
    pages,
    pageId,
    preview,
    onViewCurrent,
}: {
    pages: AdminBookDetail['book']['pages'];
    pageId?: string | null;
    preview: AdminBookDetail['preview'];
    onViewCurrent: () => void;
}) {
    const [selectedIndex, setSelectedIndex] = useState(() =>
        Math.max(
            0,
            pages.findIndex((page) => page.id === pageId),
        ),
    );
    const index = Math.min(selectedIndex, pages.length - 1);
    const page = pages[index];
    const aspect = page?.aspect ?? 297 / 210;

    return (
        <section className="grid min-w-0 content-start gap-2.5">
            <div
                className={`flex-wrap items-center justify-between gap-x-2 gap-y-1 ${preview ? 'flex' : 'hidden md:flex'}`}
            >
                <h3 className="m-0 hidden font-semibold text-sm md:block">
                    Xem trước trang ({pages.length})
                </h3>
                {preview && (
                    <Badge tone="neutral">
                        {preview.source === 'draft'
                            ? 'Bản nháp'
                            : `Bản xuất bản v${preview.versionNo}${preview.isCurrent ? ' · Hiện tại' : ''}`}
                    </Badge>
                )}
                {preview?.source === 'published' && !preview.isCurrent && (
                    <Button type="button" size="sm" variant="ghost" onClick={onViewCurrent}>
                        Xem bản hiện tại
                    </Button>
                )}
            </div>
            {pageId && !pages.some((item) => item.id === pageId) && (
                <p className="m-0 text-muted-foreground text-xs">
                    Trang được báo cáo không có trong phiên bản đang xem.
                </p>
            )}
            {page ? (
                <div className="overflow-hidden rounded-xl border border-border">
                    <div
                        className={`grid place-items-center bg-muted/50 p-2 [container-type:size] ${pagePreviewHeight}`}
                    >
                        <div
                            className="relative grid place-items-center overflow-hidden bg-white shadow-xs"
                            style={{
                                aspectRatio: 1 / aspect,
                                width: `min(100%, ${100 / aspect}cqh)`,
                            }}
                        >
                            {page.thumbnailUrl ? (
                                <img
                                    src={page.thumbnailUrl}
                                    alt={`Ảnh trang ${page.orderIndex + 1}`}
                                    className="absolute inset-0 size-full object-contain"
                                />
                            ) : (
                                <BookOpen
                                    className="size-6 text-muted-foreground"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3">
                        <div className="min-w-[6rem] flex-1 space-y-0.5" aria-live="polite">
                            <p className="m-0 font-medium text-sm">
                                {page.title || `Trang ${page.orderIndex + 1}`}
                            </p>
                            <p className="m-0 text-muted-foreground text-xs">
                                {page.objectCount} đối tượng ·{' '}
                                {page.markerMode === 'NONE'
                                    ? 'Không dùng AR'
                                    : preview?.source === 'published' &&
                                        page.markerMode === 'CUSTOM_MARKER'
                                      ? 'Marker tùy chỉnh'
                                      : `Marker ${adminPageMarkerLabel(page)}`}
                            </p>
                        </div>
                        {pages.length > 1 && (
                            <div className="flex shrink-0 items-center gap-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    className="size-9"
                                    aria-label="Trang trước"
                                    disabled={index === 0}
                                    onClick={() => setSelectedIndex(index - 1)}
                                >
                                    <ChevronLeft aria-hidden="true" />
                                </Button>
                                <Select
                                    value={String(index)}
                                    onValueChange={(value) => setSelectedIndex(Number(value))}
                                >
                                    <SelectTrigger
                                        size="sm"
                                        aria-label="Chọn trang xem trước"
                                        className="m-0 h-9 w-24 gap-1 px-2 py-1.5 text-sm data-[size=sm]:min-h-9"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {pages.map((item, itemIndex) => (
                                            <SelectItem key={item.id} value={String(itemIndex)}>
                                                Trang {item.orderIndex + 1}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    className="size-9"
                                    aria-label="Trang sau"
                                    disabled={index === pages.length - 1}
                                    onClick={() => setSelectedIndex(index + 1)}
                                >
                                    <ChevronRight aria-hidden="true" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <p className="m-0 rounded-xl bg-muted/50 p-3 text-muted-foreground text-sm">
                    Chưa có dữ liệu trang.
                </p>
            )}
        </section>
    );
}

export interface BookModerationDetailModalProps {
    bookId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onTakedown?: (book: BookTarget) => void;
    onDismiss?: (book: BookTarget) => void;
    onReinstate?: (book: BookTarget) => void;
    showFullDetails?: boolean;
}

export function BookModerationDetailModal({
    bookId,
    isOpen,
    onClose,
    onTakedown,
    onDismiss,
    onReinstate,
    showFullDetails = false,
}: BookModerationDetailModalProps) {
    const { user: currentAdmin } = useAuth();
    const isMobile = useIsMobile();
    const [activeReport, setActiveReport] = useState<ModerationReport | null>();
    const [previewRevision, setPreviewRevision] = useState(0);
    const [tab, setTab] = useState('reports');
    const bookKey = adminKeys.book(currentAdmin?.id || '', bookId || '');
    const details = useQuery<AdminBookDetail>({
        queryKey: [...bookKey, 'reported'],
        queryFn: ({ signal }) => {
            if (!bookId) throw new Error('Không tìm thấy mã sách.');
            return adminApi.book(bookId, signal, 'reported');
        },
        enabled: Boolean(bookId && isOpen),
        retry: false,
    });

    const initialPreview = details.data?.preview;
    const requestedVersion = activeReport?.version?.id ?? 'current';
    const fetchPreview = Boolean(
        activeReport !== undefined &&
            initialPreview?.source === 'published' &&
            (requestedVersion === 'current'
                ? !initialPreview.isCurrent
                : initialPreview.versionId !== requestedVersion),
    );
    const versionDetails = useQuery({
        queryKey: [...bookKey, requestedVersion],
        queryFn: ({ signal }) => {
            if (!bookId) throw new Error('Không tìm thấy mã sách.');
            return adminApi.book(bookId, signal, requestedVersion);
        },
        enabled: isOpen && Boolean(bookId) && fetchPreview,
        retry: false,
    });

    if (!isOpen) return null;

    const book = details.data?.book;
    const reports = details.data?.reports ?? [];
    const displayed = fetchPreview ? versionDetails.data : details.data;
    const pages = displayed?.book.pages ?? [];
    const shownReport =
        activeReport === undefined
            ? reports.find((report) => report.status === 'OPEN')
            : activeReport;
    const reportList = (
        <BookModerationReports
            reports={reports}
            activeReportId={shownReport?.id}
            onPreview={(report) => {
                setActiveReport(report);
                setPreviewRevision((revision) => revision + 1);
                setTab('pages');
            }}
        />
    );
    const previewContent =
        fetchPreview && versionDetails.isPending ? (
            <div role="status" aria-busy="true">
                <span className="sr-only">Đang tải phiên bản sách…</span>
                <BookModerationPreviewSkeleton />
            </div>
        ) : fetchPreview && versionDetails.isError ? (
            <RetryNotice
                message="Chưa tải được phiên bản sách."
                detail={errorMessage(versionDetails.error)}
                busy={versionDetails.isFetching}
                onRetry={() => void versionDetails.refetch()}
            />
        ) : (
            <BookModerationPages
                key={previewRevision}
                pages={pages}
                pageId={shownReport?.pageId}
                preview={displayed?.preview}
                onViewCurrent={() => {
                    setActiveReport(null);
                    setPreviewRevision((revision) => revision + 1);
                }}
            />
        );
    const openReportsCount = reports.filter((report) => report.status === 'OPEN').length;
    const bookTarget = book && { ...book, reportCount: openReportsCount };

    const bookMetadata = book && (
        <div className="grid gap-1">
            {book.description && (
                <p className="m-0 text-muted-foreground text-sm">{book.description}</p>
            )}
            <p className="m-0 text-muted-foreground text-xs">
                Mã sách <span className="font-mono">{book.id}</span>
            </p>
        </div>
    );

    return (
        <AdminDialog
            open={isOpen}
            title="Chi tiết kiểm duyệt sách"
            description="Xem báo cáo và các trang sách."
            onClose={onClose}
            className="max-w-[min(880px,calc(100vw-32px))] gap-3 sm:gap-4"
        >
            <div className="-mx-1 min-h-0 space-y-3 overflow-y-auto px-1 pb-1 sm:space-y-4">
                {details.isPending && <BookModerationSkeleton />}
                {details.isError && (
                    <RetryNotice
                        message="Chưa tải được thông tin sách."
                        detail={errorMessage(details.error)}
                        busy={details.isFetching}
                        onRetry={() => void details.refetch()}
                    />
                )}
                {book && (
                    <>
                        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
                            <div className="flex items-start gap-3">
                                <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface text-muted-foreground sm:size-12">
                                    {book.coverUrl ? (
                                        <img
                                            src={book.coverUrl}
                                            alt=""
                                            className="size-full object-contain"
                                        />
                                    ) : (
                                        <BookOpen className="size-5" aria-hidden="true" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <h3 className="wrap-anywhere m-0 font-semibold text-base">
                                        {book.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
                                        <Link
                                            to={`/admin/users/${book.author.id}`}
                                            className="wrap-anywhere font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-current"
                                        >
                                            {book.author.displayName}
                                        </Link>
                                        <span aria-hidden="true">·</span>
                                        <span>
                                            {displayed?.book.pageCount ?? book.pageCount} trang
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone="neutral">
                                            {visibilityLabel[book.visibility]}
                                        </Badge>
                                        {book.takenDown && <Badge tone="danger">Đã gỡ</Badge>}
                                        {openReportsCount > 0 && (
                                            <Badge tone="warning">
                                                {openReportsCount} báo cáo chờ
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!isMobile && bookMetadata}
                        </div>

                        {book.takenDown && book.takenDownReason && (
                            <Alert tone="danger" className="m-0">
                                <p className="m-0 font-medium">Lý do gỡ sách</p>
                                <p className="mt-1 mb-0">{book.takenDownReason}</p>
                            </Alert>
                        )}

                        {isMobile ? (
                            <Tabs value={tab} onValueChange={setTab} className="gap-2.5">
                                <TabsList className="w-full" aria-label="Nội dung kiểm duyệt sách">
                                    <TabsTrigger value="reports" className="min-h-8 py-1">
                                        Báo cáo ({reports.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="pages" className="min-h-8 py-1">
                                        Trang sách ({displayed?.book.pageCount ?? book.pageCount})
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="reports" className="space-y-3">
                                    {reportList}
                                    {bookMetadata}
                                </TabsContent>
                                <TabsContent value="pages" forceMount>
                                    {previewContent}
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-5 lg:gap-6">
                                {reportList}
                                {previewContent}
                            </div>
                        )}
                    </>
                )}
            </div>

            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0 empty:hidden max-sm:[&_button]:px-2.5">
                {details.isPending && (
                    <>
                        {onTakedown && (
                            <Skeleton className="h-10 w-22 rounded-[var(--radius-control)]" />
                        )}
                        {onDismiss && (
                            <Skeleton className="h-10 w-34 rounded-[var(--radius-control)]" />
                        )}
                    </>
                )}
                {showFullDetails && book && (
                    <Button variant="ghost" asChild className="mr-auto">
                        <Link to={`/admin/books/${book.id}`}>Chi tiết đầy đủ</Link>
                    </Button>
                )}
                {bookTarget && !bookTarget.takenDown && onTakedown && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => onTakedown(bookTarget)}
                    >
                        Gỡ sách
                    </Button>
                )}
                {bookTarget && openReportsCount > 0 && onDismiss && (
                    <Button type="button" onClick={() => onDismiss(bookTarget)}>
                        Bỏ qua báo cáo
                    </Button>
                )}
                {bookTarget?.takenDown && onReinstate && (
                    <Button type="button" onClick={() => onReinstate(bookTarget)}>
                        Khôi phục sách
                    </Button>
                )}
            </DialogFooter>
        </AdminDialog>
    );
}
