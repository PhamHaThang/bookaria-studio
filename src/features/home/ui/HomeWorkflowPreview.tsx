import {
    useMotionTokens,
    useShouldReduceMotion,
    useTempoTransition,
} from '@animate-ui/react/utils/motion';
import {
    Box,
    Check,
    FileText,
    Image,
    Layers,
    Link2,
    MousePointer2,
    Play,
    QrCode,
    RotateCcw,
    ScanLine,
} from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';

export type WorkflowStep = 'import' | 'edit' | 'publish';

const scenes = {
    import: {
        number: 1,
        description: 'Minh họa nhập chương sách từ tệp PDF và thêm ảnh bìa.',
    },
    edit: {
        number: 2,
        description:
            'Mô hình cá voi hiện trên trang. Con trỏ di chuyển tới mô hình, sau đó âm thanh được minh họa bằng dạng sóng.',
    },
    publish: {
        number: 3,
        description: 'Sách được mở trên điện thoại và mô hình cá voi hiện ra ở chế độ AR.',
    },
} as const;

function EditCursor() {
    const { ease } = useMotionTokens();
    const transition = useTempoTransition({
        duration: 0.88,
        delay: 0.8,
        ease: ease.soft,
    });

    return (
        <motion.div
            className="absolute inset-0 z-10"
            initial={{ x: '79%', y: '72%', opacity: 0 }}
            animate={{ x: '64%', y: '49%', opacity: 1 }}
            transition={transition}
        >
            <MousePointer2 className="size-5 fill-foreground text-background drop-shadow-sm sm:size-6" />
        </motion.div>
    );
}

function ImportScene({ play }: { play: boolean }) {
    const { transition } = useMotionTokens();
    const fileArrival = useTempoTransition({ duration: 0.55, delay: 0.18 });
    const coverArrival = useTempoTransition({ duration: 0.55, delay: 0.64 });
    const confirm = useTempoTransition({ duration: 0.32, delay: 1.25 });
    const fileClassName =
        'absolute z-10 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1.5 font-semibold text-[clamp(0.625rem,2.15cqw,0.875rem)] shadow-[var(--shadow-popover)] sm:px-3 sm:py-2';

    return (
        <div className="absolute inset-y-[7%_12%] left-1/2 w-[clamp(7rem,37cqw,15.5rem)] -translate-x-1/2">
            <div className="absolute inset-0 flex flex-col rounded-[var(--radius-control)] border border-border bg-surface p-[clamp(0.625rem,3cqw,1.375rem)] shadow-[var(--shadow-popover)]">
                <div className="flex flex-col gap-[clamp(0.25rem,1cqw,0.5rem)]">
                    <span className="h-1.5 w-2/3 rounded-full bg-foreground/15 sm:h-2" />
                    <span className="h-1 w-full rounded-full bg-foreground/10 sm:h-1.5" />
                    <span className="h-1 w-5/6 rounded-full bg-foreground/10 sm:h-1.5" />
                </div>
                <div className="mt-[clamp(0.625rem,3.5cqw,1.625rem)] grid h-[45%] min-h-8 place-items-center rounded-lg border border-foreground/30 border-dashed bg-muted px-1 text-center font-medium text-[clamp(0.625rem,2.1cqw,0.8125rem)] text-muted-foreground">
                    Thả PDF hoặc ảnh vào đây
                </div>
                <span className="mt-[clamp(0.5rem,2cqw,1rem)] h-1 w-1/2 rounded-full bg-foreground/10 sm:h-1.5" />
            </div>
            <motion.div
                className={`${fileClassName} top-[15%] left-0 -translate-x-[61%] sm:top-[27%]`}
                initial={play ? { opacity: 0, x: -16, y: -8 } : false}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ ...fileArrival, ease: transition.reveal.ease }}
            >
                <FileText className="size-3 shrink-0 sm:size-3.5" />
                chuong-1.pdf
            </motion.div>
            <motion.div
                className={`${fileClassName} top-[70%] right-0 translate-x-[55%] sm:top-[58%]`}
                initial={play ? { opacity: 0, x: 16, y: 8 } : false}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ ...coverArrival, ease: transition.reveal.ease }}
            >
                <Image className="size-3 shrink-0 sm:size-3.5" />
                bia-sach.jpg
            </motion.div>
            <motion.div
                className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 font-semibold text-[clamp(0.625rem,2.1cqw,0.875rem)] text-primary-foreground sm:px-4 sm:py-2"
                initial={play ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...confirm, ease: transition.reveal.ease }}
            >
                <Check className="size-3 shrink-0 sm:size-4" />
                Đã nhập 24 trang
            </motion.div>
        </div>
    );
}

