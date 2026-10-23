import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { libraryFields, readLibrarySearch } from '../features/admin/library-model';
import {
    LibraryConfirm,
    LibraryMetadata,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { assetKeys, assetStatusLabels, assetsApi, assetTypeLabels } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type CreateLibraryAssetBody,
    CreateLibraryAssetBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, AssetCategory } from '../shared/contracts/dto.schema';
import { Feedback } from '../shared/ui/Feedback';

function PromoteForm({ asset, categories }: { asset: Asset; categories: AssetCategory[] }) {
    const action = useLibraryAction(),
        navigate = useNavigate(),
        [draft, setDraft] = useState<CreateLibraryAssetBody | null>(null),
        [error, setError] = useState<string | null>(null);
    if (asset.scope !== 'mine' || asset.status !== 'READY')
        return <Feedback error="Chỉ chọn tài nguyên cá nhân đã sẵn sàng để đưa vào thư viện." />;
    return (
        <>
            <h2>Thông tin tài nguyên dùng chung</h2>
            <p>
                {asset.name} — {assetTypeLabels[asset.type]}
            </p>
            <WriteFeedback action={action} error={error} />
            <form
                className="admin-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    const fields = libraryFields(new FormData(event.currentTarget));
                    const parsed = CreateLibraryAssetBodySchema.safeParse({
                        ...fields,
                        sourceUrl: fields.sourceUrl || undefined,
                        assetId: asset.id,
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
                    <LibraryMetadata asset={asset} categories={categories} />
                    <button className="button" type="submit">
                        Xem lại việc chia sẻ
                    </button>
                </fieldset>
            </form>
            {draft && (
                <LibraryConfirm
                    title="Đưa vào thư viện dùng chung?"
                    busy={action.busy}
                    blocked={action.uncertain}
                    error={action.error}
                    onClose={() => setDraft(null)}
                    onConfirm={() =>
                        void action.run(
                            () => libraryApi.promote(draft),
                            (result) =>
                                navigate(`/admin/library/${result.id}`, {
                                    replace: true,
                                    state: { promoted: true },
                                }),
                        )
                    }
                >
                    <p>
                        {draft.name} — {draft.authorName} — {draft.license}
                    </p>
                    <p>
                        Tài nguyên sẽ chuyển khỏi danh sách cá nhân sang thư viện dùng chung. Các
                        tác giả có thể chọn dùng trong sách; các tham chiếu hiện có được giữ lại.
                    </p>
                </LibraryConfirm>
            )}
        </>
    );
}
export function AdminLibraryNewPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
        query = readLibrarySearch(params),
        selected = params.get('asset') || '',
        valid = IdSchema.safeParse(selected).success;
    const mine = useQuery({
        queryKey: assetKeys.list(user?.id || '', { ...query, scope: 'mine' }),
        queryFn: ({ signal }) => assetsApi.list({ ...query, scope: 'mine' }, signal),
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', selected),
        queryFn: ({ signal }) => assetsApi.detail(selected, signal),
        enabled: valid,
    });
    return (
        <>
            <Link to="/admin/library">Về thư viện dùng chung</Link>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Thêm vào thư viện</h1>
                    <p>
                        Chọn tài nguyên cá nhân đã sẵn sàng, sau đó xác nhận giấy phép và tác giả
                        gốc.
                    </p>
                </div>
                <Link className="button secondary compact" to="/assets/upload">
                    Tải tệp mới
                </Link>
            </div>
            <form
                className="admin-filters"
                key={query.q || ''}
                onSubmit={(event) => {
                    event.preventDefault();
                    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
                    setParams(q ? { q } : {});
                }}
            >
                <label htmlFor="promote-q">
                    Tìm tài nguyên cá nhân
                    <input
                        name="q"
                        id="promote-q"
                        type="search"
                        maxLength={100}
                        defaultValue={query.q}
                    />
                </label>
                <button className="button compact" type="submit">
                    Tìm tài nguyên
                </button>
            </form>
            <AdminReload
                retry={() => {
                    void mine.refetch();
                    void categories.refetch();
                    if (valid) void detail.refetch();
                }}
                busy={mine.isFetching || categories.isFetching || detail.isFetching}
            />
            {mine.isPending && <p role="status">Đang tải tài nguyên cá nhân…</p>}
            {mine.isError && <Feedback error={errorMessage(mine.error)} />}
            {mine.isSuccess && (
                <>
                    <p>{mine.data.meta.total} tài nguyên cá nhân (gồm các tệp chưa sẵn sàng)</p>
                    {mine.data.data.length ? (
                        <ul className="admin-rows">
                            {mine.data.data.map((asset) => (
                                <li key={asset.id}>
                                    <div>
                                        <h2>{asset.name}</h2>
                                        <p>
                                            {assetTypeLabels[asset.type]} ·{' '}
                                            {assetStatusLabels[asset.status]}
                                        </p>
                                    </div>
                                    <button
                                        className="button secondary compact"
                                        type="button"
                                        disabled={
                                            asset.status !== 'READY' || asset.scope !== 'mine'
                                        }
                                        aria-pressed={selected === asset.id}
                                        onClick={() =>
                                            setParams((current) => {
                                                const next = new URLSearchParams(current);
                                                next.set('asset', asset.id);
                                                return next;
                                            })
                                        }
                                    >
                                        Chọn<span className="sr-only"> {asset.name}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Chưa có tài nguyên phù hợp</h2>
                            <p>Tải tệp mới và chờ xử lý xong, hoặc đổi từ khóa tìm.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={mine.data.meta} />
                </>
            )}
            <section className="admin-section">
                {selected && !valid && <Feedback error="Mã tài nguyên chưa hợp lệ." />}
                {valid && detail.isPending && <p role="status">Đang tải tài nguyên đã chọn…</p>}
                {(detail.isError || categories.isError) && (
                    <Feedback error={errorMessage(detail.error || categories.error)} />
                )}
                {valid && detail.isSuccess && categories.isSuccess && (
                    <PromoteForm
                        key={detail.data.id}
                        asset={detail.data}
                        categories={categories.data}
                    />
                )}
            </section>
        </>
    );
}
