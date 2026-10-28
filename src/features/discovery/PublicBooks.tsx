import { Link } from 'react-router-dom';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import type { PublicBookCard } from '../../shared/contracts/api/public.schema';
import { publishedReaderUrl } from './api';

function Cover({ url }: { url: string | null }) {
    return (
        <span
            className="book-cover motion-safe:[.book-gallery_.book-row:hover_&_img]:transform-[scale(1.025)] grid h-[66px] w-[50px] overflow-hidden rounded-[var(--radius-sm)] bg-surface text-[var(--text-cover)] [place-items:center] max-[760px]:row-[span_2] max-[760px]:h-[54px] max-[760px]:w-10 [&_img]:size-full [&_img]:object-cover [.book-gallery_&]:col-[1_/_-1] [.book-gallery_&]:row-[1] [.book-gallery_&]:h-[190px] [.book-gallery_&]:w-full [.book-gallery_&]:rounded-[7px] [.book-gallery_&]:bg-surface [.book-gallery_&_img]:object-contain motion-safe:[.book-gallery_&_img]:[transition:transform_180ms_ease-out]"
            aria-hidden="true"
        >
            <BookCoverImage url={url} />
        </span>
    );
}

function ageLabel(book: PublicBookCard) {
    if (book.ageMin === null && book.ageMax === null) return 'Chưa ghi độ tuổi';
    if (book.ageMin === null) return `Đến ${book.ageMax} tuổi`;
    if (book.ageMax === null) return `Từ ${book.ageMin} tuổi`;
    return book.ageMin === book.ageMax
        ? `${book.ageMin} tuổi`
        : `${book.ageMin}–${book.ageMax} tuổi`;
}

export function PublicBooks({ books }: { books: PublicBookCard[] }) {
    return (
        <ul className="public-book-list m-0 list-none p-0" aria-label="Danh sách sách công khai">
            {books.map((book) => (
                <li
                    className="public-book-row grid grid-cols-[52px_minmax(0,_1fr)_auto] items-center gap-5 border-b-[1px] border-b-border px-0 py-6 [border-bottom-style:solid] max-[640px]:grid-cols-[50px_minmax(0,_1fr)] max-[640px]:gap-3 max-[640px]:[&_>_a]:col-[2] max-[640px]:[&_>_a]:[justify-self:start] [&_p]:text-[length:var(--text-sm)]"
                    key={book.slug}
                >
                    <Cover key={book.coverUrl || 'none'} url={book.coverUrl} />
                    <div className="book-info [&_h2]:wrap-anywhere min-w-0 max-[760px]:col-[2_/_4] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h2]:leading-[1.4] max-[760px]:[&_h2]:text-[length:var(--text-md)] [&_h2_a:hover]:text-primary [&_h2_a:hover]:underline [&_h2_a]:text-[inherit] [&_h2_a]:no-underline [&_p]:m-0 [&_p]:text-[length:var(--text-xs)] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-xs)] [.book-gallery_&]:col-[1_/_-1] [.book-gallery_&]:row-[2] [.book-gallery_&]:px-[3px] [.book-gallery_&_h2]:mb-[5px] [.book-gallery_&_h2]:text-[length:15px] [.book-gallery_&_h2]:leading-[1.5] [.book-gallery_&_p]:text-[length:11px]">
                        <h2>
                            <a
                                href={publishedReaderUrl(book.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {book.title}
                                <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                    {' '}
                                    — mở trong Viewer, tab mới
                                </span>
                            </a>
                        </h2>
                        <p>
                            <Link to={`/authors/${book.author.id}`}>{book.author.displayName}</Link>
                        </p>
                        <p>
                            {ageLabel(book)} · {book.language} · {book.arPageCount} trang AR
                        </p>
                    </div>
                    <Button variant="secondary" asChild>
                        <a
                            href={publishedReaderUrl(book.slug)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Đọc ${book.title} trong Viewer, tab mới`}
                        >
                            Đọc sách
                        </a>
                    </Button>
                </li>
            ))}
        </ul>
    );
}