const waveformBars = [
    { height: 5, peak: 1.45, delay: 0.12 },
    { height: 9, peak: 1.3, delay: 0.06 },
    { height: 12, peak: 1.18, delay: 0 },
    { height: 8, peak: 1.4, delay: 0.08 },
    { height: 4, peak: 1.6, delay: 0.16 },
];

function AudioWaveform({ play }: { play: boolean }) {
    const pulse = useTempoTransition({ duration: 0.52, delay: 1.98 });
    const stagger = useTempoTransition({ duration: 1 }).duration;

    return (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center gap-px">
            {waveformBars.map(({ height, peak, delay }) => (
                <motion.span
                    key={height}
                    className="w-[2px] rounded-full bg-current"
                    style={{ height }}
                    initial={false}
                    animate={play ? { scaleY: [1, peak, 0.58, 1] } : undefined}
                    transition={{
                        ...pulse,
                        delay: pulse.delay + delay * stagger,
                        repeat: Infinity,
                    }}
                />
            ))}
        </span>
    );
}

function EditScene({ play }: { play: boolean }) {
    const { transition } = useMotionTokens();
    const appear = useTempoTransition({ duration: 0.52, delay: 0.22 });
    const select = useTempoTransition({ duration: 0.2, delay: 1.55 });
    const sound = useTempoTransition({ duration: 0.3, delay: 1.76 });

    return (
        <>
            <div className="absolute inset-y-[8%] right-[8%] left-[28%] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-sm">
                <div className="border-border border-b px-[3cqw] py-[2cqw] font-semibold text-[clamp(0.625rem,2.5cqw,0.9375rem)]">
                    Đại dương thức giấc
                </div>
                <img
                    src="/images/home/ocean-book.webp"
                    alt=""
                    className="absolute inset-x-[8%] bottom-[5%] h-[64%] w-[84%] object-contain opacity-55"
                />
            </div>
            <div className="absolute top-[30%] left-[13%] flex flex-col items-center gap-1 rounded-[var(--radius-control)] border border-border bg-surface p-1 text-muted-foreground shadow-md sm:p-1.5">
                <span className="grid size-[clamp(1.5rem,6cqw,2.5rem)] place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Box className="size-3.5 sm:size-4" />
                </span>
                <span className="grid size-[clamp(1.5rem,6cqw,2.5rem)] place-items-center">
                    <Play className="size-3.5 sm:size-4" />
                </span>
                <span className="grid size-[clamp(1.5rem,6cqw,2.5rem)] place-items-center">
                    <Layers className="size-3.5 sm:size-4" />
                </span>
            </div>
            <motion.div
                className="absolute top-[24%] right-[18%] bottom-[27%] left-[43%]"
                initial={play ? { y: 8, opacity: 0, scale: 0.91 } : false}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ ...appear, ease: transition.reveal.ease }}
            >
                <motion.div
                    className="absolute inset-0 border border-[var(--editor-axis-z)]"
                    initial={play ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={select}
                >
                    {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map(
                        (position) => (
                            <span
                                key={position}
                                className={`absolute size-1.5 border border-[var(--editor-axis-z)] bg-surface ${position}`}
                            />
                        ),
                    )}
                </motion.div>
                <img
                    src="/images/home/ocean-whale.webp"
                    alt=""
                    className="absolute inset-0 size-full object-contain"
                />
            </motion.div>
            <motion.div
                className="absolute right-[4%] bottom-[4%] flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 font-medium text-[clamp(0.625rem,2.25cqw,0.875rem)] shadow-sm"
                initial={play ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...sound, ease: transition.reveal.ease }}
            >
                <AudioWaveform play={play} />
                Âm thanh đại dương
            </motion.div>
            {play && <EditCursor />}
        </>
    );
}

