import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { motion, useInView } from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';

export function HomeScrollReveal({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const inView = useInView(containerRef, {
        amount: 1 / 3,
        // Keep the trigger above the fixed blur at the bottom of the page.
        margin: '0px 0px -120px',
        once: true,
    });
    const [focused, setFocused] = useState(false);
    const { transition } = useMotionTokens();
    const reduceMotion = useShouldReduceMotion();
    const visible = inView || focused;

    return (
        <motion.div
            ref={containerRef}
            className={className}
            onFocusCapture={!visible ? () => setFocused(true) : undefined}
            initial={false}
            animate={{
                opacity: visible ? 1 : 0,
                y: visible || reduceMotion ? 0 : 28,
            }}
            transition={
                focused
                    ? { duration: 0 }
                    : { ...transition.reveal, duration: transition.reveal.duration * 1.8 }
            }
        >
            {children}
        </motion.div>
    );
}
