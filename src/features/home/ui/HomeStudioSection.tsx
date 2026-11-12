import { ArrowRight, Check } from 'lucide-react';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';
import { HomeScrollReveal } from './HomeScrollReveal';
import { HomeStudioPreview } from './HomeStudioPreview';

const benefits = [
    'Sắp xếp mô hình 3D, video và âm thanh.',
    'Tạo tương tác bằng các khối kéo thả.',
    'Xem trước cả cuốn sách rồi xuất bản.',
];

export function HomeStudioSection() {
    return (
        <section
            data-theme-scope="dark"
            aria-labelledby="studio-heading"
            className="overflow-clip rounded-2xl border border-border bg-surface-dark text-foreground sm:rounded-3xl"
        >
            <div className="mx-auto grid w-full max-w-[1328px] items-center gap-10 px-6 py-16 sm:px-8 sm:py-20 lg:min-h-[min(52rem,85dvh)] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16 lg:py-24">
                <HomeScrollReveal className="relative min-w-0 max-lg:order-2">
                    <HomeStudioPreview />
                </HomeScrollReveal>

                <HomeScrollReveal className="flex min-w-0 flex-col items-start">
                    <p className="m-0 mb-4 font-medium text-muted-foreground text-sm leading-6 sm:text-base">
                        Bookaria Studio
                    </p>
                    <h2
                        id="studio-heading"
                        className="m-0 text-balance font-semibold text-[clamp(2.125rem,6vw,3.75rem)] leading-[1.1] tracking-[-0.05em] lg:text-[clamp(2.5rem,4.1vw,3.75rem)]"
                    >
                        <span className="block">Thiết kế sách AR.</span>
                        <span className="block text-muted-foreground">Không cần viết mã.</span>
                    </h2>
                    <p className="m-0 mt-5 max-w-[42ch] text-pretty text-base text-muted-foreground leading-relaxed sm:text-lg">
                        Bắt đầu từ trang trắng, PDF hoặc ảnh có sẵn. Biên soạn sách và xem nội dung
                        AR ngay trong trình duyệt.
                    </p>
                    <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0 sm:mt-7">
                        {benefits.map((benefit) => (
                            <li
                                key={benefit}
                                className="flex items-start gap-3 text-base leading-6"
                            >
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-background">
                                    <Check
                                        aria-hidden="true"
                                        className="size-3.5"
                                        strokeWidth={2.5}
                                    />
                                </span>
                                {benefit}
                            </li>
                        ))}
                    </ul>
                    <Button size="hero" asChild className="mt-8 max-sm:w-full">
                        <AuthRequiredLink to="/books">
                            Khám phá Studio <ArrowRight aria-hidden="true" data-icon="inline-end" />
                        </AuthRequiredLink>
                    </Button>
                </HomeScrollReveal>
            </div>
        </section>
    );
}