function PublishScene({ play }: { play: boolean }) {
    const { transition } = useMotionTokens();
    const phone = useTempoTransition({ duration: 0.5, delay: 0.1 });
    const qr = useTempoTransition({ duration: 0.5, delay: 0.52 });
    const link = useTempoTransition({ duration: 0.5, delay: 0.87 });
    const scan = useTempoTransition({ duration: 1.12, delay: 1.32 });
    const appear = useTempoTransition({ duration: 0.68, delay: 2.42 });

    return (
        <>
            <div className="absolute inset-y-[2%_3%] left-[33%] -translate-x-1/2">
                <motion.div
                    className="relative aspect-[1/2] h-full rounded-[clamp(1rem,4.6cqw,2rem)] bg-[var(--palette-neutral-900)] p-[3px] shadow-[var(--shadow-popover)] ring-1 ring-foreground/15 sm:p-[5px]"
                    initial={play ? { opacity: 0, y: 12 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...phone, ease: transition.reveal.ease }}
                >
                    <div className="relative size-full overflow-hidden rounded-[clamp(0.85rem,4cqw,1.7rem)] bg-surface">
                        <span className="absolute top-[4%] left-1/2 z-10 h-[3%] w-[24%] -translate-x-1/2 rounded-full bg-[var(--palette-neutral-900)]" />
                        <span className="absolute bottom-[3%] left-1/2 z-10 h-[1.2%] w-[33%] -translate-x-1/2 rounded-full bg-foreground/75" />
                        <motion.div
                            className="absolute inset-x-[8%] top-[11%] z-10 flex items-center justify-center gap-1 whitespace-nowrap rounded-full bg-primary px-1 py-0.5 font-semibold text-[clamp(0.5rem,1.75cqw,0.75rem)] text-primary-foreground sm:py-1"
                            initial={play ? { opacity: 0, y: -4 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...appear, ease: transition.reveal.ease }}
                        >
                            <ScanLine className="size-2.5 shrink-0 sm:size-3" />
                            AR đang bật
                        </motion.div>
                        <img
                            src="/images/home/ocean-book.webp"
                            alt=""
                            className="absolute inset-x-[6%] bottom-[9%] h-[46%] w-[88%] object-contain"
                        />
                        {play && (
                            <motion.div
                                className="absolute inset-x-[9%] top-[30%] bottom-[15%] z-10"
                                initial={{ y: '0%', opacity: 0 }}
                                animate={{ y: '92%', opacity: [0, 1, 1, 0] }}
                                transition={{ ...scan, ease: transition.reveal.ease }}
                            >
                                <span className="block h-px rounded-full bg-foreground/70" />
                            </motion.div>
                        )}
                        <motion.img
                            src="/images/home/ocean-whale.webp"
                            alt=""
                            className="absolute inset-x-[4%] top-[23%] h-[49%] w-[92%] object-contain"
                            initial={play ? { opacity: 0, scale: 0.7, y: 12 } : false}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ ...appear, ease: transition.reveal.ease }}
                        />
                    </div>
                </motion.div>
            </div>
            <div className="absolute top-[24%] right-[10%] flex w-[29%] flex-col gap-2 sm:gap-3">
                <motion.div
                    className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-border bg-surface p-[2.5cqw] text-center font-medium text-[clamp(0.625rem,2.2cqw,0.875rem)] shadow-sm"
                    initial={play ? { opacity: 0, x: 12 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...qr, ease: transition.reveal.ease }}
                >
                    <QrCode className="size-[clamp(1.75rem,10cqw,4.5rem)]" strokeWidth={1.35} />
                    Mã QR của sách
                </motion.div>
                <motion.div
                    className="flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-1.5 text-center font-medium text-[clamp(0.625rem,2.2cqw,0.875rem)] shadow-sm sm:px-2.5"
                    initial={play ? { opacity: 0, x: 12 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...link, ease: transition.reveal.ease }}
                >
                    <Link2 className="hidden size-3.5 shrink-0 sm:block" />
                    Liên kết sách
                </motion.div>
            </div>
        </>
    );
}

const previews = { import: ImportScene, edit: EditScene, publish: PublishScene };

export function HomeWorkflowPreview({ step }: { step: WorkflowStep }) {
    const stage = useRef<HTMLDivElement>(null);
    const inView = useInView(stage, { amount: 0.35 });
    const reduceMotion = useShouldReduceMotion();
    const [replay, setReplay] = useState(0);
    const { transition } = useMotionTokens();
    const play = inView && !reduceMotion;
    const Scene = previews[step];
    const stepNumber = scenes[step].number;

    return (
        <div
            ref={stage}
            className="@container relative isolate aspect-[1.2] min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted sm:aspect-[1.5]"
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border-default)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-default)_1px,transparent_1px)] bg-size-[2rem_2rem] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
            />
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-3">
                <p className="m-0 flex min-h-8 items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-2 font-medium text-muted-foreground text-xs">
                    <span
                        aria-hidden="true"
                        className="grid size-5 place-items-center rounded-full bg-primary font-semibold text-[10px] text-primary-foreground"
                    >
                        {stepNumber}
                    </span>
                    Bước {stepNumber} / {Object.keys(previews).length}
                </p>
                {!reduceMotion && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Phát lại"
                        aria-label="Phát lại"
                        onClick={() => setReplay((value) => value + 1)}
                    >
                        <RotateCcw aria-hidden="true" />
                    </Button>
                )}
            </div>
            <div role="img" aria-label={scenes[step].description} className="absolute inset-0">
                <motion.div
                    key={`${step}-${replay}-${play}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-12 bottom-3 sm:top-14 sm:bottom-5"
                    initial={play ? { opacity: 0, y: 10, scale: 0.98 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={transition.reveal}
                >
                    <Scene play={play} />
                </motion.div>
            </div>
        </div>
    );
}
