import { UserRound } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { AvatarFallback, AvatarImage, Avatar as AvatarRoot } from './primitives/avatar';
export function Avatar({
    url,
    transparent = false,
}: {
    url: string | null;
    transparent?: boolean;
}) {
    return (
        <AvatarRoot className="account-avatar size-8" aria-hidden="true">
            {url && <AvatarImage src={url} alt="" />}
            <AvatarFallback
                className={cn('text-primary', transparent ? 'bg-transparent' : 'bg-surface')}
            >
                <UserRound size={18} />
            </AvatarFallback>
        </AvatarRoot>
    );
}
