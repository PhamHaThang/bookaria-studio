import type { AdminUser } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import { roleLabel, statusLabel } from '../model';

export function UserSummary({ user }: { user: AdminUser }) {
    const initials = (user.displayName || user.email).trim().slice(0, 2).toUpperCase();

    return (
        <div className="flex min-w-0 items-start gap-3 rounded-lg bg-muted/40 p-3">
            <Avatar className="size-11 shrink-0">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold text-foreground text-sm">{user.displayName}</p>
                <p className="m-0 text-muted-foreground text-sm">{user.email}</p>
                {user.organization && (
                    <p className="m-0 text-muted-foreground text-xs">{user.organization}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>
                        {roleLabel[user.role]}
                    </Badge>
                    <Badge tone={user.status === 'LOCKED' ? 'danger' : 'success'}>
                        {statusLabel[user.status]}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
