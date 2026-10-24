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
}: {
    page: number;
    totalPages: number;
    onPage: (page: number) => void;
    label: string;
}) {
    if (totalPages <= 1) return null;
    return (
        <PaginationRoot aria-label={label} className="mt-8 justify-end">
            <PaginationContent className="m-0 gap-3 p-0">
                <PaginationItem>
                    <Button
                        variant="secondary"
                        disabled={page <= 1}
                        onClick={() => onPage(page - 1)}
                    >
                        <ChevronLeft data-icon="inline-start" />
                        Trang trước
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
                        disabled={page >= totalPages}
                        onClick={() => onPage(page + 1)}
                    >
                        Trang sau
                        <ChevronRight data-icon="inline-end" />
                    </Button>
                </PaginationItem>
            </PaginationContent>
        </PaginationRoot>
    );
}
