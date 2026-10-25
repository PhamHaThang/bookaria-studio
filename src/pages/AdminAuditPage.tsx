import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
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
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Nhật ký quản trị</h1>
                    <p>Đối chiếu người thực hiện, đối tượng và nội dung từng thao tác quản trị.</p>
                </div>
                {query && <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />}
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_[data-slot=select-trigger]]:w-full [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto]"
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
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-action">
                            Thao tác
                            <FormSelect
                                id="audit-action"
                                name="action"
                                defaultValue={params.get('action') || ''}
                                options={[
                                    { value: '', label: 'Tất cả thao tác' },
                                    ...(AuditActionSchema.options.map((value) => ({
                                        value: value,
                                        label: auditLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-actor">
                            Mã người thực hiện (UUID)
                            <Input
                                id="audit-actor"
                                name="actorId"
                                defaultValue={params.get('actorId') || ''}
                                spellCheck={false}
                                autoCapitalize="none"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-target-type">
                            Loại đối tượng
                            <FormSelect
                                id="audit-target-type"
                                name="targetType"
                                defaultValue={params.get('targetType') || ''}
                                options={[
                                    { value: '', label: 'Tất cả đối tượng' },
                                    ...(AuditTargetTypeSchema.options.map((value) => ({
                                        value: value,
                                        label: targetLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-target">
                            Mã đối tượng (UUID)
                            <Input
                                id="audit-target"
                                name="targetId"
                                defaultValue={params.get('targetId') || ''}
                                spellCheck={false}
                                autoCapitalize="none"
                            />
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Lọc nhật ký</Button>
                    <Link to="/admin/audit-logs">Xóa bộ lọc</Link>
                </FieldGroup>
            </form>
            {!parsed.success && (
                <Feedback error="Bộ lọc không hợp lệ. Mã người thực hiện và mã đối tượng phải là UUID; hãy sửa hoặc xóa bộ lọc." />
            )}
            {query && list.isPending && (
                <LoadingState layout="rows">Đang tải nhật ký…</LoadingState>
            )}
            {query && list.isError && <Feedback error={errorMessage(list.error)} />}
            {query && list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} bản ghi · mới nhất trước</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
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
                                            <code className="admin-id wrap-anywhere">
                                                {log.target.id}
                                            </code>
                                        </p>
                                        <p className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            {adminDate(log.createdAt)}
                                        </p>
                                    </div>
                                    <Link to={`/admin/audit-logs/${log.id}`}>
                                        Xem chi tiết
                                        <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                            {' '}
                                            bản ghi {log.id}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có nhật ký phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Thử bộ lọc khác hoặc đợi thao tác quản trị mới.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
