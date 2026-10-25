import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditNotes, componentFamilies } from '@/features/style-guide/catalog';
import { ButtonSamples, ControlSamples } from '@/features/style-guide/ui/ControlSamples';
import { FeedbackSamples } from '@/features/style-guide/ui/FeedbackSamples';
import { GuideSection } from '@/features/style-guide/ui/GuideSection';
import { LoadingSamples } from '@/features/style-guide/ui/LoadingSamples';
import { NavigationSamples } from '@/features/style-guide/ui/NavigationSamples';
import { OverlaySamples } from '@/features/style-guide/ui/OverlaySamples';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { Separator } from '@/shared/ui/primitives/separator';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/primitives/table';

const sections = [
    ['colors', 'Màu sắc & khoảng cách'],
    ['typography', 'Kiểu chữ'],
    ['buttons', 'Nút & liên kết'],
    ['forms', 'Ô nhập & lựa chọn'],
    ['navigation', 'Điều hướng & bộ lọc'],
    ['overlays', 'Modal & menu'],
    ['feedback', 'Phản hồi & trạng thái'],
    ['loading', 'Loading & Skeleton'],
    ['content', 'Thẻ & nội dung trống'],
    ['audit', 'Đối chiếu component'],
] as const;
const swatches = [
    ['Màu chính', '--action-primary'],
    ['Hover chính', '--action-primary-hover'],
    ['Nền trang', '--bg-canvas'],
    ['Bề mặt', '--bg-surface'],
    ['Chữ chính', '--text-primary'],
    ['Chữ phụ', '--text-muted'],
    ['Viền control', '--border-input'],
    ['Viền phân cách', '--border-default'],
    ['Thành công', '--status-success-text'],
    ['Cảnh báo', '--status-warning-text'],
    ['Lỗi', '--status-danger-text'],
    ['Focus', '--focus-color'],
] as const;

