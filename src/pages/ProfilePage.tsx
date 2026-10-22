import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { auth, useAuth } from '../features/auth';
import { profileApi, profileKey } from '../features/profile';
import { errorMessage } from '../shared/api/errors';
import { NewPasswordSchema } from '../shared/contracts/api/auth.schema';
import type { Me } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';

function ProfileForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
    const cache = useQueryClient();
    const [values, setValues] = useState({
        displayName: me.displayName,
        organization: me.organization || '',
        bio: me.bio || '',
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const mutation = useMutation({
        mutationFn: profileApi.update,
        onMutate: () => cache.cancelQueries({ queryKey: profileKey(me.id) }),
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending) return;
        setError(null);
        setSuccess(null);
        try {
            const saved = await mutation.mutateAsync({
                displayName: values.displayName,
                organization: values.organization || null,
                bio: values.bio || null,
            });
            onSaved(saved);
            setValues({
                displayName: saved.displayName,
                organization: saved.organization || '',
                bio: saved.bio || '',
            });
            setSuccess('Đã lưu hồ sơ.');
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <form className="editor-form" onSubmit={submit} aria-busy={mutation.isPending}>
            <h2>Thông tin cá nhân</h2>
            <Feedback error={error} success={success} />
            <fieldset disabled={mutation.isPending}>
                <label htmlFor="profile-name">
                    Họ tên
                    <input
                        id="profile-name"
                        autoComplete="name"
                        value={values.displayName}
                        onChange={(e) => setValues({ ...values, displayName: e.target.value })}
                        maxLength={100}
                        required
                    />
                </label>
                <label htmlFor="profile-email">
                    Email
                    <input id="profile-email" type="email" value={me.email} readOnly />
                    <span className="field-hint">
                        {me.emailVerified ? 'Email đã được xác minh.' : 'Email chưa được xác minh.'}
                    </span>
                </label>
                <label htmlFor="profile-organization">
                    Đơn vị / trường học
                    <input
                        id="profile-organization"
                        autoComplete="organization"
                        value={values.organization}
                        onChange={(e) => setValues({ ...values, organization: e.target.value })}
                        maxLength={150}
                    />
                </label>
                <label htmlFor="profile-bio">
                    Giới thiệu
                    <textarea
                        id="profile-bio"
                        rows={4}
                        value={values.bio}
                        onChange={(e) => setValues({ ...values, bio: e.target.value })}
                        maxLength={500}
                    />
                </label>
                <Button type="submit" loading={mutation.isPending}>
                    {mutation.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
                </Button>
            </fieldset>
        </form>
    );
}

function PasswordForm() {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const mutation = useMutation({ mutationFn: profileApi.changePassword });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        setSuccess(null);
        try {
            const password = NewPasswordSchema.parse(String(data.get('newPassword') || ''));
            if (password !== data.get('confirmation')) {
                setError('Mật khẩu nhập lại chưa khớp.');
                return;
            }
            await mutation.mutateAsync({
                currentPassword: String(data.get('currentPassword') || '') || undefined,
                newPassword: password,
            });
            form.reset();
            setSuccess('Đã đổi mật khẩu. Các phiên đăng nhập khác đã được thu hồi.');
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <form
            className="editor-form password-section"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <h2>Đổi mật khẩu</h2>
            <p className="section-description">
                Nếu bạn đăng nhập bằng mật khẩu, hãy nhập mật khẩu hiện tại. Mật khẩu mới cần ít
                nhất 8 ký tự và tối đa 72 byte.
            </p>
            <Feedback error={error} success={success} />
            <fieldset disabled={mutation.isPending}>
                <label htmlFor="currentPassword">
                    Mật khẩu hiện tại
                    <input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                    />
                </label>
                <label htmlFor="newPassword">
                    Mật khẩu mới
                    <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={72}
                        required
                    />
                </label>
                <label htmlFor="confirmation">
                    Nhập lại mật khẩu mới
                    <input
                        id="confirmation"
                        name="confirmation"
                        type="password"
                        autoComplete="new-password"
                        required
                    />
                </label>
                <Button type="submit" loading={mutation.isPending}>
                    {mutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
                </Button>
            </fieldset>
        </form>
    );
}

export function ProfilePage() {
    const { user } = useAuth();
    const cache = useQueryClient();
    const profile = useQuery({
        queryKey: profileKey(user?.id || ''),
        queryFn: ({ signal }) => profileApi.get(signal),
        enabled: Boolean(user),
        refetchOnWindowFocus: false,
    });
    if (profile.isPending) return <p role="status">Đang tải hồ sơ…</p>;
    if (profile.isError)
        return (
            <>
                <h1>Hồ sơ</h1>
                <Feedback error={errorMessage(profile.error)} />
                <button
                    className="button compact"
                    type="button"
                    onClick={() => {
                        void profile.refetch();
                    }}
                >
                    Thử tải lại
                </button>
            </>
        );
    const me = profile.data;
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Hồ sơ</h1>
                    <p>Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
                </div>
            </div>
            <div className="profile-layout">
                <div>
                    <ProfileForm
                        key={me.id}
                        me={me}
                        onSaved={(saved) => {
                            cache.setQueryData(profileKey(me.id), saved);
                            auth.store.setState({ user: saved });
                        }}
                    />
                    <PasswordForm />
                </div>
                <aside className="storage-summary" aria-labelledby="storage-title">
                    <h2 id="storage-title">Dung lượng tài nguyên</h2>
                    <p>
                        <strong>{formatBytes(me.storage.usedBytes)}</strong> /{' '}
                        {formatBytes(me.storage.quotaBytes)}
                    </p>
                    <progress
                        aria-label="Dung lượng đã sử dụng"
                        max={Math.max(1, me.storage.quotaBytes)}
                        value={Math.min(me.storage.usedBytes, Math.max(1, me.storage.quotaBytes))}
                    />
                    <p className="field-hint">
                        {me.storage.usedBytes >= me.storage.quotaBytes
                            ? 'Đã chạm hạn mức. Bạn có thể cần dọn tài nguyên trước khi tải thêm.'
                            : 'Dung lượng được cập nhật theo tài nguyên trong tài khoản.'}
                    </p>
                </aside>
            </div>
        </>
    );
}
