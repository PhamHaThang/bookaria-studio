import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Pagination } from '@/shared/ui/Pagination';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { SearchInput } from '@/shared/ui/SearchInput';
import { discoveryApi } from '../features/discovery';
import { PublicBooks } from '../features/discovery/PublicBooks';
import { readDiscoverySearch, updateDiscoverySearch } from '../features/discovery/search';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

const ages = Array.from({ length: 19 }, (_, value) => String(value));

export function ExplorePage() {
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
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thư viện sách công khai</h1>
                    <p>Tìm sách tương tác và đọc cùng Bookaria.</p>
                </div>
            </div>
            <form
                className="discovery-filters grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-4 border-b-[1px] border-b-border pb-6 [border-bottom-style:solid] max-[640px]:grid-cols-[minmax(0,_1fr)] [&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-2"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const changes = Object.fromEntries(
                        ['q', 'age', 'topic', 'language', 'sort'].map((key) => [
                            key,
                            String(data.get(key) || '').trim(),
                        ]),
                    );
                    setParams((current) => updateDiscoverySearch(current, changes));
                }}
            >
                <FieldGroup className="contents">
                    <Field className="col-span-2 block min-w-0 max-[640px]:col-auto">
                        <FieldLabel htmlFor="explore-book-search" className="m-0">
                            Tên sách
                        </FieldLabel>
                        <SearchInput
                            className="mt-2"
                            id="explore-book-search"
                            name="q"
                            maxLength={100}
                            defaultValue={query.q || ''}
                            placeholder="Tìm theo tên sách"
                        />
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Độ tuổi
                            <FormSelect
                                name="age"
                                defaultValue={query.age ?? ''}
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
                            <Input
                                name="topic"
                                maxLength={50}
                                defaultValue={query.topic || ''}
                                placeholder="Nhập chủ đề"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Ngôn ngữ
                            <Input
                                name="language"
                                pattern="[a-z]{2}(-[A-Z]{2})?"
                                title="Mã ngôn ngữ, ví dụ vi, en hoặc en-US"
                                defaultValue={query.language || ''}
                                placeholder="vi, en, en-US"
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel>
                            Sắp xếp
                            <FormSelect
                                name="sort"
                                defaultValue={query.sort}
                                options={[
                                    { value: 'newest', label: 'Mới xuất bản' },
                                    { value: 'popular', label: 'Đọc nhiều' },
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <div className="discovery-filter-actions col-[span_2] flex flex-wrap items-end gap-3 max-[640px]:col-[auto]">
                        <Button type="submit">Tìm sách</Button>
                        <Button variant="secondary" asChild>
                            <Link to="/explore">Xóa bộ lọc</Link>
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
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
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
                                {filtered && <Link to="/explore">Xóa bộ lọc</Link>}
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
