import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Box, Info, Plus, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/primitives/dialog';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/shared/ui/primitives/input-group';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset } from '../../../shared/contracts/dto.schema';
import type { AssetType } from '../../../shared/contracts/enums.schema';
import { formatBytes } from '../../../shared/lib/format';
import { Feedback } from '../../../shared/ui/Feedback';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
} from '../../assets';
import { flattenAssetPages } from '../../assets/model/asset-pages';
import { useAuth } from '../../auth';
import { importHint } from '../model/import-asset';
import { AssetDeleteDialog } from './AssetDeleteDialog';
import { AssetMediaPreview } from './AssetMediaPreview';
import { AssetUploadView } from './AssetUploadView';

export function AssetPicker({
    type,
    onChoose,
    onClose,
    usedAssetIds = [],
}: {
    type: AssetType;
    usedAssetIds?: string[];
    onChoose: (asset: Asset) => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const [removing, setRemoving] = useState<Asset | null>(null),
        [addingId, setAddingId] = useState<string | null>(null);
    const [scope, setScope] = useState<'mine' | 'library'>('library');
    const [search, setSearch] = useState(''),
        [query, setQuery] = useState('');
    const [categoryId, setCategoryId] = useState(''),
        [hasAnimation, setHasAnimation] = useState(false);
    const [mode, setMode] = useState<'library' | 'upload'>('library'),
        [preview, setPreview] = useState<Asset | null>(null);
    const [busy, setBusy] = useState(false),
        [uploadBusy, setUploadBusy] = useState(false),
        [error, setError] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null),
        backFocus = useRef<HTMLElement | null>(null),
        opener = useRef(document.activeElement as HTMLElement | null),
        header = useRef<HTMLHeadingElement>(null),
        closeButton = useRef<HTMLButtonElement>(null),
        libraryScroll = useRef<HTMLDivElement>(null),
        scrollPosition = useRef(0),
        scrollFilter = useRef('');
    const blocked = busy || uploadBusy || Boolean(removing);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        if (mode === 'upload' || preview) header.current?.focus();
    }, [mode, preview]);
    useEffect(() => {
        const next = search.trim();
        if (next === query) return;
        const timer = setTimeout(() => setQuery(next), 300);
        return () => clearTimeout(timer);
    }, [search, query]);
    function clearSearch() {
        setSearch('');
        setQuery('');
    }
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
    const input = {
        scope,
        type,
        q: query || undefined,
        categoryId: categoryId || undefined,
        hasAnimation: type === 'MODEL' && hasAnimation ? true : undefined,
        limit: 12,
    };
    const list = useInfiniteQuery({
        queryKey: assetKeys.list(user?.id || '', { ...input, pagination: 'load-more' }),
        queryFn: ({ signal, pageParam }) => assetsApi.list({ ...input, page: pageParam }, signal),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.data.length > 0 && last.meta.page < last.meta.totalPages
                ? last.meta.page + 1
                : undefined,
        enabled: mode === 'library',
        refetchOnWindowFocus: true,
        refetchInterval: (query) =>
            query.state.data?.pages.some((page) =>
                page.data.some((asset) => asset.status === 'PROCESSING'),
            )
                ? 3000
                : false,
    });
    const assets = flattenAssetPages(list.data?.pages ?? []);
    const total = list.data?.pages.at(-1)?.meta.total ?? 0;
    const filterKey = [scope, type, categoryId, hasAnimation, query].join(':');
    useEffect(() => {
        if (scrollFilter.current === filterKey) return;
        scrollFilter.current = filterKey;
        scrollPosition.current = 0;
        if (libraryScroll.current) libraryScroll.current.scrollTop = 0;
    }, [filterKey]);
    async function loadMore() {
        if (blocked || search.trim() !== query || list.isFetching || !list.hasNextPage) return;
        await list.fetchNextPage({ cancelRefetch: false });
    }
    async function choose(asset: Asset) {
        if (controller.current || blocked || asset.status !== 'READY') return;
        const active = new AbortController();
        controller.current = active;
        setBusy(true);
        setAddingId(asset.id);
        setError(null);
        try {
            const fresh = await assetsApi.detail(asset.id, active.signal);
            active.signal.throwIfAborted();
            if (fresh.type !== type || fresh.status !== 'READY')
                throw new Error(
                    'Tài nguyên chưa sẵn sàng. Hãy kiểm tra lại trạng thái hoặc chọn tệp khác.',
                );
            onChoose(fresh);
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (!active.signal.aborted) {
                controller.current = null;
                setBusy(false);
                setAddingId(null);
            }
        }
    }
    function openUpload() {
        scrollPosition.current = libraryScroll.current?.scrollTop ?? 0;
        backFocus.current = document.activeElement as HTMLElement;
        setError(null);
        setMode('upload');
        setPreview(null);
    }
    function back() {
        setPreview(null);
        setMode('library');
        setError(null);
        requestAnimationFrame(() => {
            if (libraryScroll.current) libraryScroll.current.scrollTop = scrollPosition.current;
            if (backFocus.current?.isConnected) backFocus.current.focus({ preventScroll: true });
            else closeButton.current?.focus();
        });
    }
    const title =
        mode === 'upload'
            ? type === 'MODEL'
                ? 'Tải mô hình 3D'
                : `Tải ${assetTypeLabels[type].toLowerCase()}`
            : preview
              ? preview.name
              : type === 'MODEL'
                ? 'Thư viện 3D'
                : `Thư viện ${assetTypeLabels[type].toLowerCase()}`;
    const content = (
        <>
            <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-4 bg-surface py-3">
                <Field className="min-w-56 max-w-96 flex-1">
                    <FieldLabel htmlFor="scene-asset-search" className="sr-only">
                        Tìm tài nguyên
                    </FieldLabel>
                    <InputGroup>
                        <InputGroupInput
                            id="scene-asset-search"
                            type="search"
                            placeholder="Tìm theo tên tài nguyên…"
                            maxLength={100}
                            value={search}
                            disabled={blocked}
                            className="[&::-webkit-search-cancel-button]:appearance-none"
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    setQuery(search.trim());
                                }
                            }}
                        />
                        <InputGroupAddon align="inline-start">
                            <Search aria-hidden="true" />
                        </InputGroupAddon>
                        {(search || (list.isFetching && !list.isFetchingNextPage)) && (
                            <InputGroupAddon align="inline-end">
                                {(search.trim() !== query ||
                                    (list.isFetching && !list.isFetchingNextPage)) && (
                                    <Spinner aria-hidden="true" />
                                )}
                                {search && (
                                    <InputGroupButton
                                        size="icon-xs"
                                        aria-label="Xóa từ khóa"
                                        disabled={blocked}
                                        onClick={clearSearch}
                                    >
                                        <X />
                                    </InputGroupButton>
                                )}
                            </InputGroupAddon>
                        )}
                    </InputGroup>
                </Field>
                <Field className="w-60 shrink-0">
                    <FieldLabel className="sr-only" htmlFor="scene-asset-category">
                        Danh mục
                    </FieldLabel>
                    <FormSelect
                        id="scene-asset-category"
                        className="m-0"
                        value={categoryId}
                        disabled={blocked}
                        onValueChange={(value) => {
                            setCategoryId(value);
                        }}
                        options={[
                            { value: '', label: 'Tất cả danh mục' },
                            ...(categories.data?.map((category) => ({
                                value: category.id,
                                label: category.name,
                            })) ?? []),
                        ]}
                    />
                </Field>
                <div className="ml-auto flex items-center gap-4">
                    {type === 'MODEL' && (
                        <Field orientation="horizontal">
                            <Checkbox
                                id="scene-asset-animation"
                                checked={hasAnimation}
                                disabled={blocked}
                                onCheckedChange={(checked) => {
                                    setHasAnimation(checked === true);
                                }}
                            />
                            <FieldLabel
                                className="flex items-center gap-2"
                                htmlFor="scene-asset-animation"
                            >
                                Có animation
                            </FieldLabel>
                        </Field>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Làm mới thư viện"
                        disabled={blocked || list.isFetching}
                        onClick={() => void list.refetch()}
                    >
                        <RefreshCw />
                    </Button>
                </div>
            </div>
            {categories.isError && (
                <p className="mb-4 text-muted-foreground text-xs">
                    Chưa tải được danh mục. Bạn vẫn có thể chọn tài nguyên trong danh sách.
                </p>
            )}
            {scope === 'mine' && (
                <Button
                    variant="secondary"
                    className="mb-4 w-full py-3"
                    disabled={blocked}
                    onClick={openUpload}
                >
                    <Upload data-icon="inline-start" />
                    {type === 'MODEL' ? 'Tải mô hình 3D của bạn' : 'Tải tài nguyên từ máy'}
                    <span className="ml-3 font-normal text-xs">{importHint[type]}</span>
                </Button>
            )}
            {list.isPending && (
                <div
                    role="status"
                    aria-label="Đang tải tài nguyên…"
                    className="grid grid-cols-4 gap-5"
                >
                    {['first', 'second', 'third', 'fourth'].map((id) => (
                        <div key={id} className="flex min-w-0 flex-col gap-3" aria-hidden="true">
                            <Skeleton className="h-[clamp(64px,14dvh,126px)] w-full rounded-xl" />
                            <Skeleton className="h-4 w-4/5" />
                            <Skeleton className="h-3 w-2/5" />
                        </div>
                    ))}
                </div>
            )}
            {list.isError && !list.data && (
                <Empty>
                    <EmptyHeader>
                        <EmptyTitle>Chưa tải được thư viện</EmptyTitle>
                        <EmptyDescription>{errorMessage(list.error)}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button variant="secondary" onClick={() => void list.refetch()}>
                            Thử lại
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
            {list.data && assets.length === 0 && (
                <Empty className="min-h-0 py-5">
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className="size-16 rounded-2xl">
                            <Box className="size-8" strokeWidth={1.5} aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                            {query || categoryId || hasAnimation
                                ? 'Không tìm thấy tài nguyên phù hợp'
                                : scope === 'mine'
                                  ? 'Bạn chưa có tài nguyên nào'
                                  : 'Thư viện chưa có tài nguyên loại này'}
                        </EmptyTitle>
                        <EmptyDescription>
                            {query || categoryId || hasAnimation
                                ? query
                                    ? `Không có kết quả cho “${query}”. Thử từ khóa khác hoặc điều chỉnh bộ lọc.`
                                    : 'Chọn danh mục khác hoặc xóa bộ lọc để xem thêm.'
                                : scope === 'mine'
                                  ? 'Tải tệp của bạn để bắt đầu thêm nội dung vào trang sách.'
                                  : 'Thử lại sau hoặc mở Tài nguyên của tôi để dùng tệp của bạn.'}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        {query || categoryId || hasAnimation ? (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    clearSearch();
                                    setCategoryId('');
                                    setHasAnimation(false);
                                }}
                            >
                                {query && !categoryId && !hasAnimation
                                    ? 'Xóa tìm kiếm'
                                    : 'Xóa bộ lọc'}
                            </Button>
                        ) : scope === 'mine' ? (
                            <Button onClick={openUpload}>
                                <Upload data-icon="inline-start" />
                                Tải tệp đầu tiên
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setScope('mine');
                                }}
                            >
                                Xem tài nguyên của tôi
                            </Button>
                        )}
                    </EmptyContent>
                </Empty>
            )}
            {list.data && assets.length > 0 && (
                <ul
                    className="m-0 grid list-none grid-cols-4 gap-x-5 gap-y-4 p-0"
                    aria-label="Danh sách tài nguyên"
                >
                    {assets.map((asset) => (
                        <Card key={asset.id} asChild size="sm" className="min-w-0 gap-0 py-0">
                            <li data-asset-id={asset.id} className="min-w-0">
                                <Button
                                    variant="plain"
                                    className="group flex w-full flex-col gap-0 text-left disabled:opacity-100"
                                    disabled={blocked || asset.status !== 'READY'}
                                    aria-label={`Xem ${asset.name}`}
                                    onClick={() => {
                                        scrollPosition.current =
                                            libraryScroll.current?.scrollTop ?? 0;
                                        backFocus.current = document.activeElement as HTMLElement;
                                        setPreview(asset);
                                        setError(null);
                                    }}
                                >
                                    <CardContent asChild className="w-full px-0">
                                        <span className="relative block h-[clamp(64px,14dvh,126px)] w-full overflow-hidden rounded-t-xl [&_img]:transition-transform motion-safe:group-hover:[&_img]:scale-[1.03]">
                                            <AssetThumbnail asset={asset} variant="card" />
                                            {asset.status === 'READY' &&
                                            asset.meta.animations?.length ? (
                                                <Badge
                                                    variant="secondary"
                                                    className="absolute top-2 left-2"
                                                >
                                                    Animation
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </CardContent>
                                    <CardHeader asChild className="w-full pt-2 pb-1">
                                        <span>
                                            <CardTitle asChild>
                                                <strong
                                                    className="block w-full truncate"
                                                    title={asset.name}
                                                >
                                                    {asset.name}
                                                </strong>
                                            </CardTitle>
                                        </span>
                                    </CardHeader>
                                </Button>
                                <CardFooter className="min-h-8 gap-1 px-3 pb-2">
                                    <span className="min-w-0 flex-1 text-muted-foreground text-xs">
                                        {formatBytes(asset.sizeBytes)}
                                        {asset.status !== 'READY' &&
                                            ` · ${assetStatusLabels[asset.status]}`}
                                    </span>
                                    {asset.status === 'FAILED' && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    disabled={blocked}
                                                    aria-label={`Xem lỗi ${asset.name}`}
                                                    title="Xem nguyên nhân"
                                                >
                                                    <Info />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                side="top"
                                                align="end"
                                                sideOffset={8}
                                                className="w-80 gap-3 p-4"
                                                aria-label="Chi tiết lỗi xử lý"
                                                onEscapeKeyDown={(event) => event.stopPropagation()}
                                            >
                                                <PopoverHeader>
                                                    <PopoverTitle>
                                                        Không xử lý được tài nguyên
                                                    </PopoverTitle>
                                                    <PopoverDescription>
                                                        {asset.error ||
                                                            'Tệp chưa xử lý thành công. Hãy kiểm tra định dạng và nội dung rồi tải một bản khác.'}
                                                    </PopoverDescription>
                                                </PopoverHeader>
                                                {scope === 'mine' && asset.scope === 'mine' ? (
                                                    <>
                                                        <p className="text-muted-foreground text-xs">
                                                            Bạn có thể xóa tài nguyên lỗi và tải một
                                                            tệp khác.
                                                        </p>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={openUpload}
                                                        >
                                                            <Upload data-icon="inline-start" />
                                                            Tải tệp khác
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <p className="text-muted-foreground text-xs">
                                                        Hãy chọn tài nguyên khác trong thư viện.
                                                    </p>
                                                )}
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={`Thêm ${asset.name} vào trang`}
                                        title={
                                            asset.status === 'READY'
                                                ? 'Thêm vào trang'
                                                : assetStatusLabels[asset.status]
                                        }
                                        disabled={blocked || asset.status !== 'READY'}
                                        onClick={() => void choose(asset)}
                                    >
                                        {busy && addingId === asset.id ? <Spinner /> : <Plus />}
                                    </Button>
                                    {scope === 'mine' && asset.scope === 'mine' && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label={`Xóa ${asset.name}`}
                                            title={
                                                asset.status === 'PROCESSING'
                                                    ? assetStatusLabels[asset.status]
                                                    : usedAssetIds.includes(asset.id)
                                                      ? 'Tài nguyên đang được dùng trong trang này'
                                                      : 'Xóa tài nguyên'
                                            }
                                            disabled={
                                                blocked ||
                                                asset.status === 'PROCESSING' ||
                                                usedAssetIds.includes(asset.id)
                                            }
                                            onClick={() => setRemoving(asset)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    )}
                                </CardFooter>
                            </li>
                        </Card>
                    ))}
                </ul>
            )}
            {list.data && assets.length > 0 && (list.hasNextPage || list.isError) && (
                <section
                    className="flex flex-col items-center gap-3 py-6"
                    aria-label="Tải thêm tài nguyên"
                >
                    {list.isError && <Feedback error={errorMessage(list.error)} />}
                    {list.hasNextPage && (
                        <Button
                            variant="secondary"
                            disabled={blocked || search.trim() !== query || list.isFetching}
                            aria-busy={list.isFetchingNextPage}
                            onClick={() => void loadMore()}
                        >
                            {list.isFetchingNextPage ? (
                                <Spinner />
                            ) : (
                                <Plus data-icon="inline-start" />
                            )}
                            {list.isFetchingNextPage
                                ? 'Đang tải thêm…'
                                : list.isFetchNextPageError
                                  ? 'Thử tải thêm'
                                  : 'Tải thêm'}
                        </Button>
                    )}
                </section>
            )}
        </>
    );
    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open && !blocked) onClose();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    aria-describedby={undefined}
                    className="scene-asset-picker flex h-[min(820px,calc(100dvh-48px))] w-[min(1240px,calc(100vw-64px))] max-w-none flex-col overflow-hidden p-0 [&_[data-slot=field-label]]:m-0 [&_[data-slot=input]]:m-0"
                    onCloseAutoFocus={(event) => {
                        if (opener.current?.isConnected) {
                            event.preventDefault();
                            opener.current.focus({ preventScroll: true });
                        }
                    }}
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => {
                        if (blocked) event.preventDefault();
                    }}
                >
                    <header className="flex shrink-0 items-center gap-3 border-border border-b px-6 py-3">
                        <DialogTitle
                            ref={header}
                            tabIndex={-1}
                            className="m-0 flex min-h-10 min-w-0 flex-1 items-center leading-normal outline-none"
                        >
                            <span className="block truncate">{title}</span>
                        </DialogTitle>
                        <Button
                            ref={closeButton}
                            variant="ghost"
                            size="icon"
                            aria-label="Đóng chọn tài nguyên"
                            disabled={blocked}
                            onClick={onClose}
                        >
                            <X />
                        </Button>
                    </header>
                    {error && (
                        <div className="shrink-0 px-6 pt-4">
                            <Feedback error={error} />
                        </div>
                    )}
                    {mode === 'upload' ? (
                        <AssetUploadView
                            type={type}
                            pending={busy}
                            onChoose={(asset) => void choose(asset)}
                            onBusyChange={setUploadBusy}
                            onBack={() => {
                                scrollPosition.current = 0;
                                clearSearch();
                                setScope('mine');

                                setCategoryId('');
                                setHasAnimation(false);

                                back();
                            }}
                        />
                    ) : preview ? (
                        <>
                            <div className="min-h-0 flex-1 px-6 py-4">
                                <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_280px] grid-rows-[minmax(0,1fr)] gap-6">
                                    <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-background">
                                        <AssetMediaPreview type={type} url={preview.url} />
                                    </div>
                                    <div className="flex flex-col gap-5 py-3">
                                        <h3 className="break-words font-semibold text-lg">
                                            {preview.name}
                                        </h3>
                                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
                                            <dt className="text-muted-foreground">Định dạng</dt>
                                            <dd>{preview.format.toUpperCase()}</dd>
                                            <dt className="text-muted-foreground">Dung lượng</dt>
                                            <dd>{formatBytes(preview.sizeBytes)}</dd>
                                            <dt className="text-muted-foreground">Trạng thái</dt>
                                            <dd>{assetStatusLabels[preview.status]}</dd>
                                            {preview.authorName && (
                                                <>
                                                    <dt className="text-muted-foreground">
                                                        Tác giả
                                                    </dt>
                                                    <dd>{preview.authorName}</dd>
                                                </>
                                            )}
                                            {preview.license && (
                                                <>
                                                    <dt className="text-muted-foreground">
                                                        Giấy phép
                                                    </dt>
                                                    <dd>{preview.license}</dd>
                                                </>
                                            )}
                                        </dl>
                                        {preview.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {preview.tags.map((tag) => (
                                                    <Badge variant="secondary" key={tag}>
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                        {preview.status !== 'READY' && (
                                            <p className="text-muted-foreground text-sm">
                                                Tài nguyên này chưa sẵn sàng để thêm. Về thư viện để
                                                kiểm tra trạng thái mới nhất.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <footer className="flex shrink-0 items-center justify-between border-border border-t px-6 py-3">
                                <Button variant="ghost" disabled={blocked} onClick={back}>
                                    Quay lại
                                </Button>
                                <div className="ml-auto flex items-center gap-3">
                                    {scope === 'mine' && preview.scope === 'mine' && (
                                        <Button
                                            variant="ghost"
                                            disabled={
                                                blocked ||
                                                preview.status === 'PROCESSING' ||
                                                usedAssetIds.includes(preview.id)
                                            }
                                            title={
                                                preview.status === 'PROCESSING'
                                                    ? assetStatusLabels[preview.status]
                                                    : usedAssetIds.includes(preview.id)
                                                      ? 'Tài nguyên đang được dùng trong trang này'
                                                      : 'Xóa tài nguyên'
                                            }
                                            onClick={() => setRemoving(preview)}
                                        >
                                            <Trash2 data-icon="inline-start" />
                                            Xóa tài nguyên
                                        </Button>
                                    )}
                                    <Button
                                        disabled={blocked || preview.status !== 'READY'}
                                        onClick={() => void choose(preview)}
                                    >
                                        {busy ? <Spinner /> : <Plus data-icon="inline-start" />}Thêm
                                        vào trang
                                    </Button>
                                </div>
                            </footer>
                        </>
                    ) : (
                        <>
                            <Tabs
                                value={scope}
                                onValueChange={(value) => {
                                    setScope(value as 'mine' | 'library');

                                    setError(null);
                                }}
                                className="min-h-0 flex-1 gap-0"
                            >
                                <div className="shrink-0 px-6">
                                    <TabsList variant="line" aria-label="Nguồn tài nguyên">
                                        <TabsTrigger
                                            className="flex-none"
                                            value="library"
                                            disabled={blocked}
                                        >
                                            Thư viện chung
                                        </TabsTrigger>
                                        <TabsTrigger
                                            className="flex-none"
                                            value="mine"
                                            disabled={blocked}
                                        >
                                            Tài nguyên của tôi
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <div
                                    ref={libraryScroll}
                                    className="min-h-0 flex-1 overflow-y-auto px-6 pb-3 [overflow-anchor:none] [overscroll-behavior:contain]"
                                >
                                    {(['library', 'mine'] as const).map((value) => (
                                        <TabsContent
                                            key={value}
                                            value={value}
                                            className="flex min-h-full flex-col"
                                        >
                                            {scope === value && content}
                                        </TabsContent>
                                    ))}
                                </div>
                            </Tabs>
                            <footer className="flex shrink-0 items-center justify-center border-border border-t px-6 py-3">
                                <p
                                    role="status"
                                    aria-live="polite"
                                    className="text-muted-foreground text-xs tabular-nums"
                                >
                                    {list.data
                                        ? `Đã hiển thị ${assets.length} / ${total} tài nguyên`
                                        : list.isPending
                                          ? 'Đang tải tài nguyên…'
                                          : 'Chưa tải được danh sách tài nguyên'}
                                </p>
                            </footer>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            {removing && (
                <AssetDeleteDialog
                    asset={removing}
                    returnFocus={closeButton.current}
                    onClose={() => setRemoving(null)}
                    onRemoved={() => {
                        if (preview?.id === removing.id) setPreview(null);
                        setRemoving(null);
                        setError(null);
                    }}
                />
            )}{' '}
        </>
    );
}
