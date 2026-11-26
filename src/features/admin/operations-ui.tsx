import { Link } from 'react-router-dom';
import { IdSchema } from '../../shared/contracts/common.schema';
import type { AuditAction } from '../../shared/contracts/enums.schema';
import type { BadgeTone } from '../../shared/ui/Badge';

export function auditActionTone(action: AuditAction): BadgeTone {
    switch (action) {
        case 'LOCK_USER':
        case 'TAKE_DOWN_BOOK':
        case 'DELETE_ASSET':
            return 'danger';
        case 'CREATE_USER':
        case 'REINSTATE_BOOK':
        case 'CREATE_LIBRARY_ASSET':
            return 'success';
        case 'UNLOCK_USER':
        case 'CHANGE_ROLE':
        case 'SET_QUOTA':
        case 'RESOLVE_REPORT':
            return 'info';
        case 'RETRY_JOB':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function AuditJson({ value }: { value: Record<string, unknown> | null }) {
    return value === null ? (
        <p>Không có dữ liệu bổ sung.</p>
    ) : (
        <pre className="admin-json wrap-anywhere max-w-full bg-muted p-4 text-[length:var(--text-sm)] [white-space:pre-wrap]">
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}
export function AdminActor({ actor }: { actor: { id: string; displayName: string } | null }) {
    if (!actor) return <>Tài khoản không còn tồn tại</>;
    return IdSchema.safeParse(actor.id).success ? (
        <Link to={`/admin/users/${actor.id}`}>{actor.displayName}</Link>
    ) : (
        actor.displayName
    );
}
