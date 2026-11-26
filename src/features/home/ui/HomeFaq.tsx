import { Accordion } from '@animate-ui/react/primitives/radix-ui/accordion';
import { useMotionTokens } from '@animate-ui/react/utils/motion';
import { ChevronRight } from 'lucide-react';
import { HomeScrollReveal } from './HomeScrollReveal';

const questions = [
    {
        id: 'no-code',
        question: 'Tôi có cần biết lập trình để tạo sách không?',
        answer: 'Bạn có thể tạo sách bằng cách kéo thả nội dung trong Studio và nối các khối tương tác trực quan. Các thao tác như phát âm thanh, hiện nội dung hay chuyển trang đều có thể thiết lập trong giao diện.',
    },
    {
        id: 'import',
        question: 'Tôi có thể dùng PDF hoặc hình ảnh có sẵn không?',
        answer: 'Có. Khi tạo sách, bạn có thể nhập PDF và chọn những trang cần dùng, hoặc tải lên nhiều hình ảnh. Nội dung được dùng làm nền trang để bạn tiếp tục thêm chữ, mô hình 3D, âm thanh và tương tác.',
    },
    {
        id: 'reader-account',
        question: 'Người đọc có cần đăng nhập không?',
        answer: 'Với sách đã được xuất bản và chia sẻ, người đọc có thể mở liên kết hoặc quét QR để truy cập mà không cần đăng nhập. Bạn cần tài khoản khi muốn tạo và quản lý sách trong Studio.',
    },
    {
        id: 'ar',
        question: 'Xem AR trên điện thoại có cần cài ứng dụng không?',
        answer: 'Bạn xem AR trực tiếp trong trình duyệt trên điện thoại. Mở liên kết sách, chọn Quét sách và cho phép dùng camera, rồi hướng camera vào trang sách hoặc marker đã được thiết lập để xem nội dung AR.',
    },
    {
        id: 'screen-reading',
        question: 'Chưa có sách in thì có trải nghiệm được không?',
        answer: 'Có. Chọn Bắt đầu đọc để xem các trang và tương tác ngay trên màn hình điện thoại hoặc máy tính. Khi có sách in, bạn có thể chuyển sang Quét sách để xem AR.',
    },
    {
        id: 'qr-and-marker',
        question: 'Mã QR và marker khác nhau thế nào?',
        answer: 'Mã QR mở liên kết của cuốn sách. Marker hoặc hình ảnh trang sách giúp camera nhận diện trang và đặt nội dung AR vào đúng vị trí. Thiết lập nhận diện được người tạo chọn cho từng trang trong Studio.',
    },
    {
        id: 'updates',
        question: 'Tôi có thể chỉnh sửa sách sau khi xuất bản không?',
        answer: 'Có. Bạn tiếp tục chỉnh sửa bản nháp rồi xuất bản phiên bản mới khi sẵn sàng. Liên kết và QR chia sẻ được giữ nguyên, người đọc sẽ mở phiên bản đang phát hành.',
    },
];

export function HomeFaq() {
    const { transition } = useMotionTokens();

    return (
        <section
            id="faq"
            aria-labelledby="faq-heading"
            className="scroll-mt-28 bg-background text-foreground"
        >
            <div className="mx-auto w-full max-w-[960px] px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
                <HomeScrollReveal>
                    <h2
                        id="faq-heading"
                        className="m-0 text-balance text-center font-semibold text-[clamp(2rem,3vw,2.75rem)] leading-[1.15] tracking-[-0.04em]"
                    >
                        Câu hỏi thường gặp
                    </h2>
                </HomeScrollReveal>
                <HomeScrollReveal className="mt-8 sm:mt-10">
                    <Accordion.Root type="single" collapsible className="border-border border-t">
                        {questions.map(({ id, question, answer }, index) => (
                            <Accordion.Item key={id} value={id} className="border-border border-b">
                                <Accordion.Header className="m-0 flex">
                                    <Accordion.Trigger
                                        data-slot="accordion-trigger"
                                        className="group flex w-full items-start gap-3 rounded-md py-5 text-left outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:items-center sm:gap-5 sm:py-6"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="mt-1 w-5 shrink-0 font-normal text-muted-foreground text-xs tabular-nums sm:mt-0"
                                        >
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <span className="min-w-0 flex-1 font-medium text-base leading-relaxed sm:text-lg">
                                            {question}
                                        </span>
                                        <span
                                            aria-hidden="true"
                                            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors group-hover:border-foreground/40 group-data-[state=open]:border-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground"
                                        >
                                            <ChevronRight
                                                className="size-4 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
                                                style={{
                                                    transitionDuration: `${transition.disclosure.duration}s`,
                                                    transitionTimingFunction: `cubic-bezier(${transition.disclosure.ease.join(',')})`,
                                                }}
                                            />
                                        </span>
                                    </Accordion.Trigger>
                                </Accordion.Header>
                                <Accordion.Content
                                    data-slot="accordion-content"
                                    transition={transition.disclosure}
                                    className="overflow-hidden"
                                >
                                    <div className="pr-12 pb-7 pl-8 sm:pr-14 sm:pl-10">
                                        <p className="m-0 text-pretty text-muted-foreground text-sm leading-[1.8] sm:text-base">
                                            {answer}
                                        </p>
                                    </div>
                                </Accordion.Content>
                            </Accordion.Item>
                        ))}
                    </Accordion.Root>
                </HomeScrollReveal>
            </div>
        </section>
    );
}
