import { Link } from 'react-router-dom';
import { IdSchema } from '../../shared/contracts/common.schema';

export function AuditJson({ value }: { value: Record<string, unknown> | null }) {
    return value === null ? (
        <p>Không có dữ liệu bổ sung.</p>
    ) : (
        <pre className="admin-json">{JSON.stringify(value, null, 2)}</pre>
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
