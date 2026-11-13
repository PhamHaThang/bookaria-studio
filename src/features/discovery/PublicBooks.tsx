import { ArrowUpRight, ScanLine } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { bookLanguageOptions } from '@/features/books/model/languages';
import type { PublicBookCard } from '@/shared/contracts/api/public.schema';
import { cn } from '@/shared/lib/cn';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { publicBookAgeLabel, publicBookInfoLocation } from './public-book-info';

const gridClass =
    'grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3 xl:grid-cols-4';
const cardClass = 'min-w-0 rounded-[var(--radius-card)] border border-border bg-surface';
const shelfClass =
    'relative grid aspect-[1.16] min-w-0 place-items-center rounded-t-[calc(var(--radius-card)-1px)] bg-muted';
const infoClass = 'flex min-w-0 flex-col items-start gap-1.5 p-3 sm:p-4';

export function PublicBooks({ books }: { books: PublicBookCard[] }) {
    const location = useLocation();
    const state = { publicBookReturnTo: location.pathname + location.search + location.hash };
    return (
        <ul className={gridClass} aria-label="Danh sách sách công khai">
            {books.map((book) => {
                const to = publicBookInfoLocation(location, book.slug);
                const language = bookLanguageOptions(book.language).find(
                    (item) => item.value === book.language,
                )?.label;
                return (
                    <li
                        key={book.slug}
                        className={cn(
                            cardClass,
                            'group/book relative focus-within:border-input hover:border-input motion-safe:transition-colors motion-safe:duration-200',
                        )}
                    >
                        <div className={shelfClass}>
                            <div className="absolute inset-x-[23%] inset-y-[8%] flex items-center justify-center">
                                <BookCoverImage
                                    url={book.coverUrl}
                                    className="block size-auto max-h-full max-w-full shrink-0 rounded-sm bg-transparent shadow-[0_8px_18px_-5px_#0005] motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out motion-safe:group-hover/book:-translate-y-1 motion-safe:group-focus-within/book:-translate-y-1"
                                />
                            </div>
                        </div>
                        <div className={infoClass}>
                            <h3 className="m-0 w-full font-semibold text-base leading-snug sm:text-lg">
                                <Link
                                    to={to}
                                    state={state}
                                    preventScrollReset
                                    className="flex items-start justify-between gap-1.5 outline-none after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:outline-offset-4"
                                    aria-label={`Xem thông tin ${book.title}`}
                                >
                                    <span className="wrap-anywhere line-clamp-2">{book.title}</span>
                                    <ArrowUpRight
                                        className="mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/book:translate-x-0.5 motion-safe:group-hover/book:-translate-y-0.5"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </h3>
                            <Link
                                to={`/authors/${book.author.id}`}
                                className="relative z-10 max-w-full truncate text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                            >
                                {book.author.displayName}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-xs">
                                {book.arPageCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <ScanLine className="size-3.5" aria-hidden="true" />
                                        {book.arPageCount.toLocaleString('vi-VN')} trang AR
                                    </span>
                                )}
                                <span>{language}</span>

                                {(book.ageMin !== null || book.ageMax !== null) && (
                                    <span>{publicBookAgeLabel(book)}</span>
                                )}
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export function PublicBooksSkeleton() {
    return (
        <div role="status" aria-busy="true">
            <span className="sr-only">Đang tải sách…</span>
            <div className={gridClass} aria-hidden="true">
                {['a', 'b', 'c', 'd'].map((item) => (
                    <div key={item} className={cardClass}>
                        <div className={shelfClass}>
                            <Skeleton className="aspect-[3/4] w-[54%] rounded-sm" />
                        </div>
                        <div className={infoClass}>
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-5 w-1/2" />
                            <Skeleton className="mt-1 h-4 w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
