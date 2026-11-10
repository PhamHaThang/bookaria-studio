import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    Ban,
    BookOpen,
    Calendar,
    CheckCircle2,
    Flag,
    RotateCcw,
    ShieldAlert,
    User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import {
    adminApi,
    adminDate,
    adminKeys,
    reportLabel,
    reportStatusLabel,
    visibilityLabel,
} from '../features/admin';
import { AdminReload, useAdminAction } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type AdminBookDetail,
    ModerationNoteBodySchema,
    TakedownBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

type BookAction = 'takedown' | 'reinstate' | 'dismiss';

const actionLabel = {
    takedown: 'Gỡ sách',
    reinstate: 'Khôi phục sách',
    dismiss: 'Bỏ qua báo cáo đang mở',
};

function BookActions({
    data,
    onSaved,
}: {
    data: AdminBookDetail;
    onSaved: (message: string) => void;
}) {
    const [kind, setKind] = useState<BookAction>(data.book.takenDown ? 'reinstate' : 'takedown');
    const [note, setNote] = useState('');
    const [draft, setDraft] = useState<{ kind: BookAction; note: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const action = useAdminAction();
    const open = data.reports.filter((report) => report.status === 'OPEN').length;

    return (
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="m-0 font-semibold text-foreground text-lg tracking-tight">
                Xử lý kiểm duyệt
            </h2>
            <p className="mt-1 text-muted-foreground text-xs">
                Lựa chọn thao tác can thiệp kiểm duyệt đối với đầu sách và cập nhật trạng thái các
                báo cáo.
            </p>

            <Feedback error={error || action.error} />

            {action.uncertain && (
                <Button
                    variant="secondary"
                    fullWidth
                    type="button"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </Button>
            )}

            <form
                className="mt-4 max-w-xl space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    setError(null);
                    const parsed =
                        kind === 'takedown'
                            ? TakedownBodySchema.safeParse({ reason: note })
                            : ModerationNoteBodySchema.safeParse({ note });
                    if (!parsed.success) {
                        setError(errorMessage(parsed.error));
                        return;
                    }
                    setDraft({ kind, note: note.trim() });
                }}
            >
                <FieldGroup className="space-y-4">
                    <fieldset disabled={action.busy || action.uncertain} className="space-y-4">
                        <Field>
                            <FieldLabel htmlFor="book-action" className="font-medium text-xs">
                                Thao tác kiểm duyệt
                            </FieldLabel>
                            <div className="mt-1">
                                <FormSelect
                                    id="book-action"
                                    value={kind}
                                    onValueChange={(value) => setKind(value as BookAction)}
                                    options={[
                                        ...(!data.book.takenDown
                                            ? [{ value: 'takedown', label: 'Gỡ sách' }]
                                            : []),
                                        ...(data.book.takenDown
                                            ? [{ value: 'reinstate', label: 'Khôi phục sách' }]
                                            : []),
                                        {
                                            value: 'dismiss',
                                            label: <>Bỏ qua báo cáo đang mở ({open})</>,
                                            disabled: !open,
                                        },
                                    ]}
                                />
                            </div>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="book-action-note" className="font-medium text-xs">
                                {kind === 'takedown'
                                    ? 'Lý do gỡ sách (bắt buộc)'
                                    : 'Ghi chú xử lý (không bắt buộc)'}
                            </FieldLabel>
                            <Textarea
                                id="book-action-note"
                                className="mt-1"
                                required={kind === 'takedown'}
                                maxLength={1000}
                                rows={3}
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder={
                                    kind === 'takedown'
                                        ? 'Nhập lý do gỡ sách để thông báo tới tác giả...'
                                        : 'Nhập ghi chú lưu vào biên bản kiểm toán...'
                                }
                            />
                        </Field>

                        <div className="pt-1">
                            <Button
                                type="submit"
                                disabled={kind === 'dismiss' && !open}
                                variant={kind === 'takedown' ? 'destructive' : 'default'}
                                className="gap-2"
                            >
                                {kind === 'takedown' && <Ban className="h-4 w-4" />}
                                {kind === 'reinstate' && <RotateCcw className="h-4 w-4" />}
                                {kind === 'dismiss' && <CheckCircle2 className="h-4 w-4" />}
                                Xem lại và thực hiện thao tác
                            </Button>
                        </div>
                    </fieldset>
                </FieldGroup>
            </form>

            {draft && (
                <ConfirmationDialog
                    description={<>Sách: {data.book.title}</>}
                    title={`Xác nhận: ${actionLabel[draft.kind].toLowerCase()}`}
                    busy={action.busy}
                    className="admin-confirm max-h-[88dvh] max-w-md overflow-y-auto p-5 sm:p-6"
                    onClose={() => setDraft(null)}
                >
                    <p className="text-foreground/90 text-sm leading-relaxed">
                        {draft.kind === 'takedown'
                            ? 'Sách sẽ chuyển sang riêng tư; tất cả báo cáo đang mở được đánh dấu đã xử lý. Tác giả nhận thông báo.'
                            : draft.kind === 'reinstate'
                              ? 'Máy chủ bỏ trạng thái bị gỡ và khôi phục quyền hiển thị trước đó nếu tài khoản tác giả đang hoạt động. Tác giả nhận thông báo.'
                              : 'Tất cả báo cáo đang mở của sách sẽ được bỏ qua; không gỡ sách.'}
                    </p>
                    {draft.note && (
                        <div className="rounded bg-muted/40 p-3 text-xs italic">
                            Lý do / ghi chú: {draft.note}
                        </div>
                    )}
                    <Feedback error={action.error} />
                    <div className="flex items-center justify-end gap-2.5 border-border border-t pt-4">
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                disabled={action.busy}
                                onClick={() => setDraft(null)}
                            >
                                Quay lại
                            </Button>
                        </AlertDialogAction>
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant={draft.kind === 'takedown' ? 'destructive' : 'default'}
                                size="sm"
                                type="button"
                                disabled={action.busy || action.uncertain}
                                onClick={() =>
                                    void action.run(
                                        async () => {
                                            if (draft.kind === 'takedown')
                                                await adminApi.takedown(data.book.id, {
                                                    reason: draft.note,
                                                });
                                            else if (draft.kind === 'reinstate')
                                                await adminApi.reinstate(data.book.id, {
                                                    note: draft.note,
                                                });
                                            else
                                                await adminApi.dismiss(data.book.id, {
                                                    note: draft.note,
                                                });
                                        },
                                        () => {
                                            setDraft(null);
                                            setNote('');
                                            onSaved(
                                                'Đã hoàn tất: ' +
                                                    actionLabel[draft.kind].toLowerCase() +
                                                    '.',
                                            );
                                        },
                                    )
                                }
                            >
                                {action.busy
                                    ? 'Đang xử lý…'
                                    : `Xác nhận ${actionLabel[draft.kind].toLowerCase()}`}
                            </Button>
                        </AlertDialogCancel>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}

export function AdminBookDetailPage() {
    const [success, setSuccess] = useState<string | null>(null);
    const { user } = useAuth();
    const { bookId = '' } = useParams();
    const valid = IdSchema.safeParse(bookId).success;

    const query = useQuery({
        queryKey: adminKeys.book(user?.id || '', bookId),
        queryFn: ({ signal }) => adminApi.book(bookId, signal),
        enabled: valid,
        retry: false,
        refetchOnWindowFocus: false,
    });

    if (!valid) {
        return (
            <div className="mx-auto max-w-6xl space-y-4 p-6">
                <h1 className="font-semibold text-2xl text-foreground">Không tìm thấy sách</h1>
                <p className="text-muted-foreground text-sm">
                    Mã định danh sách không hợp lệ hoặc đã bị thay đổi.
                </p>
                <Button variant="outline" asChild>
                    <Link to="/admin/books">Về tra cứu sách</Link>
                </Button>
            </div>
        );
    }

    const data = query.data;

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Thanh điều hướng quay lại */}
            <div className="flex items-center justify-between">
                <Link
                    to="/admin/moderation"
                    className="inline-flex items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Về hàng chờ kiểm duyệt</span>
                </Link>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                        <Link to="/admin/books">Tra cứu tất cả sách</Link>
                    </Button>
                </div>
            </div>

            <Feedback success={success} />

            {query.isPending && <LoadingState layout="detail">Đang tải sách…</LoadingState>}
            {query.isError && (
                <>
                    <Feedback error={errorMessage(query.error)} />
                    <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                </>
            )}

            {query.isSuccess && data && (
                <>
                    {/* Header thông tin sách */}
                    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-xs">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40">
                                    <BookOpen className="h-6 w-6 text-primary/80" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h1 className="m-0 truncate font-semibold text-2xl text-foreground tracking-tight">
                                            {data.book.title}
                                        </h1>
                                        <Badge
                                            tone="neutral"
                                            className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                        >
                                            {visibilityLabel[data.book.visibility]}
                                        </Badge>
                                        {data.book.takenDown && (
                                            <Badge
                                                tone="danger"
                                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                            >
                                                Đã bị gỡ
                                            </Badge>
                                        )}
                                        {data.reports.filter((r) => r.status === 'OPEN').length >
                                            0 && (
                                            <Badge
                                                tone="warning"
                                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                            >
                                                <Flag className="h-2.5 w-2.5" />
                                                {
                                                    data.reports.filter((r) => r.status === 'OPEN')
                                                        .length
                                                }{' '}
                                                báo cáo mở
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                                        <span className="inline-flex items-center gap-1">
                                            <User className="h-3.5 w-3.5" />
                                            Tác giả:{' '}
                                            <Link
                                                to={`/admin/users/${data.book.author.id}`}
                                                className="font-medium text-foreground hover:text-primary hover:underline"
                                            >
                                                {data.book.author.displayName}
                                            </Link>
                                        </span>
                                        <span>•</span>
                                        <span>{data.book.pageCount} trang</span>
                                        <span>•</span>
                                        <span className="font-mono text-muted-foreground/80">
                                            ID: {data.book.id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <AdminReload
                                retry={() => void query.refetch()}
                                busy={query.isFetching}
                            />
                        </div>

                        {data.book.description && (
                            <div className="mt-4 border-border/70 border-t pt-3.5">
                                <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                                    {data.book.description}
                                </p>
                            </div>
                        )}

                        {data.book.takenDownReason && (
                            <div className="mt-3.5 rounded-[var(--radius-md)] border border-destructive/20 bg-destructive/10 p-3 text-destructive text-xs">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    Lý do đã gỡ trước đó:
                                </span>
                                <p className="m-0 mt-1 text-foreground/90 leading-relaxed">
                                    {data.book.takenDownReason}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Khối xử lý kiểm duyệt */}
                    <BookActions
                        key={`${data.book.id}:${data.book.takenDown}:${data.reports.map((report) => report.status).join(',')}`}
                        data={data}
                        onSaved={setSuccess}
                    />

                    {/* Danh sách báo cáo vi phạm */}
                    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 font-semibold text-foreground text-lg tracking-tight">
                                Báo cáo vi phạm ({data.reports.length})
                            </h2>
                        </div>

                        {data.reports.length ? (
                            <ul className="mt-4 list-none space-y-3 p-0">
                                {data.reports.map((report) => (
                                    <li
                                        key={report.id}
                                        className="rounded-[var(--radius-md)] border border-border bg-surface p-4 text-xs shadow-xs"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    tone={
                                                        report.reason === 'INAPPROPRIATE'
                                                            ? 'danger'
                                                            : 'warning'
                                                    }
                                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[10px] leading-none"
                                                >
                                                    {reportLabel[report.reason]}
                                                </Badge>
                                                <Badge
                                                    tone={
                                                        report.status === 'OPEN'
                                                            ? 'warning'
                                                            : 'neutral'
                                                    }
                                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[10px] leading-none"
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
                                                        • Xử lý: {adminDate(report.handledAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {report.note && (
                                            <div className="mt-2.5 rounded bg-muted/40 p-2.5 text-foreground/90 italic">
                                                “{report.note}”
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 rounded-[var(--radius-md)] border border-border border-dashed p-5 text-center text-muted-foreground text-xs">
                                Chưa có báo cáo nào cho đầu sách này.
                            </p>
                        )}
                    </section>

                    {/* Danh sách các trang hiện tại */}
                    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs sm:p-6">
                        <div>
                            <h2 className="m-0 font-semibold text-foreground text-lg tracking-tight">
                                Các trang hiện tại ({data.book.pages.length})
                            </h2>
                            <p className="mt-1 text-muted-foreground text-xs">
                                Ảnh thu nhỏ và thông tin đối tượng hiện tại do máy chủ trả về.
                            </p>
                        </div>

                        {data.book.pages.length ? (
                            <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-6">
                                {data.book.pages.map((page) => (
                                    <div
                                        key={page.id}
                                        className="group overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface text-center shadow-xs transition-colors hover:border-primary/40"
                                    >
                                        <div className="relative flex aspect-3/4 items-center justify-center bg-muted/30">
                                            {page.thumbnailUrl ? (
                                                <img
                                                    className="h-full w-full object-contain"
                                                    src={page.thumbnailUrl}
                                                    alt={`Ảnh thu nhỏ trang ${page.orderIndex + 1}`}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                                            )}
<<<<<<< HEAD
                                            <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
                                                #{page.orderIndex + 1}
                                            </span>
=======
                                            <div>
                                                <h3>
                                                    Trang {page.orderIndex + 1}:{' '}
                                                    {page.title || 'Chưa đặt tên'}
                                                </h3>
                                                <p>
                                                    {page.objectCount} đối tượng · Marker:{' '}
                                                    {page.markerMode === 'CUSTOM_MARKER'
                                                        ? page.markerWarnings.includes('NOT_SCORED')
                                                            ? 'Chưa phân tích'
                                                            : page.markerWarnings.some((warning) =>
                                                                    [
                                                                        'LOW_SCORE',
                                                                        'REANALYZE_REQUIRED',
                                                                        'STALE_MARKER',
                                                                        'NO_FEATURES',
                                                                    ].includes(warning),
                                                                )
                                                              ? 'Cần phân tích lại'
                                                              : 'Đã phân tích'
                                                        : page.markerMode === 'NONE'
                                                          ? 'Không dùng AR'
                                                          : 'Bookaria'}
                                                </p>
                                            </div>
>>>>>>> origin/main
                                        </div>
                                        <div className="p-2 text-left">
                                            <p className="m-0 truncate font-medium text-foreground text-xs">
                                                {page.title || `Trang ${page.orderIndex + 1}`}
                                            </p>
                                            <p className="m-0 mt-0.5 text-[10px] text-muted-foreground">
                                                {page.objectCount} đối tượng
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-4 rounded-[var(--radius-md)] border border-border border-dashed p-5 text-center text-muted-foreground text-xs">
                                Đầu sách chưa có trang nào được tạo.
                            </p>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
