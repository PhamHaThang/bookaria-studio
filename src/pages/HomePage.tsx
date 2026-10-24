import { ArrowRight, ArrowUpRight, BookOpen, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequiredLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';

export function HomePage() {
    return (
        <section
            className="grid grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] items-center gap-20 py-16"
            aria-labelledby="home-heading"
        >
            <div>
                <h1
                    id="home-heading"
                    className="mb-6 max-w-[17ch] font-semibold text-[52px] leading-[1.2] tracking-[-0.025em]"
                >
                    Mở một cuốn sách.
                    <br />
                    Bắt đầu một ý tưởng.
                </h1>
                <p className="mb-9 max-w-[48ch] text-lg text-muted-foreground leading-relaxed">
                    Khám phá sách tương tác 3D và AR, hoặc tạo nên cuốn sách của riêng bạn từ trang
                    trắng, PDF và hình ảnh.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <Button asChild>
                        <Link to="/library">
                            <BookOpen data-icon="inline-start" aria-hidden="true" />
                            Khám phá sách
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <AuthRequiredLink to="/books/new">
                            <PencilLine data-icon="inline-start" aria-hidden="true" />
                            Tạo sách của bạn
                        </AuthRequiredLink>
                    </Button>
                </div>
            </div>
            <div className="border-border border-y py-2">
                <Link
                    to="/library"
                    className="group flex items-start justify-between gap-6 py-8 text-foreground no-underline"
                >
                    <div>
                        <h2 className="mb-3 text-xl">Tìm cuốn sách tiếp theo</h2>
                        <p className="m-0 max-w-[34ch] text-muted-foreground text-sm leading-relaxed">
                            Xem sách công khai, khám phá tác giả và mở nội dung trong Viewer. Không
                            cần tài khoản để đọc.
                        </p>
                    </div>
                    <ArrowUpRight
                        className="mt-1 size-5 shrink-0 text-primary transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                        aria-hidden="true"
                    />
                </Link>
                <AuthRequiredLink
                    to="/books/new"
                    className="group flex items-start justify-between gap-6 border-border border-t py-8 text-foreground no-underline"
                >
                    <div>
                        <h2 className="mb-3 text-xl">Đưa ý tưởng vào trang sách</h2>
                        <p className="m-0 max-w-[34ch] text-muted-foreground text-sm leading-relaxed">
                            Thêm mô hình 3D, hình ảnh, âm thanh và tương tác, rồi xuất bản để chia
                            sẻ với người đọc.
                        </p>
                    </div>
                    <ArrowUpRight
                        className="mt-1 size-5 shrink-0 text-primary transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                        aria-hidden="true"
                    />
                </AuthRequiredLink>
                <Link
                    to="/help"
                    className="flex min-h-12 items-center justify-between gap-4 font-medium text-sm"
                >
                    Lần đầu sử dụng Bookaria?
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
