import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { BookOpen, BookX, Copy, ExternalLink, FileDown, QrCode, RotateCcw, X } from 'lucide-react';
import { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { readAuthMode } from '@/features/auth/model/dialog';
import { bookLanguageOptions } from '@/features/books/model/languages';
import { errorMessage } from '@/shared/api/errors';
import { SlugSchema } from '@/shared/contracts/common.schema';
import type { PublicBook } from '@/shared/contracts/dto.schema';
import { formatBytes, formatDate } from '@/shared/lib/format';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/shared/ui/primitives/accordion';
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
                className="flex max-h-[calc(100dvh-32px)] max-w-[min(1040px,calc(100vw-32px))] flex-col overflow-hidden p-0"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
                }}
            >
                <header className="flex shrink-0 items-center justify-between gap-4 border-border border-b px-5 py-4 sm:px-6">
                    <DialogTitle className="m-0">Thông tin sách</DialogTitle>
                    <DialogDescription className="sr-only">
                        Xem giới thiệu và thông tin trước khi mở sách để đọc.
                    </DialogDescription>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" aria-label="Đóng thông tin sách">
                            <X />
                        </Button>
                    </DialogClose>
                </header>
                <div
                    className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6"
                    aria-busy={valid && detail.isPending}
                >
                    {unavailable ? (
                        <Empty className="min-h-64 border-0 p-4">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <BookX className="size-9" strokeWidth={1.5} />
                                </EmptyMedia>
                                <EmptyTitle>Sách hiện không khả dụng</EmptyTitle>
                                <EmptyDescription>
                                    Sách có thể đã ngừng chia sẻ hoặc không còn tồn tại. Bạn có thể
                                    quay lại Khám phá để chọn sách khác.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : detail.isError ? (
                        <Empty className="min-h-64 border-0 p-4">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <BookOpen className="size-9" strokeWidth={1.5} />
                                </EmptyMedia>
                                <EmptyTitle>Chưa tải được thông tin sách</EmptyTitle>
                                <EmptyDescription>{errorMessage(detail.error)}</EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button variant="outline" onClick={() => void detail.refetch()}>
                                    <RotateCcw data-icon="inline-start" />
                                    Thử lại
                                </Button>
                            </EmptyContent>
                        </Empty>
                    ) : book ? (
                        <BookInformation book={book} />
                    ) : (
                        <BookInformationSkeleton />
                    )}
                </div>
                <footer className="flex shrink-0 items-center justify-between gap-3 border-border border-t px-5 py-4 sm:px-6">
                    {book ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => void copyLink()}
                                aria-label="Sao chép liên kết thông tin sách"
                            >
                                <Copy data-icon="inline-start" />
                                <span className="max-sm:sr-only">Sao chép liên kết</span>
                            </Button>
                            <Button asChild>
                                <a
                                    href={publishedReaderUrl(book.slug)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <BookOpen data-icon="inline-start" />
                                    Mở sách
                                    <ExternalLink data-icon="inline-end" />
                                    <span className="sr-only"> trong tab mới</span>
                                </a>
                            </Button>
                        </>
                    ) : (
                        <>
                            {detail.isPending && valid && (
                                <p role="status" className="text-muted-foreground text-sm">
                                    Đang tải thông tin sách…
                                </p>
                            )}
                            <DialogClose asChild>
                                <Button variant="outline" className="ml-auto">
                                    Đóng
                                </Button>
                            </DialogClose>
                        </>
                    )}
                </footer>
            </DialogContent>
        </Dialog>
    );
}

