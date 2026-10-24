import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { libraryKeys, readLibrarySearch } from '../features/admin/library-model';
import { CategorySelect, libraryApi } from '../features/admin/library-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { AssetThumbnail, assetKeys, assetsApi, assetTypeLabels } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { formatBytes } from '../shared/lib/format';
import { Feedback } from '../shared/ui/Feedback';
export function AdminLibraryPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
        query = readLibrarySearch(params);
    const list = useQuery({
        queryKey: libraryKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => libraryApi.library(query, signal),
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thư viện dùng chung</h1>
                    <p>Tài nguyên có thể được các tác giả sử dụng trong sách.</p>
                </div>
                <Button asChild>
                    <Link to="/admin/library/new">Thêm vào thư viện</Link>
                </Button>
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_[data-slot=select-trigger]]:w-full [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto]"
                key={params.toString() + categories.isSuccess}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget),
                        next = new URLSearchParams();
                    for (const [key, value] of data) if (value) next.set(key, String(value).trim());
                    setParams(next);
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="library-q">
                            Tên tài nguyên
                            <Input
                                id="library-q"
                                name="q"
                                type="search"
                                maxLength={100}
                                defaultValue={query.q}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="library-type">
                            Loại
                            <FormSelect
                                id="library-type"
                                name="type"
                                defaultValue={query.type || ''}
                                options={[
                                    { value: '', label: 'Tất cả' },
                                    ...(Object.entries(assetTypeLabels).map(([value, label]) => ({
                                        value: value,
                                        label: label,
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    {categories.isSuccess && (
                        <CategorySelect
                            emptyLabel="Tất cả danh mục"
                            label="Lọc danh mục"
                            categories={categories.data}
                            value={query.categoryId || ''}
                        />
                    )}
                    <Button type="submit">Lọc thư viện</Button>
                    <Link to="/admin/library">Xóa bộ lọc</Link>
                </FieldGroup>
            </form>
            {categories.isError && <Feedback error={errorMessage(categories.error)} />}
            <AdminReload
                retry={() => {
                    void list.refetch();
                    void categories.refetch();
                }}
                busy={list.isFetching || categories.isFetching}
            />
            {list.isPending && <LoadingState>Đang tải thư viện…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} tài nguyên</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((asset) => (
                                <li key={asset.id}>
                                    <div className="library-row-main flex min-w-0 items-center gap-4 [&_>_div]:min-w-0">
                                        <AssetThumbnail asset={asset} />
                                        <div>
                                            <h2>
                                                <Link to={`/admin/library/${asset.id}`}>
                                                    {asset.name}
                                                </Link>
                                            </h2>
                                            <p>
                                                {assetTypeLabels[asset.type]} ·{' '}
                                                {formatBytes(asset.sizeBytes)}
                                            </p>
                                            <p>
                                                {asset.authorName} · {asset.license}
                                            </p>
                                            <p>
                                                {categories.data?.find(
                                                    (item) => item.id === asset.categoryId,
                                                )?.name || 'Không có danh mục'}
                                            </p>
                                        </div>
                                    </div>
                                    <Link to={`/admin/library/${asset.id}`}>
                                        Sửa thông tin
                                        <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                            {' '}
                                            {asset.name}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có tài nguyên phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Đổi bộ lọc hoặc chọn tài nguyên cá nhân để đưa vào thư viện.
                                    </p>
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
