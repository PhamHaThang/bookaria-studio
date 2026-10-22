import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../shared/ui/Badge';
import { useUnreadNotifications } from './index';

export function NotificationLink({ userId }: { userId: string }) {
    const unread = useUnreadNotifications(userId, true);
    const count = unread.isSuccess ? unread.data.meta.total : undefined;
    return (
        <Link
            className="notification-header-link"
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
