import {
    useMotionTokens,
    useShouldReduceMotion,
    useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { Box, Image, Music2, Plus, SlidersHorizontal, Type, Video } from 'lucide-react';
import { motion, useAnimate, useInView, useSpring, useTransform } from 'motion/react';
import { type PointerEvent, useEffect, useRef, useState } from 'react';

const tools = [
    { icon: Box, label: 'Mô hình 3D' },
    { icon: Image, label: 'Hình ảnh' },
    { icon: Type, label: 'Văn bản' },
    { icon: Video, label: 'Video' },
    { icon: Music2, label: 'Âm thanh' },
];

const creatures = [
    { id: 'whale', name: 'Cá voi' },
    { id: 'turtle', name: 'Rùa biển' },
    { id: 'ray', name: 'Cá đuối' },
    { id: 'octopus', name: 'Bạch tuộc' },
];
const creatureDisplayMs = 5500;

export function HomeStudioPreview() {
    const reduceMotion = useShouldReduceMotion();
    const { spring, transition } = useMotionTokens();
    const creatureExit = { ...transition.fade, duration: transition.fade.duration * 1.6 };
    const creatureEnter = {
        ...transition.reveal,
        duration: transition.reveal.duration * 1.6,
        delay: creatureExit.duration,
    };
    const [floatLayer, animateFloat] = useAnimate<HTMLDivElement>();
    const floatMotion = useRef<ReturnType<typeof animateFloat> | null>(null);
    const floatingRef = useRef(false);
    const floatDuration = useTempoTransition({ duration: 2.6 }).duration;
    const previewRef = useRef<HTMLDivElement>(null);
    const inView = useInView(previewRef, { amount: 0.25 });
    const loadedCreatures = useRef(new Set<string>());
    const [creatureIndex, setCreatureIndex] = useState(0);
    const [pageVisible, setPageVisible] = useState(() => !document.hidden);
    const currentCreature = creatures[creatureIndex];
    const floating = inView && pageVisible && !reduceMotion;
    const horizontal = useSpring(0, spring.slide);
    const vertical = useSpring(0, spring.slide);
    const rotateY = useTransform(horizontal, [-1, 1], [-6, 6]);
    const rotateX = useTransform(vertical, [-1, 1], [5, -5]);
    const creatureX = useTransform(horizontal, [-1, 1], [-13, 13]);
    const creatureY = useTransform(vertical, [-1, 1], [-9, 9]);
    const toolsX = useTransform(horizontal, [-1, -0.2, 1], [-10, 0, 0]);
    const toolsY = useTransform(horizontal, [-1, -0.2, 1], [-8, 0, 0]);
    const toolsDepth = useTransform(horizontal, [-1, -0.2, 1], [48, 30, 30]);
    const propertiesX = useTransform(horizontal, [-1, 0.2, 1], [0, 0, 10]);
    const propertiesY = useTransform(horizontal, [-1, 0.2, 1], [0, 0, -8]);
    const propertiesDepth = useTransform(horizontal, [-1, 0.2, 1], [30, 30, 48]);

    useEffect(() => {
        if (!reduceMotion) return;
        horizontal.jump(0);
        vertical.jump(0);
    }, [horizontal, reduceMotion, vertical]);

    useEffect(() => {
        const updateVisibility = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', updateVisibility);
        updateVisibility();
        return () => document.removeEventListener('visibilitychange', updateVisibility);
    }, []);

    useEffect(() => {
        if (!inView || !pageVisible || reduceMotion) return;
        const timer = window.setInterval(() => {
            setCreatureIndex((current) => {
                // Keep the current creature until another image is ready to show.
                for (let step = 1; step < creatures.length; step += 1) {
                    const next = (current + step) % creatures.length;
                    if (loadedCreatures.current.has(creatures[next].id)) return next;
                }
                return current;
            });
        }, creatureDisplayMs);
        return () => window.clearInterval(timer);
    }, [inView, pageVisible, reduceMotion]);

    // Keep the float on its own layer so pointer motion and creature swaps compose smoothly.
    useEffect(() => {
        const element = floatLayer.current;
        if (!element || reduceMotion) return;
        const animation = animateFloat(
            element,
            { y: [0, -12] },
            {
                duration: floatDuration,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'reverse',
                ease: 'easeInOut',
            },
        );
        if (!floatingRef.current) animation.pause();
        floatMotion.current = animation;
        return () => {
            animation.stop();
            floatMotion.current = null;
            element.style.transform = 'none';
        };
    }, [animateFloat, floatDuration, floatLayer, reduceMotion]);

    useEffect(() => {
        floatingRef.current = floating;
        if (floating) floatMotion.current?.play();
        else floatMotion.current?.pause();
    }, [floating]);

    function followPointer(event: PointerEvent<HTMLDivElement>) {
        if (reduceMotion || event.pointerType !== 'mouse') return;
        // Use the stationary wrapper to measure the pointer as the artwork tilts.
        const bounds = event.currentTarget.getBoundingClientRect();
        horizontal.set(
            Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1)),
        );
        vertical.set(
            Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1)),
        );
    }

    function resetPointer() {
        horizontal.set(0);
        vertical.set(0);
    }

    return (
        <div
            ref={previewRef}
            data-studio-preview=""
            role="img"
            aria-label="Minh họa Bookaria Studio với sinh vật biển, thanh công cụ bên trái và bảng thuộc tính bên phải."
            className="@container relative isolate aspect-[1.25] [perspective:950px] sm:aspect-[1.47]"
            onPointerMove={followPointer}
            onPointerLeave={resetPointer}
            onPointerCancel={resetPointer}
        >
            <motion.div
                aria-hidden="true"
                data-studio-preview-layer="stage"
                className="pointer-events-none absolute inset-0 select-none text-[clamp(0.44rem,1.65cqw,0.75rem)] [transform-style:preserve-3d]"
                style={{ rotateX, rotateY }}
            >
                <div className="absolute inset-x-[7%] inset-y-[10%] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[0_20px_48px_-22px_#0005]">
                    <div className="flex h-[12%] items-center justify-between border-border border-b px-[4%] font-medium">
                        <span>Đại dương thức giấc</span>
                        <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">
                            Xuất bản
                        </span>
                    </div>
                    <div className="absolute inset-x-0 top-[12%] bottom-0 bg-muted [perspective:380px]">
                        <div className="absolute inset-x-[14%] top-[30%] bottom-[12%] origin-bottom border border-foreground/15 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--text-primary)_12%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--text-primary)_12%,transparent)_1px,transparent_1px)] bg-size-[16px_16px] [transform:rotateX(47deg)] sm:bg-size-[24px_24px]" />
                        <div className="absolute inset-x-0 bottom-[5%] flex justify-center gap-1 text-muted-foreground">
                            <span className="grid aspect-square w-[5%] place-items-center rounded-md border border-foreground/60 bg-surface">
                                1
                            </span>
                            <span className="grid aspect-square w-[5%] place-items-center rounded-md border border-border bg-surface">
                                2
                            </span>
                            <span className="grid aspect-square w-[5%] place-items-center rounded-md border border-border bg-surface">
                                <Plus className="size-[58%]" />
                            </span>
                        </div>
                    </div>
                </div>

                <motion.div
                    data-studio-preview-layer="tools"
                    className="absolute top-[23%] left-[2%] w-[22%] rounded-[var(--radius-control)] border border-border bg-surface p-[1.25%] shadow-[0_14px_32px_-14px_#0005]"
                    style={{ x: toolsX, y: toolsY, z: toolsDepth }}
                >
                    {tools.map(({ icon: Icon, label }, index) => (
                        <div
                            key={label}
                            className={`flex items-center gap-[7%] rounded-md px-[7%] py-[8%] ${index === 0 ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
                        >
                            <Icon className="size-[1.28em] shrink-0" strokeWidth={1.75} />
                            <span>{label}</span>
                        </div>
                    ))}
                </motion.div>

                <motion.div
                    data-studio-preview-layer="properties"
                    className="absolute top-[33%] right-[2%] w-[24%] rounded-[var(--radius-control)] border border-border bg-surface p-[1.8%] shadow-[0_14px_32px_-14px_#0005]"
                    style={{ x: propertiesX, y: propertiesY, z: propertiesDepth }}
                >
                    <div className="flex items-center gap-1.5 font-semibold">
                        <SlidersHorizontal className="size-[1.2em] shrink-0" strokeWidth={1.75} />
                        Thuộc tính
                    </div>
                    <div className="mt-[9%] rounded-md border border-border bg-background px-[8%] py-[5%]">
                        {currentCreature.name}
                    </div>
                    <div className="mt-[10%] border-border border-t pt-[9%]">
                        <div className="mb-[7%] font-medium">Vị trí</div>
                        <div className="grid grid-cols-3 gap-1 text-muted-foreground">
                            {['X', 'Y', 'Z'].map((axis) => (
                                <span key={axis} className="rounded bg-muted py-1 text-center">
                                    {axis} 0
                                </span>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    data-studio-preview-layer="creature"
                    className="absolute top-[13%] left-[24%] aspect-[891/542] w-[52%] drop-shadow-[0_18px_15px_#0004] sm:top-[11%] sm:left-[21%] sm:w-[58%]"
                    style={{ x: creatureX, y: creatureY, z: 64 }}
                >
                    <div
                        ref={floatLayer}
                        data-studio-creature-float=""
                        className="absolute inset-0"
                    >
                        {(reduceMotion ? [currentCreature] : creatures).map((creature) => {
                            const active = creature.id === currentCreature.id;
                            return (
                                <motion.div
                                    key={creature.id}
                                    data-studio-creature={creature.id}
                                    className="absolute inset-0"
                                    initial={false}
                                    animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.65 }}
                                    transition={
                                        reduceMotion
                                            ? { duration: 0 }
                                            : active
                                              ? creatureEnter
                                              : creatureExit
                                    }
                                >
                                    <img
                                        src={`/images/home/ocean-${creature.id}.webp`}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        draggable={false}
                                        onLoad={() => loadedCreatures.current.add(creature.id)}
                                        className={
                                            creature.id === 'whale'
                                                ? 'absolute -top-[8.1%] -left-[50.2%] w-[161.6%] max-w-none'
                                                : 'absolute inset-0 size-full object-contain'
                                        }
                                    />
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
