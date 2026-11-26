import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    Box,
    ExternalLink,
    FileImage,
    FileText,
    Film,
    HardDrive,
    Music2,
    Save,
    Shield,
    Trash2,
    User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { libraryChanges, libraryFields } from '../features/admin/library-model';
import {
    LibraryConfirm,
    LibraryMetadata,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { AdminReload } from '../features/admin/ui';
import { AssetThumbnail, assetKeys, assetsApi, assetTypeLabels } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type UpdateLibraryAssetBody,
    UpdateLibraryAssetBodySchema,
} from '../shared/contracts/api/admin.schema';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, AssetCategory } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { LoadingState } from '../shared/ui/LoadingState';
import { FieldGroup } from '../shared/ui/primitives/field';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    IMAGE: FileImage,
    AUDIO: Music2,
    MODEL: Box,
    VIDEO: Film,
};

function LibraryEditor({
    asset,
    categories,
    onSaved,
}: {
    asset: Asset;
    categories: AssetCategory[];
    onSaved: () => void;
}) {
    const action = useLibraryAction();
    const navigate = useNavigate();
    const [draft, setDraft] = useState<UpdateLibraryAssetBody | 'delete' | null>(null);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <WriteFeedback action={action} error={error} />

            <form
                className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6"
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
                <h2 className="font-semibold text-base text-foreground">
                    Thông tin hiển thị trong thư viện
                </h2>

                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain} className="space-y-4">
                        <LibraryMetadata asset={asset} categories={categories} />
                        <div className="pt-2">
                            <Button type="submit" className="gap-2">
                                <Save className="h-4 w-4" data-icon="inline-start" />
                                Lưu thông tin thư viện
                            </Button>
                        </div>
                    </fieldset>
                </FieldGroup>
            </form>

            {/* Khối nguy hiểm: Xóa khỏi thư viện */}
            <section className="space-y-3 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
                <h2 className="font-semibold text-base text-destructive">
                    Gỡ khỏi thư viện dùng chung
                </h2>
                <p className="max-w-2xl text-muted-foreground text-xs leading-relaxed">
                    Máy chủ sẽ từ chối nếu tài nguyên còn được dùng trong bất kỳ bản nháp hoặc cuốn
                    sách nào đã xuất bản. Không tự động xóa các tham chiếu đã chèn trong sách.
                </p>
                <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 px-3 font-medium text-xs"
                    type="button"
                    disabled={action.busy || action.uncertain}
                    onClick={() => setDraft('delete')}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa tài nguyên khỏi thư viện
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
                                        `${
                                            (
                                                {
                                                    name: 'Tên',
                                                    license: 'Giấy phép',
                                                    authorName: 'Tác giả',
                                                    sourceUrl: 'Nguồn',
                                                    categoryId: 'Danh mục',
                                                    tags: 'Nhãn',
                                                } as Record<string, string>
                                            )[key]
                                        }: ${
                                            key === 'categoryId'
                                                ? categories.find((item) => item.id === value)
                                                      ?.name || 'Không có'
                                                : Array.isArray(value)
                                                  ? value.join(', ')
                                                  : value || 'Không có'
                                        }`,
                                )
                                .join('\n')}
                        </p>
                    )}
                </LibraryConfirm>
            )}
        </div>
    );
}

export function AdminLibraryDetailPage() {
    const { user } = useAuth();
    const { assetId = '' } = useParams();
    const location = useLocation();
    const valid = IdSchema.safeParse(assetId).success;
    const [success, setSuccess] = useState<string | null>(
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

    if (!valid) {
        return (
            <div className="mx-auto max-w-4xl space-y-4 p-6">
                <h1 className="font-semibold text-foreground text-xl">Không tìm thấy tài nguyên</h1>
                <Button variant="secondary" asChild>
                    <Link to="/admin/library">Về thư viện</Link>
                </Button>
            </div>
        );
    }

    const asset = detail.data;
    const TypeIcon = asset?.type ? typeIcons[asset.type] || FileText : FileText;

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Thanh điều hướng quay lại */}
            <div className="flex items-center gap-2">
                <Link
                    to="/admin/library"
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Về thư viện dùng chung</span>
                </Link>
            </div>

            <Feedback success={success} />

            <AdminReload
                retry={() => {
                    void detail.refetch();
                    void categories.refetch();
                }}
                busy={detail.isFetching || categories.isFetching}
            />

            {detail.isPending && <LoadingState layout="detail">Đang tải tài nguyên…</LoadingState>}

            {detail.isError && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                    <h1 className="font-semibold text-base text-destructive">
                        Chưa mở được tài nguyên
                    </h1>
                    <Feedback error={errorMessage(detail.error)} />
                </div>
            )}

            {detail.isSuccess && detail.data.scope !== 'library' && (
                <div className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
                    <h1 className="font-semibold text-foreground text-lg">
                        Tài nguyên chưa thuộc thư viện
                    </h1>
                    <Feedback error="Tài nguyên này hiện chỉ là tài nguyên cá nhân và chưa thuộc thư viện dùng chung." />
                    <Button asChild>
                        <Link to={`/admin/library/new?asset=${assetId}`}>
                            Chọn để đưa vào thư viện
                        </Link>
                    </Button>
                </div>
            )}

            {detail.isSuccess && detail.data.scope === 'library' && (
                <div className="space-y-6">
                    {/* Header thông tin tài nguyên */}
                    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/40">
                                <AssetThumbnail asset={detail.data} variant="card" />
                            </div>

                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-semibold text-foreground text-xl">
                                        {detail.data.name}
                                    </h1>
                                    <Badge
                                        tone="neutral"
                                        className="h-5 px-2 font-normal text-[11px]"
                                    >
                                        <TypeIcon className="mr-1 h-3 w-3" />
                                        {assetTypeLabels[detail.data.type]}
                                    </Badge>
                                    <Badge tone="info" className="h-5 px-2 font-normal text-[11px]">
                                        .{detail.data.format.toUpperCase()}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                                    <span className="flex items-center gap-1">
                                        <HardDrive className="h-3 w-3" />
                                        {formatBytes(detail.data.sizeBytes)}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {detail.data.authorName || 'Chưa rõ'}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Shield className="h-3 w-3" />
                                        {detail.data.license || 'Chưa có'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                            <a href={detail.data.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span>Mở tệp gốc</span>
                            </a>
                        </Button>
                    </div>

                    {categories.isSuccess && (
                        <LibraryEditor
                            key={JSON.stringify(detail.data)}
                            asset={detail.data}
                            categories={categories.data}
                            onSaved={() => setSuccess('Đã lưu thông tin thư viện.')}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
