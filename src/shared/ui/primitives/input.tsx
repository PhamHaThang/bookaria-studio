import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
    return (
        <input
            data-slot="input"
            type={type}
            className={cn(
                'mt-2 block min-h-[var(--control-height)] w-full min-w-0 rounded-[var(--radius-md)] border border-input bg-surface px-3 py-2 font-normal text-[length:var(--text-md)] text-foreground caret-primary transition-colors placeholder:text-[var(--text-placeholder)] hover:border-[var(--border-input-hover)] focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:bg-background disabled:text-muted-foreground aria-invalid:border-danger-foreground',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
