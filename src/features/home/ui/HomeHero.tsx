import { useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { ArrowRight, BookOpen, ChevronDown, MousePointer2, ScanLine } from 'lucide-react';
import { motion, useAnimate, useInView, useSpring } from 'motion/react';
import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { Button as PrimitiveButton } from '@/shared/ui/primitives/button';
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';

// Near-critical damping keeps pointer reversals fluid without wobble or a long settling tail.
const bookTiltSpring = { stiffness: 110, damping: 21, mass: 1, restDelta: 0.001, restSpeed: 0.001 };
const bookDriftSpring = { stiffness: 85, damping: 19, mass: 1, restDelta: 0.001, restSpeed: 0.001 };

function softenPointer(value: number) {
    // Ease into the outer limits instead of accelerating until the pointer leaves the scene.
    return Math.sin((Math.max(-1, Math.min(1, value)) * Math.PI) / 2);
}

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
    const pointerInside = useRef(false);
    const rotateX = useSpring(0, bookTiltSpring);
    const rotateZ = useSpring(0, bookTiltSpring);
    const parallaxX = useSpring(0, bookDriftSpring);
    const parallaxY = useSpring(0, bookDriftSpring);

    const resetPerspective = useCallback(() => {
        rotateX.set(0);
        rotateZ.set(0);
        parallaxX.set(0);
        parallaxY.set(0);
    }, [rotateX, rotateZ, parallaxX, parallaxY]);

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        if (open || reduceMotion || imageFailed || !imagesReady || event.pointerType !== 'mouse')
            return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        pointerInside.current = true;
        // Measure the fixed hit area, never the tilted artwork, to avoid feedback jitter.
        const rect = event.currentTarget.getBoundingClientRect();
        const x = softenPointer(((event.clientX - rect.left) / rect.width - 0.5) * 2);
        const y = softenPointer(((event.clientY - rect.top) / rect.height - 0.5) * 2);
        rotateX.set(-y * 3);
        rotateZ.set(x * 1.6);
        parallaxX.set(x * 2);
        parallaxY.set(y * 1.2);
    }

    function handlePointerLeave() {
        pointerInside.current = false;
        if (!open) resetPerspective();
    }

    useEffect(() => {
        if (open) {
            // Keep the current angle when opening a note instead of snapping back to zero.
            rotateX.jump(rotateX.get());
            rotateZ.jump(rotateZ.get());
            parallaxX.jump(parallaxX.get());
            parallaxY.jump(parallaxY.get());
        } else if (!pointerInside.current) resetPerspective();
    }, [open, resetPerspective, rotateX, rotateZ, parallaxX, parallaxY]);

    useEffect(() => {
        if (!reduceMotion && pageVisible && inView && !imageFailed) return;
        pointerInside.current = false;
        rotateX.jump(0);
        rotateZ.jump(0);
        parallaxX.jump(0);
        parallaxY.jump(0);
    }, [reduceMotion, pageVisible, inView, imageFailed, rotateX, rotateZ, parallaxX, parallaxY]);

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
                    className="relative mx-auto aspect-4/3 w-full max-w-[760px] [perspective:1200px] lg:max-w-[min(100%,64dvh)]"
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                    onPointerCancel={handlePointerLeave}
                >
                    {imageFailed ? (
                        <div className="absolute inset-10 flex flex-col items-center justify-center gap-5 rounded-[var(--radius-feature)] border border-border bg-surface">
                            <BookariaLogo symbol className="w-20" />
                            <p className="m-0 text-muted-foreground text-sm">
                                Mỗi trang sách, một khám phá.
                            </p>
                        </div>
                    ) : (
                        <motion.div
                            data-slot="hero-perspective"
                            className="motion-reduce:transform-none! pointer-events-none absolute inset-0 origin-[50%_75%] [transform-style:preserve-3d]"
                            style={{
                                rotateX: reduceMotion ? 0 : rotateX,
                                rotateZ: reduceMotion ? 0 : rotateZ,
                                x: reduceMotion ? 0 : parallaxX,
                                y: reduceMotion ? 0 : parallaxY,
                            }}
                        >
                            {/* The image already has perspective; a small pitch preserves readable pages. */}
                            <motion.div
                                data-slot="hero-book-plane"
                                className="motion-reduce:transform-none! absolute inset-0 origin-[50%_75%]"
                                style={{
                                    rotateX: reduceMotion ? 0 : 5,
                                    rotateZ: reduceMotion ? 0 : -0.65,
                                    z: reduceMotion ? 0 : -24,
                                }}
                            >
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
                            </motion.div>
                            <motion.div
                                data-slot="hero-whale-depth"
                                className="motion-reduce:transform-none! absolute inset-0 [transform-style:preserve-3d]"
                                style={{ z: reduceMotion ? 0 : 28 }}
                            >
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
                            </motion.div>
                        </motion.div>
                    )}
                    {!imageFailed && (
                        <Popover open={open} onOpenChange={setOpen}>
                            {/* Anchor to the fixed slot, not the floating trigger's animated bounds. */}
                            <PopoverAnchor asChild>
                                <div
                                    data-hero-note-anchor=""
                                    className="absolute top-[46%] left-[40%] inline-flex sm:left-[65%]"
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="min-h-11 gap-2 rounded-full border-foreground/20 bg-[color-mix(in_srgb,var(--bg-surface)_88%,transparent)] font-medium shadow-lg backdrop-blur-[0.8rem] hover:not-disabled:bg-surface hover:not-disabled:shadow-xl motion-safe:animate-[touch-float_3s_ease-in-out_var(--motion-iterations)] motion-safe:transition-[background-color,box-shadow] data-[state=open]:[animation-play-state:paused]"
                                            aria-label="Chạm thử: khám phá đại dương"
                                        >
                                            <span
                                                className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground motion-safe:[&::after]:absolute motion-safe:[&::after]:inset-0 motion-safe:[&::after]:animate-[touch-pulse_2s_ease-out_var(--motion-iterations)] motion-safe:[&::after]:rounded-full motion-safe:[&::after]:border motion-safe:[&::after]:border-primary motion-safe:[&::after]:content-['']"
                                                aria-hidden="true"
                                            >
                                                <MousePointer2 data-icon="inline-start" />
                                            </span>
                                            Chạm thử
                                        </Button>
                                    </PopoverTrigger>
                                </div>
                            </PopoverAnchor>
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
    const reduceMotion = useShouldReduceMotion();

    return (
        <section
            aria-labelledby="home-heading"
            className="relative mx-auto flex w-full max-w-[1328px] flex-col px-6 pt-12 pb-6 sm:px-8 sm:pt-16 sm:pb-8 lg:flex-1 lg:pt-4 lg:pb-2"
        >
            <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-0">
                <div className="relative z-10 flex min-w-0 flex-col items-start gap-5 sm:gap-6 lg:gap-5 lg:[@media(max-height:700px)]:gap-3">
                    <div className="flex flex-col items-start gap-3 sm:gap-4">
                        <p className="m-0 inline-flex items-center gap-2 font-medium text-muted-foreground text-sm leading-5">
                            <ScanLine
                                aria-hidden="true"
                                className="size-4 shrink-0 text-foreground/70"
                                strokeWidth={1.5}
                            />
                            Nền tảng sách tương tác AR
                        </p>
                        <h1
                            id="home-heading"
                            className="m-0 max-w-[11ch] text-balance font-semibold text-[clamp(2.75rem,5.2vw,4.5rem)] leading-[1.08] tracking-[-0.055em] lg:text-[clamp(2.5rem,7dvh,4.5rem)]"
                        >
                            Sáng tạo sách.
                            <br />
                            Kiến tạo
                            <br />
                            <span className="text-muted-foreground"> trải nghiệm.</span>
                        </h1>
                    </div>
                    <p className="m-0 max-w-[42ch] text-pretty text-base text-muted-foreground leading-[1.75] sm:text-lg lg:text-base">
                        Biến PDF, hình ảnh và ý tưởng của bạn thành sách tương tác với mô hình 3D,
                        âm thanh và trải nghiệm AR.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 max-sm:w-full max-sm:[&>a]:w-full">
                        <Button size="hero" asChild>
                            <Link to="/library">
                                Khám phá sách{' '}
                                <ArrowRight aria-hidden="true" data-icon="inline-end" />
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
            </div>
            <div className="mt-6 flex shrink-0 justify-center lg:mt-2 lg:[@media(min-height:800px)]:mb-6">
                <PrimitiveButton
                    variant="plain"
                    className="group inline-flex min-h-11 items-center gap-3 rounded-md px-1 text-muted-foreground text-xs no-underline transition-colors hover:text-foreground motion-reduce:transition-none"
                    onClick={() => {
                        document.getElementById('how-it-works')?.scrollIntoView({
                            behavior: reduceMotion ? 'instant' : 'smooth',
                            block: 'start',
                        });
                    }}
                >
                    Cuộn để khám phá
                    <span
                        aria-hidden="true"
                        className="grid size-8 place-items-center rounded-full border border-border bg-background transition-colors group-hover:border-foreground/30 group-hover:bg-hover motion-reduce:transition-none"
                    >
                        <ChevronDown
                            className="size-4 transition-transform group-hover:translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                            strokeWidth={1.5}
                        />
                    </span>
                </PrimitiveButton>
            </div>
        </section>
    );
}
