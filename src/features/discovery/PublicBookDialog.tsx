import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
    BookOpen,
    BookX,
    Copy,
    FileText,
    Globe2,
    RotateCcw,
    ScanLine,
    Smile,
    UserRound,
    X,
} from 'lucide-react';
import { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { readAuthMode } from '@/features/auth/model/dialog';
import { bookLanguageOptions } from '@/features/books/model/languages';
import { errorMessage } from '@/shared/api/errors';
import { SlugSchema } from '@/shared/contracts/common.schema';
import type { PublicBook } from '@/shared/contracts/dto.schema';
import { formatBytes, formatDate } from '@/shared/lib/format';
import { Alert } from '@/shared/ui/Alert';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { PdfReaderButton } from '@/shared/ui/pdf-reader/PdfReaderButton';
import { Avatar, AvatarFallback } from '@/shared/ui/primitives/avatar';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { discoveryApi } from '.';
import { publishedReaderUrl } from './api';
import { PublicBookQr } from './PublicBookQr';
import { publicBookAgeLabel, publicBookInfoUrl, withoutPublicBookInfo } from './public-book-info';

const informationLayout =
    'grid min-h-0 min-w-0 flex-1 grid-rows-[auto_1fr_auto] overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[auto_auto] md:[@media(min-height:400px)]:grid-rows-[minmax(0,1fr)_auto] md:[@media(min-height:400px)]:overflow-hidden';
const coverPanel =
    'relative isolate grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 overflow-clip bg-muted px-4 pt-16 pb-5 sm:px-6 md:row-span-2 md:flex md:flex-col md:items-stretch md:gap-6 md:p-7';
const detailsPanel =
    'flex min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 md:min-h-0 md:px-8 md:pt-7 md:pb-4 md:[@media(min-height:400px)]:overflow-y-auto';

export function PublicBookDialog() {
    const location = useLocation();
    const navigate = useNavigate();
    const slug = new URLSearchParams(location.search).get('book');
    const supported =
        location.pathname === '/library' || /^\/authors\/[^/]+$/.test(location.pathname);
    if (slug === null || !supported || readAuthMode(location.search)) return null;
    function close() {
        const destination = withoutPublicBookInfo(location);
        if (location.state?.publicBookReturnTo === destination && window.history.state?.idx > 0)
            navigate(-1);
        else navigate(destination, { replace: true, preventScrollReset: true });
    }
    return <BookDialog key={slug} slug={slug} onClose={close} />;
}

function BookDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
    const opener = useRef(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
    );
    const valid = SlugSchema.safeParse(slug).success;
    const detail = useQuery({
        queryKey: ['discovery', 'book', slug],
        queryFn: ({ signal }) => discoveryApi.book(slug, signal),
        enabled: valid,
        networkMode: 'always',
        staleTime: 0,
        retry: false,
    });
    const unavailable =
        !valid ||
        (isAxiosError(detail.error) && [404, 410].includes(detail.error.response?.status || 0));
    const book = detail.isSuccess ? detail.data : null;
    async function copyLink() {
        try {
            await navigator.clipboard.writeText(publicBookInfoUrl(window.location.origin, slug));
            toast.success('Đã sao chép liên kết thông tin sách.');
        } catch {
            toast.error('Chưa sao chép được liên kết. Vui lòng thử lại.');
        }
    }
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="flex h-[min(760px,calc(100dvh-32px))] max-w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden p-0 md:h-[min(520px,calc(100dvh-32px))]"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    if (event.target instanceof HTMLElement) event.target.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
                }}
            >
                <DialogDescription className="sr-only">
                    Xem giới thiệu và thông tin trước khi mở sách để đọc.
                </DialogDescription>
                {book ? (
                    <BookInformation book={book} onCopy={() => void copyLink()} />
                ) : unavailable || detail.isError ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6">
                        <DialogTitle className="px-1 pr-12">Thông tin sách</DialogTitle>
                        <Empty className="min-h-64 border-0 p-4">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    {unavailable ? (
                                        <BookX aria-hidden="true" />
                                    ) : (
                                        <BookOpen aria-hidden="true" />
                                    )}
                                </EmptyMedia>
                                <EmptyTitle>
                                    {unavailable
                                        ? 'Sách hiện không khả dụng'
                                        : 'Chưa tải được thông tin sách'}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {unavailable
                                        ? 'Sách có thể đã ngừng chia sẻ hoặc không còn tồn tại.'
                                        : errorMessage(detail.error)}
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                {unavailable ? (
                                    <DialogClose asChild>
                                        <Button variant="outline">Quay lại</Button>
                                    </DialogClose>
                                ) : (
                                    <Button variant="outline" onClick={() => void detail.refetch()}>
                                        <RotateCcw data-icon="inline-start" aria-hidden="true" />
                                        Thử lại
                                    </Button>
                                )}
                            </EmptyContent>
                        </Empty>
                    </div>
                ) : (
                    <BookInformationSkeleton />
                )}
                <DialogClose asChild>
                    <Button
                        variant="utility"
                        size="icon"
                        className="absolute top-4 right-4"
                        aria-label="Đóng thông tin sách"
                    >
                        <X aria-hidden="true" />
                    </Button>
                </DialogClose>
            </DialogContent>
        </Dialog>
    );
}

