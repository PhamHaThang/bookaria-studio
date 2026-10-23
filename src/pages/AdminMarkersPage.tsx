import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
            <div className="page-heading insights-heading">
                <div>
                    <h1>Bộ marker Bookaria</h1>
                    <p>Quản lý marker đã biên dịch sẵn để cấp cho trang mới.</p>
                </div>
                <Link className="button compact" to="/admin/markers/new">
                    Đăng ký marker
                </Link>
            </div>
            <Feedback success={success} />
            <WriteFeedback action={action} />
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching || action.busy} />
            {list.isPending && <p role="status">Đang tải marker…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p>{list.data.meta.total} marker</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows">
                            {list.data.data.map((marker) => (
                                <li key={marker.id}>
                                    <div>
                                        <h2>Marker số {marker.number}</h2>
                                        <div className="admin-metadata">
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
                                    <button
                                        className="button secondary compact"
                                        type="button"
                                        disabled={action.busy || action.uncertain}
                                        onClick={() => setDraft(marker)}
                                    >
                                        {marker.isActive ? 'Tắt' : 'Bật'} marker {marker.number}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Chưa có marker Bookaria</h2>
                            <p>Chuẩn bị ảnh và tệp .mind khớp nhau trước khi đăng ký marker.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
            <p className="stats-note">
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
                className="admin-form"
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
                <fieldset disabled={action.busy || action.uncertain}>
                    <label htmlFor="marker-number">
                        Số marker
                        <input
                            id="marker-number"
                            name="number"
                            type="number"
                            required
                            min={1}
                            step={1}
                            max={2147483647}
                        />
                    </label>
                    <label htmlFor="marker-seed">
                        Seed
                        <input
                            id="marker-seed"
                            name="seed"
                            type="number"
                            required
                            step={1}
                            min={Number.MIN_SAFE_INTEGER}
                            max={Number.MAX_SAFE_INTEGER}
                        />
                    </label>
                    <label htmlFor="marker-image-id">
                        Public ID ảnh
                        <input id="marker-image-id" name="imagePublicId" required maxLength={300} />
                    </label>
                    <label htmlFor="marker-mind-id">
                        Public ID tệp .mind
                        <input id="marker-mind-id" name="mindPublicId" required maxLength={300} />
                    </label>
                    <label htmlFor="marker-score">
                        Điểm marker (không bắt buộc)
                        <input
                            id="marker-score"
                            name="markerScore"
                            type="number"
                            min={0}
                            max={5}
                            step={1}
                        />
                    </label>
                    <label className="library-ack" htmlFor="marker-ack">
                        <input id="marker-ack" type="checkbox" required />
                        Tôi đã kiểm tra ảnh và tệp .mind khớp nhau, truy cập được và sẵn sàng dùng.
                    </label>
                    <p className="stats-note">
                        Số và seed phải duy nhất. Máy chủ tạo marker ở trạng thái bật và ghi thời
                        điểm xác thực; hệ thống hiện không kiểm tra nội dung hai tệp. Chỉ đăng ký
                        sau khi đã kiểm tra bằng công cụ chuẩn bị marker.
                    </p>
                    <button className="button" type="submit">
                        Xem lại đăng ký
                    </button>
                </fieldset>
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
