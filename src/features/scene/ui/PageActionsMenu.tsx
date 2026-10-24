import { ArrowLeft, ArrowRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Feedback } from '../../../shared/ui/Feedback';

export function PageActionsMenu({
    anchor,
    title,
    locked,
    first,
    last,
    error,
    onClose,
    onRename,
    onMove,
    onDuplicate,
    onDelete,
}: {
    anchor: HTMLButtonElement;
    title: string;
    locked: boolean;
    first: boolean;
    last: boolean;
    error: string | null;
    onClose: () => void;
    onRename: () => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const menu = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const node = menu.current;
        if (!node) return;
        node.showPopover();
        function position() {
            if (!node) return;
            const rect = anchor.getBoundingClientRect();
            const width = node.offsetWidth,
                height = node.offsetHeight;
            const viewport = document.documentElement;
            const left = Math.max(
                8,
                Math.min(rect.left + rect.width / 2 - width / 2, viewport.clientWidth - width - 8),
            );
            const above = rect.top - height - 8;
            const top =
                above >= 8 ? above : Math.min(rect.bottom + 8, viewport.clientHeight - height - 8);
            node.style.left = `${left}px`;
            node.style.top = `${Math.max(8, top)}px`;
        }
        position();
        const firstButton = node.querySelector<HTMLButtonElement>('button:not(:disabled)');
        if (firstButton) firstButton.focus();
        else node.focus();
        const observer = new ResizeObserver(position);
        observer.observe(node);
        window.addEventListener('resize', position);
        document.addEventListener('scroll', position, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', position);
            document.removeEventListener('scroll', position, true);
            if (node.matches(':popover-open')) node.hidePopover();
            if (document.contains(anchor)) anchor.focus();
        };
    }, [anchor]);
    return (
        <div
            id="page-actions-menu"
            className="page-actions-popover"
            ref={menu}
            popover="auto"
            role="menu"
            tabIndex={-1}
            aria-label={title}
            onToggle={(event) => {
                if (event.newState === 'closed') onClose();
            }}
            onKeyDown={(event) => {
                event.stopPropagation();
                const buttons = Array.from(
                    menu.current?.querySelectorAll<HTMLButtonElement>(
                        'button[role="menuitem"]:not(:disabled)',
                    ) || [],
                );
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    const next =
                        event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? buttons.length - 1
                              : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) %
                                buttons.length;
                    buttons[next]?.focus();
                }
                if (event.key === 'Tab') {
                    event.preventDefault();
                    onClose();
                }
            }}
        >
            <p className="page-actions-title">{title}</p>
            <button type="button" role="menuitem" disabled={locked} onClick={onRename}>
                <Pencil size={16} />
                Đổi tên trang
            </button>
            <button
                type="button"
                role="menuitem"
                disabled={locked || first}
                onClick={() => onMove(-1)}
            >
                <ArrowLeft size={16} />
                Đưa lên trước
            </button>
            <button
                type="button"
                role="menuitem"
                disabled={locked || last}
                onClick={() => onMove(1)}
            >
                <ArrowRight size={16} />
                Đưa ra sau
            </button>
            <button type="button" role="menuitem" disabled={locked} onClick={onDuplicate}>
                <Copy size={16} />
                Nhân bản trang
            </button>
            <button
                type="button"
                role="menuitem"
                className="page-menu-delete"
                disabled={locked}
                onClick={onDelete}
            >
                <Trash2 size={16} />
                Xóa trang
            </button>
            <Feedback error={error} />
        </div>
    );
}
