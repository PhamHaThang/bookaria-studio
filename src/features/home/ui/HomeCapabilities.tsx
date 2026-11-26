import { Fade } from '@animate-ui/react/primitives/effects/fade';
import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import {
    BookOpen,
    Box,
    FileInput,
    ImagePlay,
    Music2,
    QrCode,
    ScanLine,
    Workflow,
} from 'lucide-react';
import { useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const capabilities = [
    { label: 'Mô hình 3D', Icon: Box },
    { label: 'Hình ảnh & video', Icon: ImagePlay },
    { label: 'Âm thanh & lời kể', Icon: Music2 },
    { label: 'Tương tác trực quan', Icon: Workflow },
    { label: 'Nhập PDF & ảnh', Icon: FileInput },
    { label: 'Nhận diện AR', Icon: ScanLine },
    { label: 'Chia sẻ bằng QR', Icon: QrCode },
    { label: 'Đọc trên trình duyệt', Icon: BookOpen },
];

export function HomeCapabilities() {
    const ref = useRef<HTMLElement>(null);
    const inView = useInView(ref, { amount: 0.1 });
    const reduceMotion = useShouldReduceMotion();
    const { transition } = useMotionTokens();
    const [pageVisible, setPageVisible] = useState(() => !document.hidden);

    useEffect(() => {
        const update = () => setPageVisible(!document.hidden);
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);

    return (
        <section
            ref={ref}
            aria-label="Các chức năng của Bookaria"
            data-theme-scope="dark"
            className="w-full overflow-clip border-border border-y bg-surface-dark py-2 text-foreground"
        >
            <Fade inView inViewOnce transition={transition.reveal}>
                <div className="group overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] sm:py-3 motion-reduce:[mask-image:none]">
                    <div
                        data-capability-track=""
                        data-running={inView && pageVisible && !reduceMotion}
                        className="flex w-max animate-[home-capability-marquee_48s_linear_infinite] motion-reduce:w-full motion-reduce:animate-none group-hover:[animation-play-state:paused] data-[running=false]:[animation-play-state:paused]"
                    >
                        {[false, true].map((duplicate) => (
                            <ul
                                key={String(duplicate)}
                                aria-hidden={duplicate || undefined}
                                className={`m-0 flex min-w-[100vw] shrink-0 list-none items-center justify-around gap-10 py-1 pr-10 pl-0 sm:gap-16 sm:pr-16 ${duplicate ? 'motion-reduce:hidden' : 'motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-8 motion-reduce:gap-y-5 motion-reduce:pr-0'}`}
                            >
                                {capabilities.map(({ label, Icon }) => (
                                    <li
                                        key={label}
                                        className="flex items-center gap-3 whitespace-nowrap font-medium text-base text-foreground/75 tracking-[-0.025em] sm:text-xl"
                                    >
                                        <Icon
                                            aria-hidden="true"
                                            className="size-5 shrink-0 text-muted-foreground sm:size-6"
                                            strokeWidth={1.5}
                                        />
                                        {label}
                                    </li>
                                ))}
                            </ul>
                        ))}
                    </div>
                </div>
            </Fade>
        </section>
    );
}
