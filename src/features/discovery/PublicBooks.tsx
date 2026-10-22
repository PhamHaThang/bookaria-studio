import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicBookCard } from '../../shared/contracts/api/public.schema';
import { publishedReaderUrl } from './api';

function Cover({ url }: { url: string | null }) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="book-cover" aria-hidden="true">
            {url && !failed ? (
                <img
                    src={url}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(true)}
                />
            ) : (
                <BookOpen size={24} />
            )}
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
        <ul className="public-book-list" aria-label="Danh sách sách công khai">
            {books.map((book) => (
                <li className="public-book-row" key={book.slug}>
                    <Cover key={book.coverUrl || 'none'} url={book.coverUrl} />
                    <div className="book-info">
                        <h2>
                            <a
                                href={publishedReaderUrl(book.slug)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {book.title}
                                <span className="sr-only"> — mở trong Viewer, tab mới</span>
                            </a>
                        </h2>
                        <p>
                            <Link to={`/authors/${book.author.id}`}>{book.author.displayName}</Link>
                        </p>
                        <p>
                            {ageLabel(book)} · {book.language} · {book.arPageCount} trang AR
                        </p>
                    </div>
                    <a
                        className="button secondary compact"
                        href={publishedReaderUrl(book.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Đọc ${book.title} trong Viewer, tab mới`}
                    >
                        Đọc sách
                    </a>
                </li>
            ))}
        </ul>
    );
}
