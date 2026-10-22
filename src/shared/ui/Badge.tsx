import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export function Badge({
    tone = 'neutral',
    className,
    ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
    return <span {...props} className={cn('badge', `badge-${tone}`, className)} />;
}
