import { Accordion } from '@animate-ui/react/primitives/radix-ui/accordion';
import { useMotionTokens } from '@animate-ui/react/utils/motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';
import { HomeScrollReveal } from './HomeScrollReveal';
import { HomeWorkflowPreview, type WorkflowStep } from './HomeWorkflowPreview';

const steps = [
    {
        id: 'import',
        title: 'Chuẩn bị trang sách',
        description:
            'Bắt đầu với trang trắng hoặc nhập PDF và ảnh có sẵn. Chọn các trang bạn muốn dùng rồi sắp xếp theo thứ tự đọc.',
    },
    {
        id: 'edit',
        title: 'Thêm nội dung tương tác',
        description:
            'Thêm mô hình 3D, video hoặc âm thanh vào từng trang. Dùng các khối kéo thả để thiết lập phản hồi khi người đọc chạm vào đối tượng.',
    },
    {
        id: 'publish',
        title: 'Xuất bản và chia sẻ',
        description:
            'Gửi liên kết hoặc mã QR để người đọc mở sách trong trình duyệt. Với bản in, họ có thể quét các trang đã thiết lập để xem nội dung AR.',
    },
] as const satisfies readonly { id: WorkflowStep; title: string; description: string }[];

export function HomeHowItWorks() {
    const { transition } = useMotionTokens();
    const [step, setStep] = useState<WorkflowStep>('import');

    return (
        <section
            id="how-it-works"
            aria-labelledby="how-it-works-heading"
            className="scroll-mt-28 bg-background text-foreground"
        >
            <div className="mx-auto w-full max-w-[1328px] px-6 pb-[clamp(3rem,8dvh,6rem)] sm:px-8">
                <HomeScrollReveal className="text-center">
                    <p className="m-0 mb-4 font-medium text-muted-foreground text-sm">
                        Cách hoạt động
                    </p>
                    <h2
                        id="how-it-works-heading"
                        className="m-0 text-balance font-semibold text-[clamp(2.125rem,4vw,3.5rem)] leading-[1.1] tracking-[-0.05em]"
                    >
                        Từ trang sách đến{' '}
                        <span className="block text-muted-foreground">trải nghiệm AR.</span>
                    </h2>
                </HomeScrollReveal>

                <div className="mt-10 grid items-center gap-6 sm:mt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10 xl:gap-14">
                    <HomeScrollReveal className="min-w-0">
                        <Accordion.Root
                            type="single"
                            value={step}
                            onValueChange={(value) => {
                                const selected = steps.find((item) => item.id === value);
                                if (selected) setStep(selected.id);
                            }}
                            className="grid gap-2"
                        >
                            {steps.map(({ id, title, description }, index) => (
                                <Accordion.Item
                                    key={id}
                                    value={id}
                                    data-how-step=""
                                    className="rounded-[var(--radius-card)] border border-transparent transition-colors data-[state=open]:border-border data-[state=open]:bg-surface data-[state=open]:shadow-sm motion-reduce:transition-none"
                                >
                                    <Accordion.Header className="m-0">
                                        <Accordion.Trigger className="group grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-card)] px-3 py-3 text-left text-muted-foreground transition-colors focus-visible:outline-offset-2 data-[state=open]:cursor-default data-[state=open]:text-foreground data-[state=closed]:hover:bg-hover data-[state=closed]:hover:text-foreground motion-reduce:transition-none sm:gap-4 sm:px-5 sm:py-3.5">
                                            <span
                                                aria-hidden="true"
                                                className="grid size-9 place-items-center rounded-full border border-border font-medium text-xs tabular-nums transition-colors group-data-[state=open]:border-primary group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground motion-reduce:transition-none"
                                            >
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <span className="font-semibold text-base leading-snug sm:text-lg">
                                                {title}
                                            </span>
                                            <ChevronDown
                                                aria-hidden="true"
                                                className="size-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0 motion-reduce:transition-none"
                                            />
                                        </Accordion.Trigger>
                                    </Accordion.Header>
                                    <Accordion.Content
                                        transition={transition.disclosure}
                                        className="overflow-hidden"
                                    >
                                        <p className="m-0 text-pretty pr-4 pb-5 pl-15 text-muted-foreground text-sm leading-[1.65] sm:pr-10 sm:pb-6 sm:pl-18 sm:text-[0.9375rem]">
                                            {description}
                                        </p>
                                    </Accordion.Content>
                                </Accordion.Item>
                            ))}
                        </Accordion.Root>
                    </HomeScrollReveal>

                    <HomeScrollReveal className="min-w-0">
                        <HomeWorkflowPreview step={step} />
                    </HomeScrollReveal>
                </div>

                <HomeScrollReveal className="mt-8 flex justify-center sm:mt-10">
                    <Button size="hero" asChild className="max-sm:w-full">
                        <AuthRequiredLink to="/books/new">
                            Tạo cuốn sách đầu tiên{' '}
                            <ArrowRight aria-hidden="true" data-icon="inline-end" />
                        </AuthRequiredLink>
                    </Button>
                </HomeScrollReveal>
            </div>
        </section>
    );
}