function BookInformation({ book, onCopy }: { book: PublicBook; onCopy: () => void }) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const openPdf = params.get('pdf') === '1';
    function closePdf() {
        if (!openPdf) return;
        params.delete('pdf');
        navigate(
            { pathname: location.pathname, search: `?${params}`, hash: location.hash },
            {
                replace: true,
                preventScrollReset: true,
                state: location.state,
            },
        );
    }
    const language =
        bookLanguageOptions(book.language).find((item) => item.value === book.language)?.label ||
        book.language;
    const facts = [
        { label: 'Số trang', value: book.pageCount.toLocaleString('vi-VN'), icon: FileText },
        { label: 'Trang có AR', value: book.arPageCount.toLocaleString('vi-VN'), icon: ScanLine },
        { label: 'Ngôn ngữ', value: language, icon: Globe2 },
        { label: 'Độ tuổi', value: publicBookAgeLabel(book), icon: Smile },
    ];
    return (
        <div className={informationLayout}>
            <div className={coverPanel}>
                {book.coverUrl && (
                    <img
                        key={book.coverUrl}
                        src={book.coverUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="pointer-events-none absolute inset-0 -z-10 size-full scale-110 object-cover opacity-40 blur-2xl"
                        onError={(event) => {
                            event.currentTarget.hidden = true;
                        }}
                    />
                )}
                <div className="my-auto flex min-w-0 shrink-0 justify-center">
                    <BookCoverImage
                        url={book.coverUrl}
                        alt={`Bìa ${book.title}`}
                        loading="eager"
                        className="h-auto max-h-44 w-auto max-w-full rounded-lg bg-transparent shadow-[0_16px_24px_-12px_#0008] md:max-h-[clamp(6rem,calc(100dvh-15rem),16rem)] md:max-w-48"
                    />
                </div>
                <PublicBookQr slug={book.slug} />
            </div>
            <div className={detailsPanel}>
                <header className="flex min-w-0 flex-col gap-2 pr-10">
                    <DialogTitle className="wrap-anywhere text-3xl leading-tight tracking-tight lg:text-4xl">
                        {book.title}
                    </DialogTitle>
                    <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground text-sm">
                        <Avatar className="size-7 shrink-0" aria-hidden="true">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {book.author.displayName
                                    .trim()
                                    .charAt(0)
                                    .toLocaleUpperCase('vi') || <UserRound className="size-4" />}
                            </AvatarFallback>
                        </Avatar>
                        <span className="wrap-anywhere min-w-0">
                            Tác giả{' '}
                            <Link
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                                to={`/authors/${book.author.id}`}
                            >
                                {book.author.displayName}
                            </Link>
                        </span>
                    </div>
                </header>
                <dl className="m-0 grid grid-cols-2 gap-2.5 sm:gap-3">
                    {facts.map(({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-xl border border-border px-2.5 py-2.5 sm:gap-x-3 sm:px-3.5 sm:py-3"
                        >
                            <Icon
                                className="col-start-1 row-span-2 size-8 rounded-lg bg-muted p-2 text-foreground sm:size-9"
                                aria-hidden="true"
                            />
                            <dt className="col-start-2 self-end text-muted-foreground text-xs">
                                {label}
                            </dt>
                            <dd className="wrap-anywhere col-start-2 m-0 self-start font-medium text-sm">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
                <section aria-label="Giới thiệu sách" className="flex min-w-0 flex-col gap-2">
                    <h3 className="m-0 font-semibold text-sm">Giới thiệu</h3>
                    <p className="m-0 whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                        {book.description?.trim() || 'Cuốn sách này chưa có mô tả.'}
                    </p>
                    <p className="m-0 mt-1 text-muted-foreground text-xs">
                        Cập nhật {formatDate(book.version.publishedAt)}
                        {book.downloadBytes > 0 &&
                            ` — Nội dung khoảng ${formatBytes(book.downloadBytes)}`}
                    </p>
                </section>
                {!book.printPdfUrl && openPdf && (
                    <Alert tone="info">Sách này hiện chưa có bản in PDF.</Alert>
                )}
            </div>
            <footer className="sticky bottom-0 flex min-w-0 flex-wrap items-center gap-2 bg-popover px-4 py-3 sm:gap-3 sm:px-6 md:static md:px-8 md:pt-1 md:pb-6">
                {book.printPdfUrl && (
                    <PdfReaderButton
                        url={book.printPdfUrl}
                        title={book.title}
                        defaultOpen={openPdf}
                        onOpenChange={(open) => {
                            if (!open) closePdf();
                        }}
                    />
                )}
                <Button
                    variant="outline"
                    className="max-lg:size-10 max-lg:p-2"
                    title="Sao chép liên kết"
                    onClick={onCopy}
                    aria-label="Sao chép liên kết thông tin sách"
                >
                    <Copy data-icon="inline-start" aria-hidden="true" />
                    <span className="max-lg:sr-only">Sao chép liên kết</span>
                </Button>
                <Button className="ml-auto max-sm:px-3" asChild>
                    <a
                        href={publishedReaderUrl(book.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <BookOpen data-icon="inline-start" aria-hidden="true" />
                        Trải nghiệm
                        <span className="sr-only"> trong tab mới</span>
                    </a>
                </Button>
            </footer>
        </div>
    );
}

function BookInformationSkeleton() {
    return (
        <div className={informationLayout} aria-busy="true">
            <DialogTitle className="sr-only">Thông tin sách</DialogTitle>
            <span role="status" className="sr-only">
                Đang tải thông tin sách…
            </span>
            <div className={coverPanel} aria-hidden="true">
                <Skeleton className="mx-auto aspect-[3/4] w-full max-w-44 rounded-lg" />
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className={detailsPanel} aria-hidden="true">
                <div className="flex flex-col gap-2 pr-10">
                    <Skeleton className="h-10 w-4/5" />
                    <Skeleton className="h-7 w-36" />
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-[62px] rounded-xl" />
                    ))}
                </div>
                <div className="grid gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                </div>
            </div>
            <div
                aria-hidden="true"
                className="flex justify-end px-4 py-3 sm:px-6 md:px-8 md:pt-1 md:pb-6"
            >
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
}
