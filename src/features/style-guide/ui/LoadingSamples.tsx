import { Box, Plus } from 'lucide-react';
import { useState } from 'react';
import { AssetThumbnail } from '@/features/assets';
import type { Asset } from '@/shared/contracts/dto.schema';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import type { SkeletonLayout } from '@/shared/ui/ContentSkeleton';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Button as PrimitiveButton } from '@/shared/ui/primitives/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { ScrollArea } from '@/shared/ui/primitives/scroll-area';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { GuideSection, Sample } from './GuideSection';

const skeletons: { value: SkeletonLayout; label: string }[] = [
    { value: 'books', label: 'Sách trong Studio' },
    { value: 'assets', label: 'Danh sách tài nguyên' },
    { value: 'rows', label: 'Hàng dữ liệu' },
    { value: 'pages', label: 'Danh sách trang' },
    { value: 'public-books', label: 'Sách công khai' },
    { value: 'profile', label: 'Hồ sơ' },
    { value: 'author', label: 'Tác giả' },
    { value: 'detail', label: 'Trang chi tiết' },
    { value: 'stats', label: 'Thống kê' },
    { value: 'editor', label: 'Khung editor' },
    { value: 'asset-picker', label: 'Bộ chọn tài nguyên' },
    { value: 'page-strip', label: 'Dải trang' },
    { value: 'notifications', label: 'Thông báo' },
];
const demoAsset: Asset = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Tài nguyên minh họa',
    type: 'MODEL',
    status: 'READY',
    sizeBytes: 1024,
    format: 'glb',
    url: 'https://example.com/sample.glb',
    thumbnailUrl: null,
    meta: {},
    tags: [],
    license: null,
    authorName: null,
    sourceUrl: null,
    scope: 'mine',
    categoryId: null,
    createdAt: '2026-10-26T00:00:00.000Z',
};

export function LoadingSamples() {
    const [layout, setLayout] = useState<SkeletonLayout>('books');
    const [empty, setEmpty] = useState(true);
    return (
        <>
            <GuideSection
                id="loading"
                title="Loading & Skeleton"
                description="Ba mức chờ có chủ đích khác nhau. Chỉ dùng logo chờ khi mở ứng dụng/chuyển khung; giữ Skeleton sát cấu trúc dữ liệu, Spinner sát thao tác."
            >
                <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 gap-8 max-[800px]:grid-cols-1">
                        <Sample title="Mở ứng dụng" source="@/shared/ui/LoadingScreen">
                            <div className="rounded-lg border border-border">
                                <LoadingScreen message="Đang mở Bookaria…" />
                            </div>
                        </Sample>
                        <Sample
                            title="Thao tác cục bộ"
                            source="Spinner; LoadingState không truyền layout"
                        >
                            <div className="flex items-center gap-3">
                                <Spinner aria-hidden="true" />
                                <span className="text-sm">Đang xử lý mẫu…</span>
                            </div>
                            <LoadingState>Đang tải thông tin mẫu…</LoadingState>
                        </Sample>
                    </div>
                    <Sample
                        title="Skeleton theo nội dung thực tế"
                        source="LoadingState layout → ContentSkeleton (13 bố cục)"
                    >
                        <Field className="block max-w-80">
                            <FieldLabel htmlFor="guide-skeleton" className="mb-0">
                                Chọn bố cục Skeleton
                            </FieldLabel>
                            <FormSelect
                                id="guide-skeleton"
                                value={layout}
                                onValueChange={(value) => setLayout(value as SkeletonLayout)}
                                options={skeletons}
                            />
                        </Field>
                        <ScrollArea className="h-80 rounded-lg border border-border bg-surface">
                            <div className="min-w-180 p-5">
                                <LoadingState layout={layout}>
                                    Đang tải nội dung minh họa…
                                </LoadingState>
                            </div>
                        </ScrollArea>
                    </Sample>
                </div>
            </GuideSection>
            <GuideSection
                id="content"
                title="Thẻ, tài nguyên & trạng thái trống"
                description="Card ghép đủ header/content/footer. Tài nguyên đang xử lý hiển thị loading; thất bại hiển thị cảnh báo, khóa thêm vào scene. Trạng thái trống luôn có hướng xử lý."
            >
                <div className="flex flex-col gap-8">
                    <Sample
                        title="Cùng component thumbnail, khác trạng thái dữ liệu"
                        source="features/assets/AssetThumbnail variant=card; primitives/card + Badge"
                    >
                        <div className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-1">
                            {(['READY', 'PROCESSING', 'FAILED'] as const).map((status) => (
                                <Card key={status}>
                                    <CardHeader>
                                        <CardTitle>
                                            {status === 'READY'
                                                ? 'Sẵn sàng'
                                                : status === 'PROCESSING'
                                                  ? 'Đang xử lý'
                                                  : 'Xử lý thất bại'}
                                        </CardTitle>
                                        <CardDescription>Mẫu trạng thái tài nguyên</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-32">
                                            <AssetThumbnail
                                                asset={{ ...demoAsset, status }}
                                                variant="card"
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="justify-between px-4 pb-4">
                                        <Badge
                                            tone={
                                                status === 'READY'
                                                    ? 'success'
                                                    : status === 'PROCESSING'
                                                      ? 'warning'
                                                      : 'danger'
                                            }
                                        >
                                            {status}
                                        </Badge>
                                        <PrimitiveButton
                                            size="icon-sm"
                                            variant="ghost"
                                            disabled={status !== 'READY'}
                                            aria-label={`Thêm mẫu ${status}`}
                                            onClick={() => setEmpty(false)}
                                        >
                                            <Plus />
                                        </PrimitiveButton>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </Sample>
                    <Sample
                        title="Danh sách trống"
                        source="primitives/empty · icon + title + description + action"
                    >
                        {empty ? (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <Box />
                                    </EmptyMedia>
                                    <EmptyTitle>Chưa có tài nguyên mẫu</EmptyTitle>
                                    <EmptyDescription>
                                        Thêm nội dung đầu tiên để tiếp tục sáng tạo.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button variant="secondary" onClick={() => setEmpty(false)}>
                                        Thêm tài nguyên mẫu
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        ) : (
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-5">
                                <span role="status">Đã thêm tài nguyên minh họa.</span>
                                <Button variant="outline" onClick={() => setEmpty(true)}>
                                    Xem lại trạng thái trống
                                </Button>
                            </div>
                        )}
                    </Sample>
                </div>
            </GuideSection>
        </>
    );
}
