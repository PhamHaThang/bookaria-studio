import { useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { ArrowRight, BookOpen, Plus } from 'lucide-react';
import { motion, useAnimate, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';

/** A lightweight illustrated interaction sample; it never starts the editor or AR runtime. */
function ARBookIllustration() {
    const reduceMotion = useShouldReduceMotion();
    const [imageFailed, setImageFailed] = useState(false);
    const [open, setOpen] = useState(false);
    const [readyLayers, setReadyLayers] = useState(0);
    const [pageVisible, setPageVisible] = useState(() => document.visibilityState !== 'hidden');
    const stage = useRef<HTMLDivElement>(null);
    const inView = useInView(stage, { amount: 0.1 });
    const [whale, animate] = useAnimate<HTMLDivElement>();
    const whaleMotion = useRef<ReturnType<typeof animate> | null>(null);
    const imagesReady = readyLayers === 3;
    const moving = imagesReady && inView && pageVisible && !open && !reduceMotion && !imageFailed;

    useEffect(() => {
        const update = () => setPageVisible(document.visibilityState !== 'hidden');
        document.addEventListener('visibilitychange', update);
        update();
        return () => document.removeEventListener('visibilitychange', update);
    }, []);

    // Pause/resume the same timeline so opening a note never restarts the whale's motion.
    useEffect(() => {
        if (!whale.current || !imagesReady || imageFailed || reduceMotion) return;
        const element = whale.current;
        const animation = animate(
            element,
            {
                y: [0, -16],
                x: [0, 4],
                rotate: [0, -1],
            },
            {
                duration: 2.4,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'reverse',
                ease: [0.37, 0, 0.63, 1],
            },
        );
        animation.pause();
        whaleMotion.current = animation;
        return () => {
            animation.stop();
            whaleMotion.current = null;
            element.style.transform = 'none';
        };
    }, [animate, whale, imagesReady, imageFailed, reduceMotion]);

    useEffect(() => {
        if (moving) whaleMotion.current?.play();
        else whaleMotion.current?.pause();
    }, [moving]);

    return (
        <div ref={stage} className="relative min-w-0">
            <motion.div
                className="motion-reduce:transform-none!"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                <div
                    data-slot="hero-artwork"
                    className="relative mx-auto aspect-[4/3] w-full max-w-[760px]"
                >
                    {imageFailed ? (
                        <div className="absolute inset-10 flex flex-col items-center justify-center gap-5 rounded-[var(--radius-feature)] border border-border bg-surface">
                            <BookariaLogo symbol className="w-20" />
                            <p className="m-0 text-muted-foreground text-sm">
                                Mỗi trang sách, một khám phá.
                            </p>
                        </div>
                    ) : (
                        <>
                            <img
                                src="/images/home/ocean-book.webp"
                                alt="Cuốn sách mở với minh họa đại dương bằng nét mực đen trắng."
                                width={1440}
                                height={1080}
                                fetchPriority="high"
                                decoding="async"
                                draggable={false}
                                onLoad={() => setReadyLayers((ready) => ready | 1)}
                                onError={() => setImageFailed(true)}
                                className="pointer-events-none size-full select-none object-contain"
                            />
                            <div
                                ref={whale}
                                data-slot="hero-whale"
                                className="motion-reduce:transform-none! pointer-events-none absolute inset-0 origin-[65%_30%]"
                            >
                                <img
                                    src="/images/home/ocean-whale.webp"
                                    alt="Cá voi nổi phía trên trang sách."
                                    width={1440}
                                    height={1080}
                                    fetchPriority="high"
                                    decoding="async"
                                    draggable={false}
                                    onLoad={() => setReadyLayers((ready) => ready | 2)}
                                    onError={() => setImageFailed(true)}
                                    className="size-full select-none object-contain"
                                />
                            </div>
                        </>
                    )}
                    {!imageFailed && (
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-[46%] left-[40%] min-h-11 gap-2 rounded-full border-foreground/20 bg-surface px-3 shadow-lg hover:not-disabled:bg-surface hover:not-disabled:shadow-xl motion-safe:transition-[background-color,box-shadow] sm:left-[65%]"
                                    aria-label="Chạm thử: khám phá đại dương"
                                >
                                    <Plus aria-hidden="true" data-icon="inline-start" />
                                    Chạm thử
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                side="top"
                                sideOffset={12}
                                collisionPadding={20}
                                className="w-[260px] gap-4 p-5"
                            >
                                <PopoverHeader className="gap-2">
                                    <PopoverTitle className="mb-2">Khám phá đại dương</PopoverTitle>
                                    <PopoverDescription className="m-0 leading-relaxed">
                                        Một điểm chạm nhỏ có thể mở ra cả câu chuyện. Cùng khám phá
                                        những cuốn sách khác nhé.
                                    </PopoverDescription>
                                </PopoverHeader>
                                <Button size="sm" variant="outline" asChild>
                                    <Link to="/library">
                                        Khám phá thư viện{' '}
                                        <ArrowRight aria-hidden="true" data-icon="inline-end" />
                                    </Link>
                                </Button>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </motion.div>
            <div className="mt-1 flex min-h-8 items-center justify-center gap-2 sm:mt-4">
                <p className="m-0 text-center text-muted-foreground text-xs leading-relaxed sm:text-sm">
                    Chạm thử để khám phá câu chuyện.
                </p>
            </div>
        </div>
    );
}

export function HomeHero() {
    return (
        <section
            aria-labelledby="home-heading"
            className="relative mx-auto grid w-full max-w-[1328px] items-center gap-6 px-6 pt-12 pb-12 sm:px-8 sm:pt-16 sm:pb-16 lg:min-h-[690px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-0 lg:pt-16 lg:pb-20"
        >
            <div className="relative z-10 flex min-w-0 flex-col items-start gap-7 lg:pb-5">
                <h1
                    id="home-heading"
                    className="m-0 max-w-[11ch] text-balance font-semibold text-[clamp(2.75rem,5.2vw,4.5rem)] leading-[1.08] tracking-[-0.055em]"
                >
                    Sáng tạo sách.
                    <br />
                    Kiến tạo
                    <br />
                    <span className="text-muted-foreground"> trải nghiệm.</span>
                </h1>
                <p className="m-0 max-w-[38ch] text-pretty text-base text-muted-foreground leading-[1.75] sm:text-lg">
                    Nền tảng biên soạn và trải nghiệm sách tương tác, nơi trí tưởng tượng vượt xa
                    giới hạn của trang giấy.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 max-sm:w-full max-sm:[&>a]:w-full">
                    <Button size="hero" asChild>
                        <Link to="/library">
                            Khám phá sách <ArrowRight aria-hidden="true" data-icon="inline-end" />
                        </Link>
                    </Button>
                    <Button variant="outline" size="hero" asChild>
                        <AuthRequiredLink to="/books/new">
                            <BookOpen aria-hidden="true" data-icon="inline-start" />
                            Tạo sách của bạn
                        </AuthRequiredLink>
                    </Button>
                </div>
            </div>
            <ARBookIllustration />
        </section>
    );
}
