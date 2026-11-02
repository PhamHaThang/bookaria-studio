import type { PublicBookCard } from '../../shared/contracts/api/public.schema';
import { SlugSchema } from '../../shared/contracts/common.schema';

type PageLocation = { pathname: string; search: string; hash: string };

export function publicBookInfoLocation(location: PageLocation, slug: string) {
    const params = new URLSearchParams(location.search);
    params.set('book', SlugSchema.parse(slug));
    return { pathname: location.pathname, search: `?${params}`, hash: location.hash };
}

export function withoutPublicBookInfo(location: PageLocation) {
    const params = new URLSearchParams(location.search);
    params.delete('book');
    return `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`;
}

export function publicBookInfoUrl(origin: string, slug: string) {
    const url = new URL('/library', origin);
    url.searchParams.set('book', SlugSchema.parse(slug));
    return url.href;
}

export function publicBookAgeLabel(book: Pick<PublicBookCard, 'ageMin' | 'ageMax'>) {
    if (book.ageMin === null && book.ageMax === null) return 'Chưa ghi độ tuổi';
    if (book.ageMin === null) return `Đến ${book.ageMax} tuổi`;
    if (book.ageMax === null) return `Từ ${book.ageMin} tuổi`;
    return book.ageMin === book.ageMax
        ? `${book.ageMin} tuổi`
        : `${book.ageMin}–${book.ageMax} tuổi`;
}
