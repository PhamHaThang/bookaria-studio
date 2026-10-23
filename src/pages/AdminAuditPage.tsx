import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { adminDate, adminOperationsApi, auditLabel } from '../features/admin';
import {
    formSearch,
    operationsKeys,
    readAuditSearch,
    targetLabel,
} from '../features/admin/operations-model';
import { AdminActor } from '../features/admin/operations-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { AuditActionSchema, AuditTargetTypeSchema } from '../shared/contracts/enums.schema';
import { Feedback } from '../shared/ui/Feedback';

export function AdminAuditPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams();
    const parsed = readAuditSearch(params),
        query = parsed.success ? parsed.data : null;
    const list = useQuery({
        queryKey: operationsKeys.audit(user?.id || '', query),
        queryFn: ({ signal }) => adminOperationsApi.audit(query || {}, signal),
        enabled: query !== null,
        retry: false,
    });
    return (
        <>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Nhật ký quản trị</h1>
                    <p>Đối chiếu người thực hiện, đối tượng và nội dung từng thao tác quản trị.</p>
                </div>
                {query && <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />}
            </div>
            <form
                className="admin-filters"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    setParams(
                        formSearch(new FormData(event.currentTarget), [
                            'action',
                            'actorId',
                            'targetType',
                            'targetId',
                        ]),
                    );
                }}
            >
                <label htmlFor="audit-action">
                    Thao tác
                    <select
                        id="audit-action"
                        name="action"
                        defaultValue={params.get('action') || ''}
                    >
                        <option value="">Tất cả thao tác</option>
                        {AuditActionSchema.options.map((value) => (
                            <option key={value} value={value}>
                                {auditLabel[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="audit-actor">
                    Mã người thực hiện (UUID)
                    <input
                        id="audit-actor"
                        name="actorId"
                        defaultValue={params.get('actorId') || ''}
                        spellCheck={false}
                        autoCapitalize="none"
                    />
                </label>
                <label htmlFor="audit-target-type">
                    Loại đối tượng
                    <select
                        id="audit-target-type"
                        name="targetType"
                        defaultValue={params.get('targetType') || ''}
                    >
                        <option value="">Tất cả đối tượng</option>
                        {AuditTargetTypeSchema.options.map((value) => (
                            <option key={value} value={value}>
                                {targetLabel[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="audit-target">
                    Mã đối tượng (UUID)
                    <input
                        id="audit-target"
                        name="targetId"
                        defaultValue={params.get('targetId') || ''}
                        spellCheck={false}
                        autoCapitalize="none"
                    />
                </label>
                <button type="submit" className="button compact">
                    Lọc nhật ký
                </button>
                <Link to="/admin/audit-logs">Xóa bộ lọc</Link>
            </form>
            {!parsed.success && (
                <Feedback error="Bộ lọc không hợp lệ. Mã người thực hiện và mã đối tượng phải là UUID; hãy sửa hoặc xóa bộ lọc." />
            )}
            {query && list.isPending && <p role="status">Đang tải nhật ký…</p>}
            {query && list.isError && <Feedback error={errorMessage(list.error)} />}
            {query && list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} bản ghi · mới nhất trước</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows">
                            {list.data.data.map((log) => (
                                <li key={log.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/audit-logs/${log.id}`}>
                                                #{log.id} · {auditLabel[log.action]}
                                            </Link>
                                        </h2>
                                        <p>
                                            Người thực hiện: <AdminActor actor={log.actor} />
                                        </p>
                                        <p>
                                            {targetLabel[log.target.type]}:{' '}
                                            <code className="admin-id">{log.target.id}</code>
                                        </p>
                                        <p className="admin-metadata">{adminDate(log.createdAt)}</p>
                                    </div>
                                    <Link to={`/admin/audit-logs/${log.id}`}>
                                        Xem chi tiết
                                        <span className="sr-only"> bản ghi {log.id}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có nhật ký phù hợp</h2>
                            <p>Thử bộ lọc khác hoặc đợi thao tác quản trị mới.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
