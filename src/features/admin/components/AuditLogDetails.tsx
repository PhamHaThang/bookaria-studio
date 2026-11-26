import { Calendar, ListFilter } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AuditLog } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { adminDate, auditLabel } from '../model';
import { auditTargetLink, targetLabel } from '../operations-model';
import { AdminActor, AuditJson, auditActionTone } from '../operations-ui';

export function AuditLogDetails({ log }: { log: AuditLog }) {
    return (
        <div className="grid min-w-0 gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{auditLabel[log.action]}</span>
                    <Badge tone={auditActionTone(log.action)}>#{log.id}</Badge>
                </div>
                <time
                    dateTime={log.createdAt}
                    className="flex items-center gap-1.5 text-muted-foreground text-xs"
                >
                    <Calendar className="size-3.5" aria-hidden="true" />
                    {adminDate(log.createdAt)}
                </time>
            </div>

            <dl className="m-0 grid gap-3 sm:grid-cols-2">
                <div className="grid min-w-0 content-start gap-1 rounded-lg border border-border p-3">
                    <dt className="text-muted-foreground text-xs">Người thực hiện</dt>
                    <dd className="m-0 font-medium text-sm">
                        <AdminActor actor={log.actor} />
                    </dd>
                    <dd className="m-0 text-muted-foreground text-xs">
                        <code className="wrap-anywhere">{log.actor.id}</code>
                    </dd>
                </div>
                <div className="grid min-w-0 content-start gap-1 rounded-lg border border-border p-3">
                    <dt className="text-muted-foreground text-xs">Đối tượng</dt>
                    <dd className="m-0 font-medium text-sm">{targetLabel[log.target.type]}</dd>
                    <dd className="m-0 text-muted-foreground text-xs">
                        <code className="wrap-anywhere">{log.target.id}</code>
                    </dd>
                </div>
            </dl>

            <section className="grid min-w-0 gap-2 [&_p]:m-0 [&_pre]:m-0 [&_pre]:rounded-lg">
                <h2 className="m-0 font-semibold text-sm">Dữ liệu thao tác</h2>
                <AuditJson value={log.detail} />
            </section>
        </div>
    );
}

export function AuditTargetHistoryLink({ log, onClick }: { log: AuditLog; onClick?: () => void }) {
    return (
        <Button asChild>
            <Link to={auditTargetLink(log.target.type, log.target.id)} onClick={onClick}>
                <ListFilter data-icon="inline-start" />
                Lọc theo đối tượng
            </Link>
        </Button>
    );
}
