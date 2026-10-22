import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Alert({
    tone = 'info',
    className,
    role,
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { tone?: 'danger' | 'success' | 'warning' | 'info' }) {
    return (
        <p
            {...props}
            className={cn('feedback', `tone-${tone}`, className)}
            role={role || (tone === 'danger' ? 'alert' : 'status')}
        />
    );
}
