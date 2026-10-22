export function Pagination({
    page,
    totalPages,
    onPage,
    label,
}: {
    page: number;
    totalPages: number;
    onPage: (page: number) => void;
    label: string;
}) {
    if (totalPages <= 1) return null;
    return (
        <nav className="pagination" aria-label={label}>
            <button
                type="button"
                className="button secondary compact"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
            >
                Trang trước
            </button>
            <span>
                Trang {page} / {totalPages}
            </span>
            <button
                type="button"
                className="button secondary compact"
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
            >
                Trang sau
            </button>
        </nav>
    );
}
