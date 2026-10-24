import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
    return (
        <select
            data-slot="native-select"
            className={cn(
                'mt-2 block min-h-[var(--control-height)] w-full min-w-0 appearance-auto rounded-[var(--radius-md)] border border-input bg-surface px-3 py-2 font-normal text-[length:var(--text-md)] text-foreground caret-primary transition-colors placeholder:text-[var(--text-placeholder)] hover:border-[var(--border-input-hover)] focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:bg-background disabled:text-muted-foreground aria-invalid:border-danger-foreground',
                className,
            )}
            {...props}
        />
    );
}
function NativeSelectOption(props: ComponentProps<'option'>) {
    return <option data-slot="native-select-option" {...props} />;
}
function NativeSelectOptGroup(props: ComponentProps<'optgroup'>) {
    return <optgroup data-slot="native-select-optgroup" {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
