import {
    ArrowDownRight,
    ArrowRight,
    BookOpen,
    Box,
    CircleHelp,
    Compass,
    Keyboard,
    PanelsTopLeft,
    Send,
    Volume2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type MouseEvent, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthDialogLink, AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { chapters, shortcutGroups, uploadLimits } from '@/features/help/guide';
import { Button } from '@/shared/ui/Button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/shared/ui/primitives/accordion';
import { Kbd } from '@/shared/ui/primitives/kbd';

const topics = [
    { id: 'bat-dau', label: 'Bắt đầu nhanh', icon: Compass },
    { id: 'tao-sach', label: 'Tạo và biên soạn sách', icon: PanelsTopLeft },
    { id: 'noi-dung', label: 'Nội dung và tương tác', icon: Box },
    { id: 'xuat-ban', label: 'Xuất bản và chia sẻ', icon: Send },
    { id: 'doc-sach', label: 'Đọc và trải nghiệm sách', icon: BookOpen },
    { id: 'phim-tat', label: 'Phím tắt', icon: Keyboard },
    { id: 'cau-hoi', label: 'Câu hỏi thường gặp', icon: CircleHelp },
] as const;

const quickStart = [
    {
        title: 'Tạo tài khoản',
        text: 'Chọn Đăng ký ở đầu trang và làm theo hướng dẫn xác minh email. Nếu đã có tài khoản, chọn Đăng nhập.',
    },
    {
        title: 'Mở Studio',
        text: 'Trên máy tính, chọn Studio Editor để vào không gian làm việc, rồi mở Sách của tôi.',
    },
    {
        title: 'Tạo cuốn sách đầu tiên',
        text: 'Chọn Tạo sách, nhập tên và chọn khổ sách. Bắt đầu với Sách trống hoặc nhập các trang từ PDF hay ảnh.',
    },
    {
        title: 'Xem thử như độc giả',
        text: 'Thêm một hình ảnh hoặc mô hình 3D vào trang, lưu sách rồi chọn Xem trước. Bấm Bắt đầu xem để thử nội dung.',
    },
] as const;

const questions = [
    {
        id: 'app',
        title: 'Tôi có cần cài ứng dụng để đọc sách AR không?',
        text: 'Bạn có thể đọc sách và xem AR ngay trong trình duyệt. Khi quét sách in, hãy cho phép trình duyệt dùng camera.',
    },
    {
        id: 'upload',
        title: 'Tệp tải lên có giới hạn dung lượng không?',
        text: (
            <dl className="m-0 grid gap-3 sm:grid-cols-2">
                {uploadLimits.map(({ label, formats, size }) => (
                    <div key={label}>
                        <dt className="font-medium text-foreground">{label}</dt>
                        <dd className="m-0">
                            {formats}, tối đa {size} MB/tệp.
                        </dd>
                    </div>
                ))}
            </dl>
        ),
    },
    {
        id: 'password',
        title: 'Tôi quên mật khẩu thì khôi phục thế nào?',
        text: (
            <>
                Mở <AuthDialogLink mode="forgot">Quên mật khẩu</AuthDialogLink>, nhập email tài
                khoản rồi làm theo liên kết được gửi trong thư.
            </>
        ),
    },
    {
        id: 'camera',
        title: 'Làm gì khi camera bị chặn?',
        text: 'Mở phần quyền của trang trong trình duyệt, bật quyền Camera rồi thử quét lại. Bạn cũng có thể quay lại bìa sách và chọn đọc trên màn hình.',
    },
    {
        id: 'marker',
        title: 'Mã QR và marker dùng để làm gì?',
        text: 'Mã QR dẫn đến cuốn sách trong trình duyệt. Marker hoặc hình ảnh trang sách giúp camera nhận diện đúng trang để đặt nội dung AR lên bản in.',
    },
    {
        id: 'tracking',
        title: 'Camera mở rồi nhưng chưa nhận diện trang?',
        text: 'Kiểm tra bạn đã mở đúng sách và đang quét trang có AR. Đặt sách phẳng, tránh phản sáng và lùi camera vừa đủ để thấy trọn trang hoặc marker.',
    },
    {
        id: 'updates',
        title: 'Tôi có thể cập nhật sách sau khi xuất bản không?',
        text: 'Bạn có thể tiếp tục chỉnh bản nháp rồi xuất bản phiên bản mới. Liên kết và QR vẫn mở phiên bản đang phát hành.',
    },
];

function GuideSteps({ steps }: { steps: readonly { title: string; text: string }[] }) {
    return (
        <ol className="m-0 grid list-none gap-5 p-0 sm:gap-6">
            {steps.map(({ title, text }, index) => (
                <li
                    key={title}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4"
                >
                    <span
                        aria-hidden="true"
                        className="grid size-9 place-items-center rounded-full border border-border bg-surface font-semibold text-sm tabular-nums"
                    >
                        {index + 1}
                    </span>
                    <div className="pt-1.5">
                        <h3 className="m-0 font-semibold text-base">{title}</h3>
                        <p className="m-0 mt-1.5 max-w-[69ch] text-muted-foreground text-sm leading-[1.75] sm:text-base">
                            {text}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function AudioFlowExample() {
    const reduceMotion = useReducedMotion();
    return (
        <figure className="m-0 mt-6 rounded-[var(--radius-card)] border border-border p-4 sm:mt-7 sm:p-5">
            <figcaption className="mb-3 font-medium text-sm">Ví dụ trong Tương tác</figcaption>
            <div className="flex flex-col items-stretch sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-border p-3">
                    <Box className="size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="m-0 font-medium text-sm">Khi chạm đối tượng</p>
                        <p className="m-0 mt-0.5 text-muted-foreground text-xs">
                            Mô hình 3D trên trang
                        </p>
                    </div>
                </div>
                <div
                    aria-hidden="true"
                    className="mx-6 h-6 w-0.5 bg-border sm:mx-0 sm:h-0.5 sm:w-10"
                >
                    <motion.div
                        className="size-full origin-top bg-foreground sm:origin-left"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.25 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
                    />
                </div>
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-border p-3">
                    <Volume2 className="size-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="m-0 font-medium text-sm">Phát âm thanh</p>
                        <p className="m-0 mt-0.5 text-muted-foreground text-xs">
                            Tệp âm thanh đã chọn
                        </p>
                    </div>
                </div>
            </div>
        </figure>
    );
}

export function HelpPage() {
    const { search, hash } = useLocation();

    function scrollToTopic(event: MouseEvent<HTMLAnchorElement>) {
        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        const heading = document.getElementById(event.currentTarget.hash.slice(1));
        if (!heading) return;

        heading.focus({ preventScroll: true });
        heading.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
        });
    }

    useEffect(() => {
        const topic = topics.find(({ id }) => window.location.hash === `#${id}`);
        // A direct link may arrive before this lazy route has rendered its headings.
        if (topic) document.getElementById(topic.id)?.scrollIntoView();
    }, []);

    return (
        <article data-stable-scroll-overlays>
            <header className="grid items-center gap-5 overflow-hidden rounded-[var(--radius-card)] border border-border px-5 py-7 sm:px-9 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-8 lg:px-12 lg:py-9">
                <div>
                    <h1 className="m-0 text-balance font-semibold text-4xl leading-[1.12] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                        Hướng dẫn Bookaria
                    </h1>
                    <p className="m-0 mt-4 max-w-[42ch] text-pretty text-muted-foreground leading-relaxed">
                        Đọc và quét sách AR, hoặc làm theo từng bước để biên soạn và xuất bản cuốn
                        sách đầu tiên.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2.5">
                        <Button asChild>
                            <Link
                                to={{ search, hash: '#doc-sach' }}
                                preventScrollReset
                                onClick={scrollToTopic}
                            >
                                Đọc và trải nghiệm
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link
                                to={{ search, hash: '#tao-sach' }}
                                preventScrollReset
                                onClick={scrollToTopic}
                            >
                                Tạo sách AR{' '}
                                <ArrowDownRight aria-hidden="true" data-icon="inline-end" />
                            </Link>
                        </Button>
                    </div>
                </div>
                <div
                    aria-hidden="true"
                    className="pointer-events-none relative mx-auto aspect-[1.65] w-full max-w-120 select-none md:aspect-[1.8]"
                >
                    <img
                        src="/images/home/ocean-book.webp"
                        alt=""
                        width={1440}
                        height={1080}
                        decoding="async"
                        draggable={false}
                        className="absolute inset-0 size-full object-contain"
                    />
                    <img
                        src="/images/home/ocean-whale.webp"
                        alt=""
                        width={1440}
                        height={1080}
                        decoding="async"
                        draggable={false}
                        className="motion-safe:fade-in-75 motion-safe:slide-in-from-bottom-8 absolute inset-0 size-full object-contain motion-safe:animate-in motion-safe:duration-900 motion-safe:ease-out"
                    />
                </div>
            </header>

            <div className="mt-10 grid items-start gap-9 lg:mt-14 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
                <nav aria-label="Mục lục hướng dẫn" className="lg:sticky lg:top-28 lg:pr-2">
                    <ul className="m-0 flex list-none flex-wrap gap-1 p-0 lg:flex-col">
                        {topics.map(({ id, label, icon: Icon }) => (
                            <li key={id}>
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="h-full justify-start whitespace-normal text-left text-muted-foreground hover:not-disabled:border-border hover:not-disabled:bg-transparent aria-[current=location]:border-border aria-[current=location]:text-foreground lg:w-full"
                                >
                                    <Link
                                        aria-current={
                                            (hash || '#bat-dau') === `#${id}`
                                                ? 'location'
                                                : undefined
                                        }
                                        to={{ search, hash: `#${id}` }}
                                        preventScrollReset
                                        onClick={scrollToTopic}
                                    >
                                        <Icon aria-hidden="true" data-icon="inline-start" />
                                        {label}
                                    </Link>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="grid min-w-0 gap-12 sm:gap-16">
                    <section aria-labelledby="bat-dau">
                        <h2
                            id="bat-dau"
                            tabIndex={-1}
                            className="m-0 mb-3 scroll-mt-36 text-2xl focus:outline-none sm:text-3xl lg:scroll-mt-28"
                        >
                            Bắt đầu nhanh
                        </h2>
                        <p className="m-0 text-muted-foreground text-sm sm:text-base">
                            Các bước để tạo và xem thử trang sách đầu tiên trong Studio.
                        </p>
                        <div className="mt-6 sm:mt-7">
                            <GuideSteps steps={quickStart} />
                            <Button asChild variant="outline" className="mt-5 ml-12 sm:ml-13">
                                <AuthRequiredLink to="/books/new">
                                    Tạo sách{' '}
                                    <ArrowRight aria-hidden="true" data-icon="inline-end" />
                                </AuthRequiredLink>
                            </Button>
                        </div>
                    </section>

                    {chapters.map(({ id, title, intro, steps }) => (
                        <section key={id} aria-labelledby={id}>
                            <h2
                                id={id}
                                tabIndex={-1}
                                className="m-0 scroll-mt-36 text-2xl focus:outline-none sm:text-3xl lg:scroll-mt-28"
                            >
                                {title}
                            </h2>
                            <p className="m-0 mt-3 max-w-[69ch] text-muted-foreground text-sm leading-relaxed sm:text-base">
                                {intro}
                            </p>
                            <div className="mt-6 sm:mt-7">
                                <GuideSteps steps={steps} />
                            </div>
                            {id === 'noi-dung' && <AudioFlowExample />}
                            {id === 'doc-sach' && (
                                <Button asChild variant="outline" className="mt-5 ml-12 sm:ml-13">
                                    <Link to="/library">
                                        Khám phá sách{' '}
                                        <ArrowRight aria-hidden="true" data-icon="inline-end" />
                                    </Link>
                                </Button>
                            )}
                        </section>
                    ))}

                    <section aria-labelledby="phim-tat">
                        <h2
                            id="phim-tat"
                            tabIndex={-1}
                            className="m-0 scroll-mt-36 text-2xl focus:outline-none sm:text-3xl lg:scroll-mt-28"
                        >
                            Phím tắt
                        </h2>
                        <p className="m-0 mt-3 text-muted-foreground text-sm sm:text-base">
                            Trong chế độ Thiết kế. Trên macOS, dùng <Kbd>⌘</Kbd> thay cho{' '}
                            <Kbd>Ctrl</Kbd>.
                        </p>
                        <div className="mt-5 grid gap-3 xl:grid-cols-3">
                            {shortcutGroups.map(({ title, shortcuts }) => (
                                <div
                                    key={title}
                                    className="rounded-[var(--radius-card)] border border-border p-4 sm:p-5"
                                >
                                    <h3 className="m-0 mb-3 text-base">{title}</h3>
                                    <dl className="m-0 grid gap-2.5 text-sm">
                                        {shortcuts.map(({ label, keys }) => (
                                            <div
                                                key={label}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2"
                                            >
                                                <dt className="text-muted-foreground">{label}</dt>
                                                <dd className="m-0">
                                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                                        {keys.map((key, index) => (
                                                            <span
                                                                key={key}
                                                                className="inline-flex items-center gap-1"
                                                            >
                                                                {index > 0 && <span>+</span>}
                                                                <Kbd>{key}</Kbd>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section aria-labelledby="cau-hoi">
                        <h2
                            id="cau-hoi"
                            tabIndex={-1}
                            className="m-0 mb-5 scroll-mt-36 text-2xl focus:outline-none sm:text-3xl lg:scroll-mt-28"
                        >
                            Câu hỏi thường gặp
                        </h2>
                        <Accordion type="single" collapsible className="gap-2">
                            {questions.map(({ id, title, text }) => (
                                <AccordionItem
                                    key={id}
                                    value={id}
                                    className="rounded-xl border border-border transition-colors focus-within:border-input hover:border-input data-[state=open]:border-input motion-reduce:transition-none"
                                >
                                    <AccordionTrigger className="min-h-14 items-center gap-3 px-4 py-3 hover:no-underline **:data-[slot=accordion-trigger-icon]:size-5 motion-reduce:transition-none">
                                        {title}
                                    </AccordionTrigger>
                                    <AccordionContent className="motion-safe:fade-in max-w-[70ch] px-4 pb-5 text-muted-foreground leading-relaxed motion-safe:animate-in motion-safe:duration-200">
                                        {text}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </section>
                </div>
            </div>
            <section
                aria-labelledby="mo-studio"
                className="mt-12 grid items-center gap-5 rounded-[var(--radius-card)] border border-border p-5 sm:mt-16 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
                <div className="flex items-start gap-4">
                    <span className="hidden size-12 shrink-0 place-items-center rounded-xl border border-border sm:grid">
                        <PanelsTopLeft className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="mo-studio" className="m-0 text-xl sm:text-2xl">
                            Tạo trang sách đầu tiên của bạn
                        </h2>
                        <p className="m-0 mt-2 text-muted-foreground text-sm leading-relaxed">
                            Bắt đầu hành trình sáng tạo sách của riêng bạn! Mở Studio để thêm nội
                            dung, chỉnh sửa trang sách và xem trước thành phẩm.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild>
                        <AuthRequiredLink to="/books">
                            Mở Studio <ArrowRight aria-hidden="true" data-icon="inline-end" />
                        </AuthRequiredLink>
                    </Button>
                </div>
            </section>
        </article>
    );
}
