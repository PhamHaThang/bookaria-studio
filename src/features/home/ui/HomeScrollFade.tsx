import { motion, useScroll, useTransform } from 'motion/react';

// Keep layers fixed individually: a fixed wrapper isolates their backdrop in Chromium.
const blurLayers = [
    {
        blur: 0.375,
        mask: 'linear-gradient(to bottom, transparent 0%, black 16.67%, black 33.33%, transparent 50%)',
    },
    {
        blur: 0.75,
        mask: 'linear-gradient(to bottom, transparent 16.67%, black 33.33%, black 50%, transparent 66.67%)',
    },
    {
        blur: 1.5,
        mask: 'linear-gradient(to bottom, transparent 33.33%, black 50%, black 66.67%, transparent 83.33%)',
    },
    {
        blur: 3,
        mask: 'linear-gradient(to bottom, transparent 50%, black 66.67%, black 83.33%, transparent 100%)',
    },
    { blur: 6, mask: 'linear-gradient(to bottom, transparent 66.67%, black 83.33%, black 100%)' },
    { blur: 12, mask: 'linear-gradient(to bottom, transparent 83.33%, black 100%)' },
];

/** Match the intro bottom spacing, overlapping only the last 24px of the marquee at entry. */
export function HomeScrollFade() {
    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0.97, 1], [1, 0]);

    return (
        <div aria-hidden="true" data-home-scroll-fade="" className="contents">
            {blurLayers.map(({ blur, mask }) => (
                <motion.div
                    key={blur}
                    data-home-blur-layer=""
                    className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(clamp(3rem,8dvh,6rem)+1.5rem)] [@media(prefers-reduced-transparency:reduce)]:hidden"
                    style={{
                        opacity,
                        backdropFilter: `blur(${blur}px)`,
                        WebkitBackdropFilter: `blur(${blur}px)`,
                        maskImage: mask,
                        WebkitMaskImage: mask,
                    }}
                />
            ))}
        </div>
    );
}
