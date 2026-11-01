import { useQuery } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { adminDate, readAdminQueueSearch } from '../features/admin';
import { libraryKeys } from '../features/admin/library-model';
import {
    LibraryConfirm,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { MarkerRegistrationDialog } from '../features/admin/MarkerRegistrationDialog';
import { MarkerTestDialog } from '../features/admin/MarkerTestDialog';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { BookariaMarker } from '../shared/contracts/dto.schema';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

export function AdminMarkersPage() {
    const [testing, setTesting] = useState(false);
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
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
                    <p>Quản lý marker dùng để nhận diện trang sách.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" onClick={() => setTesting(true)}>
                        <ScanLine data-icon="inline-start" />
                        Thử điểm marker
                    </Button>
                    <Button
                        onClick={() => {
                            setTesting(false);
                            setParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set('register', '1');
                                return next;
                            });
                        }}
                    >
                        Đăng ký marker
                    </Button>
                </div>
            </div>
            {params.get('register') === '1' && (
                <MarkerRegistrationDialog
                    onClose={() =>
                        setParams(
                            (current) => {
                                const next = new URLSearchParams(current);
                                next.delete('register');
                                return next;
                            },
                            { replace: true },
                        )
                    }
                />
            )}
            {testing && <MarkerTestDialog onClose={() => setTesting(false)} />}
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
                                    <p>Chọn ảnh để hệ thống tự tạo nhận diện và đăng ký marker.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} busy={list.isFetching} />
                </>
            )}
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Bật marker để cấp cho trang mới. Tắt marker không thay đổi các trang hoặc phiên bản
                đã sử dụng marker đó.
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
