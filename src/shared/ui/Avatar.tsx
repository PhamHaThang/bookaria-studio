import { UserRound } from 'lucide-react';
import { AvatarFallback, AvatarImage, Avatar as AvatarRoot } from './primitives/avatar';
export function Avatar({ url }: { url: string | null }) {
    return (
        <AvatarRoot className="account-avatar size-8" aria-hidden="true">
            {url && <AvatarImage src={url} alt="" />}
            <AvatarFallback>
                <UserRound size={18} />
            </AvatarFallback>
        </AvatarRoot>
    );
}
