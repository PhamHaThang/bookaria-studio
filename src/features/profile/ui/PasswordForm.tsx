import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { validateNewPassword } from '@/features/auth/model/form';
import { errorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { profileApi } from '../model/profile';

export function PasswordForm({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const mutation = useMutation({
        mutationFn: profileApi.changePassword,
        onMutate: () => onBusyChange?.(true),
        onSettled: () => onBusyChange?.(false),
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (mutation.isPending) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        setSuccess(null);
        try {
            const password = String(data.get('newPassword') || '');
            const validation = validateNewPassword(
                password,
                String(data.get('confirmation') || ''),
            );
            if (validation) {
                setError(validation);
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
        <Card asChild>
            <form aria-label="Đổi mật khẩu" onSubmit={submit} aria-busy={mutation.isPending}>
                <CardHeader className="gap-2">
                    <CardTitle asChild>
                        <h2 className="m-0">Đổi mật khẩu</h2>
                    </CardTitle>
                    <CardDescription id="new-password-help">
                        Nếu bạn đăng nhập bằng mật khẩu, hãy nhập mật khẩu hiện tại. Mật khẩu mới
                        cần ít nhất 8 ký tự.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Feedback error={error} success={success} errorMode="toast" />
                    <fieldset disabled={mutation.isPending} className="m-0 min-w-0 border-0 p-0">
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="currentPassword">Mật khẩu hiện tại</FieldLabel>
                                <PasswordInput
                                    id="currentPassword"
                                    visibilityLabel="mật khẩu hiện tại"
                                    name="currentPassword"
                                    autoComplete="current-password"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="newPassword">Mật khẩu mới</FieldLabel>
                                <PasswordInput
                                    id="newPassword"
                                    visibilityLabel="mật khẩu mới"
                                    name="newPassword"
                                    autoComplete="new-password"
                                    aria-describedby="new-password-help"
                                    minLength={8}
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="confirmation">
                                    Nhập lại mật khẩu mới
                                </FieldLabel>
                                <PasswordInput
                                    id="confirmation"
                                    visibilityLabel="mật khẩu nhập lại"
                                    name="confirmation"
                                    autoComplete="new-password"
                                    required
                                />
                            </Field>
                        </FieldGroup>
                    </fieldset>
                </CardContent>
                <CardFooter className="justify-end px-6 pt-0 pb-6">
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
                </CardFooter>
            </form>
        </Card>
    );
}
