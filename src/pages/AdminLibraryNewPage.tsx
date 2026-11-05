import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Share2, UploadCloud } from 'lucide-react';
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
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
} from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type CreateLibraryAssetBody,
    CreateLibraryAssetBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, AssetCategory } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { SearchFilter } from '../shared/ui/LiveFilters';
import { LoadingState } from '../shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';

function PromoteForm({ asset, categories }: { asset: Asset; categories: AssetCategory[] }) {
    const action = useLibraryAction();
    const navigate = useNavigate();
    const [draft, setDraft] = useState<CreateLibraryAssetBody | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (asset.scope !== 'mine' || asset.status !== 'READY') {
        return (
            <Feedback error="Chỉ chọn tài nguyên cá nhân đã ở trạng thái Sẵn sàng để đưa vào thư viện." />
        );
    }

    return (
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
            <div>
                <h2 className="font-semibold text-base text-foreground">
                    Thông tin tài nguyên đưa vào thư viện
                </h2>
                <p className="mt-0.5 text-muted-foreground text-xs">
                    {asset.name} — {assetTypeLabels[asset.type]} ({formatBytes(asset.sizeBytes)})
                </p>
            </div>

            <WriteFeedback action={action} error={error} />

            <form
                className="space-y-4"
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
                    <fieldset disabled={action.busy || action.uncertain} className="space-y-4">
                        <LibraryMetadata asset={asset} categories={categories} />
                        <div className="pt-2">
                            <Button type="submit" className="gap-2">
                                <Share2 className="h-4 w-4" data-icon="inline-start" />
                                Xem lại và đưa vào thư viện
                            </Button>
                        </div>
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
        </div>
    );
}

export function AdminLibraryNewPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readLibrarySearch(params);
    const selected = params.get('asset') || '';
    const valid = IdSchema.safeParse(selected).success;

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
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Header: Điều hướng quay lại & Tiêu đề */}
            <div className="space-y-3">
                <Link
                    to="/admin/library"
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Về thư viện dùng chung</span>
                </Link>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                            Thêm vào thư viện
                        </h1>
                        <p className="mt-1 text-muted-foreground text-sm">
                            Chọn tài nguyên cá nhân đã sẵn sàng, sau đó xác nhận giấy phép và tác
                            giả gốc.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" asChild className="gap-2">
                        <Link to="/assets/upload">
                            <UploadCloud className="h-4 w-4" />
                            <span>Tải tệp mới</span>
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Bộ lọc tìm kiếm tài nguyên cá nhân */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
                    <Field>
                        <FieldLabel htmlFor="promote-q" className="font-medium text-xs">
                            Tìm tài nguyên cá nhân
                        </FieldLabel>
                        <SearchFilter
                            className="mt-1.5"
                            name="q"
                            id="promote-q"
                            placeholder="Tên tài nguyên cá nhân..."
                            maxLength={100}
                            value={query.q}
                        />
                    </Field>
                </FieldGroup>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {mine.isPending && (
                <LoadingState layout="assets">Đang tải tài nguyên cá nhân…</LoadingState>
            )}
            {mine.isError && <Feedback error={errorMessage(mine.error)} />}

            {/* Danh sách tài nguyên cá nhân */}
            {mine.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{mine.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{mine.data.meta.total}</strong>{' '}
                            tài nguyên cá nhân
                        </span>
                        <AdminReload
                            retry={() => {
                                void mine.refetch();
                                void categories.refetch();
                                if (valid) void detail.refetch();
                            }}
                            busy={mine.isFetching || categories.isFetching || detail.isFetching}
                        />
                    </div>

                    {mine.data.data.length ? (
                        <ul className="list-none space-y-2.5 p-0">
                            {mine.data.data.map((asset) => {
                                const isReady = asset.status === 'READY' && asset.scope === 'mine';
                                const isSelected = selected === asset.id;

                                return (
                                    <li
                                        key={asset.id}
                                        className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border bg-surface hover:border-primary/40'
                                        }`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                                                <AssetThumbnail asset={asset} variant="compact" />
                                            </div>
                                            <div className="min-w-0 space-y-0.5">
                                                <h3 className="truncate font-semibold text-foreground text-sm">
                                                    {asset.name}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                    <span>{assetTypeLabels[asset.type]}</span>
                                                    <span>•</span>
                                                    <span>{formatBytes(asset.sizeBytes)}</span>
                                                    <span>•</span>
                                                    <span
                                                        className={
                                                            asset.status === 'READY'
                                                                ? 'font-medium text-emerald-500'
                                                                : 'text-amber-500'
                                                        }
                                                    >
                                                        {assetStatusLabels[asset.status]}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant={isSelected ? 'default' : 'secondary'}
                                            size="sm"
                                            className="h-8 shrink-0 px-3 text-xs"
                                            type="button"
                                            disabled={!isReady}
                                            aria-pressed={isSelected}
                                            onClick={() =>
                                                setParams((current) => {
                                                    const next = new URLSearchParams(current);
                                                    next.set('asset', asset.id);
                                                    return next;
                                                })
                                            }
                                        >
                                            {isSelected ? (
                                                <>
                                                    <Check className="mr-1 h-3.5 w-3.5" />
                                                    Đang chọn
                                                </>
                                            ) : (
                                                'Chọn tài nguyên'
                                            )}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Chưa có tài nguyên phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Tải tệp mới và chờ xử lý xong, hoặc đổi từ khóa tìm kiếm.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}

                    <div className="pt-2">
                        <AdminPager
                            page={query.page}
                            meta={mine.data.meta}
                            busy={mine.isFetching}
                        />
                    </div>
                </div>
            )}

            {/* Khối Form cấu hình đưa vào thư viện */}
            <div className="pt-4">
                {selected && !valid && <Feedback error="Mã tài nguyên chưa hợp lệ." />}
                {valid && detail.isPending && (
                    <LoadingState layout="detail">Đang tải tài nguyên đã chọn…</LoadingState>
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
            </div>
        </div>
    );
}
