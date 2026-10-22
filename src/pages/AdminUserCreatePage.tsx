import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi, bytesLabel, roleLabel } from '../features/admin';
import { useAdminAction } from '../features/admin/ui';
import { errorMessage } from '../shared/api/errors';
import {
    type AdminCreateUserBody,
    AdminCreateUserBodySchema,
} from '../shared/contracts/api/admin.schema';
import { LIMITS } from '../shared/contracts/common.schema';
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
import { Feedback } from '../shared/ui/Feedback';

export function AdminUserCreatePage() {
    const navigate = useNavigate(),
        action = useAdminAction();
    const [draft, setDraft] = useState<AdminCreateUserBody | null>(null),
        [error, setError] = useState<string | null>(null);
    return (
        <>
            <Link to="/admin/users">Về danh sách người dùng</Link>
            <h1>Tạo người dùng</h1>
            <p>Tạo tài khoản mới với vai trò và hạn mức được chỉ định. Không tự gửi email mời.</p>
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
                    const data = new FormData(event.currentTarget);
                    const parsed = AdminCreateUserBodySchema.safeParse({
                        email: data.get('email'),
                        password: data.get('password'),
                        displayName: data.get('displayName'),
                        role: data.get('role'),
                        storageQuotaBytes: Number(data.get('quota')),
                    });
                    if (!parsed.success) {
                        setError(errorMessage(parsed.error));
                        return;
                    }
                    setDraft(parsed.data);
                }}
            >
                <fieldset disabled={action.busy || action.uncertain}>
                    <label htmlFor="create-name">
                        Tên hiển thị
                        <input
                            id="create-name"
                            name="displayName"
                            required
                            maxLength={100}
                            autoComplete="off"
                        />
                    </label>
                    <label htmlFor="create-email">
                        Email
                        <input
                            id="create-email"
                            name="email"
                            type="email"
                            required
                            autoComplete="off"
                        />
                    </label>
                    <label htmlFor="create-password">
                        Mật khẩu ban đầu
                        <input
                            id="create-password"
                            name="password"
                            type="password"
                            required
                            minLength={LIMITS.passwordMinLength}
                            maxLength={LIMITS.passwordMaxLength}
                            autoComplete="new-password"
                        />
                    </label>
                    <label htmlFor="create-role">
                        Vai trò
                        <select id="create-role" name="role" defaultValue="AUTHOR">
                            <option value="AUTHOR">Tác giả</option>
                            <option value="ADMIN">Quản trị viên</option>
                        </select>
                    </label>
                    <label htmlFor="create-quota">
                        Hạn mức dung lượng (byte)
                        <input
                            id="create-quota"
                            name="quota"
                            type="number"
                            required
                            min={1}
                            step={1}
                            max={Number.MAX_SAFE_INTEGER}
                            defaultValue={LIMITS.defaultQuotaBytes}
                        />
                    </label>
                    <p className="stats-note">
                        1 GiB = 1.073.741.824 byte. Mật khẩu không được lưu vào trình duyệt bởi ứng
                        dụng.
                    </p>
                    <button className="button" type="submit">
                        Xem lại và tạo tài khoản
                    </button>
                </fieldset>
            </form>
            {draft && (
                <ConfirmDialog
                    title="Xác nhận tạo người dùng"
                    busy={action.busy}
                    className="admin-confirm"
                    onClose={() => setDraft(null)}
                >
                    <p>
                        {draft.displayName} — {draft.email}
                    </p>
                    <p>
                        Vai trò: {roleLabel[draft.role]}. Hạn mức:{' '}
                        {bytesLabel(draft.storageQuotaBytes)}.
                    </p>
                    {draft.role === 'ADMIN' && <p>Tài khoản này có quyền quản trị hệ thống.</p>}
                    <Feedback error={action.error} />
                    <div className="admin-actions">
                        <button
                            type="button"
                            className="button"
                            disabled={action.busy || action.uncertain}
                            onClick={() =>
                                void action.run(
                                    () => adminApi.createUser(draft),
                                    (result) => {
                                        setDraft(null);
                                        navigate(`/admin/users/${result.id}`, {
                                            replace: true,
                                            state: { created: true },
                                        });
                                    },
                                )
                            }
                        >
                            {action.busy ? 'Đang tạo…' : 'Xác nhận tạo tài khoản'}
                        </button>
                        <button
                            type="button"
                            className="button secondary"
                            disabled={action.busy}
                            onClick={() => setDraft(null)}
                        >
                            Quay lại
                        </button>
                    </div>
                </ConfirmDialog>
            )}
        </>
    );
}
