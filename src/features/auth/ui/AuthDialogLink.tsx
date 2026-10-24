import type { ComponentProps } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { type AuthMode, authLocation, readAuthMode } from '../model/dialog';
import { useAuth } from '../model/session';

type Props = Omit<ComponentProps<typeof Link>, 'to'> & {
    mode: AuthMode;
    next?: string;
    disabled?: boolean;
};

export function AuthDialogLink({ mode, next, disabled, onClick, ...props }: Props) {
    const location = useLocation();
    const switching = readAuthMode(location.search) !== null;
    return (
        <Link
            {...props}
            to={authLocation(location, mode, next)}
            replace={switching}
            state={switching ? location.state : { ...location.state, authDialogBackground: true }}
            aria-disabled={disabled || undefined}
            onClick={(event) => {
                if (disabled) event.preventDefault();
                else onClick?.(event);
            }}
        />
    );
}

export function AuthRequiredLink({ to, ...props }: ComponentProps<typeof Link> & { to: string }) {
    const { user } = useAuth();
    return user ? (
        <Link {...props} to={to} />
    ) : (
        <AuthDialogLink {...props} mode="login" next={to} />
    );
}
