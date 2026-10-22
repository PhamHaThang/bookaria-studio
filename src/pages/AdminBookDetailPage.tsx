import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
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
        <section className="admin-section">
            <h2>Xử lý kiểm duyệt</h2>
            <Feedback error={error || action.error} />
            {action.uncertain && (
                <button
                    className="button secondary"
                    type="button"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </button>
            )}
            <form
                className="admin-form"
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
                <fieldset disabled={action.busy || action.uncertain}>
                    <label htmlFor="book-action">
                        Thao tác
                        <select
                            id="book-action"
                            value={kind}
                            onChange={(event) => setKind(event.target.value as BookAction)}
                        >
                            {!data.book.takenDown && <option value="takedown">Gỡ sách</option>}
                            {data.book.takenDown && (
                                <option value="reinstate">Khôi phục sách</option>
                            )}
                            <option value="dismiss" disabled={!open}>
                                Bỏ qua báo cáo đang mở ({open})
                            </option>
                        </select>
                    </label>
                    <label htmlFor="book-action-note">
                        {kind === 'takedown'
                            ? 'Lý do gỡ sách (bắt buộc)'
                            : 'Ghi chú (không bắt buộc)'}
                        <textarea
                            id="book-action-note"
                            required={kind === 'takedown'}
                            maxLength={1000}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </label>
                    <button className="button" type="submit" disabled={kind === 'dismiss' && !open}>
                        Xem lại thao tác
                    </button>
                </fieldset>
            </form>
            {draft && (
                <ConfirmDialog
                    title={`Xác nhận: ${actionLabel[draft.kind].toLowerCase()}`}
                    busy={action.busy}
                    className="admin-confirm"
                    onClose={() => setDraft(null)}
                >
                    <p>Sách: {data.book.title}</p>
                    <p>
                        {draft.kind === 'takedown'
                            ? 'Sách sẽ chuyển sang riêng tư; tất cả báo cáo đang mở được đánh dấu đã xử lý. Tác giả nhận thông báo.'
                            : draft.kind === 'reinstate'
                              ? 'Máy chủ bỏ trạng thái bị gỡ và khôi phục quyền hiển thị trước đó nếu tài khoản tác giả đang hoạt động. Tác giả nhận thông báo.'
                              : 'Tất cả báo cáo đang mở của sách sẽ được bỏ qua; không gỡ sách.'}
                    </p>
                    {draft.note && <p>Lý do / ghi chú: {draft.note}</p>}
                    <Feedback error={action.error} />
                    <div className="admin-actions">
                        <button
                            className="button"
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
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            disabled={action.busy}
                            onClick={() => setDraft(null)}
                        >
                            Quay lại
                        </button>
                    </div>
                </ConfirmDialog>
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
            {query.isPending && <p role="status">Đang tải sách…</p>}
            {query.isError && (
                <>
                    <Feedback error={errorMessage(query.error)} />
                    <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                </>
            )}
            {query.isSuccess && data && (
                <>
                    <div className="page-heading insights-heading">
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
                    <div className="admin-metadata">
                        <Badge>{visibilityLabel[data.book.visibility]}</Badge>
                        {data.book.takenDown && <Badge tone="danger">Đã bị gỡ</Badge>}
                        <span>{data.book.pageCount} trang</span>
                    </div>
                    {data.book.description && (
                        <p className="admin-prose">{data.book.description}</p>
                    )}
                    {data.book.takenDownReason && (
                        <p className="admin-prose">Lý do đã gỡ: {data.book.takenDownReason}</p>
                    )}
                    <BookActions
                        key={`${data.book.id}:${data.book.takenDown}:${data.reports.map((report) => report.status).join(',')}`}
                        data={data}
                        onSaved={setSuccess}
                    />
                    <section className="admin-section">
                        <h2>Báo cáo ({data.reports.length})</h2>
                        {data.reports.length ? (
                            <ul className="admin-rows">
                                {data.reports.map((report) => (
                                    <li key={report.id}>
                                        <div>
                                            <h3>{reportLabel[report.reason]}</h3>
                                            {report.note && (
                                                <p className="admin-prose">{report.note}</p>
                                            )}
                                            <div className="admin-metadata">
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
                    <section className="admin-section">
                        <h2>Các trang hiện tại</h2>
                        <p className="stats-note">
                            Ảnh thu nhỏ và thông tin bản nháp hiện tại do API trả về; không phải
                            trình xem toàn bộ nội dung phiên bản đã xuất bản.
                        </p>
                        {data.book.pages.length ? (
                            <ol className="admin-rows">
                                {data.book.pages.map((page) => (
                                    <li key={page.id}>
                                        <div className="admin-metadata">
                                            {page.thumbnailUrl && (
                                                <img
                                                    className="admin-page-thumb"
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
