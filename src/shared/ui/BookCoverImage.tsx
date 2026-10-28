import { useState } from 'react';
import { cn } from '@/shared/lib/cn';

/** Missing or unreachable book covers share the same white Bookaria cover. */
export function BookCoverImage({
    url,
    alt = '',
    loading = 'lazy',
    className,
}: {
    url?: string | null;
    alt?: string;
    loading?: 'lazy' | 'eager';
    className?: string;
}) {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    return (
        <img
            src={url && failedUrl !== url ? url : '/brand/bookaria-cover.svg'}
            alt={alt}
            loading={loading}
            decoding="async"
            referrerPolicy="no-referrer"
            className={cn('size-full min-h-0 min-w-0 bg-surface object-contain', className)}
            onError={() => {
                if (url) setFailedUrl(url);
            }}
        />
    );
}
