import { Loader2Icon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
    return (
        <Loader2Icon
            data-slot="spinner"
            role="status"
            aria-label="Đang xử lý"
            className={cn('size-4 motion-safe:animate-spin', className)}
            {...props}
        />
    );
}

export { Spinner };
