import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import {
    adminApi,
    adminDate,
    adminKeys,
    bytesLabel,
    readAdminUsersSearch,
    roleLabel,
    statusLabel,
} from '../features/admin';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

export function AdminUsersPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams(),
        query = readAdminUsersSearch(params);
    const list = useQuery({
        queryKey: adminKeys.users(user?.id || '', query),
        queryFn: ({ signal }) => adminApi.users(query, signal),
        retry: false,
    });
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Người dùng</h1>
                    <p>Tìm tài khoản, quản lý quyền và dung lượng.</p>
                </div>
                <Button asChild>
                    <Link to="/admin/users/new">Tạo người dùng</Link>
                </Button>
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_[data-slot=select-trigger]]:w-full [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto]"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget),
                        next = new URLSearchParams();
                    for (const [key, value] of data)
                        if (String(value).trim()) next.set(key, String(value).trim());
                    setParams(next);
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-q">
                            Tên hoặc email
                            <Input
                                type="search"
                                name="q"
                                id="admin-user-q"
                                maxLength={100}
                                defaultValue={query.q}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-role">
                            Vai trò
                            <FormSelect
                                name="role"
                                id="admin-user-role"
                                defaultValue={query.role || ''}
                                options={[
                                    { value: '', label: 'Tất cả' },
                                    { value: 'AUTHOR', label: 'Tác giả' },
                                    { value: 'ADMIN', label: 'Quản trị viên' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-status">
                            Trạng thái
                            <FormSelect
                                name="status"
                                id="admin-user-status"
                                defaultValue={query.status || ''}
                                options={[
                                    { value: '', label: 'Tất cả' },
                                    { value: 'ACTIVE', label: 'Hoạt động' },
                                    { value: 'LOCKED', label: 'Đã khóa' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-user-sort">
                            Sắp xếp
                            <FormSelect
                                name="sort"
                                id="admin-user-sort"
                                defaultValue={query.sort}
                                options={[
                                    { value: '-createdAt', label: 'Mới nhất' },
                                    { value: 'createdAt', label: 'Cũ nhất' },
                                    { value: 'displayName', label: 'Tên A–Z' },
                                    { value: '-displayName', label: 'Tên Z–A' },
                                    { value: 'email', label: 'Email A–Z' },
                                    { value: '-email', label: 'Email Z–A' },
                                    { value: 'updatedAt', label: 'Cập nhật cũ nhất' },
                                    { value: '-updatedAt', label: 'Cập nhật mới nhất' },
                                    { value: 'storageUsedBytes', label: 'Dung lượng tăng dần' },
                                    { value: '-storageUsedBytes', label: 'Dung lượng giảm dần' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Áp dụng bộ lọc</Button>
                    <Link to="/admin/users">Xóa bộ lọc</Link>
                </FieldGroup>
            </form>
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            {list.isPending && <LoadingState layout="rows">Đang tải người dùng…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} người dùng</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows admin-users [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((item) => (
                                <li key={item.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/users/${item.id}`}>
                                                {item.displayName}
                                            </Link>
                                        </h2>
                                        <p>{item.email}</p>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            <Badge
                                                tone={item.role === 'ADMIN' ? 'info' : 'neutral'}
                                            >
                                                {roleLabel[item.role]}
                                            </Badge>
                                            <Badge
                                                tone={
                                                    item.status === 'LOCKED' ? 'danger' : 'success'
                                                }
                                            >
                                                {statusLabel[item.status]}
                                            </Badge>
                                            <span>{item.bookCount} sách</span>
                                        </div>
                                    </div>
                                    <div className="admin-row-detail flex flex-col gap-2 text-[length:var(--text-sm)]">
                                        <span>
                                            {bytesLabel(item.storage.usedBytes)} /{' '}
                                            {bytesLabel(item.storage.quotaBytes)}
                                        </span>
                                        <span>Tạo: {adminDate(item.createdAt)}</span>
                                        <Link to={`/admin/users/${item.id}`}>
                                            Xem tài khoản
                                            <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                {' '}
                                                {item.email}
                                            </span>
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có tài khoản phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Thử tìm tên hoặc email khác, hoặc xóa bộ lọc.</p>
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
