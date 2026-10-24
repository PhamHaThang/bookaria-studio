import { BookOpen, Check, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button, buttonStyles } from '../shared/ui/Button';

const swatches = [
    ['Nền trang', '--bg-canvas'],
    ['Bề mặt', '--bg-surface'],
    ['Màu chính', '--action-primary'],
    ['Chữ chính', '--text-primary'],
    ['Chữ phụ', '--text-muted'],
    ['Viền ô nhập', '--border-input'],
    ['Thành công', '--status-success-text'],
    ['Cảnh báo', '--status-warning-text'],
    ['Lỗi', '--status-danger-text'],
    ['Focus', '--focus-color'],
] as const;

export function StyleGuidePage() {
    const [saved, setSaved] = useState(false);
    function previewSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaved(true);
    }
    return (
        <div className="theme-guide mx-auto max-w-280 px-6 py-8 max-[540px]:px-5 max-[540px]:py-6">
            <header className="theme-guide-header mb-12 flex items-center justify-between gap-6 max-[540px]:mb-8 max-[540px]:gap-3">
                <Link
                    className="brand inline-flex items-center gap-3 font-bold text-[length:var(--text-2xl)] text-[var(--text-brand-strong)] no-underline [&_span]:border-l-[var(--border-width)] [&_span]:border-l-border [&_span]:pl-3 [&_span]:font-normal [&_span]:text-[length:var(--text-sm)] [&_span]:text-muted-foreground [&_span]:[border-left-style:solid] [.studio-topbar_&]:min-h-[66px] [.studio-topbar_&]:min-w-[222px] [.studio-topbar_&]:gap-2 [.studio-topbar_&]:self-stretch [.studio-topbar_&]:border-r-[1px] [.studio-topbar_&]:border-r-border [.studio-topbar_&]:bg-[var(--nav-ground)] [.studio-topbar_&]:px-5 [.studio-topbar_&]:py-4 [.studio-topbar_&]:text-[length:20px] [.studio-topbar_&]:text-foreground [.studio-topbar_&]:[border-right-style:solid] max-[700px]:[.studio-topbar_&]:mr-auto max-[1000px]:[.studio-topbar_&]:min-w-[190px] max-[700px]:[.studio-topbar_&]:min-w-0 max-[700px]:[.studio-topbar_&]:flex-[0_1_auto] max-[1000px]:[.studio-topbar_&]:px-[14px] max-[700px]:[.studio-topbar_&]:px-3 max-[1000px]:[.studio-topbar_&]:text-[length:18px] max-[700px]:[.studio-topbar_&]:text-[length:17px] [.studio-topbar_&_span]:border-[var(--nav-muted)] [.studio-topbar_&_span]:pl-2 [.studio-topbar_&_span]:text-[length:10px] [.studio-topbar_&_span]:text-[var(--nav-ink)] max-[700px]:[.studio-topbar_&_span]:hidden max-[760px]:[.studio-topbar_&_span]:hidden [.studio-topbar_&_svg]:text-primary max-[540px]:[.theme-guide-header_&_span]:hidden"
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                >
                    <BookOpen size={25} aria-hidden="true" />
                    Bookaria<span>Studio</span>
                </Link>
                <Link to="/books">Về Studio</Link>
            </header>
            <main id="main">
                <div className="theme-guide-intro max-w-[68ch] [&_h1]:mt-4 [&_p]:text-muted-foreground">
                    <h1>Nền tảng giao diện Studio</h1>
                    <Badge tone="info">Bộ giao diện mẫu · Light</Badge>
                    <p>
                        Màu xanh dịu, chữ tiếng Việt rõ ràng và các thành phần dùng chung. Trang này
                        chỉ có khi chạy chế độ phát triển; các thao tác bên dưới là bản mẫu tại chỗ.
                    </p>
                </div>
                <nav
                    className="theme-guide-nav mt-6 flex flex-wrap gap-[var(--space-2)_var(--space-6)] py-5 [border-block:1px_solid_var(--border-default)] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center"
                    aria-label="Mục trong bộ giao diện"
                >
                    <a href="#colors">Màu sắc</a>
                    <a href="#typography">Kiểu chữ</a>
                    <a href="#buttons">Nút & liên kết</a>
                    <a href="#forms">Biểu mẫu</a>
                    <a href="#feedback">Thông báo</a>
                    <a href="#spacing">Khoảng cách</a>
                </nav>

                <section
                    id="colors"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="colors-title"
                >
                    <h2 id="colors-title">Màu sắc theo vai trò</h2>
                    <p>Đổi token ngữ nghĩa để cập nhật đồng bộ các màn hình.</p>
                    <ul className="theme-swatches [&_code]:wrap-anywhere m-0 grid list-none grid-cols-[repeat(auto-fit,_minmax(164px,_1fr))] gap-6 p-0 max-[540px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[540px]:gap-[var(--space-5)_var(--space-4)] [&_code]:block [&_code]:text-[length:var(--text-xs)] [&_code]:text-muted-foreground [&_strong]:mt-2 [&_strong]:mb-1 [&_strong]:block [&_strong]:text-[length:var(--text-sm)]">
                        {swatches.map(([label, token]) => (
                            <li key={token}>
                                <div
                                    className="theme-swatch h-16 rounded-[var(--radius-md)] border border-border border-solid"
                                    style={{ background: `var(${token})` }}
                                />
                                <strong>{label}</strong>
                                <code>{token}</code>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    id="typography"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="type-title"
                >
                    <h2 id="type-title">Bricolage Grotesque + Be Vietnam Pro</h2>
                    <p>
                        Bricolage Grotesque cho tiêu đề (600, 700). Be Vietnam Pro cho nội dung,
                        nhãn và nút (400, 500, 600, 700). Cả hai font được lưu cùng ứng dụng.
                    </p>
                    <div className="theme-type-samples border border-border border-solid bg-surface p-6 max-[540px]:p-5 [&_p:last-child]:mb-0 [&_p]:mx-0 [&_p]:mt-0 [&_p]:mb-4">
                        <p className="theme-heading-sample font-display font-semibold text-[length:var(--text-3xl)] leading-[var(--leading-tight)] max-[540px]:text-[length:var(--text-2xl)]">
                            Mỗi cuốn sách mở ra một thế giới.
                        </p>
                        <p className="theme-subheading-sample font-display font-semibold text-[length:var(--text-xl)]">
                            Không gian sáng tạo của bạn
                        </p>
                        <p>Khám phá, sáng tạo và chia sẻ những câu chuyện đầy cảm hứng.</p>
                        <p className="theme-small-sample text-[length:var(--text-sm)] text-muted-foreground">
                            Chữ phụ 14px · Tiếng Việt: ă â đ ê ô ơ ư · 0123456789
                        </p>
                        <p className="theme-caption-sample text-[length:var(--text-xs)] text-muted-foreground">
                            Chú thích 12px · Đã lưu thay đổi cách đây vài giây.
                        </p>
                    </div>
                    <div className="theme-weight-samples my-5 flex flex-wrap items-center gap-4">
                        <span style={{ fontWeight: 400 }}>400 Thường</span>
                        <span style={{ fontWeight: 500 }}>500 Vừa</span>
                        <span style={{ fontWeight: 600 }}>600 Đậm vừa</span>
                        <span style={{ fontWeight: 700 }}>700 Đậm</span>
                    </div>
                </section>

                <section
                    id="buttons"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="buttons-title"
                >
                    <h2 id="buttons-title">Nút & liên kết</h2>
                    <p>Dùng phím Tab để xem viền focus. Nút mặc định cao 48px, cỡ nhỏ 40px.</p>
                    <div className="theme-demo-row my-5 flex flex-wrap items-center gap-4 [.theme-demo-form_&:last-child]:mb-0">
                        <Button>
                            <Plus data-icon="inline-start" aria-hidden="true" />
                            Tạo sách
                        </Button>
                        <Button variant="secondary">Lưu bản nháp</Button>
                        <Button variant="ghost">Hủy bỏ</Button>
                        <Button variant="danger">Chuyển vào thùng rác</Button>
                    </div>
                    <div className="theme-demo-row my-5 flex flex-wrap items-center gap-4 [.theme-demo-form_&:last-child]:mb-0">
                        <Button size="sm">Cỡ nhỏ</Button>
                        <Button disabled>Chưa khả dụng</Button>
                        <Button aria-busy={true} disabled={true}>
                            {true && <Spinner data-icon="inline-start" aria-hidden="true" />}Đang
                            lưu mẫu…
                        </Button>
                        <Link to="/books" className={buttonStyles({ variant: 'secondary' })}>
                            Mở Studio
                        </Link>
                    </div>
                    <p className="theme-caption-sample text-[length:var(--text-xs)] text-muted-foreground">
                        Nút tải bị khóa tương tác; liên kết điều hướng vẫn là thẻ liên kết.
                    </p>
                </section>

                <section
                    id="forms"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="forms-title"
                >
                    <h2 id="forms-title">Biểu mẫu</h2>
                    <p>Mỗi ô có nhãn rõ ràng. Chữ trợ giúp và lỗi được nối với ô nhập tương ứng.</p>
                    <form
                        className="theme-demo-form max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-6 max-[540px]:p-5"
                        onSubmit={previewSave}
                    >
                        <FieldGroup className="contents">
                            {saved && (
                                <Alert tone="success">
                                    Đã lưu bản mẫu tại trang này. Không có dữ liệu được gửi lên máy
                                    chủ.
                                </Alert>
                            )}
                            <div className="form-grid grid grid-cols-[1fr_1fr] gap-[0_var(--space-6)] max-[760px]:grid-cols-[1fr] max-[540px]:[.theme-demo-form_&]:grid-cols-[1fr]">
                                <Field className="theme-demo-field mb-5 block [&_label]:mb-0">
                                    <FieldLabel htmlFor="sample-title">Tên sách</FieldLabel>

                                    <Input
                                        id="sample-title"
                                        name="title"
                                        placeholder="Nhập tên sách"
                                        required
                                        aria-describedby="sample-title-hint"
                                    />
                                    <span
                                        id="sample-title-hint"
                                        className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                                    >
                                        Hãy đặt một tên ngắn, dễ nhớ.
                                    </span>
                                </Field>
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="sample-format">
                                        Khổ sách
                                        <FormSelect
                                            id="sample-format"
                                            name="format"
                                            options={[
                                                { value: 'A4', label: 'A4' },
                                                { value: 'A5', label: 'A5' },
                                                { value: 'Hình vuông', label: 'Hình vuông' },
                                            ]}
                                        />
                                    </FieldLabel>
                                </Field>
                            </div>
                            <Field orientation="contents">
                                <FieldLabel htmlFor="sample-description">
                                    Mô tả
                                    <Textarea
                                        id="sample-description"
                                        name="description"
                                        rows={3}
                                        placeholder="Cuốn sách này dành cho ai?"
                                    />
                                </FieldLabel>
                            </Field>
                            <div className="form-grid grid grid-cols-[1fr_1fr] gap-[0_var(--space-6)] max-[760px]:grid-cols-[1fr] max-[540px]:[.theme-demo-form_&]:grid-cols-[1fr]">
                                <Field
                                    data-invalid
                                    className="theme-demo-field mb-5 block [&_label]:mb-0"
                                >
                                    <FieldLabel htmlFor="sample-invalid">
                                        Tên chưa hợp lệ
                                    </FieldLabel>
                                    <Input
                                        id="sample-invalid"
                                        defaultValue=""
                                        aria-invalid="true"
                                        aria-describedby="sample-invalid-error"
                                    />
                                    <span
                                        id="sample-invalid-error"
                                        className="field-error mx-0 mt-2 mb-0 text-[length:var(--text-xs)] text-danger-foreground"
                                    >
                                        Ví dụ lỗi: vui lòng nhập tên sách.
                                    </span>
                                </Field>
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="sample-readonly">
                                        Thông tin chỉ đọc
                                        <Input
                                            id="sample-readonly"
                                            value="Bookaria Studio"
                                            readOnly
                                        />
                                    </FieldLabel>
                                </Field>
                            </div>
                            <Field orientation="contents">
                                <FieldLabel htmlFor="sample-disabled">
                                    Ô tạm khóa
                                    <Input id="sample-disabled" value="Đang chờ xử lý" disabled />
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                    <Checkbox name="remember" />
                                    Ghi nhớ lựa chọn mẫu
                                </FieldLabel>
                            </Field>
                            <div className="theme-demo-row my-5 flex flex-wrap items-center gap-4 [.theme-demo-form_&:last-child]:mb-0">
                                <Button type="submit">
                                    <Check data-icon="inline-start" aria-hidden="true" />
                                    Lưu bản mẫu
                                </Button>
                            </div>
                        </FieldGroup>
                    </form>
                </section>

                <section
                    id="feedback"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="feedback-title"
                >
                    <h2 id="feedback-title">Thông báo & trạng thái</h2>
                    <div className="theme-feedback-samples max-w-180">
                        <Alert tone="info">
                            Thông tin: bạn có thể chỉnh sửa tên sách trong phần chi tiết.
                        </Alert>
                        <Alert tone="success">Thành công: thông tin đã được lưu.</Alert>
                        <Alert tone="warning">
                            Cần chú ý: hãy xác minh email trước khi xuất bản.
                        </Alert>
                        <Alert tone="danger">
                            Lỗi: chưa kết nối được máy chủ. Vui lòng thử lại.
                        </Alert>
                    </div>
                    <div className="theme-demo-row my-5 flex flex-wrap items-center gap-4 [.theme-demo-form_&:last-child]:mb-0">
                        <Badge>Bản nháp</Badge>
                        <Badge tone="success">Đã xuất bản</Badge>
                        <Badge tone="warning">Có thay đổi</Badge>
                        <Badge tone="danger">Cần kiểm tra</Badge>
                        <Badge tone="info">Thông tin</Badge>
                    </div>
                </section>

                <section
                    id="spacing"
                    className="theme-guide-section border-b-[1px] border-b-border py-10 [border-bottom-style:solid] [scroll-margin-top:var(--space-6)] [&_>_p]:mx-0 [&_>_p]:mt-[calc(-1_*_var(--space-2))] [&_>_p]:mb-6 [&_>_p]:text-muted-foreground"
                    aria-labelledby="spacing-title"
                >
                    <h2 id="spacing-title">Khoảng cách & bo góc</h2>
                    <p>
                        Thang khoảng cách theo bước 4px. Ưu tiên 8, 12, 16, 24 và 32px trong màn
                        hình mới.
                    </p>
                    <div className="theme-space-samples mb-8 grid gap-3 [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-4 [&_code]:w-20 [&_small]:text-[length:var(--text-xs)] [&_small]:text-muted-foreground [&_span]:h-4 [&_span]:bg-primary">
                        {([1, 2, 3, 4, 6, 8, 12, 16] as const).map((step) => (
                            <div key={step}>
                                <code>space-{step}</code>
                                <span style={{ width: `var(--space-${step})` }} />
                                <small>{step * 4}px</small>
                            </div>
                        ))}
                    </div>
                    <div className="theme-radius-samples flex flex-wrap gap-4 [&_>_div]:border [&_>_div]:border-input [&_>_div]:border-solid [&_>_div]:bg-surface [&_>_div]:p-5">
                        {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                            <div key={size} style={{ borderRadius: `var(--radius-${size})` }}>
                                <code>radius-{size}</code>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
            <footer className="theme-guide-footer pt-8 pb-4 text-[length:var(--text-sm)] text-muted-foreground">
                Bookaria Studio · Theme mẫu, có thể thay đổi dần theo thiết kế chính thức.
            </footer>
        </div>
    );
}
