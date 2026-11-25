export type StudioSection = '/studio' | '/books' | '/assets' | '/stats' | '/books/trash';

/** One owning section per Studio route, including nested book statistics. */
export function getStudioSection(pathname: string): StudioSection | null {
    if (pathname === '/books/trash' || pathname.startsWith('/books/trash/')) return '/books/trash';
    if (/^\/books\/[^/]+\/stats\/?$/.test(pathname)) return '/stats';
    for (const section of ['/studio', '/books', '/assets', '/stats'] as const) {
        if (pathname === section || pathname.startsWith(`${section}/`)) return section;
    }
    return null;
}
