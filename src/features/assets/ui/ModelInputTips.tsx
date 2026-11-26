import { Check, ChevronDown, Lightbulb, X } from 'lucide-react';
import { animate, motion, useInView, useMotionValue, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

const tips = [
    {
        id: 'subject',
        tab: 'Chủ thể',
        title: 'Một vật thể mỗi ảnh',
        description: 'Đặt vật thể ở giữa và để nó chiếm phần lớn khung hình.',
        avoid: 'Nhiều vật thể',
        prefer: 'Một chủ thể',
    },
    {
        id: 'ratio',
        tab: 'Tỉ lệ ảnh',
        title: 'Ưu tiên ảnh vuông',
        description:
            'Ảnh tỉ lệ 1:1 giúp vật thể nằm cân đối trong khung. Tránh khoảng trống quá lớn.',
        avoid: 'Khung quá dài',
        prefer: 'Khung vuông, cân đối',
    },
    {
        id: 'framing',
        tab: 'Khung hình',
        title: 'Giữ trọn hình dáng',
        description: 'Chừa khoảng trống quanh vật thể để thấy đủ các mép và chi tiết nhô ra.',
        avoid: 'Bị cắt mất một phần',
        prefer: 'Thấy trọn vật thể',
    },
    {
        id: 'background',
        tab: 'Nền ảnh',
        title: 'Nền gọn, ánh sáng đều',
        description: 'Dùng nền trơn, ít chữ và đủ sáng để đường viền vật thể rõ hơn.',
        avoid: 'Nền rối, thiếu sáng',
        prefer: 'Nền trơn, đủ sáng',
    },
    {
        id: 'rights',
        tab: 'Nội dung phù hợp',
        title: 'Chọn nội dung phù hợp',
        description:
            'Không tải ảnh có nội dung khiêu dâm, bạo lực, thù ghét hoặc vi phạm bản quyền.',
        avoid: 'Nội dung không phù hợp',
        prefer: 'Ảnh phù hợp và có quyền sử dụng',
    },
    {
        id: 'expectation',
        tab: 'Kết quả AI',
        title: 'Kết quả có thể khác ảnh gốc',
        description:
            'AI có thể thay đổi hình dáng và chi tiết. Hãy kiểm tra mô hình trước khi dùng.',
        avoid: 'Ảnh tham chiếu',
        prefer: 'Chi tiết có thể thay đổi',
    },
] as const;

function TipExample({
    tip,
    preferred = false,
}: {
    tip: (typeof tips)[number];
    preferred?: boolean;
}) {
    return (
        <figure
            className={cn('m-0 min-w-0 text-center', !preferred && tip.id !== 'rights' && 'mt-6')}
        >
            <div
                className={cn(
                    'relative mx-auto',
                    preferred ? 'w-[min(100%,176px)] rotate-6' : 'w-[min(100%,144px)] -rotate-8',
                    !preferred && tip.id === 'ratio' && 'w-[min(100%,112px)]',
                    tip.id === 'rights' && 'w-[min(100%,192px)] -rotate-6',
                )}
            >
                <img
                    alt={`${tip.title}: ${preferred ? tip.prefer : tip.avoid}`}
                    draggable={false}
                    decoding="async"
                    src={`/images/model-tips/${tip.id}-${preferred ? 'right' : 'left'}.webp`}
                    width={512}
                    height={512}
                    className="block h-auto w-full object-contain"
                />
                {tip.id !== 'expectation' && (
                    <span
                        className={cn(
                            'absolute -top-1 -right-1 grid size-8 place-items-center rounded-full shadow-sm',
                            preferred
                                ? 'bg-success-solid text-on-dark'
                                : 'bg-danger-solid text-on-dark',
                        )}
                    >
                        {preferred ? (
                            <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                        ) : (
                            <X className="size-5" strokeWidth={3} aria-hidden="true" />
                        )}
                    </span>
                )}
            </div>
        </figure>
    );
}

function TipSlide({ tip, index }: { tip: (typeof tips)[number]; index: number }) {
    return (
        <>
            <h3 className="m-0 text-center font-semibold text-muted-foreground text-sm">
                {tip.id !== 'expectation' && `Mẹo ${index + 1}: `}
                {tip.title}
            </h3>
            <p className="mx-auto mt-2 mb-0 min-h-12 max-w-[38ch] text-center text-sm leading-relaxed">
                {tip.description}
            </p>
            <div
                className={cn(
                    'relative mt-2 grid min-h-48 items-center gap-3 px-1 pt-2',
                    tip.id === 'rights' ? 'grid-cols-1' : 'grid-cols-2',
                )}
            >
                <TipExample tip={tip} />
                {tip.id === 'expectation' && (
                    <svg
                        className="pointer-events-none absolute top-[38%] left-1/2 h-8 w-12 -translate-x-1/2 text-highlight"
                        viewBox="0 0 48 32"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M3 26C12 8 27 5 43 12M34 3l10 9-11 8" />
                    </svg>
                )}
                {tip.id !== 'rights' && <TipExample tip={tip} preferred />}
            </div>
        </>
    );
}

export function ModelInputTips() {
    const panel = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    // End copies let the track wrap by one slide before snapping to the matching real slide.
    const [slide, setSlide] = useState({ index: 1, instant: true });
    const activeIndex = (slide.index - 1 + tips.length) % tips.length;
    const activeTip = tips[activeIndex].id;
    const [hovering, setHovering] = useState(false);
    const [focused, setFocused] = useState(false);
    const [dragging, setDragging] = useState(false);
    const reduceMotion = useReducedMotion();
    const dragOffset = useMotionValue(0);
    const slideTransition = {
        duration: reduceMotion ? 0 : 0.32,
        ease: [0.22, 1, 0.36, 1] as const,
    };
    const visible = useInView(panelRef, { amount: 0.25 });
    const rotating = visible && !hovering && !focused && !dragging && !reduceMotion;
    const moveTip = useCallback((direction: number) => {
        setSlide((current) => {
            if (current.index === 0 || current.index === tips.length + 1) return current;
            return { index: current.index + direction, instant: false };
        });
    }, []);
    useEffect(() => {
        if (!rotating) return;
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            moveTip(1);
        }, 3000);
        return () => window.clearInterval(timer);
    }, [rotating, moveTip]);

    return (
        <aside
            aria-label="Mẹo chọn ảnh"
            className="min-w-0 bg-popover p-1 md:col-start-1 md:row-start-1 md:flex md:flex-col md:justify-center md:p-4"
        >
            <Button
                variant="ghost"
                aria-expanded={expanded}
                aria-controls={panel}
                aria-label="Mẹo chọn ảnh"
                className="w-full justify-start px-2 md:hidden"
                onClick={() => setExpanded((open) => !open)}
            >
                <Lightbulb className="text-muted-foreground" aria-hidden="true" />
                <ChevronDown
                    className={cn(
                        'ml-auto transition-transform motion-reduce:transition-none',
                        expanded && 'rotate-180',
                    )}
                    aria-hidden="true"
                />
            </Button>
            <div
                id={panel}
                ref={panelRef}
                className={cn('px-3 md:flex md:flex-col md:px-0', !expanded && 'hidden')}
                onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setHovering(true);
                }}
                onPointerLeave={() => setHovering(false)}
                onFocusCapture={() => setFocused(true)}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                        setFocused(false);
                }}
            >
                <Tabs
                    value={activeTip}
                    onValueChange={(value) => {
                        setSlide((current) => {
                            const index = tips.findIndex((tip) => tip.id === value) + 1;
                            if (current.index === tips.length && index === 1)
                                return { index: tips.length + 1, instant: false };
                            if (current.index === 1 && index === tips.length)
                                return { index: 0, instant: false };
                            return { index, instant: false };
                        });
                    }}
                    className="gap-4"
                >
                    <div className="order-last flex items-center justify-center">
                        <TabsList
                            aria-label="Các mẹo chọn ảnh"
                            className="border-0 bg-transparent p-0"
                        >
                            {tips.map((tip) => (
                                <TabsTrigger
                                    key={tip.id}
                                    value={tip.id}
                                    aria-label={tip.tab}
                                    title={tip.tab}
                                    className="group/tip h-11 min-h-11 w-8 flex-none rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:bg-transparent"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-0.5 w-4 rounded-full bg-border group-hover/tip:bg-muted-foreground/60 group-focus-visible/tip:h-1 group-focus-visible/tip:bg-foreground group-data-[state=active]/tip:w-6 group-data-[state=active]/tip:bg-foreground motion-safe:transition-[height,width,background-color]"
                                    />
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <motion.div
                        style={{ touchAction: 'pan-y' }}
                        onPanStart={() => {
                            dragOffset.stop();
                            setDragging(true);
                        }}
                        onPan={(_event, info) => dragOffset.set(info.offset.x)}
                        onPanEnd={(_event, info) => {
                            setDragging(false);
                            if (
                                Math.abs(info.offset.x) >= 48 &&
                                Math.abs(info.offset.x) > Math.abs(info.offset.y)
                            ) {
                                moveTip(info.offset.x < 0 ? 1 : -1);
                            }
                            animate(dragOffset, 0, slideTransition);
                        }}
                        className="min-w-0 flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
                    >
                        <motion.div style={{ x: dragOffset }} className="h-full">
                            <motion.div
                                initial={false}
                                animate={{ x: `${-slide.index * 100}%` }}
                                transition={{
                                    ...slideTransition,
                                    duration: slide.instant ? 0 : slideTransition.duration,
                                }}
                                onAnimationComplete={() => {
                                    setSlide((current) => {
                                        if (current.index === 0)
                                            return { index: tips.length, instant: true };
                                        if (current.index === tips.length + 1)
                                            return { index: 1, instant: true };
                                        return current;
                                    });
                                }}
                                className="flex h-full"
                            >
                                <div
                                    aria-hidden="true"
                                    inert
                                    className="min-w-0 shrink-0 grow-0 basis-full px-2"
                                >
                                    <TipSlide tip={tips[tips.length - 1]} index={tips.length - 1} />
                                </div>
                                {tips.map((tip, index) => (
                                    <TabsContent
                                        key={tip.id}
                                        value={tip.id}
                                        forceMount
                                        aria-hidden={tip.id !== activeTip || undefined}
                                        inert={tip.id !== activeTip}
                                        className="min-w-0 shrink-0 grow-0 basis-full px-2 data-[state=inactive]:pointer-events-none data-[state=inactive]:block"
                                    >
                                        <TipSlide tip={tip} index={index} />
                                    </TabsContent>
                                ))}
                                <div
                                    aria-hidden="true"
                                    inert
                                    className="min-w-0 shrink-0 grow-0 basis-full px-2"
                                >
                                    <TipSlide tip={tips[0]} index={0} />
                                </div>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                </Tabs>
            </div>
        </aside>
    );
}
