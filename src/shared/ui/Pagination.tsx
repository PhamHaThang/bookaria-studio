import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './primitives/button';
import {
    PaginationContent,
    PaginationItem,
    Pagination as PaginationRoot,
} from './primitives/pagination';
export function Pagination({
    page,
    totalPages,
    onPage,
    label,
    busy = false,
}: {
    page: number;
    totalPages: number;
    onPage: (page: number) => void;
    label: string;
    busy?: boolean;
}) {
    if (totalPages <= 1) return null;
    return (
        <PaginationRoot
            aria-label={label}
            aria-busy={busy || undefined}
            className="mt-8 justify-end"
        >
            <PaginationContent className="m-0 max-w-full gap-3 p-0">
                <PaginationItem>
                    <Button
                        variant="secondary"
                        aria-label="Trang trước"
                        className="max-[540px]:px-3"
                        disabled={busy || page <= 1}
                        onClick={() => onPage(page - 1)}
                    >
                        <ChevronLeft data-icon="inline-start" />
                        <span className="max-[540px]:sr-only">Trang trước</span>
                    </Button>
                </PaginationItem>
                <PaginationItem>
                    <span className="px-2 text-sm tabular-nums" aria-live="polite">
                        Trang {page} / {totalPages}
                    </span>
                </PaginationItem>
                <PaginationItem>
                    <Button
                        variant="secondary"
                        aria-label="Trang sau"
                        className="max-[540px]:px-3"
                        disabled={busy || page >= totalPages}
                        onClick={() => onPage(page + 1)}
                    >
                        <span className="max-[540px]:sr-only">Trang sau</span>
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </PaginationItem>
            </PaginationContent>
        </PaginationRoot>
    );
}
