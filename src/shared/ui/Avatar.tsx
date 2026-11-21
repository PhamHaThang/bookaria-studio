import { UserRound } from 'lucide-react';
import { getAvatarFallback } from '@/shared/lib/avatar-fallback';
import { cn } from '@/shared/lib/cn';
import { AvatarFallback, AvatarImage, Avatar as AvatarRoot } from './primitives/avatar';
export function Avatar({
    url,
    name,
    transparent = false,
}: {
    url: string | null;
    name?: string;
    transparent?: boolean;
}) {
    const { initials } = getAvatarFallback(name);
    return (
        <AvatarRoot className="account-avatar size-8" aria-hidden="true">
            {url && <AvatarImage src={url} alt="" />}
            <AvatarFallback
                className={cn(
                    'font-semibold',
                    transparent
                        ? 'bg-transparent text-primary'
                        : 'bg-primary text-primary-foreground',
                )}
            >
                {initials || <UserRound size={18} />}
            </AvatarFallback>
        </AvatarRoot>
    );
}
