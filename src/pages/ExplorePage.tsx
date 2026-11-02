import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Library } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';
import { SearchFilter, SelectFilter, TextFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Pagination } from '@/shared/ui/Pagination';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { discoveryApi } from '../features/discovery';
import { PublicBooks } from '../features/discovery/PublicBooks';
import { readDiscoverySearch, updateDiscoverySearch } from '../features/discovery/search';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

const ages = Array.from({ length: 19 }, (_, value) => String(value));

export function ExplorePage() {
    const [params, setParams] = useSearchParams();
    const { user } = useAuth();
    const view = params.get('view') === 'assets' ? 'assets' : 'books';
    return (
        <Tabs
            value={view}
            onValueChange={(value) =>
                setParams((current) => {
                    const next = new URLSearchParams();
                    if (value === 'assets') next.set('view', 'assets');
                    for (const key of ['auth', 'next', 'token']) {
                        const item = current.get(key);
                        if (item) next.set(key, item);
                    }
                    return next;
                })
            }
            className="gap-8"
        >
            <div
                data-slot="explore-section-navigation"
                className="flex min-h-13 items-center justify-between gap-6"
            >
                <TabsList aria-label="Khám phá">
                    <TabsTrigger value="books">
                        <Library aria-hidden="true" />
                        Sách
                    </TabsTrigger>
                    <TabsTrigger value="assets">
                        <FolderOpen aria-hidden="true" />
                        Tài nguyên
                    </TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="books">
                <div className="mb-7">
                    <h1 className="font-semibold text-[28px] tracking-tight">Khám phá sách</h1>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Tìm sách tương tác và đọc cùng Bookaria.
                    </p>
                </div>
                <ExploreBooks />
            </TabsContent>
            <TabsContent value="assets">
                <div className="mb-7">
                    <h1 className="font-semibold text-[28px] tracking-tight">
                        Tài nguyên dùng chung
                    </h1>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Khám phá hình ảnh, âm thanh, video và mô hình 3D cho sách của bạn.
                    </p>
                </div>
                {user ? (
                    <AssetCatalog scope="library" />
                ) : (
                    <Empty className="py-16">
                        <EmptyHeader>
                            <EmptyMedia>
                                <FolderOpen size={38} aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>Thư viện tài nguyên Bookaria</EmptyTitle>
                            <EmptyDescription>
                                Đăng nhập để xem trước hình ảnh, âm thanh, video và mô hình 3D dùng
                                chung cho sách của bạn.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button asChild>
                                <AuthDialogLink mode="login">Đăng nhập</AuthDialogLink>
                            </Button>
                        </EmptyContent>
                    </Empty>
                )}
            </TabsContent>
        </Tabs>
    );
}

function ExploreBooks() {
    const [params, setParams] = useSearchParams();
    const query = readDiscoverySearch(params);
    const listing = useQuery({
        queryKey: ['discovery', 'books', query],
        queryFn: ({ signal }) => discoveryApi.books(query, signal),
        staleTime: 0,
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (
            listing.isSuccess &&
            !listing.isFetching &&
            meta &&
            query.page > Math.max(1, meta.totalPages)
        )
            setParams(
                (current) =>
                    updateDiscoverySearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
    }, [listing.isSuccess, listing.isFetching, meta, query.page, setParams]);
    const filtered = Boolean(query.q || query.age !== undefined || query.topic || query.language);
    return (
        <>
            <form
                className="discovery-filters grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-4 border-b-[1px] border-b-border pb-6 [border-bottom-style:solid] max-[640px]:grid-cols-[minmax(0,_1fr)] [&_label>[data-slot=select-trigger]]:mt-0 [&_label>input]:mt-0 [&_label]:mb-0 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-2"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="contents">
                    <Field className="col-span-2 min-w-0 max-[640px]:col-auto">
                        <FieldLabel htmlFor="explore-book-search" className="m-0">
                            Tên sách
                        </FieldLabel>
                        <SearchFilter
                            className="mt-2"
                            id="explore-book-search"
                            name="q"
                            maxLength={100}
                            value={query.q || ''}
                            placeholder="Tìm theo tên sách"
                        />
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Độ tuổi
                            <SelectFilter
                                name="age"
                                value={query.age ?? ''}
                                options={[
                                    { value: '', label: 'Tất cả độ tuổi' },
                                    ...(ages.map((age) => ({
                                        value: age,
                                        label: <>{age} tuổi</>,
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Chủ đề
                            <TextFilter
                                name="topic"
                                maxLength={50}
                                value={query.topic || ''}
                                placeholder="Nhập chủ đề"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Ngôn ngữ
                            <TextFilter
                                name="language"
                                pattern="[a-z]{2}(-[A-Z]{2})?"
                                title="Mã ngôn ngữ, ví dụ vi, en hoặc en-US"
                                value={query.language || ''}
                                placeholder="vi, en, en-US"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Sắp xếp
                            <SelectFilter
                                name="sort"
                                value={query.sort}
                                options={[
                                    { value: 'newest', label: 'Mới xuất bản' },
                                    { value: 'popular', label: 'Đọc nhiều' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <div className="discovery-filter-actions col-[span_2] flex flex-wrap items-end gap-3 max-[640px]:col-[auto]">
                        <Button variant="secondary" className="min-h-11" asChild>
                            <Link to="/library" state={{ resetFilters: true }}>
                                Xóa bộ lọc
                            </Link>
                        </Button>
                    </div>
                </FieldGroup>
            </form>
            {listing.isPending && <LoadingState layout="public-books">Đang tải sách…</LoadingState>}
            {listing.isError && (
                <div className="list-state px-0 py-12">
                    <Feedback error={errorMessage(listing.error)} />
                    <Button type="button" onClick={() => void listing.refetch()}>
                        Thử tải lại
                    </Button>
                </div>
            )}
            {listing.isSuccess && (
                <>
                    <p
                        className="mx-0 mt-0 mb-3 flex list-summary justify-between gap-4 text-[length:12px] text-muted-foreground [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375"
                        role="status"
                    >
                        {listing.data.meta.total} cuốn sách
                        {listing.isFetching ? ' · Đang cập nhật…' : ''}
                    </p>
                    {listing.data.data.length ? (
                        <PublicBooks books={listing.data.data} />
                    ) : (
                        <Empty className="empty-state px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>
                                        {filtered
                                            ? 'Chưa tìm thấy sách phù hợp'
                                            : 'Thư viện chưa có sách công khai'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        {filtered
                                            ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem thêm sách.'
                                            : 'Các sách được tác giả xuất bản công khai sẽ xuất hiện ở đây.'}
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                {filtered && (
                                    <Link to="/library" state={{ resetFilters: true }}>
                                        Xóa bộ lọc
                                    </Link>
                                )}
                            </EmptyContent>
                        </Empty>
                    )}
                    {listing.data.meta.totalPages > 1 && (
                        <Pagination
                            page={query.page}
                            totalPages={listing.data.meta.totalPages}
                            busy={listing.isFetching}
                            label="Phân trang thư viện"
                            onPage={(page) =>
                                setParams((current) =>
                                    updateDiscoverySearch(current, { page: String(page) }),
                                )
                            }
                        />
                    )}
                </>
            )}
        </>
    );
}
