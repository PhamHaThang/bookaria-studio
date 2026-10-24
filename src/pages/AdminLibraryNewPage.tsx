import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
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
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
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
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <LibraryMetadata asset={asset} categories={categories} />
                        <Button fullWidth type="submit">
                            Xem lại việc chia sẻ
                        </Button>
                    </fieldset>
                </FieldGroup>
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
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thêm vào thư viện</h1>
                    <p>
                        Chọn tài nguyên cá nhân đã sẵn sàng, sau đó xác nhận giấy phép và tác giả
                        gốc.
                    </p>
                </div>
                <Button variant="secondary" asChild>
                    <Link to="/assets/upload">Tải tệp mới</Link>
                </Button>
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto] [&_select]:w-full"
                key={query.q || ''}
                onSubmit={(event) => {
                    event.preventDefault();
                    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
                    setParams(q ? { q } : {});
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="promote-q">
                            Tìm tài nguyên cá nhân
                            <Input
                                name="q"
                                id="promote-q"
                                type="search"
                                maxLength={100}
                                defaultValue={query.q}
                            />
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Tìm tài nguyên</Button>
                </FieldGroup>
            </form>
            <AdminReload
                retry={() => {
                    void mine.refetch();
                    void categories.refetch();
                    if (valid) void detail.refetch();
                }}
                busy={mine.isFetching || categories.isFetching || detail.isFetching}
            />
            {mine.isPending && <LoadingState>Đang tải tài nguyên cá nhân…</LoadingState>}
            {mine.isError && <Feedback error={errorMessage(mine.error)} />}
            {mine.isSuccess && (
                <>
                    <p>{mine.data.meta.total} tài nguyên cá nhân (gồm các tệp chưa sẵn sàng)</p>
                    {mine.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {mine.data.data.map((asset) => (
                                <li key={asset.id}>
                                    <div>
                                        <h2>{asset.name}</h2>
                                        <p>
                                            {assetTypeLabels[asset.type]} ·{' '}
                                            {assetStatusLabels[asset.status]}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
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
                                        Chọn
                                        <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                            {' '}
                                            {asset.name}
                                        </span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Chưa có tài nguyên phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Tải tệp mới và chờ xử lý xong, hoặc đổi từ khóa tìm.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={mine.data.meta} />
                </>
            )}
            <section className="admin-section mt-8">
                {selected && !valid && <Feedback error="Mã tài nguyên chưa hợp lệ." />}
                {valid && detail.isPending && (
                    <LoadingState>Đang tải tài nguyên đã chọn…</LoadingState>
                )}
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
