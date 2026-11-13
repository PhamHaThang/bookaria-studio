import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpen, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { libraryAssetLocation } from '@/features/assets/model/search';
import { BOOK_LANGUAGES, bookLanguageOptions } from '@/features/books/model/languages';
import { BookTopicField } from '@/features/books/ui/BookTopicField';
import { BOOK_AGE_MAX } from '@/shared/contracts/common.schema';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { SearchFilter, SelectFilter } from '@/shared/ui/LiveFilters';
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
import { Input } from '@/shared/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';
import { discoveryApi } from '../features/discovery';
import { PublicBooks, PublicBooksSkeleton } from '../features/discovery/PublicBooks';
import { readDiscoverySearch, updateDiscoverySearch } from '../features/discovery/search';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

const CUSTOM_LANGUAGE = 'custom-language';

export function ExplorePage() {
    const [params] = useSearchParams();
    const { hash } = useLocation();
    if (params.get('view') === 'assets') {
        return <Navigate to={libraryAssetLocation(params) + hash} replace />;
    }

    return (
        <>
            <header data-stable-scroll-overlays className="pt-3 pb-7 sm:pt-7 sm:pb-9">
                <h1 className="m-0 font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
                    Khám phá sách
                </h1>
                <p className="mt-3 mb-0 max-w-[58ch] text-muted-foreground text-sm leading-relaxed sm:text-base">
                    Tìm sách tương tác và khám phá nội dung AR ngay trong trình duyệt.
                </p>
            </header>
            <ExploreBooks />
        </>
    );
}

