'use client';
import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/shared/lib/cn';

function Switch({
    className,
    size = 'default',
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { size?: 'sm' | 'default' }) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            data-size={size}
            className={cn(
                'peer group/switch inline-flex shrink-0 items-center rounded-full border border-primary bg-surface p-0.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[size=default]:h-5 data-[size=sm]:h-4.5 data-[size=default]:w-9 data-[size=sm]:w-8 data-[state=checked]:bg-primary',
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block rounded-full bg-primary transition-transform data-[state=checked]:translate-x-[calc(100%+2px)] data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-primary-foreground group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-3 motion-reduce:transition-none"
            />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
