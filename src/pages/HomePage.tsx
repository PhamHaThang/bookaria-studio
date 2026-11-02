import { ArrowRight, BookOpen, Box, Image, ScanLine, Type, Video, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { BrandOrbit } from '@/features/home/ui/BrandOrbit';
import { Button } from '@/shared/ui/Button';

const capabilities = [
    { label: 'Mô hình 3D', icon: Box },
    { label: 'Hình ảnh', icon: Image },
    { label: 'Văn bản', icon: Type },
    { label: 'Video', icon: Video },
    { label: 'Âm thanh', icon: Volume2 },
    { label: 'AR Marker', icon: ScanLine },
];

export function HomePage() {
    return (
        <section aria-labelledby="home-heading" className="overflow-hidden">
            <div className="mx-auto max-w-[1328px] px-6">
                <div className="grid min-h-132 grid-cols-1 items-center gap-x-8 max-lg:pt-14 lg:grid-cols-[minmax(0,1fr)_384px_minmax(0,1fr)]">
                    <div className="relative z-1 flex flex-col items-start gap-6 max-lg:items-center max-lg:text-center">
                        <h1
                            id="home-heading"
                            className="m-0 max-w-[19ch] font-semibold text-5xl leading-[1.1] tracking-[-0.025em] max-sm:text-4xl max-lg:text-5xl max-xl:text-[42px]"
                        >
                            Đọc và tạo sách
                            <br />
                            với Bookaria.
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 max-lg:justify-center">
                            <Button size="hero" asChild>
                                <Link to="/library">
                                    Khám phá sách
                                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                                </Link>
                            </Button>
                            <Button size="hero" variant="secondary" asChild>
                                <AuthRequiredLink to="/books/new">
                                    Tạo sách của bạn
                                </AuthRequiredLink>
                            </Button>
                        </div>
                    </div>
                    <BrandOrbit />
                    <div className="relative z-1 flex flex-col items-start gap-6 max-lg:mx-auto max-lg:max-w-140 max-lg:items-center max-lg:pb-12 max-lg:text-center">
                        <Link
                            to="/library"
                            className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-muted px-3 font-medium text-muted-foreground text-xs no-underline transition-colors hover:bg-secondary hover:text-foreground"
                        >
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            Không cần tài khoản để đọc
                            <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                        <p className="m-0 max-w-[40ch] font-medium text-base text-muted-foreground leading-[1.4]">
                            Khám phá sách 3D và AR. Tạo sách từ trang trắng, PDF hoặc hình ảnh, rồi
                            chia sẻ với người đọc.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-6 pt-8 pb-12">
                    <p className="m-0 text-center text-muted-foreground text-xs">
                        Mỗi trang sách, nhiều cách kể chuyện.
                    </p>
                    <ul
                        aria-label="Nội dung có thể thêm vào sách"
                        className="m-0 flex list-none flex-wrap justify-center gap-3 p-0 sm:gap-5"
                    >
                        {capabilities.map(({ label, icon: Icon }) => (
                            <li
                                key={label}
                                className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-muted-foreground text-sm"
                            >
                                <Icon
                                    className="size-4 text-foreground"
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                />
                                {label}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