function ExploreBooks() {
    const [params, setParams] = useSearchParams();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [topic, setTopic] = useState('');
    const [languageChoice, setLanguageChoice] = useState('');
    const results = useRef<HTMLElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);
    const query = readDiscoverySearch(params);
    const listing = useQuery({
        queryKey: ['discovery', 'books', query],
        queryFn: ({ signal }) => discoveryApi.books(query, signal),
        placeholderData: keepPreviousData,
        networkMode: 'always',
        staleTime: 0,
    });
    const meta = listing.data?.meta;
    const books = listing.data?.data;
    const loading = listing.isPending || (listing.isPlaceholderData && !books?.length);
    useEffect(() => {
        if (
            !listing.isPlaceholderData &&
            !listing.isFetching &&
            meta &&
            query.page > Math.max(1, meta.totalPages)
        )
            setParams(
                (current) =>
                    updateDiscoverySearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
    }, [listing.isPlaceholderData, listing.isFetching, meta, query.page, setParams]);

    const languageLabel = query.language
        ? bookLanguageOptions(query.language).find((item) => item.value === query.language)?.label
        : undefined;
    const filters = [
        { key: 'topic', label: query.topic },
        { key: 'language', label: languageLabel },
        { key: 'age', label: query.age === undefined ? undefined : `${query.age} tuổi` },
    ].filter((filter) => filter.label !== undefined);
    const filtered = Boolean(query.q || filters.length);
    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const changes = {
            topic: String(form.get('topic') ?? '').trim(),
            language:
                languageChoice === CUSTOM_LANGUAGE
                    ? String(form.get('languageCode') ?? '').trim()
                    : languageChoice,
            age: String(form.get('age') ?? '').trim(),
        };
        setParams((current) => updateDiscoverySearch(current, changes), {
            preventScrollReset: true,
        });
        setFiltersOpen(false);
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
                <SearchFilter
                    ref={searchInput}
                    className="min-w-0 basis-full sm:flex-1 sm:basis-auto"
                    name="q"
                    aria-label="Tìm theo tên sách"
                    maxLength={100}
                    value={query.q || ''}
                    placeholder="Tìm theo tên sách"
                />
                <SelectFilter
                    name="sort"
                    aria-label="Sắp xếp sách"
                    className="mt-0 min-w-0 flex-1 sm:w-44 sm:flex-none"
                    value={query.sort}
                    options={[
                        { value: 'newest', label: 'Mới xuất bản' },
                        { value: 'popular', label: 'Đọc nhiều' },
                    ]}
                />
                <Popover
                    open={filtersOpen}
                    onOpenChange={(open) => {
                        if (open) {
                            setTopic(query.topic || '');
                            setLanguageChoice(query.language || '');
                        }
                        setFiltersOpen(open);
                    }}
                >
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            className="min-h-[var(--control-height)] border-input bg-surface font-normal text-[length:var(--text-md)] hover:not-disabled:border-[var(--border-input-hover)] data-[state=open]:border-[var(--border-input-hover)] data-[state=open]:bg-hover"
                        >
                            <SlidersHorizontal
                                className="size-4 text-muted-foreground"
                                data-icon="inline-start"
                            />
                            Bộ lọc{filters.length > 0 && ` (${filters.length})`}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        sideOffset={8}
                        aria-label="Bộ lọc sách"
                        className="max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-32px)] gap-4 overflow-y-auto overscroll-contain p-4"
                    >
                        <form onSubmit={applyFilters}>
                            <FieldGroup className="gap-4 [&_[data-slot=select-trigger]]:mt-0 [&_input]:mt-0">
                                <BookTopicField
                                    id="explore-topic"
                                    name="topic"
                                    emptyLabel="Tất cả chủ đề"
                                    value={topic}
                                    disabled={false}
                                    onChange={setTopic}
                                />
                                <Field>
                                    <FieldLabel htmlFor="explore-language">Ngôn ngữ</FieldLabel>
                                    <FormSelect
                                        id="explore-language"
                                        value={languageChoice}
                                        onValueChange={setLanguageChoice}
                                        options={[
                                            { value: '', label: 'Tất cả ngôn ngữ' },
                                            ...(query.language
                                                ? bookLanguageOptions(query.language)
                                                : BOOK_LANGUAGES),
                                            { value: CUSTOM_LANGUAGE, label: 'Ngôn ngữ khác…' },
                                        ]}
                                    />
                                </Field>
                                {languageChoice === CUSTOM_LANGUAGE && (
                                    <Field>
                                        <FieldLabel htmlFor="explore-language-code">
                                            Mã ngôn ngữ
                                        </FieldLabel>
                                        <Input
                                            id="explore-language-code"
                                            name="languageCode"
                                            pattern="[a-z]{2}(-[A-Z]{2})?"
                                            placeholder="Ví dụ: en-US"
                                            required
                                        />
                                    </Field>
                                )}
                                <Field>
                                    <FieldLabel htmlFor="explore-age">Độ tuổi</FieldLabel>
                                    <Input
                                        id="explore-age"
                                        name="age"
                                        type="number"
                                        min={0}
                                        max={BOOK_AGE_MAX}
                                        step={1}
                                        defaultValue={query.age}
                                        placeholder="Tất cả độ tuổi"
                                    />
                                </Field>
                                <Button type="submit">Áp dụng bộ lọc</Button>
                            </FieldGroup>
                        </form>
                    </PopoverContent>
                </Popover>
            </div>
            {filters.length > 0 && (
                <fieldset
                    className="m-0 mt-3 flex min-w-0 flex-wrap gap-2 border-0 p-0"
                    aria-label="Bộ lọc đang áp dụng"
                >
                    {filters.map(({ key, label }) => (
                        <Button
                            key={key}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-auto min-h-8 whitespace-normal text-left"
                            aria-label={`Bỏ bộ lọc ${label}`}
                            onClick={() => {
                                setParams(
                                    (current) =>
                                        updateDiscoverySearch(current, { [key]: undefined }),
                                    { preventScrollReset: true },
                                );
                            }}
                        >
                            {label}
                            <X data-icon="inline-end" />
                        </Button>
                    ))}
                    {(filters.length > 1 || query.q) && (
                        <Button size="sm" variant="ghost" asChild>
                            <Link to="/library" state={{ resetFilters: true }}>
                                Xóa bộ lọc
                            </Link>
                        </Button>
                    )}
                </fieldset>
            )}
            <section
                ref={results}
                tabIndex={-1}
                aria-labelledby="explore-results"
                className="mt-5 scroll-mt-24 outline-none sm:mt-7"
            >
                <h2 id="explore-results" className="sr-only">
                    Kết quả tìm kiếm sách
                </h2>
                <p role="status" className="sr-only">
                    {listing.isFetching
                        ? 'Đang cập nhật…'
                        : meta && `${meta.total.toLocaleString('vi-VN')} cuốn sách`}
                </p>
                {loading ? (
                    <PublicBooksSkeleton />
                ) : listing.isError ? (
                    <Empty className="min-h-64 bg-muted px-5 py-12">
                        <EmptyHeader>
                            <EmptyTitle>
                                <h3>Chưa tải được sách</h3>
                            </EmptyTitle>
                        </EmptyHeader>
                        <Feedback error={errorMessage(listing.error)} />
                        <EmptyContent>
                            <Button type="button" onClick={() => void listing.refetch()}>
                                Thử tải lại
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : books?.length ? (
                    <div
                        className={
                            listing.isPlaceholderData
                                ? undefined
                                : 'motion-safe:fade-in-60 motion-safe:animate-in motion-safe:duration-200'
                        }
                        aria-busy={listing.isFetching}
                    >
                        <PublicBooks books={books} />
                    </div>
                ) : (
                    <Empty className="gap-5 px-4 py-9 sm:py-12">
                        <EmptyHeader className="gap-2">
                            <EmptyMedia
                                variant="icon"
                                className="mb-2 size-12 rounded-xl"
                                aria-hidden="true"
                            >
                                {filtered ? (
                                    <SearchX className="size-6" />
                                ) : (
                                    <BookOpen className="size-6" />
                                )}
                            </EmptyMedia>
                            <EmptyTitle>
                                <h3>
                                    {filtered
                                        ? 'Chưa tìm thấy sách phù hợp'
                                        : 'Thư viện chưa có sách công khai'}
                                </h3>
                            </EmptyTitle>
                            <EmptyDescription className="wrap-anywhere">
                                {query.q ? (
                                    <>
                                        Không có kết quả cho <strong>“{query.q}”</strong>
                                        {filters.length > 0 ? ' với bộ lọc hiện tại.' : '.'}
                                    </>
                                ) : filtered ? (
                                    'Thử bỏ bộ lọc để xem thêm sách.'
                                ) : (
                                    'Sách công khai sẽ xuất hiện tại đây sau khi được xuất bản.'
                                )}
                            </EmptyDescription>
                        </EmptyHeader>
                        {filtered && (
                            <EmptyContent className="max-w-none flex-row flex-wrap justify-center">
                                {query.q && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            searchInput.current?.focus();
                                            searchInput.current?.select();
                                        }}
                                    >
                                        Đổi từ khóa
                                    </Button>
                                )}
                                {filters.length > 0 && (
                                    <Button
                                        type="button"
                                        variant={query.q ? 'ghost' : 'secondary'}
                                        onClick={() => {
                                            setParams(
                                                (current) =>
                                                    updateDiscoverySearch(current, {
                                                        age: undefined,
                                                        language: undefined,
                                                        topic: undefined,
                                                    }),
                                                { preventScrollReset: true },
                                            );
                                            searchInput.current?.focus({ preventScroll: true });
                                        }}
                                    >
                                        Bỏ bộ lọc
                                    </Button>
                                )}
                            </EmptyContent>
                        )}
                    </Empty>
                )}
                {meta && meta.totalPages > 1 && (
                    <Pagination
                        page={query.page}
                        totalPages={meta.totalPages}
                        busy={listing.isFetching}
                        label="Phân trang thư viện"
                        className="mt-8 justify-center sm:justify-center"
                        onPage={(page) => {
                            setParams(
                                (current) => updateDiscoverySearch(current, { page: String(page) }),
                                { preventScrollReset: true },
                            );
                            results.current?.focus({ preventScroll: true });
                            results.current?.scrollIntoView({ block: 'start' });
                        }}
                    />
                )}
            </section>
        </>
    );
}
