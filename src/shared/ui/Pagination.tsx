import { Button } from '@/shared/ui/Button';
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
        <nav
            className="pagination mt-8 flex items-center justify-end gap-5 text-[length:var(--text-sm)] tabular-nums max-[760px]:justify-between max-[760px]:gap-2 max-[760px]:text-[length:var(--text-xs)] max-[760px]:[&_.button]:p-3 max-[760px]:[&_.button]:text-[length:var(--text-xs)]"
            aria-label={label}
        >
            <Button
                type="button"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
            >
                Trang trước
            </Button>
            <span>
                Trang {page} / {totalPages}
            </span>
            <Button
                type="button"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
            >
                Trang sau
            </Button>
        </nav>
    );
}
