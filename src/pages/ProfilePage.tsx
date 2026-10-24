import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ImageUploadEditor } from '../features/assets';
import { auth, useAuth } from '../features/auth';
import { profileApi, profileKey } from '../features/profile';
import { errorMessage } from '../shared/api/errors';
import { NewPasswordSchema } from '../shared/contracts/api/auth.schema';
import type { Me } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';

function ProfileForm({
    me,
    onSaved,
    disabled,
    onBusyChange,
}: {
    me: Me;
    onSaved: (me: Me) => void;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
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
        onMutate: () => {
            onBusyChange(true);
            return cache.cancelQueries({ queryKey: profileKey(me.id) });
        },
        onSettled: () => onBusyChange(false),
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending || disabled) return;
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
        <form
            className="editor-form max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <FieldGroup className="contents">
                <h2>Thông tin cá nhân</h2>
                <Feedback error={error} success={success} />
                <fieldset disabled={mutation.isPending || disabled}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="profile-name">
                            Họ tên
                            <Input
                                id="profile-name"
                                autoComplete="name"
                                value={values.displayName}
                                onChange={(e) =>
                                    setValues({ ...values, displayName: e.target.value })
                                }
                                maxLength={100}
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="profile-email">
                            Email
                            <Input id="profile-email" type="email" value={me.email} readOnly />
                            <span className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                {me.emailVerified
                                    ? 'Email đã được xác minh.'
                                    : 'Email chưa được xác minh.'}
                            </span>
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="profile-organization">
                            Đơn vị / trường học
                            <Input
                                id="profile-organization"
                                autoComplete="organization"
                                value={values.organization}
                                onChange={(e) =>
                                    setValues({ ...values, organization: e.target.value })
                                }
                                maxLength={150}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="profile-bio">
                            Giới thiệu
                            <Textarea
                                id="profile-bio"
                                rows={4}
                                value={values.bio}
                                onChange={(e) => setValues({ ...values, bio: e.target.value })}
                                maxLength={500}
                            />
                        </FieldLabel>
                    </Field>
                    <Button
                        type="submit"
                        aria-busy={mutation.isPending}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending && (
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                        )}
                        {mutation.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
                    </Button>
                </fieldset>
            </FieldGroup>
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
            className="editor-form password-section mt-8 max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <FieldGroup className="contents">
                <h2>Đổi mật khẩu</h2>
                <p className="section-description mx-0 mt-[-6px] mb-6 text-[length:var(--text-sm)] text-muted-foreground">
                    Nếu bạn đăng nhập bằng mật khẩu, hãy nhập mật khẩu hiện tại. Mật khẩu mới cần ít
                    nhất 8 ký tự và tối đa 72 byte.
                </p>
                <Feedback error={error} success={success} />
                <fieldset disabled={mutation.isPending}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="currentPassword">
                            Mật khẩu hiện tại
                            <Input
                                id="currentPassword"
                                name="currentPassword"
                                type="password"
                                autoComplete="current-password"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="newPassword">
                            Mật khẩu mới
                            <Input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={72}
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="confirmation">
                            Nhập lại mật khẩu mới
                            <Input
                                id="confirmation"
                                name="confirmation"
                                type="password"
                                autoComplete="new-password"
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Button
                        type="submit"
                        aria-busy={mutation.isPending}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending && (
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                        )}
                        {mutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
                    </Button>
                </fieldset>
            </FieldGroup>
        </form>
    );
}

export function ProfilePage() {
    const { user } = useAuth();
    const cache = useQueryClient();
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [profileBusy, setProfileBusy] = useState(false);
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
                <Button
                    type="button"
                    onClick={() => {
                        void profile.refetch();
                    }}
                >
                    Thử tải lại
                </Button>
            </>
        );
    const me = profile.data;
    return (
        <>
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Hồ sơ</h1>
                    <p>Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
                </div>
            </div>
            <div className="profile-layout grid grid-cols-[minmax(0,_720px)_minmax(180px,_240px)] items-start gap-8 max-[1100px]:grid-cols-[minmax(0,_1fr)]">
                <div>
                    <ImageUploadEditor
                        key={`avatar-${me.id}`}
                        kind="avatar"
                        currentUrl={me.avatarUrl}
                        disabled={profileBusy}
                        onBusyChange={setAvatarBusy}
                        onUploaded={() => {
                            void cache.invalidateQueries({ queryKey: profileKey(me.id) });
                        }}
                        onSave={async (avatarAssetId) => {
                            await cache.cancelQueries({ queryKey: profileKey(me.id) });
                            const saved = await profileApi.update({ avatarAssetId });
                            if (auth.store.getState().user?.id !== me.id) return;
                            cache.setQueryData(profileKey(me.id), saved);
                            auth.store.setState({ user: saved });
                        }}
                    />
                    <ProfileForm
                        key={me.id}
                        me={me}
                        disabled={avatarBusy}
                        onBusyChange={setProfileBusy}
                        onSaved={(saved) => {
                            if (auth.store.getState().user?.id !== me.id) return;
                            cache.setQueryData(profileKey(me.id), saved);
                            auth.store.setState({ user: saved });
                        }}
                    />
                    <PasswordForm />
                </div>
                <aside
                    className="storage-summary pt-2 max-[1100px]:max-w-90 [&_h2]:mb-4 [&_h2]:text-[length:var(--text-md)] [&_p]:text-[length:var(--text-sm)] [&_p]:tabular-nums [&_progress]:h-[9px] [&_progress]:w-full [&_progress]:[accent-color:var(--action-primary)]"
                    aria-labelledby="storage-title"
                >
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
                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                        {me.storage.usedBytes >= me.storage.quotaBytes
                            ? 'Đã chạm hạn mức. Bạn có thể cần dọn tài nguyên trước khi tải thêm.'
                            : 'Dung lượng được cập nhật theo tài nguyên trong tài khoản.'}
                    </p>
                </aside>
            </div>
        </>
    );
}
