import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/api/client';
import { createNotificationsApi } from './api';
import { notificationKeys } from './model';

export { notificationKeys, notificationTypeLabels, readNotificationSearch } from './model';

export const notificationsApi = createNotificationsApi(apiClient);
export function useUnreadNotifications(userId: string, poll = false) {
    return useQuery({
        queryKey: notificationKeys.count(userId),
        queryFn: ({ signal }) =>
            notificationsApi.list({ page: 1, limit: 1, unread: 'true' }, signal),
        enabled: Boolean(userId),
        staleTime: 15000,
        refetchInterval: poll ? 30000 : false,
        refetchIntervalInBackground: false,
    });
}
