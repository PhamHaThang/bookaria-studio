import type { BookStatus } from '@/shared/contracts/enums.schema';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { bookStatusLabels } from '../model/search';

const statusTones = {
    DRAFT: 'neutral',
    PUBLISHED: 'success',
    CHANGED: 'warning',
} satisfies Record<BookStatus, BadgeTone>;

export function BookStatusBadge({ status }: { status: BookStatus }) {
    return <Badge tone={statusTones[status]}>{bookStatusLabels[status]}</Badge>;
}
