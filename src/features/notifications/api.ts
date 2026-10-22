import type { AxiosInstance } from 'axios';
import type { z } from 'zod';
import { expectStatus, readPage } from '../../shared/api/contract';
import {
    MarkNotificationsReadBodySchema,
    NotificationsQuerySchema,
} from '../../shared/contracts/api/me.schema';
import { IdSchema } from '../../shared/contracts/common.schema';
import { NotificationSchema } from '../../shared/contracts/dto.schema';

export function createNotificationsApi(http: AxiosInstance) {
    return {
        async list(input: z.input<typeof NotificationsQuerySchema>, signal?: AbortSignal) {
            const response = await http.get('/me/notifications', {
                params: NotificationsQuerySchema.parse(input),
                signal,
            });
            expectStatus(response, 200);
            return readPage(response, NotificationSchema);
        },
        async read(input: z.input<typeof MarkNotificationsReadBodySchema>) {
            expectStatus(
                await http.post(
                    '/me/notifications/read',
                    MarkNotificationsReadBodySchema.parse(input),
                ),
                204,
            );
        },
    };
}

export function notificationTarget(link: string | null): string | null {
    if (!link || /[\\\s?#]/.test(link)) return null;
    if (['/books', '/assets', '/profile', '/stats', '/notifications'].includes(link)) return link;
    const parts = link.split('/');
    if (parts[0] !== '' || !IdSchema.safeParse(parts[2]).success) return null;
    if (parts[1] === 'assets' && parts.length === 3) return link;
    if (parts[1] !== 'books') return null;
    if (parts.length === 3 || (parts.length === 4 && parts[3] === 'stats')) return link;
    if (parts.length === 5 && parts[3] === 'pages' && IdSchema.safeParse(parts[4]).success)
        return link;
    return null;
}
