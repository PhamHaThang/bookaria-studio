import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';

/** Keep the same reply slot while the waiting row opens into its actual content. */
export function AssistantTurn({ pending, children }: { pending: boolean; children: ReactNode }) {
    const content = useRef<HTMLDivElement>(null);
    const wasPending = useRef(pending);
    const [height, setHeight] = useState<number | undefined>(pending ? 24 : undefined);
    useLayoutEffect(() => {
        const node = content.current;
        if (!node || !wasPending.current) return;
        const measure = () => setHeight(node.getBoundingClientRect().height);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        const timer = pending
            ? undefined
            : setTimeout(() => {
                  observer.disconnect();
                  wasPending.current = false;
                  setHeight(undefined);
              }, 390);
        return () => {
            observer.disconnect();
            clearTimeout(timer);
        };
    }, [pending]);
    return (
        <div
            data-assistant-turn
            className={cn(
                'transition-[height] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                pending ? 'overflow-visible' : 'overflow-clip',
            )}
            style={{ height }}
        >
            <div ref={content}>{children}</div>
        </div>
    );
}
