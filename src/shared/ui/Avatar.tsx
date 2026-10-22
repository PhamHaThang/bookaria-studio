import { UserRound } from 'lucide-react';
import { useState } from 'react';

function AvatarImage({ url }: { url: string | null }) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="account-avatar" aria-hidden="true">
            {url && !failed ? (
                <img src={url} alt="" onError={() => setFailed(true)} />
            ) : (
                <UserRound size={18} />
            )}
        </span>
    );
}
export function Avatar({ url }: { url: string | null }) {
    return <AvatarImage key={url || 'empty'} url={url} />;
}
