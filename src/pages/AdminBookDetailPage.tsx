import { useQuery } from '@tanstack/react-query';
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
    const [kind, setKind] = useState<BookAction>(data.book.takenDown ? 'reinstate' : 'takedown'),
        [note, setNote] = useState('');
    const [draft, setDraft] = useState<{ kind: BookAction; note: string } | null>(null),
        [error, setError] = useState<string | null>(null);
    const action = useAdminAction(),
        open = data.reports.filter((report) => report.status === 'OPEN').length;
    return (
        <section className="admin-section mt-8">
            <h2>Xử lý kiểm duyệt</h2>
            <Feedback error={error || action.error} />
            {action.uncertain && (
                <Button
                    variant="secondary"
                    fullWidth
                    type="button"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </Button>
            )}
            <form
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
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
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="book-action">
                                Thao tác
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
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="book-action-note">
                                {kind === 'takedown'
                                    ? 'Lý do gỡ sách (bắt buộc)'
                                    : 'Ghi chú (không bắt buộc)'}
                                <Textarea
                                    id="book-action-note"
                                    required={kind === 'takedown'}
                                    maxLength={1000}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                />
                            </FieldLabel>
                        </Field>
                        <Button fullWidth type="submit" disabled={kind === 'dismiss' && !open}>
                            Xem lại thao tác
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            {draft && (
                <ConfirmationDialog
                    description={<> Sách: {data.book.title} </>}
                    title={`Xác nhận: ${actionLabel[draft.kind].toLowerCase()}`}
                    busy={action.busy}
                    className="admin-confirm [&_p]:wrap-anywhere max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto [&_p]:[white-space:pre-wrap]"
                    onClose={() => setDraft(null)}
                >
                    <p>
                        {draft.kind === 'takedown'
                            ? 'Sách sẽ chuyển sang riêng tư; tất cả báo cáo đang mở được đánh dấu đã xử lý. Tác giả nhận thông báo.'
                            : draft.kind === 'reinstate'
                              ? 'Máy chủ bỏ trạng thái bị gỡ và khôi phục quyền hiển thị trước đó nếu tài khoản tác giả đang hoạt động. Tác giả nhận thông báo.'
                              : 'Tất cả báo cáo đang mở của sách sẽ được bỏ qua; không gỡ sách.'}
                    </p>
                    {draft.note && <p>Lý do / ghi chú: {draft.note}</p>}
                    <Feedback error={action.error} />
                    <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                fullWidth
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
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="secondary"
                                fullWidth
                                type="button"
                                disabled={action.busy}
                                onClick={() => setDraft(null)}
                            >
                                Quay lại
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
export function AdminBookDetailPage() {
    const [success, setSuccess] = useState<string | null>(null);
    const { user } = useAuth(),
        { bookId = '' } = useParams(),
        valid = IdSchema.safeParse(bookId).success;
    const query = useQuery({
        queryKey: adminKeys.book(user?.id || '', bookId),
        queryFn: ({ signal }) => adminApi.book(bookId, signal),
        enabled: valid,
        retry: false,
        refetchOnWindowFocus: false,
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy sách</h1>
                <Link to="/admin/books">Về tra cứu sách</Link>
            </>
        );
    const data = query.data;
    return (
        <>
            <Link to="/admin/moderation">Về báo cáo chờ xử lý</Link>
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
                    <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                        <div>
                            <h1>{data.book.title}</h1>
                            <p>
                                Tác giả:{' '}
                                <Link to={`/admin/users/${data.book.author.id}`}>
                                    {data.book.author.displayName}
                                </Link>
                            </p>
                        </div>
                        <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                    </div>
                    <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                        <Badge>{visibilityLabel[data.book.visibility]}</Badge>
                        {data.book.takenDown && <Badge tone="danger">Đã bị gỡ</Badge>}
                        <span>{data.book.pageCount} trang</span>
                    </div>
                    {data.book.description && (
                        <p className="admin-prose wrap-anywhere [white-space:pre-wrap]">
                            {data.book.description}
                        </p>
                    )}
                    {data.book.takenDownReason && (
                        <p className="admin-prose wrap-anywhere [white-space:pre-wrap]">
                            Lý do đã gỡ: {data.book.takenDownReason}
                        </p>
                    )}
                    <BookActions
                        key={`${data.book.id}:${data.book.takenDown}:${data.reports.map((report) => report.status).join(',')}`}
                        data={data}
                        onSaved={setSuccess}
                    />
                    <section className="admin-section mt-8">
                        <h2>Báo cáo ({data.reports.length})</h2>
                        {data.reports.length ? (
                            <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                                {data.reports.map((report) => (
                                    <li key={report.id}>
                                        <div>
                                            <h3>{reportLabel[report.reason]}</h3>
                                            {report.note && (
                                                <p className="admin-prose wrap-anywhere [white-space:pre-wrap]">
                                                    {report.note}
                                                </p>
                                            )}
                                            <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                                <Badge
                                                    tone={
                                                        report.status === 'OPEN'
                                                            ? 'warning'
                                                            : 'neutral'
                                                    }
                                                >
                                                    {reportStatusLabel[report.status]}
                                                </Badge>
                                                <span>Gửi: {adminDate(report.createdAt)}</span>
                                                {report.handledAt && (
                                                    <span>
                                                        Xử lý: {adminDate(report.handledAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>Chưa có báo cáo cho sách này.</p>
                        )}
                    </section>
                    <section className="admin-section mt-8">
                        <h2>Các trang hiện tại</h2>
                        <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                            Ảnh thu nhỏ và thông tin bản nháp hiện tại do API trả về; không phải
                            trình xem toàn bộ nội dung phiên bản đã xuất bản.
                        </p>
                        {data.book.pages.length ? (
                            <ol className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                                {data.book.pages.map((page) => (
                                    <li key={page.id}>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            {page.thumbnailUrl && (
                                                <img
                                                    className="admin-page-thumb size-24 shrink-0 bg-muted object-contain"
                                                    src={page.thumbnailUrl}
                                                    alt={`Ảnh thu nhỏ trang ${page.orderIndex + 1}`}
                                                    loading="lazy"
                                                />
                                            )}
                                            <div>
                                                <h3>
                                                    Trang {page.orderIndex + 1}:{' '}
                                                    {page.title || 'Chưa đặt tên'}
                                                </h3>
                                                <p>
                                                    {page.objectCount} đối tượng · Điểm marker:{' '}
                                                    {page.markerScore ?? 'Chưa chấm'}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p>Sách chưa có trang.</p>
                        )}
                    </section>
                </>
            )}
        </>
    );
}
