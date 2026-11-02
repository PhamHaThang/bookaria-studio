import { Link, useLocation } from 'react-router-dom';
import type { PublicBookCard } from '@/shared/contracts/api/public.schema';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { publicBookAgeLabel, publicBookInfoLocation } from './public-book-info';

export function PublicBooks({ books }: { books: PublicBookCard[] }) {
    const location = useLocation();
    const state = { publicBookReturnTo: `${location.pathname}${location.search}${location.hash}` };
    return (
        <ul className="public-book-list m-0 list-none p-0" aria-label="Danh sách sách công khai">
            {books.map((book) => {
                const to = publicBookInfoLocation(location, book.slug);
                return (
                    <li
                        key={book.slug}
                        className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-5 border-border border-b py-6 max-sm:grid-cols-[50px_minmax(0,1fr)] max-sm:gap-x-3 max-sm:gap-y-4"
                    >
                        <Link
                            to={to}
                            state={state}
                            preventScrollReset
                            aria-label={`Xem thông tin ${book.title}`}
                            className="block h-[66px] w-[50px] overflow-hidden rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 max-sm:row-span-2 max-sm:self-start"
                        >
                            <BookCoverImage key={book.coverUrl || 'none'} url={book.coverUrl} />
                        </Link>
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 className="m-0 mb-1 break-words text-base leading-snug">
                                <Link
                                    to={to}
                                    state={state}
                                    preventScrollReset
                                    className="underline-offset-4 hover:underline"
                                >
                                    {book.title}
                                </Link>
                            </h2>
                            <p className="text-muted-foreground text-xs">
                                <Link
                                    to={`/authors/${book.author.id}`}
                                    className="underline-offset-4 hover:underline"
                                >
                                    {book.author.displayName}
                                </Link>
                            </p>
                            <p className="text-muted-foreground text-xs">
                                {publicBookAgeLabel(book)} — {book.language} — {book.arPageCount}{' '}
                                trang AR
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="max-sm:col-start-2 max-sm:justify-self-start"
                            asChild
                        >
                            <Link
                                to={to}
                                state={state}
                                preventScrollReset
                                aria-label={`Xem chi tiết ${book.title}`}
                            >
                                Xem chi tiết
                            </Link>
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}
