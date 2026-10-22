import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
    adminApi,
    adminDate,
    adminKeys,
    bytesLabel,
    roleLabel,
    statusLabel,
    userChanges,
    visibilityLabel,
} from '../features/admin';
import { AdminReload, useAdminAction } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { AdminUserDetails } from '../shared/contracts/api/admin.schema';
import {
    type AdminUpdateUserBody,
    AdminUpdateUserBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import { Badge } from '../shared/ui/Badge';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Feedback } from '../shared/ui/Feedback';

function UserEditor({
    target,
    actor,
    onSaved,
}: {
    target: AdminUserDetails;
    actor: string;
    onSaved: () => void;
}) {
    const [role, setRole] = useState(target.role),
        [status, setStatus] = useState(target.status),
        [quota, setQuota] = useState(String(target.storage.quotaBytes)),
        [reason, setReason] = useState('');
    const [draft, setDraft] = useState<AdminUpdateUserBody | null>(null),
        [error, setError] = useState<string | null>(null);
    const action = useAdminAction(),
        self = actor.toLowerCase() === target.id.toLowerCase();
    const body = userChanges(target, { role, status, quota, reason });
    const changed =
        body.role !== undefined ||
        body.status !== undefined ||
        body.storageQuotaBytes !== undefined;
    return (
        <section className="admin-section">
            <h2>Thay đổi tài khoản</h2>
            <Feedback error={error || action.error} />
            {action.uncertain && (
                <button
                    type="button"
                    className="button secondary"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </button>
            )}
            {self && <p>Bạn không thể tự khóa hoặc hạ quyền tài khoản đang dùng.</p>}
            <form
                className="admin-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    setError(null);
                    const parsed = AdminUpdateUserBodySchema.safeParse(body);
                    if (!parsed.success) {
                        setError(errorMessage(parsed.error));
                        return;
                    }
                    setDraft(parsed.data);
                }}
            >
                <fieldset disabled={action.busy || action.uncertain}>
                    <label htmlFor="edit-role">
                        Vai trò
                        <select
                            id="edit-role"
                            disabled={self}
                            value={role}
                            onChange={(event) => setRole(event.target.value as typeof role)}
                        >
                            <option value="AUTHOR">Tác giả</option>
                            <option value="ADMIN">Quản trị viên</option>
                        </select>
                    </label>
                    <label htmlFor="edit-status">
                        Trạng thái
                        <select
                            id="edit-status"
                            disabled={self}
                            value={status}
                            onChange={(event) => setStatus(event.target.value as typeof status)}
                        >
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="LOCKED">Đã khóa</option>
                        </select>
                    </label>
                    <label htmlFor="edit-quota">
                        Hạn mức dung lượng (byte)
                        <input
                            id="edit-quota"
                            type="number"
                            required
                            min={1}
                            step={1}
                            max={Number.MAX_SAFE_INTEGER}
                            value={quota}
                            onChange={(event) => setQuota(event.target.value)}
                        />
                    </label>
                    <p className="stats-note">
                        1 GiB = 1.073.741.824 byte. Hạn mức hiện nhập: {bytesLabel(Number(quota))}.
                    </p>
                    <label htmlFor="edit-reason">
                        Lý do thay đổi
                        {body.status !== undefined || body.role !== undefined
                            ? ' (bắt buộc)'
                            : ' (không bắt buộc)'}
                        <textarea
                            id="edit-reason"
                            required={body.status !== undefined || body.role !== undefined}
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                        />
                    </label>
                    <button className="button" type="submit" disabled={!changed}>
                        Xem lại thay đổi
                    </button>
                </fieldset>
            </form>
            {draft && (
                <ConfirmDialog
                    title="Xác nhận thay đổi tài khoản"
                    busy={action.busy}
                    className="admin-confirm"
                    onClose={() => setDraft(null)}
                >
                    <p>
                        {target.displayName} — {target.email}
                    </p>
                    {draft.role && (
                        <p>
                            Vai trò: {roleLabel[target.role]} → {roleLabel[draft.role]}.{' '}
                            {draft.role === 'AUTHOR'
                                ? 'Các phiên đăng nhập sẽ bị thu hồi.'
                                : 'Người dùng sẽ có quyền quản trị hệ thống.'}
                        </p>
                    )}
                    {draft.status && (
                        <p>
                            Trạng thái: {statusLabel[target.status]} → {statusLabel[draft.status]}.{' '}
                            {draft.status === 'LOCKED'
                                ? 'Thu hồi mọi phiên đăng nhập và chuyển sách của người dùng sang riêng tư.'
                                : 'Máy chủ khôi phục quyền hiển thị trước khi khóa khi sách đủ điều kiện; sách bị gỡ vẫn được giữ riêng tư.'}
                        </p>
                    )}
                    {draft.storageQuotaBytes !== undefined && (
                        <p>
                            Hạn mức: {bytesLabel(target.storage.quotaBytes)} →{' '}
                            {bytesLabel(draft.storageQuotaBytes)}.
                        </p>
                    )}
                    {draft.reason && <p>Lý do: {draft.reason}</p>}
                    <Feedback error={action.error} />
                    <div className="admin-actions">
                        <button
                            className="button"
                            type="button"
                            disabled={action.busy || action.uncertain}
                            onClick={() =>
                                void action.run(
                                    () => adminApi.updateUser(target.id, draft),
                                    () => {
                                        setDraft(null);
                                        onSaved();
                                    },
                                )
                            }
                        >
                            {action.busy ? 'Đang lưu…' : 'Xác nhận lưu thay đổi'}
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
export function AdminUserDetailPage() {
    const location = useLocation();
    const [success, setSuccess] = useState<string | null>(
        location.state?.created ? 'Đã tạo người dùng.' : null,
    );
    const { user } = useAuth(),
        { userId = '' } = useParams(),
        valid = IdSchema.safeParse(userId).success;
    const query = useQuery({
        queryKey: adminKeys.user(user?.id || '', userId),
        queryFn: ({ signal }) => adminApi.user(userId, signal),
        enabled: valid,
        retry: false,
        refetchOnWindowFocus: false,
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy người dùng</h1>
                <Link to="/admin/users">Về danh sách người dùng</Link>
            </>
        );
    return (
        <>
            <Link to="/admin/users">Về danh sách người dùng</Link>
            <Feedback success={success} />
            {query.isPending && <p role="status">Đang tải tài khoản…</p>}
            {query.isError && (
                <>
                    <Feedback error={errorMessage(query.error)} />
                    <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                </>
            )}
            {query.isSuccess && (
                <>
                    <div className="page-heading insights-heading">
                        <div>
                            <h1>{query.data.displayName}</h1>
                            <p>{query.data.email}</p>
                        </div>
                        <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                    </div>
                    <dl className="admin-facts">
                        <div>
                            <dt>Vai trò</dt>
                            <dd>{roleLabel[query.data.role]}</dd>
                        </div>
                        <div>
                            <dt>Trạng thái</dt>
                            <dd>
                                <Badge tone={query.data.status === 'LOCKED' ? 'danger' : 'success'}>
                                    {statusLabel[query.data.status]}
                                </Badge>
                            </dd>
                        </div>
                        <div>
                            <dt>Dung lượng đã dùng / hạn mức</dt>
                            <dd>
                                {bytesLabel(query.data.storage.usedBytes)} /{' '}
                                {bytesLabel(query.data.storage.quotaBytes)}
                            </dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{query.data.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd>
                        </div>
                        <div>
                            <dt>Ngày tạo</dt>
                            <dd>{adminDate(query.data.createdAt)}</dd>
                        </div>
                        <div>
                            <dt>Đăng nhập gần nhất</dt>
                            <dd>{adminDate(query.data.lastLoginAt)}</dd>
                        </div>
                    </dl>
                    <UserEditor
                        key={`${query.data.id}:${query.data.updatedAt}`}
                        target={query.data}
                        actor={user?.id || ''}
                        onSaved={() => setSuccess('Đã lưu thay đổi tài khoản.')}
                    />
                    <section className="admin-section">
                        <h2>Sách của người dùng ({query.data.bookCount})</h2>
                        {query.data.books.length ? (
                            <ul className="admin-rows">
                                {query.data.books.map((book) => (
                                    <li key={book.id}>
                                        <div>
                                            <h3>
                                                <Link to={`/admin/books/${book.id}`}>
                                                    {book.title}
                                                </Link>
                                            </h3>
                                            <div className="admin-metadata">
                                                <span>{visibilityLabel[book.visibility]}</span>
                                                <span>{book.pageCount} trang</span>
                                                {book.takenDown && (
                                                    <Badge tone="danger">Đã bị gỡ</Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Link to={`/admin/books/${book.id}`}>
                                            Xem để kiểm duyệt
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>Chưa có sách trong danh sách trả về.</p>
                        )}
                    </section>
                </>
            )}
        </>
    );
}
