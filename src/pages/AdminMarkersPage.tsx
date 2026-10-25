import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { adminDate, readAdminQueueSearch } from '../features/admin';
import { libraryKeys } from '../features/admin/library-model';
import {
    LibraryConfirm,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type CreateBookariaMarkerBody,
    CreateBookariaMarkerBodySchema,
} from '../shared/contracts/api/admin.schema';
import type { BookariaMarker } from '../shared/contracts/dto.schema';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

export function AdminMarkersPage() {
    const { user } = useAuth(),
        [params] = useSearchParams(),
        query = readAdminQueueSearch(params),
        action = useLibraryAction(),
        [draft, setDraft] = useState<BookariaMarker | null>(null),
        [success, setSuccess] = useState<string | null>(null);
    const list = useQuery({
        queryKey: libraryKeys.markers(user?.id || '', query),
        queryFn: ({ signal }) => libraryApi.markers(query, signal),
    });
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Bộ marker Bookaria</h1>
                    <p>Quản lý marker đã biên dịch sẵn để cấp cho trang mới.</p>
                </div>
                <Button asChild>
                    <Link to="/admin/markers/new">Đăng ký marker</Link>
                </Button>
            </div>
            <Feedback success={success} />
            <WriteFeedback action={action} />
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching || action.busy} />
            {list.isPending && <LoadingState layout="rows">Đang tải marker…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p>{list.data.meta.total} marker</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((marker) => (
                                <li key={marker.id}>
                                    <div>
                                        <h2>Marker số {marker.number}</h2>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            <Badge tone={marker.isActive ? 'success' : 'neutral'}>
                                                {marker.isActive ? 'Đang bật' : 'Đã tắt'}
                                            </Badge>
                                            <span>Điểm: {marker.markerScore ?? 'Chưa có'}</span>
                                            <span>
                                                {marker.validatedAt
                                                    ? `Đã ghi nhận: ${adminDate(marker.validatedAt)}`
                                                    : 'Chưa ghi nhận xác thực'}
                                            </span>
                                        </div>
                                        <p>
                                            <a
                                                href={marker.imageUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Mở ảnh marker {marker.number}
                                            </a>
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        disabled={action.busy || action.uncertain}
                                        onClick={() => setDraft(marker)}
                                    >
                                        {marker.isActive ? 'Tắt' : 'Bật'} marker {marker.number}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Chưa có marker Bookaria</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Chuẩn bị ảnh và tệp .mind khớp nhau trước khi đăng ký
                                        marker.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Bật/tắt điều khiển việc cấp marker cho trang mới. Không sửa các trang đã gắn marker
                hoặc các bản đã xuất bản. Thời điểm ghi nhận là dữ liệu máy chủ, không phải kết quả
                kiểm tra tệp trong trình duyệt.
            </p>
            {draft && (
                <LibraryConfirm
                    title={`${draft.isActive ? 'Tắt' : 'Bật'} marker ${draft.number}?`}
                    busy={action.busy}
                    blocked={action.uncertain}
                    error={action.error}
                    onClose={() => setDraft(null)}
                    onConfirm={() =>
                        void action.run(
                            () => libraryApi.setMarker(draft.id, { isActive: !draft.isActive }),
                            () => {
                                setSuccess(
                                    `Đã ${draft.isActive ? 'tắt' : 'bật'} marker ${draft.number}.`,
                                );
                                setDraft(null);
                            },
                        )
                    }
                >
                    <p>
                        {draft.isActive
                            ? 'Marker sẽ không được cấp cho trang mới.'
                            : 'Marker sẽ có thể được cấp cho trang mới nếu đáp ứng điều kiện máy chủ.'}
                    </p>
                    <p>Các trang đã sử dụng marker không được thay đổi bởi thao tác này.</p>
                </LibraryConfirm>
            )}
        </>
    );
}
export function AdminMarkerCreatePage() {
    const action = useLibraryAction(),
        navigate = useNavigate(),
        [draft, setDraft] = useState<CreateBookariaMarkerBody | null>(null),
        [error, setError] = useState<string | null>(null);
    return (
        <>
            <Link to="/admin/markers">Về bộ marker</Link>
            <h1>Đăng ký marker đã biên dịch</h1>
            <p>
                Nhập định danh Cloudinary của ảnh và tệp .mind đã tải lên. Form này không tải tệp
                hoặc biên dịch marker.
            </p>
            <WriteFeedback action={action} error={error} />
            <form
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const score = String(data.get('markerScore') || '');
                    const parsed = CreateBookariaMarkerBodySchema.safeParse({
                        number: Number(data.get('number')),
                        seed: Number(data.get('seed')),
                        imagePublicId: String(data.get('imagePublicId') || '').trim(),
                        mindPublicId: String(data.get('mindPublicId') || '').trim(),
                        ...(score ? { markerScore: Number(score) } : {}),
                    });
                    if (!parsed.success) {
                        setError(errorMessage(parsed.error));
                        return;
                    }
                    setError(null);
                    setDraft(parsed.data);
                }}
            >
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="marker-number">
                                Số marker
                                <Input
                                    id="marker-number"
                                    name="number"
                                    type="number"
                                    required
                                    min={1}
                                    step={1}
                                    max={2147483647}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="marker-seed">
                                Seed
                                <Input
                                    id="marker-seed"
                                    name="seed"
                                    type="number"
                                    required
                                    step={1}
                                    min={Number.MIN_SAFE_INTEGER}
                                    max={Number.MAX_SAFE_INTEGER}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="marker-image-id">
                                Public ID ảnh
                                <Input
                                    id="marker-image-id"
                                    name="imagePublicId"
                                    required
                                    maxLength={300}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="marker-mind-id">
                                Public ID tệp .mind
                                <Input
                                    id="marker-mind-id"
                                    name="mindPublicId"
                                    required
                                    maxLength={300}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="marker-score">
                                Điểm marker (không bắt buộc)
                                <Input
                                    id="marker-score"
                                    name="markerScore"
                                    type="number"
                                    min={0}
                                    max={5}
                                    step={1}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel
                                className="library-ack [.admin-form_&]:flex [.admin-form_&]:items-start [.admin-form_&]:gap-3 [.admin-form_&_input]:mt-1 [.admin-form_&_input]:size-5 [.admin-form_&_input]:shrink-0"
                                htmlFor="marker-ack"
                            >
                                <Checkbox id="marker-ack" required />
                                Tôi đã kiểm tra ảnh và tệp .mind khớp nhau, truy cập được và sẵn
                                sàng dùng.
                            </FieldLabel>
                        </Field>
                        <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                            Số và seed phải duy nhất. Máy chủ tạo marker ở trạng thái bật và ghi
                            thời điểm xác thực; hệ thống hiện không kiểm tra nội dung hai tệp. Chỉ
                            đăng ký sau khi đã kiểm tra bằng công cụ chuẩn bị marker.
                        </p>
                        <Button fullWidth type="submit">
                            Xem lại đăng ký
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            {draft && (
                <LibraryConfirm
                    title="Đăng ký marker mới?"
                    busy={action.busy}
                    blocked={action.uncertain}
                    error={action.error}
                    onClose={() => setDraft(null)}
                    onConfirm={() =>
                        void action.run(
                            () => libraryApi.createMarker(draft),
                            () => navigate('/admin/markers', { replace: true }),
                        )
                    }
                >
                    <p>
                        Marker số {draft.number}, seed {draft.seed}.
                    </p>
                    <p>
                        Ảnh: {draft.imagePublicId}\nTệp .mind: {draft.mindPublicId}
                    </p>
                    <p>Marker sẽ được bật ngay và có thể được cấp cho trang mới.</p>
                </LibraryConfirm>
            )}
        </>
    );
}
