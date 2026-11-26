import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';
import {
    PaginationContent,
    PaginationItem,
    Pagination as PaginationRoot,
} from './primitives/pagination';

export interface PaginationProps {
    page: number;
    totalPages: number;
    onPage: (page: number) => void;
    label: string;
    busy?: boolean;
    className?: string;
}

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Tạo danh sách các số trang và dấu '...' hiển thị theo chuẩn UX:
 * Ví dụ khi có nhiều trang: << < 1 2 3 ... 98 99 > >>
 */
function generatePageList(currentPage: number, totalPages: number): PageItem[] {
    // Nếu tổng số trang nhỏ (<= 5 trang), hiển thị tất cả các số trang vì các số liên tiếp liền kề nhau
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Nếu đang ở gần đầu (trang 1, 2, 3) và có nhiều trang:
    // Hiển thị 3 trang đầu, dấu ..., và 2 trang cuối (Ví dụ: 1 2 3 ... 98 99)
    if (currentPage <= 3) {
        if (totalPages >= 7) {
            return [1, 2, 3, 'ellipsis-end', totalPages - 1, totalPages];
        }
        return [1, 2, 3, 'ellipsis-end', totalPages];
    }

    // Nếu đang ở gần cuối (3 trang cuối):
    // Hiển thị 2 trang đầu, dấu ..., và 3 trang cuối (Ví dụ: 1 2 ... 97 98 99)
    if (currentPage >= totalPages - 2) {
        if (totalPages >= 7) {
            return [1, 2, 'ellipsis-start', totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, 'ellipsis-start', totalPages - 2, totalPages - 1, totalPages];
    }

    // Nếu đang ở giữa: [1] ... [currentPage - 1] [currentPage] [currentPage + 1] ... [totalPages]
    return [
        1,
        'ellipsis-start',
        currentPage - 1,
        currentPage,
        currentPage + 1,
        'ellipsis-end',
        totalPages,
    ];
}

export function Pagination({
    page,
    totalPages,
    onPage,
    label,
    busy = false,
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const pageItems = generatePageList(page, totalPages);

    return (
        <PaginationRoot
            aria-label={label}
            aria-busy={busy || undefined}
            className={cn(
                'mt-6 flex w-full flex-wrap items-center justify-center gap-2 sm:justify-end',
                className,
            )}
        >
            <PaginationContent className="m-0 flex-wrap gap-1 p-0 sm:gap-1.5">
                {/* 1. Nút Về trang đầu tiên (<<) */}
                <PaginationItem>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 w-9 p-0 shadow-xs"
                        aria-label="Về trang đầu tiên"
                        title="Về trang đầu tiên (Trang 1)"
                        disabled={busy || page <= 1}
                        onClick={() => onPage(1)}
                    >
                        <ChevronsLeft className="h-4 w-4" data-icon="inline-start" />
                        <span className="sr-only">Trang đầu</span>
                    </Button>
                </PaginationItem>

                {/* 2. Nút Trang trước (<) */}
                <PaginationItem>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 w-9 p-0 shadow-xs"
                        aria-label="Trang trước"
                        title={`Trang trước (Trang ${Math.max(1, page - 1)})`}
                        disabled={busy || page <= 1}
                        onClick={() => onPage(page - 1)}
                    >
                        <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
                        <span className="sr-only">Trang trước</span>
                    </Button>
                </PaginationItem>

                {/* 3. Danh sách các trang số & dấu ba chấm */}
                {pageItems.map((item) => {
                    if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                        return (
                            <PaginationItem key={item}>
                                <span
                                    className="flex h-9 min-w-8 select-none items-center justify-center font-bold text-muted-foreground text-sm tracking-widest"
                                    aria-hidden="true"
                                >
                                    ...
                                </span>
                            </PaginationItem>
                        );
                    }

                    const isCurrent = item === page;

                    return (
                        <PaginationItem key={item}>
                            <Button
                                type="button"
                                variant={isCurrent ? 'default' : 'secondary'}
                                size="sm"
                                className={cn(
                                    'h-9 min-w-9 px-3 font-medium text-xs tabular-nums shadow-xs transition-colors sm:text-sm',
                                    isCurrent
                                        ? 'pointer-events-none font-semibold'
                                        : 'hover:bg-muted/80',
                                )}
                                aria-label={`Trang ${item}`}
                                aria-current={isCurrent ? 'page' : undefined}
                                disabled={busy}
                                onClick={() => onPage(item)}
                            >
                                {item}
                            </Button>
                        </PaginationItem>
                    );
                })}

                {/* 4. Nút Trang sau (>) */}
                <PaginationItem>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 w-9 p-0 shadow-xs"
                        aria-label="Trang sau"
                        title={`Trang sau (Trang ${Math.min(totalPages, page + 1)})`}
                        disabled={busy || page >= totalPages}
                        onClick={() => onPage(page + 1)}
                    >
                        <ChevronRight className="h-4 w-4" data-icon="inline-end" />
                        <span className="sr-only">Trang sau</span>
                    </Button>
                </PaginationItem>

                {/* 5. Nút Đến trang cuối (>>) */}
                <PaginationItem>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 w-9 p-0 shadow-xs"
                        aria-label="Đến trang cuối cùng"
                        title={`Đến trang cuối cùng (Trang ${totalPages})`}
                        disabled={busy || page >= totalPages}
                        onClick={() => onPage(totalPages)}
                    >
                        <ChevronsRight className="h-4 w-4" data-icon="inline-end" />
                        <span className="sr-only">Trang cuối</span>
                    </Button>
                </PaginationItem>
            </PaginationContent>
        </PaginationRoot>
    );
}
