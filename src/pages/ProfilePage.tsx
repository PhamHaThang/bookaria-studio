import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, KeyRound, UserRound } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PasswordForm } from '@/features/profile/ui/PasswordForm';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Separator } from '@/shared/ui/primitives/separator';
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
    avatarEditor,
    onSaved,
    disabled,
    onBusyChange,
}: {
    me: Me;
    avatarEditor: ReactNode;
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
        <Card asChild>
            <section aria-labelledby="profile-details-heading">
                <CardHeader>
                    <CardTitle asChild>
                        <h2 id="profile-details-heading" className="m-0">
                            Thông tin cá nhân
                        </h2>
                    </CardTitle>
                    <CardDescription>
                        Tên, tổ chức và giới thiệu giúp người đọc biết thêm về bạn.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-6">{avatarEditor}</div>
                </CardContent>
                <form
                    aria-label="Cập nhật hồ sơ"
                    onSubmit={submit}
                    aria-busy={mutation.isPending}
                    className="flex flex-col"
                >
                    <CardContent>
                        <Feedback error={error} success={success} errorMode="toast" />
                        <fieldset
                            disabled={mutation.isPending || disabled}
                            className="m-0 min-w-0 border-0 p-0"
                        >
                            <FieldGroup>
                                <div className="grid items-start gap-5 sm:grid-cols-2">
                                    <Field>
                                        <FieldLabel htmlFor="profile-name">Họ tên</FieldLabel>
                                        <Input
                                            id="profile-name"
                                            autoComplete="name"
                                            value={values.displayName}
                                            onChange={(e) =>
                                                setValues({
                                                    ...values,
                                                    displayName: e.target.value,
                                                })
                                            }
                                            maxLength={100}
                                            required
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="profile-organization">
                                            Tổ chức
                                        </FieldLabel>
                                        <Input
                                            id="profile-organization"
                                            autoComplete="organization"
                                            placeholder="Trường học, đơn vị hoặc tổ chức"
                                            value={values.organization}
                                            onChange={(e) =>
                                                setValues({
                                                    ...values,
                                                    organization: e.target.value,
                                                })
                                            }
                                            maxLength={150}
                                        />
                                    </Field>
                                </div>
                                <Field>
                                    <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                                    <Input
                                        id="profile-email"
                                        type="email"
                                        value={me.email}
                                        disabled
                                        aria-describedby="profile-email-note"
                                    />
                                    <FieldDescription
                                        id="profile-email-note"
                                        className="flex items-center gap-1.5"
                                    >
                                        {me.emailVerified && (
                                            <BadgeCheck
                                                aria-hidden="true"
                                                className="size-3.5 shrink-0 text-success-foreground"
                                            />
                                        )}
                                        {me.emailVerified
                                            ? 'Email đã được xác minh.'
                                            : 'Email chưa được xác minh.'}
                                    </FieldDescription>
                                </Field>
                                <Field>
                                    <div className="flex items-center justify-between gap-3">
                                        <FieldLabel htmlFor="profile-bio">Giới thiệu</FieldLabel>
                                        <span className="text-muted-foreground text-xs tabular-nums">
                                            {values.bio.length}/500
                                        </span>
                                    </div>
                                    <Textarea
                                        id="profile-bio"
                                        rows={4}
                                        className="min-h-28 resize-y"
                                        placeholder="Một vài dòng về bạn và những cuốn sách bạn muốn tạo."
                                        value={values.bio}
                                        onChange={(e) =>
                                            setValues({ ...values, bio: e.target.value })
                                        }
                                        maxLength={500}
                                    />
                                </Field>
                            </FieldGroup>
                        </fieldset>
                    </CardContent>
                    <CardFooter className="justify-end px-6 py-6">
                        <Button
                            type="submit"
                            aria-busy={mutation.isPending}
                            disabled={mutation.isPending || disabled}
                        >
                            {mutation.isPending && (
                                <Spinner data-icon="inline-start" aria-hidden="true" />
                            )}
                            {mutation.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
                        </Button>
                    </CardFooter>
                </form>
            </section>
        </Card>
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
    const account = me || user;

    return (
        <section aria-labelledby="account-heading" className="w-full">
            <div className="mb-8">
                <h1 id="account-heading" className="m-0 mb-2 font-semibold text-3xl tracking-tight">
                    Hồ sơ của tôi
                </h1>
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
                className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8"
            >
                <Card asChild>
                    <aside aria-label="Thiết lập tài khoản" className="min-w-0 lg:sticky lg:top-28">
                        <CardHeader className="flex flex-row items-center gap-3">
                            <Avatar className="size-12">
                                {account?.avatarUrl && (
                                    <AvatarImage src={account.avatarUrl} alt="" />
                                )}
                                <AvatarFallback>
                                    <UserRound aria-hidden="true" className="size-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-col gap-1">
                                <p
                                    className="m-0 truncate font-semibold"
                                    title={account?.displayName}
                                >
                                    {account?.displayName || 'Tài khoản'}
                                </p>
                                <p
                                    className="m-0 truncate text-muted-foreground text-xs"
                                    title={account?.email}
                                >
                                    {account?.email}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Separator />
                            <TabsList
                                aria-label="Cài đặt tài khoản"
                                className="w-full flex-col items-stretch gap-1 border-0 p-0"
                            >
                                <TabsTrigger
                                    value="profile"
                                    disabled={busy}
                                    className="min-h-11 justify-start gap-3"
                                >
                                    <UserRound aria-hidden="true" />
                                    Hồ sơ
                                </TabsTrigger>
                                <TabsTrigger
                                    value="password"
                                    disabled={busy}
                                    className="min-h-11 justify-start gap-3"
                                >
                                    <KeyRound aria-hidden="true" />
                                    Đổi mật khẩu
                                </TabsTrigger>
                            </TabsList>
                        </CardContent>
                    </aside>
                </Card>
                <div className="min-w-0">
                    <TabsContent value="profile" forceMount className="flex flex-col">
                        {me ? (
                            <ProfileForm
                                key={me.id}
                                me={me}
                                avatarEditor={
                                    <ImageUploadEditor
                                        key={`avatar-${me.id}`}
                                        kind="avatar"
                                        embedded
                                        currentUrl={me.avatarUrl}
                                        disabled={profileBusy}
                                        onBusyChange={setAvatarBusy}
                                        onUploaded={() => {
                                            void cache.invalidateQueries({
                                                queryKey: profileKey(me.id),
                                            });
                                        }}
                                        onSave={async (avatarAssetId) => {
                                            await cache.cancelQueries({
                                                queryKey: profileKey(me.id),
                                            });
                                            const saved = await profileApi.update({
                                                avatarAssetId,
                                            });
                                            if (auth.store.getState().user?.id !== me.id) return;
                                            cache.setQueryData(profileKey(me.id), saved);
                                            auth.store.setState({ user: saved });
                                        }}
                                    />
                                }
                                disabled={avatarBusy}
                                onBusyChange={setProfileBusy}
                                onSaved={(saved) => {
                                    if (auth.store.getState().user?.id !== me.id) return;
                                    cache.setQueryData(profileKey(me.id), saved);
                                    auth.store.setState({ user: saved });
                                }}
                            />
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
            </Tabs>
        </section>
    );
}