export function StyleGuidePage() {
    const [active, setActive] = useState(() => window.location.hash.slice(1) || 'colors');
    const [values, setValues] = useState<Record<string, string>>({});
    useEffect(() => {
        const style = getComputedStyle(document.documentElement);
        setValues(
            Object.fromEntries(
                swatches.map(([, token]) => [token, style.getPropertyValue(token).trim()]),
            ),
        );
        const previous = document.title;
        document.title = 'Giao diện mẫu | Bookaria';
        const sync = () => setActive(window.location.hash.slice(1) || 'colors');
        let frame = 0;
        const trackSection = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const current = sections
                    .filter(([id]) => {
                        const section = document.getElementById(id);
                        return section && section.getBoundingClientRect().top <= 160;
                    })
                    .at(-1);
                setActive(current?.[0] ?? 'colors');
            });
        };
        window.addEventListener('hashchange', sync);
        window.addEventListener('scroll', trackSection, { passive: true });
        trackSection();
        return () => {
            document.title = previous;
            window.removeEventListener('hashchange', sync);
            window.removeEventListener('scroll', trackSection);
            cancelAnimationFrame(frame);
        };
    }, []);
    return (
        <div className="mx-auto max-w-360 px-8 py-6">
            <header className="flex items-center justify-between gap-6 border-border border-b pb-6">
                <Link to="/" aria-label="Bookaria - Trang chủ">
                    <BookariaLogo />
                </Link>
                <div className="flex items-center gap-3">
                    <Badge>Chỉ trong development</Badge>
                    <Button variant="secondary" asChild>
                        <Link to="/books">
                            <ArrowLeft data-icon="inline-start" />
                            Về Studio
                        </Link>
                    </Button>
                </div>
            </header>
            <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-12 pt-10 max-[1000px]:grid-cols-1 max-[1000px]:gap-8">
                <nav
                    aria-label="Mục giao diện mẫu"
                    className="sticky top-8 flex flex-col gap-1 max-[1000px]:static max-[1000px]:flex-row max-[1000px]:flex-wrap"
                >
                    {sections.map(([id, label]) => (
                        <a
                            key={id}
                            href={`#${id}`}
                            aria-current={active === id ? 'location' : undefined}
                            className={cn(
                                'border-transparent border-l-2 px-3 py-2 text-sm no-underline transition-colors hover:text-primary',
                                active === id
                                    ? 'border-primary font-semibold text-primary'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {label}
                        </a>
                    ))}
                </nav>
                <main id="main" className="min-w-0">
                    <div className="mb-12 max-w-[70ch]">
                        <h1 className="mt-0 mb-4 text-4xl tracking-tight">
                            Giao diện mẫu Bookaria
                        </h1>
                        <p className="m-0 text-muted-foreground">
                            Thư viện component đang dùng trong Studio. Các mẫu bên dưới sử dụng trực
                            tiếp component của dự án và có thể tương tác; dữ liệu chỉ là minh họa
                            tại chỗ.
                        </p>
                        <p className="mt-3 mb-0 text-muted-foreground text-sm">
                            Màu chính đen #252525 · Be Vietnam Pro + Bricolage Grotesque · Tailwind
                            + shadcn/Radix + Lucide + Sonner.
                        </p>
                    </div>
                    <p className="mb-10 max-w-[70ch] text-muted-foreground text-sm">
                        Control ưu tiên nền trắng; hover hoặc chọn dùng đen–trắng. Button bị khóa
                        dùng nền trắng, chữ và viền dịu thay cho khối xám. Radio/checkbox chưa chọn
                        có viền đen, nền trắng; đã chọn có nền đen. Tabs dạng line giữ gạch dưới.
                    </p>
                    <GuideSection
                        id="colors"
                        title="Màu sắc & khoảng cách"
                        description="Các ô màu đọc trực tiếp CSS token hiện tại. Sửa token sẽ đổi đồng bộ component, không giữ một bản màu riêng ở trang mẫu."
                    >
                        <ul className="m-0 grid list-none grid-cols-4 gap-x-5 gap-y-6 p-0 max-[1100px]:grid-cols-3">
                            {swatches.map(([label, token]) => (
                                <li key={token} className="min-w-0">
                                    <div
                                        className="h-14 rounded-lg border border-border"
                                        style={{ background: `var(${token})` }}
                                    />
                                    <p className="mt-2 mb-1 font-semibold text-sm">{label}</p>
                                    <code className="block break-words text-muted-foreground text-xs">
                                        {token}
                                    </code>
                                    <span className="mt-1 block text-muted-foreground text-xs">
                                        {values[token] || 'Đang đọc token…'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <Separator className="my-8" />
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="mt-0 text-base">Thang khoảng cách</h3>
                                <div className="flex flex-col gap-3">
                                    {[1, 2, 3, 4, 6, 8, 12].map((step) => (
                                        <div key={step} className="flex items-center gap-3">
                                            <code className="w-20 shrink-0 text-xs">
                                                space-{step}
                                            </code>
                                            <span
                                                className="h-2 bg-primary"
                                                style={{ width: `var(--space-${step})` }}
                                            />
                                            <span className="text-muted-foreground text-xs">
                                                {step * 4}px
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="mt-0 text-base">Bo góc & control</h3>
                                <div className="flex flex-wrap gap-3">
                                    {['sm', 'md', 'lg', 'xl'].map((size) => (
                                        <div
                                            key={size}
                                            className="border border-input bg-surface p-4"
                                            style={{ borderRadius: `var(--radius-${size})` }}
                                        >
                                            <code className="text-xs">{size}</code>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    Control thường 48px, nút nhỏ 40px. Editor có công cụ compact
                                    riêng. Viền focus ô nhập nằm bên trong; nút có focus bàn phím rõ
                                    ràng.
                                </p>
                            </div>
                        </div>
                    </GuideSection>
                    <GuideSection
                        id="typography"
                        title="Kiểu chữ tiếng Việt"
                        description="Bricolage Grotesque dành cho tiêu đề; Be Vietnam Pro dành cho nội dung và control. Cả hai font được lưu cùng ứng dụng."
                    >
                        <div className="flex flex-col gap-5">
                            <p className="m-0 font-display font-semibold text-3xl">
                                Mỗi cuốn sách mở ra một thế giới.
                            </p>
                            <p className="m-0 font-display font-semibold text-xl">
                                Không gian sáng tạo của bạn
                            </p>
                            <p className="m-0 max-w-[70ch]">
                                Khám phá, sáng tạo và chia sẻ những câu chuyện. Tiếng Việt: ă â đ ê
                                ô ơ ư. Dòng chữ dài được xuống hàng để nội dung luôn dễ đọc.
                            </p>
                            <p className="m-0 text-muted-foreground text-sm">
                                Nhãn / chữ phụ 14px · Chữ chú thích 12px ·{' '}
                                <span className="tabular-nums">0123456789</span>
                            </p>
                            <div className="flex flex-wrap gap-6">
                                {[400, 500, 600, 700].map((weight) => (
                                    <span key={weight} style={{ fontWeight: weight }}>
                                        {weight} · Bookaria
                                    </span>
                                ))}
                            </div>
                        </div>
                    </GuideSection>
                    <ButtonSamples />
                    <ControlSamples />
                    <NavigationSamples />
                    <OverlaySamples />
                    <FeedbackSamples />
                    <LoadingSamples />
                    <GuideSection
                        id="audit"
                        title="Đối chiếu component hiện tại"
                        description="Khác biệt về tên API không nhất thiết là khác thiết kế. Bảng này phân biệt những biến thể theo ngữ cảnh và những nơi còn lặp cách ghép/style cục bộ trong source."
                    >
                        <div className="flex flex-col gap-8">
                            {auditNotes.map((note) => (
                                <article
                                    key={note.group}
                                    className="border-border border-b pb-6 last:border-0"
                                >
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="m-0 text-lg">{note.group}</h3>
                                        <Badge
                                            tone={
                                                note.status.startsWith('Còn')
                                                    ? 'warning'
                                                    : 'neutral'
                                            }
                                        >
                                            {note.status}
                                        </Badge>
                                    </div>
                                    <p className="mt-3 mb-2 text-sm">{note.finding}</p>
                                    <p className="mt-0 mb-3 text-muted-foreground text-sm">
                                        {note.recommendation}
                                    </p>
                                    <code className="block break-words text-muted-foreground text-xs">
                                        {note.source}
                                    </code>
                                </article>
                            ))}
                        </div>
                        <h3 className="mt-8 mb-4 text-lg">Bản đồ component</h3>
                        <Table>
                            <TableCaption>
                                Component Bookaria bọc primitive để giữ hành vi nghiệp vụ; các ví dụ
                                trên dùng chính nguồn này.
                            </TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Nhóm</TableHead>
                                    <TableHead scope="col">Component</TableHead>
                                    <TableHead scope="col">Sử dụng</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {componentFamilies.map(([group, components, use]) => (
                                    <TableRow key={group}>
                                        <TableCell className="whitespace-normal align-top font-medium">
                                            {group}
                                        </TableCell>
                                        <TableCell className="max-w-80 whitespace-normal align-top">
                                            <code className="break-words text-xs">
                                                {components}
                                            </code>
                                        </TableCell>
                                        <TableCell className="max-w-80 whitespace-normal align-top">
                                            {use}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </GuideSection>
                </main>
            </div>
            <footer className="flex justify-between gap-6 pt-8 pb-4 text-muted-foreground text-sm">
                <span>Bookaria · Giao diện mẫu dùng chung</span>
                <a href="#main">Về đầu trang</a>
            </footer>
        </div>
    );
}
