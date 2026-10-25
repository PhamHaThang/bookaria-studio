import { useState } from 'react';
import { Disclosure } from '@/shared/ui/Disclosure';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Pagination } from '@/shared/ui/Pagination';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { GuideSection, Sample } from './GuideSection';

export function NavigationSamples() {
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    return (
        <GuideSection
            id="navigation"
            title="Điều hướng & bộ lọc"
            description="Tabs đổi nội dung, FilterBar lọc danh sách. Cùng kiểu gạch dưới không đồng nghĩa với cùng vai trò. Dùng phím mũi tên để chuyển lựa chọn trong nhóm."
        >
            <div className="flex flex-col gap-8">
                <Sample
                    title="Tabs theo ba ngữ cảnh"
                    source="primitives/tabs · TabsList variant=default | line | navigation"
                >
                    <div className="grid grid-cols-3 gap-6 max-[1000px]:grid-cols-1">
                        {(['default', 'line', 'navigation'] as const).map((variant) => (
                            <div key={variant} className="min-w-0">
                                <p className="mt-0 text-muted-foreground text-xs">{variant}</p>
                                <Tabs
                                    defaultValue="profile"
                                    orientation={
                                        variant === 'navigation' ? 'vertical' : 'horizontal'
                                    }
                                >
                                    <TabsList
                                        variant={variant}
                                        aria-label={`Tabs ${variant}`}
                                        className={
                                            variant === 'navigation' ? 'w-28 shrink-0' : undefined
                                        }
                                    >
                                        <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
                                        <TabsTrigger value="password">Mật khẩu</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="profile">
                                        <p>Nội dung hồ sơ mẫu.</p>
                                    </TabsContent>
                                    <TabsContent value="password">
                                        <p>Nội dung đổi mật khẩu mẫu.</p>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        ))}
                    </div>
                </Sample>
                <Sample
                    title="Lọc trạng thái"
                    source="@/shared/ui/FilterBar → ToggleGroup variant=line"
                >
                    <div>
                        <FilterBar
                            label="Lọc sách mẫu"
                            value={filter}
                            onValueChange={setFilter}
                            options={[
                                { value: 'all', label: 'Tất cả' },
                                { value: 'draft', label: 'Bản nháp' },
                                { value: 'published', label: 'Đã xuất bản' },
                            ]}
                        />
                        <p role="status" className="m-0 text-muted-foreground text-sm">
                            Bộ lọc mẫu:{' '}
                            {filter === 'all'
                                ? 'Tất cả'
                                : filter === 'draft'
                                  ? 'Bản nháp'
                                  : 'Đã xuất bản'}
                            .
                        </p>
                    </div>
                </Sample>
                <Sample
                    title="Phân trang dùng chung"
                    source="@/shared/ui/Pagination · page / totalPages / onPage / label / busy"
                >
                    <Field orientation="horizontal">
                        <Checkbox
                            id="guide-pagination-busy"
                            checked={busy}
                            onCheckedChange={(checked) => setBusy(checked === true)}
                        />
                        <FieldLabel htmlFor="guide-pagination-busy" className="m-0">
                            Mô phỏng đang tải phân trang
                        </FieldLabel>
                    </Field>
                    <Pagination
                        busy={busy}
                        page={page}
                        totalPages={3}
                        onPage={setPage}
                        label="Phân trang mẫu"
                    />
                </Sample>
                <Sample title="Mở rộng nội dung" source="@/shared/ui/Disclosure → Accordion">
                    <Disclosure title="Khi nào dùng Skeleton?" defaultOpen>
                        <p className="m-0 text-muted-foreground">
                            Dùng khi đang tải dữ liệu và đã biết hình dáng nội dung, ví dụ danh sách
                            sách, thông báo hoặc hồ sơ.
                        </p>
                    </Disclosure>
                </Sample>
            </div>
        </GuideSection>
    );
}
