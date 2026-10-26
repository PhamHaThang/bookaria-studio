import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

/** Slide visuals between slots while their drag hit targets remain fixed. */
export function usePageReorderMotion(
    viewport: RefObject<HTMLElement | null>,
    pages: readonly { id: string }[] | undefined,
    preview: readonly string[] | null,
) {
    const positions = useRef(new Map<string, number>());
    const animations = useRef(new Map<string, Animation>());
    const order = pages?.map((page) => page.id).join('|') || '';
    const desiredOrder = preview?.join('|') || order;
    useLayoutEffect(() => {
        if (!order) {
            positions.current.clear();
            return;
        }
        const cards = Array.from(
            viewport.current?.querySelectorAll<HTMLElement>('[data-page-id]') || [],
        );
        const slots = cards.map((card) => card.offsetLeft);
        const desired = new Map(desiredOrder.split('|').map((id, index) => [id, index]));
        const next = new Map<string, number>();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        cards.forEach((card, index) => {
            const id = card.dataset.pageId;
            const visual = card.querySelector<HTMLElement>('[data-page-visual]');
            if (!id || !visual) return;
            const x = card.offsetLeft;
            const previous = positions.current.get(id) ?? x;
            const translated = new DOMMatrixReadOnly(getComputedStyle(visual).transform).m41;
            const from = previous - x + translated;
            const to = (slots[desired.get(id) ?? index] ?? x) - x;
            next.set(id, x);
            animations.current.get(id)?.cancel();
            animations.current.delete(id);
            // The inline final position survives animation completion and reduced-motion changes.
            visual.style.transform = `translateX(${to}px)`;
            if (reduced || Math.abs(from - to) < 0.5) return;
            const animation = visual.animate(
                [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
                { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
            animations.current.set(id, animation);
            animation.onfinish = () => {
                if (animations.current.get(id) === animation) animations.current.delete(id);
            };
        });
        for (const [id, animation] of animations.current)
            if (!next.has(id)) {
                animation.cancel();
                animations.current.delete(id);
            }
        positions.current = next;
    }, [order, desiredOrder, viewport]);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const current = animations.current;
        const cancel = () => {
            for (const animation of current.values()) animation.cancel();
            current.clear();
        };
        const change = () => {
            if (media.matches) cancel();
        };
        media.addEventListener('change', change);
        return () => {
            media.removeEventListener('change', change);
            cancel();
        };
    }, []);
}
