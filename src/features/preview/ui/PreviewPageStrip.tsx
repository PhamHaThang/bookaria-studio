import { useEffect, useRef } from 'react';
import type { PageSummary } from '@/shared/contracts/dto.schema';
import { Button as PrimitiveButton } from '@/shared/ui/primitives/button';
import { Spinner } from '@/shared/ui/primitives/spinner';

export function PreviewPageStrip({
    pages,
    currentPageId,
    loading,
    onSelect,
}: {
    pages: PageSummary[];
    currentPageId: string;
    loading: boolean;
    onSelect: (id: string) => void;
}) {
    const scroll = useRef<HTMLDivElement>(null);
    const selected = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        void currentPageId;
        selected.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [currentPageId]);
    useEffect(() => {
        const element = scroll.current;
        if (!element) return;
        const wheel = (event: WheelEvent) => {
            if (
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                element.scrollWidth <= element.clientWidth
            )
                return;
            const delta =
                Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (!delta) return;
            event.preventDefault();
            event.stopPropagation();
            const unit =
                event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
            element.scrollLeft += delta * unit;
        };
        element.addEventListener('wheel', wheel, { passive: false });
        return () => element.removeEventListener('wheel', wheel);
    }, []);
    return (
        <nav
            aria-label="Các trang xem trước"
            className="pointer-events-auto flex w-max max-w-[min(100%,40rem)] items-center gap-1 rounded-2xl border border-border bg-surface p-2.5"
        >
            <div
                ref={scroll}
                data-preview-page-scroll
                className="flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain p-1 [scrollbar-width:thin]"
            >
                {pages.map((page, pageIndex) => (
                    <PrimitiveButton
                        key={page.id}
                        variant="plain"
                        ref={page.id === currentPageId ? selected : undefined}
                        aria-label={`Xem trang ${pageIndex + 1}${page.title ? `: ${page.title}` : ''}`}
                        aria-current={page.id === currentPageId ? 'page' : undefined}
                        title={page.title || `Trang ${pageIndex + 1}`}
                        className="relative flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface p-1 transition-[border-color,box-shadow] duration-150 hover:border-input aria-[current=page]:border-primary aria-[current=page]:ring-1 aria-[current=page]:ring-primary motion-reduce:transition-none"
                        onClick={() => onSelect(page.id)}
                    >
                        <img
                            src={page.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="size-full min-h-0 min-w-0 rounded-lg object-contain"
                        />
                        {loading && page.id === currentPageId && (
                            <span className="absolute inset-0 grid place-items-center rounded-xl bg-surface/80">
                                <Spinner />
                            </span>
                        )}
                        <span
                            aria-hidden="true"
                            className="absolute right-0.5 bottom-0.5 rounded-sm bg-surface px-1 text-[10px] text-foreground tabular-nums leading-4"
                        >
                            {pageIndex + 1}
                        </span>
                    </PrimitiveButton>
                ))}
            </div>
        </nav>
    );
}