function BookInformation({ book }: { book: PublicBook }) {
    const mobileQr = useRef<HTMLDivElement>(null);
    const language =
        bookLanguageOptions(book.language).find((item) => item.value === book.language)?.label ||
        book.language;
    const facts = [
        { label: 'Số trang', value: book.pageCount.toLocaleString('vi-VN') },
        { label: 'Trang có AR', value: book.arPageCount.toLocaleString('vi-VN') },
        { label: 'Ngôn ngữ', value: language },
        { label: 'Độ tuổi', value: publicBookAgeLabel(book) },
    ];
    return (
        <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[160px_minmax(0,1fr)_184px]">
            <div className="flex min-w-0 flex-col items-center gap-5">
                <div className="aspect-[3/4] w-full max-w-40 overflow-hidden rounded-xl border border-border bg-surface">
                    <BookCoverImage url={book.coverUrl} alt={`Bìa ${book.title}`} loading="eager" />
                </div>
            </div>
            <div className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-6">
                <div className="flex min-w-0 flex-col justify-center gap-3 sm:justify-start">
                    <h2 className="m-0 break-words font-semibold text-xl leading-snug sm:text-2xl">
                        {book.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Tác giả{' '}
                        <Link
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                            to={`/authors/${book.author.id}`}
                        >
                            {book.author.displayName}
                        </Link>
                    </p>
                </div>
                <dl className="col-span-2 grid grid-cols-2 gap-x-5 gap-y-3 border-border border-y py-4 text-sm sm:col-span-1 sm:col-start-2">
                    {facts.map(({ label, value }) => (
                        <div key={label} className="flex min-w-0 flex-col gap-1">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="break-words font-medium">{value}</dd>
                        </div>
                    ))}
                </dl>
                <section
                    aria-label="Giới thiệu sách"
                    className="col-span-2 flex min-w-0 flex-col gap-3 sm:col-span-1 sm:col-start-2"
                >
                    <h3 className="m-0 font-semibold text-base">Giới thiệu</h3>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {book.description?.trim() || 'Cuốn sách này chưa có mô tả.'}
                    </p>
                    {book.printPdfUrl && (
                        <Button
                            variant="link"
                            size="sm"
                            className="w-fit cursor-pointer justify-start px-0"
                            asChild
                        >
                            <a href={book.printPdfUrl} target="_blank" rel="noopener noreferrer">
                                <FileDown data-icon="inline-start" />
                                Bản in PDF
                                <ExternalLink data-icon="inline-end" />
                                <span className="sr-only"> — mở trong tab mới</span>
                            </a>
                        </Button>
                    )}
                    <p className="mt-2 text-muted-foreground text-xs">
                        Cập nhật {formatDate(book.version.publishedAt)}
                        {book.downloadBytes > 0 &&
                            ` — Nội dung khoảng ${formatBytes(book.downloadBytes)}`}
                    </p>
                </section>
            </div>
            <aside
                aria-label="Đọc sách bằng mã QR"
                className="hidden min-w-0 border-border border-l pl-6 lg:block"
            >
                <PublicBookQr slug={book.slug} />
            </aside>
            <div ref={mobileQr} className="col-span-2 lg:hidden">
                <Accordion
                    type="single"
                    collapsible
                    onValueChange={(value) => {
                        if (value)
                            requestAnimationFrame(() =>
                                mobileQr.current?.scrollIntoView({
                                    block: 'nearest',
                                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                                        .matches
                                        ? 'instant'
                                        : 'smooth',
                                }),
                            );
                    }}
                >
                    <AccordionItem value="qr">
                        <AccordionTrigger>
                            <QrCode className="size-4" aria-hidden="true" />
                            Mã QR mở sách
                        </AccordionTrigger>
                        <AccordionContent className="[&_p:not(:last-child)]:mb-0">
                            <PublicBookQr slug={book.slug} />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}

function BookInformationSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[160px_minmax(0,1fr)_184px]"
        >
            <Skeleton className="aspect-[3/4] rounded-xl" />
            <div className="contents sm:flex sm:flex-col sm:gap-6">
                <div className="flex flex-col justify-center gap-3 sm:justify-start">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-4 py-4 sm:col-span-1">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
                <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </div>
            <div className="hidden flex-col items-center gap-3 border-border border-l pl-6 lg:flex">
                <Skeleton className="size-36 rounded-lg" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
            </div>
        </div>
    );
}
