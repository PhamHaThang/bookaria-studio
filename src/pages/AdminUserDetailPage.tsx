import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
import { Textarea } from '@/shared/ui/primitives/textarea';
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
        <section className="admin-section mt-8">
            <h2>Thay đổi tài khoản</h2>
            <Feedback error={error || action.error} />
            {action.uncertain && (
                <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </Button>
            )}
            {self && <p>Bạn không thể tự khóa hoặc hạ quyền tài khoản đang dùng.</p>}
            <form
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
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
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="edit-role">
                                Vai trò
                                <NativeSelect
                                    id="edit-role"
                                    disabled={self}
                                    value={role}
                                    onChange={(event) => setRole(event.target.value as typeof role)}
                                >
                                    <option value="AUTHOR">Tác giả</option>
                                    <option value="ADMIN">Quản trị viên</option>
                                </NativeSelect>
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="edit-status">
                                Trạng thái
                                <NativeSelect
                                    id="edit-status"
                                    disabled={self}
                                    value={status}
                                    onChange={(event) =>
                                        setStatus(event.target.value as typeof status)
                                    }
                                >
                                    <option value="ACTIVE">Hoạt động</option>
                                    <option value="LOCKED">Đã khóa</option>
                                </NativeSelect>
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="edit-quota">
                                Hạn mức dung lượng (byte)
                                <Input
                                    id="edit-quota"
                                    type="number"
                                    required
                                    min={1}
                                    step={1}
                                    max={Number.MAX_SAFE_INTEGER}
                                    value={quota}
                                    onChange={(event) => setQuota(event.target.value)}
                                />
                            </FieldLabel>
                        </Field>
                        <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                            1 GiB = 1.073.741.824 byte. Hạn mức hiện nhập:{' '}
                            {bytesLabel(Number(quota))}.
                        </p>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="edit-reason">
                                Lý do thay đổi
                                {body.status !== undefined || body.role !== undefined
                                    ? ' (bắt buộc)'
                                    : ' (không bắt buộc)'}
                                <Textarea
                                    id="edit-reason"
                                    required={body.status !== undefined || body.role !== undefined}
                                    maxLength={500}
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                />
                            </FieldLabel>
                        </Field>
                        <Button fullWidth type="submit" disabled={!changed}>
                            Xem lại thay đổi
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            {draft && (
                <ConfirmDialog
                    title="Xác nhận thay đổi tài khoản"
                    busy={action.busy}
                    className="admin-confirm [&_p]:wrap-anywhere max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto [&_p]:[white-space:pre-wrap]"
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
                    <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                        <Button
                            fullWidth
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
                        </Button>
                        <Button
                            variant="secondary"
                            fullWidth
                            type="button"
                            disabled={action.busy}
                            onClick={() => setDraft(null)}
                        >
                            Quay lại
                        </Button>
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
                    <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                        <div>
                            <h1>{query.data.displayName}</h1>
                            <p>{query.data.email}</p>
                        </div>
                        <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                    </div>
                    <dl className="admin-facts [&_dd]:wrap-anywhere my-5 grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[var(--space-4)_var(--space-6)] max-[640px]:grid-cols-[1fr] [&_>_div]:border-b-[1px] [&_>_div]:border-b-border [&_>_div]:py-3 [&_>_div]:[border-bottom-style:solid] [&_dd]:mx-0 [&_dd]:mt-2 [&_dd]:mb-0 [&_dd]:tabular-nums [&_dt]:text-[length:var(--text-sm)] [&_dt]:text-muted-foreground">
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
                    <section className="admin-section mt-8">
                        <h2>Sách của người dùng ({query.data.bookCount})</h2>
                        {query.data.books.length ? (
                            <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                                {query.data.books.map((book) => (
                                    <li key={book.id}>
                                        <div>
                                            <h3>
                                                <Link to={`/admin/books/${book.id}`}>
                                                    {book.title}
                                                </Link>
                                            </h3>
                                            <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
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
