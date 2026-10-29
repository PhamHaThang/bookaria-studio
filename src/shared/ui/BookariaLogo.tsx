import { cn } from '@/shared/lib/cn';

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
                'bookaria-logo block h-auto shrink-0 object-contain',
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
