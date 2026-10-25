import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
        <input
            data-slot="input"
            type={type}
            className={cn(
                'mt-2 block min-h-[var(--control-height)] w-full min-w-0 rounded-[var(--radius-md)] border border-input bg-surface px-3 py-2 font-normal text-[length:var(--text-md)] text-foreground caret-primary outline-none transition-colors placeholder:text-[var(--text-placeholder)] hover:border-[var(--border-input-hover)] focus:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-danger-foreground aria-invalid:focus-visible:ring-danger-foreground aria-invalid:focus:border-danger-foreground',
                type === 'search' &&
                    'focus-visible:outline-0 focus-visible:outline-offset-0 focus-visible:ring-0',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
