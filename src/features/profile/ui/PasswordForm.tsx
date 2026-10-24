import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { validateNewPassword } from '@/features/auth/model/form';
import { errorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { PasswordInput } from '@/shared/ui/PasswordInput';
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
        <form
            className="editor-form password-section max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6"
            aria-label="Đổi mật khẩu"
            onSubmit={submit}
            aria-busy={mutation.isPending}
        >
            <FieldGroup className="contents">
                <h2>Đổi mật khẩu</h2>
                <p
                    id="new-password-help"
                    className="section-description mx-0 mt-[-6px] mb-6 text-[length:var(--text-sm)] text-muted-foreground"
                >
                    Nếu bạn đăng nhập bằng mật khẩu, hãy nhập mật khẩu hiện tại. Mật khẩu mới cần ít
                    nhất 8 ký tự.
                </p>
                <Feedback error={error} success={success} />
                <fieldset disabled={mutation.isPending}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="currentPassword">
                            Mật khẩu hiện tại
                            <PasswordInput
                                className="mt-2"
                                id="currentPassword"
                                visibilityLabel="mật khẩu hiện tại"
                                name="currentPassword"
                                autoComplete="current-password"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="newPassword">
                            Mật khẩu mới
                            <PasswordInput
                                className="mt-2"
                                id="newPassword"
                                visibilityLabel="mật khẩu mới"
                                name="newPassword"
                                autoComplete="new-password"
                                aria-describedby="new-password-help"
                                minLength={8}
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="confirmation">
                            Nhập lại mật khẩu mới
                            <PasswordInput
                                className="mt-2"
                                id="confirmation"
                                visibilityLabel="mật khẩu nhập lại"
                                name="confirmation"
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
