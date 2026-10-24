import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FieldGroup } from '@/shared/ui/primitives/field';
import { libraryChanges, libraryFields } from '../features/admin/library-model';
import {
    LibraryConfirm,
    LibraryMetadata,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { AdminReload } from '../features/admin/ui';
import { assetKeys, assetsApi, assetTypeLabels } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type UpdateLibraryAssetBody,
    UpdateLibraryAssetBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, AssetCategory } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';

function LibraryEditor({
    asset,
    categories,
    onSaved,
}: {
    asset: Asset;
    categories: AssetCategory[];
    onSaved: () => void;
}) {
    const action = useLibraryAction(),
        navigate = useNavigate(),
        [draft, setDraft] = useState<UpdateLibraryAssetBody | 'delete' | null>(null),
        [error, setError] = useState<string | null>(null);
    return (
        <>
            <WriteFeedback action={action} error={error} />
            <form
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
                onSubmit={(event) => {
                    event.preventDefault();
                    const parsed = UpdateLibraryAssetBodySchema.safeParse(
                        libraryChanges(asset, libraryFields(new FormData(event.currentTarget))),
                    );
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
                        <LibraryMetadata asset={asset} categories={categories} />
                        <Button type="submit" fullWidth>
                            Xem lại thay đổi
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            <section className="admin-section mt-8">
                <h2>Xóa khỏi thư viện</h2>
                <p>
                    Máy chủ từ chối nếu tài nguyên còn được dùng trong bản nháp hoặc một phiên bản
                    đã xuất bản. Không tự xóa các tham chiếu trong sách.
                </p>
                <Button
                    variant="secondary"
                    fullWidth
                    type="button"
                    disabled={action.busy || action.uncertain}
                    onClick={() => setDraft('delete')}
                >
                    Xóa tài nguyên dùng chung
                </Button>
            </section>
            {draft && (
                <LibraryConfirm
                    title={
                        draft === 'delete'
                            ? 'Xóa tài nguyên dùng chung?'
                            : 'Lưu thông tin thư viện?'
                    }
                    busy={action.busy}
                    blocked={action.uncertain}
                    error={action.error}
                    onClose={() => setDraft(null)}
                    onConfirm={() =>
                        void action.run(
                            async () => {
                                if (draft === 'delete') {
                                    await libraryApi.remove(asset.id);
                                    return null;
                                }
                                return libraryApi.update(asset.id, draft);
                            },
                            () => {
                                if (draft === 'delete')
                                    navigate('/admin/library', { replace: true });
                                else {
                                    setDraft(null);
                                    onSaved();
                                }
                            },
                        )
                    }
                >
                    <p>{asset.name}</p>
                    <p>
                        {draft === 'delete'
                            ? 'Tài nguyên sẽ biến khỏi thư viện dùng chung. Chỉ xác nhận khi muốn xóa tài nguyên này.'
                            : 'Các tác giả sẽ thấy thông tin ghi công và danh mục mới khi tải lại thư viện.'}
                    </p>
                    {draft !== 'delete' && (
                        <p>
                            {Object.entries(draft)
                                .map(
                                    ([key, value]) =>
                                        `${({ name: 'Tên', license: 'Giấy phép', authorName: 'Tác giả', sourceUrl: 'Nguồn', categoryId: 'Danh mục', tags: 'Nhãn' } as Record<string, string>)[key]}: ${key === 'categoryId' ? categories.find((item) => item.id === value)?.name || 'Không có' : Array.isArray(value) ? value.join(', ') : value || 'Không có'}`,
                                )
                                .join('\n')}
                        </p>
                    )}
                </LibraryConfirm>
            )}
        </>
    );
}
export function AdminLibraryDetailPage() {
    const { user } = useAuth(),
        { assetId = '' } = useParams(),
        location = useLocation(),
        valid = IdSchema.safeParse(assetId).success,
        [success, setSuccess] = useState<string | null>(
            location.state?.promoted ? 'Đã đưa tài nguyên vào thư viện.' : null,
        );
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId),
        queryFn: ({ signal }) => assetsApi.detail(assetId, signal),
        enabled: valid,
        refetchOnWindowFocus: false,
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy tài nguyên</h1>
                <Link to="/admin/library">Về thư viện</Link>
            </>
        );
    return (
        <>
            <Link to="/admin/library">Về thư viện dùng chung</Link>
            <Feedback success={success} />
            <AdminReload
                retry={() => {
                    void detail.refetch();
                    void categories.refetch();
                }}
                busy={detail.isFetching || categories.isFetching}
            />
            {detail.isPending && <p role="status">Đang tải tài nguyên…</p>}
            {detail.isError && <h1>Chưa mở được tài nguyên</h1>}
            {(detail.isError || categories.isError) && (
                <Feedback error={errorMessage(detail.error || categories.error)} />
            )}
            {detail.isSuccess && detail.data.scope !== 'library' && (
                <>
                    <h1>Tài nguyên chưa thuộc thư viện</h1>
                    <Feedback error="Tài nguyên này chưa thuộc thư viện dùng chung." />
                    <Link to={`/admin/library/new?asset=${assetId}`}>Chọn để đưa vào thư viện</Link>
                </>
            )}
            {detail.isSuccess && detail.data.scope === 'library' && (
                <>
                    <h1>{detail.data.name}</h1>
                    <p>
                        {assetTypeLabels[detail.data.type]} · {formatBytes(detail.data.sizeBytes)}
                    </p>
                    <p>
                        <a href={detail.data.url} target="_blank" rel="noopener noreferrer">
                            Mở tệp tài nguyên
                        </a>
                    </p>
                    {categories.isSuccess && (
                        <LibraryEditor
                            key={JSON.stringify(detail.data)}
                            asset={detail.data}
                            categories={categories.data}
                            onSaved={() => setSuccess('Đã lưu thông tin thư viện.')}
                        />
                    )}
                </>
            )}
        </>
    );
}
