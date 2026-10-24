import type { ComponentProps } from 'react';
import { AlertDescription, Alert as PrimitiveAlert } from './primitives/alert';

const variants = {
    danger: 'destructive',
    success: 'success',
    warning: 'warning',
    info: 'default',
} as const;
export function Alert({
    tone = 'info',
    className,
    role,
    children,
    ...props
}: Omit<ComponentProps<typeof PrimitiveAlert>, 'variant'> & { tone?: keyof typeof variants }) {
    return (
        <PrimitiveAlert
            {...props}
            variant={variants[tone]}
            className={className}
            role={role || (tone === 'danger' ? 'alert' : 'status')}
        >
            <AlertDescription>{children}</AlertDescription>
        </PrimitiveAlert>
    );
}
