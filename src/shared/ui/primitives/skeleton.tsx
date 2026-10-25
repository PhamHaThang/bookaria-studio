import { cn } from '@/shared/lib/cn';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            aria-hidden="true"
            className={cn('rounded-md bg-accent motion-safe:animate-pulse', className)}
            {...props}
        />
    );
}

export { Skeleton };
