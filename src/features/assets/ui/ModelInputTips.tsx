import { Check, ChevronDown, Lightbulb, Pause, Play, X } from 'lucide-react';
import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

const tips = [
    {
        id: 'subject',
        tab: 'Chủ thể',
        title: 'Một vật thể mỗi ảnh',
        description: 'Đặt vật thể ở giữa và để nó chiếm phần lớn khung hình.',
        image: 'ocean-turtle',
        avoid: 'Nhiều vật thể',
        prefer: 'Một chủ thể',
        backdrop: 'bg-[#d9eee8] dark:bg-[#25483f]',
        tint: 'sepia-[.45] hue-rotate-[70deg] saturate-[1.3]',
    },
    {
        id: 'framing',
        tab: 'Khung hình',
        title: 'Giữ trọn hình dáng',
        description: 'Chừa khoảng trống quanh vật thể để thấy đủ các mép và chi tiết nhô ra.',
        image: 'ocean-octopus',
        avoid: 'Bị cắt mất một phần',
        prefer: 'Thấy trọn vật thể',
        backdrop: 'bg-[#f9dfe6] dark:bg-[#543040]',
        tint: 'sepia-[.48] hue-rotate-[315deg] saturate-[1.7]',
    },
    {
        id: 'background',
        tab: 'Nền ảnh',
        title: 'Nền gọn, ánh sáng đều',
        description: 'Dùng nền trơn, ít chữ và đủ sáng để đường viền vật thể rõ hơn.',
        image: 'ocean-ray',
        avoid: 'Nền rối, thiếu sáng',
        prefer: 'Nền trơn, đủ sáng',
        backdrop: 'bg-[#dce9fb] dark:bg-[#283e5e]',
        tint: 'sepia-[.28] hue-rotate-[170deg] saturate-[1.5]',
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
        <figure className={cn('m-0 min-w-0 text-center', !preferred && 'mt-3')}>
            <div
                className={cn(
                    'relative mx-auto w-[min(100%,156px)]',
                    preferred ? 'rotate-4' : '-rotate-4',
                )}
            >
                <div
                    className={cn(
                        'relative grid aspect-[1.2] place-items-center overflow-hidden rounded-xl shadow-sm',
                        preferred ? tip.backdrop : 'bg-[#f2e7d6] dark:bg-[#483b31]',
                        !preferred &&
                            tip.id === 'background' &&
                            'bg-[repeating-linear-gradient(137deg,#b99a8c_0_8px,#dfc2a9_8px_17px,#c9ad91_17px_23px)]',
                    )}
                >
                    <img
                        alt=""
                        draggable={false}
                        src={`/images/home/${tip.image}.webp`}
                        className={cn(
                            'relative h-full w-full object-contain p-4 drop-shadow-md',
                            preferred ? tip.tint : 'opacity-90',
                            !preferred &&
                                tip.id === 'framing' &&
                                'translate-x-[27%] translate-y-[23%] scale-[1.8]',
                            !preferred && tip.id === 'background' && 'brightness-[.55]',
                            !preferred &&
                                tip.id === 'subject' &&
                                'w-[70%] -translate-x-[22%] translate-y-[20%]',
                        )}
                    />
                    {!preferred && tip.id === 'subject' && (
                        <>
                            <img
                                src="/images/home/ocean-octopus.webp"
                                alt=""
                                draggable={false}
                                className="pointer-events-none absolute top-[10%] right-[4%] w-[46%] -rotate-12 drop-shadow-sm"
                            />
                            <img
                                src="/images/home/ocean-ray.webp"
                                alt=""
                                draggable={false}
                                className="pointer-events-none absolute right-[4%] bottom-[12%] w-[48%] rotate-12 drop-shadow-sm"
                            />
                        </>
                    )}
                </div>
                <span
                    className={cn(
                        'absolute -top-2 -right-2 grid size-7 place-items-center rounded-full shadow-sm',
                        preferred
                            ? 'bg-success text-success-foreground'
                            : 'bg-popover text-destructive',
                    )}
                >
                    {preferred ? (
                        <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                        <X className="size-4" strokeWidth={2.5} aria-hidden="true" />
                    )}
                </span>
            </div>
            <figcaption
                className={cn(
                    'mt-3 text-xs',
                    preferred ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
            >
                {preferred ? tip.prefer : tip.avoid}
            </figcaption>
        </figure>
    );
}

export function ModelInputTips() {
    const panel = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const rotationButton = useRef<HTMLButtonElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [activeTip, setActiveTip] = useState<string>(tips[0].id);
    const [autoPlayPreference, setAutoPlay] = useState<boolean | null>(null);
    const [hovering, setHovering] = useState(false);
    const reduceMotion = useReducedMotion();
    const visible = useInView(panelRef, { amount: 0.25 });
    const autoPlay = autoPlayPreference ?? !reduceMotion;
    const rotating = autoPlay && visible && !hovering;
    useEffect(() => {
        if (!rotating) return;
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            setActiveTip((current) => {
                const position = tips.findIndex((tip) => tip.id === current);
                return tips[(position + 1) % tips.length].id;
            });
        }, 3000);
        return () => window.clearInterval(timer);
    }, [rotating]);

    return (
        <aside
            aria-label="Mẹo chọn ảnh"
            className="min-w-0 rounded-2xl bg-popover p-1 ring-1 ring-border/80 ring-inset md:col-start-1 md:row-start-1 md:flex md:flex-col md:px-5 md:pt-5 md:pb-2"
        >
            <h2 className="m-0 hidden items-center gap-2 font-semibold text-sm md:flex">
                <Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" /> Mẹo chọn
                ảnh
            </h2>
            <Button
                variant="ghost"
                aria-expanded={expanded}
                aria-controls={panel}
                className="w-full justify-start px-2 md:hidden"
                onClick={() => setExpanded((open) => !open)}
            >
                <Lightbulb className="text-muted-foreground" aria-hidden="true" /> Mẹo chọn ảnh
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
                className={cn(
                    'mt-3 px-3 md:flex md:flex-1 md:flex-col md:px-0',
                    !expanded && 'hidden',
                )}
                onPointerEnter={(event) => {
                    if (event.pointerType !== 'touch') setHovering(true);
                }}
                onPointerLeave={() => setHovering(false)}
            >
                <Tabs
                    value={activeTip}
                    onValueChange={(value) => {
                        setActiveTip(value);
                        setAutoPlay(false);
                    }}
                    onFocusCapture={(event) => {
                        if (!rotationButton.current?.contains(event.target)) setAutoPlay(false);
                    }}
                    className="gap-2 md:flex-1"
                >
                    <div className="relative order-last flex items-center justify-center">
                        <Button
                            ref={rotationButton}
                            variant="ghost"
                            size="icon"
                            title={autoPlay ? 'Tạm dừng tự chuyển mẹo' : 'Bật tự chuyển mẹo'}
                            aria-label={autoPlay ? 'Tạm dừng tự chuyển mẹo' : 'Bật tự chuyển mẹo'}
                            className="absolute right-0 rounded-full text-muted-foreground"
                            onClick={() => setAutoPlay(!autoPlay)}
                        >
                            {autoPlay ? (
                                <Pause className="size-4" aria-hidden="true" />
                            ) : (
                                <Play className="size-4" aria-hidden="true" />
                            )}
                        </Button>
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
                                    className="group/tip size-11 min-h-11 flex-none rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:bg-transparent md:w-8"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-0.5 w-4 rounded-full bg-border group-hover/tip:bg-muted-foreground/60 group-focus-visible/tip:h-1 group-focus-visible/tip:bg-foreground group-data-[state=active]/tip:w-6 group-data-[state=active]/tip:bg-foreground motion-safe:transition-[height,width,background-color]"
                                    />
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <div className="grid min-w-0 flex-1">
                        {tips.map((tip) => (
                            <TabsContent
                                key={tip.id}
                                value={tip.id}
                                forceMount
                                aria-hidden={tip.id !== activeTip || undefined}
                                inert={tip.id !== activeTip}
                                className="col-start-1 row-start-1 min-w-0 data-[state=inactive]:pointer-events-none data-[state=inactive]:block data-[state=inactive]:opacity-0 motion-safe:transition-[opacity,translate] motion-safe:duration-500 motion-safe:ease-in-out motion-safe:data-[state=inactive]:translate-y-1"
                            >
                                <h3 className="m-0 font-semibold text-base">{tip.title}</h3>
                                <p className="m-0 mt-1 min-h-10 text-muted-foreground text-sm">
                                    {tip.description}
                                </p>
                                <div className="mt-4 grid grid-cols-2 items-start gap-4 px-2 pt-2">
                                    <TipExample tip={tip} />
                                    <TipExample tip={tip} preferred />
                                </div>
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
            </div>
        </aside>
    );
}
