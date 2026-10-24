import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
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
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="create-name">
                                Tên hiển thị
                                <Input
                                    id="create-name"
                                    name="displayName"
                                    required
                                    maxLength={100}
                                    autoComplete="off"
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="create-email">
                                Email
                                <Input
                                    id="create-email"
                                    name="email"
                                    type="email"
                                    required
                                    autoComplete="off"
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="create-password">
                                Mật khẩu ban đầu
                                <Input
                                    id="create-password"
                                    name="password"
                                    type="password"
                                    required
                                    minLength={LIMITS.passwordMinLength}
                                    maxLength={LIMITS.passwordMaxLength}
                                    autoComplete="new-password"
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="create-role">
                                Vai trò
                                <NativeSelect id="create-role" name="role" defaultValue="AUTHOR">
                                    <option value="AUTHOR">Tác giả</option>
                                    <option value="ADMIN">Quản trị viên</option>
                                </NativeSelect>
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="create-quota">
                                Hạn mức dung lượng (byte)
                                <Input
                                    id="create-quota"
                                    name="quota"
                                    type="number"
                                    required
                                    min={1}
                                    step={1}
                                    max={Number.MAX_SAFE_INTEGER}
                                    defaultValue={LIMITS.defaultQuotaBytes}
                                />
                            </FieldLabel>
                        </Field>
                        <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                            1 GiB = 1.073.741.824 byte. Mật khẩu không được lưu vào trình duyệt bởi
                            ứng dụng.
                        </p>
                        <Button fullWidth type="submit">
                            Xem lại và tạo tài khoản
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            {draft && (
                <ConfirmDialog
                    title="Xác nhận tạo người dùng"
                    busy={action.busy}
                    className="admin-confirm [&_p]:wrap-anywhere max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto [&_p]:[white-space:pre-wrap]"
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
                    <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                        <Button
                            type="button"
                            fullWidth
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
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            fullWidth
                            disabled={action.busy}
                            onClick={() => setDraft(null)}
                        >
                            Quay lại
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </>
    );
}
