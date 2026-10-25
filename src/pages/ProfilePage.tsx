import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PasswordForm } from '@/features/profile/ui/PasswordForm';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ImageUploadEditor } from '../features/assets';
import { auth, useAuth } from '../features/auth';
import { profileApi, profileKey } from '../features/profile';
import { errorMessage } from '../shared/api/errors';
import type { Me } from '../shared/contracts/dto.schema';
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
            aria-label="Cập nhật hồ sơ"
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

export function ProfilePage() {
    const { user } = useAuth();
    const cache = useQueryClient();
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [profileBusy, setProfileBusy] = useState(false);
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'password' ? 'password' : 'profile';
    const busy = avatarBusy || profileBusy || passwordBusy;
    const profile = useQuery({
        queryKey: profileKey(user?.id || ''),
        queryFn: ({ signal }) => profileApi.get(signal),
        enabled: Boolean(user),
        refetchOnWindowFocus: false,
    });
    const me = profile.data;

    return (
        <section className="mx-auto w-full max-w-248">
            <div className="mb-7">
                <h1 className="mb-2 font-semibold text-3xl tracking-tight">Hồ sơ</h1>
                <p className="m-0 text-muted-foreground text-sm">
                    Quản lý thông tin cá nhân và bảo mật tài khoản.
                </p>
            </div>
            <Tabs
                orientation="vertical"
                activationMode="manual"
                value={tab}
                onValueChange={(value) => {
                    if (busy || (value !== 'profile' && value !== 'password')) return;
                    setParams(
                        (current) => {
                            const next = new URLSearchParams(current);
                            if (value === 'password') next.set('tab', value);
                            else next.delete('tab');
                            return next;
                        },
                        { preventScrollReset: true },
                    );
                    window.scrollTo(0, 0);
                }}
                className="grid grid-cols-[minmax(0,_1fr)_240px] items-start gap-8"
            >
                <div className="min-w-0">
                    <TabsContent value="profile" forceMount>
                        {me ? (
                            <>
                                <ImageUploadEditor
                                    key={`avatar-${me.id}`}
                                    kind="avatar"
                                    currentUrl={me.avatarUrl}
                                    disabled={profileBusy}
                                    onBusyChange={setAvatarBusy}
                                    onUploaded={() => {
                                        void cache.invalidateQueries({
                                            queryKey: profileKey(me.id),
                                        });
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
                            </>
                        ) : profile.isPending ? (
                            <LoadingState layout="profile">Đang tải hồ sơ…</LoadingState>
                        ) : (
                            <div>
                                <Feedback error={errorMessage(profile.error)} />
                                <Button onClick={() => void profile.refetch()}>Thử tải lại</Button>
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="password" forceMount>
                        <PasswordForm onBusyChange={setPasswordBusy} />
                    </TabsContent>
                </div>
                <Card asChild className="sticky top-28 self-start">
                    <aside aria-label="Thiết lập tài khoản">
                        <CardHeader>
                            <CardTitle asChild>
                                <h2>Tài khoản</h2>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TabsList variant="navigation" aria-label="Cài đặt tài khoản">
                                <TabsTrigger value="profile" disabled={busy}>
                                    <UserRound aria-hidden="true" />
                                    Hồ sơ
                                </TabsTrigger>
                                <TabsTrigger value="password" disabled={busy}>
                                    <KeyRound aria-hidden="true" />
                                    Đổi mật khẩu
                                </TabsTrigger>
                            </TabsList>
                        </CardContent>
                    </aside>
                </Card>
            </Tabs>
        </section>
    );
}
