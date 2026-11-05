import { type RefObject, useEffect } from 'react';

/** React Flow stops bubbling pointer events; dismiss popovers in capture phase. */
export function useInteractionPopoverDismiss(
    open: boolean,
    anchor: RefObject<HTMLElement | null>,
    content: RefObject<HTMLDivElement | null>,
    dismiss: () => void,
) {
    useEffect(() => {
        if (!open) return;
        function outside(event: PointerEvent) {
            const target = event.target;
            if (
                !(target instanceof Node) ||
                anchor.current?.contains(target) ||
                content.current?.contains(target)
            )
                return;
            dismiss();
        }
        document.addEventListener('pointerdown', outside, true);
        return () => document.removeEventListener('pointerdown', outside, true);
    }, [open, anchor, content, dismiss]);
}
