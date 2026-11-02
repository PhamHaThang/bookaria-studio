import { cn } from '@/shared/lib/cn';

/** Brand links keep a visible keyboard cue without outlining the wordmark. */
export function bookariaLogoLinkStyles(className?: string) {
    return cn(
        'outline-none transition-opacity hover:opacity-80 focus-visible:opacity-65 motion-reduce:transition-none',
        className,
    );
}

export function BookariaLogo({
    symbol = false,
    className,
}: {
    symbol?: boolean;
    className?: string;
}) {
    return (
        <img
            className={cn(
                'bookaria-logo block h-auto shrink-0 object-contain [filter:var(--logo-filter)]',
                symbol ? 'bookaria-logo-symbol w-9' : 'w-44',
                className,
            )}
            src={symbol ? '/brand/bookaria-symbol.svg' : '/brand/bookaria-wordmark.svg'}
            alt="Bookaria"
            width={symbol ? 36 : 176}
            height={symbol ? 18 : 26}
            decoding="async"
        />
    );
}
