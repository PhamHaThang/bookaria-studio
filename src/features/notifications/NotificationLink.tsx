import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../shared/ui/Badge';
import { useUnreadNotifications } from './index';

export function NotificationLink({ userId }: { userId: string }) {
    const unread = useUnreadNotifications(userId, true);
    const count = unread.isSuccess ? unread.data.meta.total : undefined;
    return (
        <Link
            className="notification-header-link inline-flex min-h-11 items-center gap-2 whitespace-nowrap max-[700px]:[.account-actions_&]:gap-[5px] max-[700px]:[.account-actions_&]:text-[length:0] max-[700px]:[.account-actions_&_.badge]:text-[length:10px]"
            to="/notifications"
            aria-label={count === undefined ? 'Thông báo' : `Thông báo, ${count} chưa đọc`}
        >
            <Bell size={19} aria-hidden="true" />
            Thông báo
            {count !== undefined && count > 0 && (
                <Badge tone="info">{count > 99 ? '99+' : count}</Badge>
            )}
        </Link>
    );
}
