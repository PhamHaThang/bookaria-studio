import type { ComponentProps } from 'react';
import { Badge as PrimitiveBadge } from './primitives/badge';
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export function Badge({
    tone = 'neutral',
    ...props
}: Omit<ComponentProps<typeof PrimitiveBadge>, 'variant'> & { tone?: BadgeTone }) {
    return <PrimitiveBadge {...props} variant={tone} />;
}
