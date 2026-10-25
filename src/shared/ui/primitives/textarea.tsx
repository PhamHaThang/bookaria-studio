import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'mt-2 block min-h-0 w-full min-w-0 resize-y rounded-[var(--radius-md)] border border-input bg-surface px-3 py-2 font-normal text-[length:var(--text-md)] text-foreground leading-[var(--leading-normal)] caret-primary outline-none transition-colors placeholder:text-[var(--text-placeholder)] hover:border-[var(--border-input-hover)] focus:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-danger-foreground aria-invalid:focus-visible:ring-danger-foreground aria-invalid:focus:border-danger-foreground',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
