import { BookOpen, Check, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../shared/ui/Alert';
import { Badge } from '../shared/ui/Badge';
import { Button, buttonStyles } from '../shared/ui/Button';
import '../shared/theme/style-guide.css';

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
        <div className="theme-guide">
            <header className="theme-guide-header">
                <Link className="brand" to="/books">
                    <BookOpen size={25} aria-hidden="true" />
                    Bookaria<span>Studio</span>
                </Link>
                <Link to="/books">Về Studio</Link>
            </header>
            <main id="main">
                <div className="theme-guide-intro">
                    <Badge tone="info">Bộ giao diện mẫu · Light</Badge>
                    <h1>Nền tảng giao diện Studio</h1>
                    <p>
                        Màu xanh dịu, chữ tiếng Việt rõ ràng và các thành phần dùng chung. Trang này
                        chỉ có khi chạy chế độ phát triển; các thao tác bên dưới là bản mẫu tại chỗ.
                    </p>
                </div>
                <nav className="theme-guide-nav" aria-label="Mục trong bộ giao diện">
                    <a href="#colors">Màu sắc</a>
                    <a href="#typography">Kiểu chữ</a>
                    <a href="#buttons">Nút & liên kết</a>
                    <a href="#forms">Biểu mẫu</a>
                    <a href="#feedback">Thông báo</a>
                    <a href="#spacing">Khoảng cách</a>
                </nav>

                <section id="colors" className="theme-guide-section" aria-labelledby="colors-title">
                    <h2 id="colors-title">Màu sắc theo vai trò</h2>
                    <p>Đổi token ngữ nghĩa để cập nhật đồng bộ các màn hình.</p>
                    <ul className="theme-swatches">
                        {swatches.map(([label, token]) => (
                            <li key={token}>
                                <div
                                    className="theme-swatch"
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
                    className="theme-guide-section"
                    aria-labelledby="type-title"
                >
                    <h2 id="type-title">Be Vietnam Pro</h2>
                    <p>Font được lưu cùng ứng dụng. Có sẵn bốn độ đậm: 400, 500, 600 và 700.</p>
                    <div className="theme-type-samples">
                        <p className="theme-heading-sample">Mỗi cuốn sách mở ra một thế giới.</p>
                        <p className="theme-subheading-sample">Không gian sáng tạo của bạn</p>
                        <p>Khám phá, sáng tạo và chia sẻ những câu chuyện đầy cảm hứng.</p>
                        <p className="theme-small-sample">
                            Chữ phụ 14px · Tiếng Việt: ă â đ ê ô ơ ư · 0123456789
                        </p>
                        <p className="theme-caption-sample">
                            Chú thích 12px · Đã lưu thay đổi cách đây vài giây.
                        </p>
                    </div>
                    <div className="theme-weight-samples">
                        <span style={{ fontWeight: 400 }}>400 Thường</span>
                        <span style={{ fontWeight: 500 }}>500 Vừa</span>
                        <span style={{ fontWeight: 600 }}>600 Đậm vừa</span>
                        <span style={{ fontWeight: 700 }}>700 Đậm</span>
                    </div>
                </section>

                <section
                    id="buttons"
                    className="theme-guide-section"
                    aria-labelledby="buttons-title"
                >
                    <h2 id="buttons-title">Nút & liên kết</h2>
                    <p>Dùng phím Tab để xem viền focus. Nút mặc định cao 48px, cỡ nhỏ 40px.</p>
                    <div className="theme-demo-row">
                        <Button>
                            <Plus size={18} aria-hidden="true" />
                            Tạo sách
                        </Button>
                        <Button variant="secondary">Lưu bản nháp</Button>
                        <Button variant="ghost">Hủy bỏ</Button>
                        <Button variant="danger">Chuyển vào thùng rác</Button>
                    </div>
                    <div className="theme-demo-row">
                        <Button size="sm">Cỡ nhỏ</Button>
                        <Button disabled>Chưa khả dụng</Button>
                        <Button loading>Đang lưu mẫu…</Button>
                        <Link to="/books" className={buttonStyles({ variant: 'secondary' })}>
                            Mở Studio
                        </Link>
                    </div>
                    <p className="theme-caption-sample">
                        Nút tải bị khóa tương tác; liên kết điều hướng vẫn là thẻ liên kết.
                    </p>
                </section>

                <section id="forms" className="theme-guide-section" aria-labelledby="forms-title">
                    <h2 id="forms-title">Biểu mẫu</h2>
                    <p>Mỗi ô có nhãn rõ ràng. Chữ trợ giúp và lỗi được nối với ô nhập tương ứng.</p>
                    <form className="theme-demo-form" onSubmit={previewSave}>
                        {saved && (
                            <Alert tone="success">
                                Đã lưu bản mẫu tại trang này. Không có dữ liệu được gửi lên máy chủ.
                            </Alert>
                        )}
                        <div className="form-grid">
                            <div className="theme-demo-field">
                                <label htmlFor="sample-title">Tên sách</label>
                                <input
                                    id="sample-title"
                                    name="title"
                                    placeholder="Nhập tên sách"
                                    required
                                    aria-describedby="sample-title-hint"
                                />
                                <span id="sample-title-hint" className="field-hint">
                                    Hãy đặt một tên ngắn, dễ nhớ.
                                </span>
                            </div>
                            <label htmlFor="sample-format">
                                Khổ sách
                                <select id="sample-format" name="format">
                                    <option>A4</option>
                                    <option>A5</option>
                                    <option>Hình vuông</option>
                                </select>
                            </label>
                        </div>
                        <label htmlFor="sample-description">
                            Mô tả
                            <textarea
                                id="sample-description"
                                name="description"
                                rows={3}
                                placeholder="Cuốn sách này dành cho ai?"
                            />
                        </label>
                        <div className="form-grid">
                            <div className="theme-demo-field">
                                <label htmlFor="sample-invalid">Tên chưa hợp lệ</label>
                                <input
                                    id="sample-invalid"
                                    defaultValue=""
                                    aria-invalid="true"
                                    aria-describedby="sample-invalid-error"
                                />
                                <span id="sample-invalid-error" className="field-error">
                                    Ví dụ lỗi: vui lòng nhập tên sách.
                                </span>
                            </div>
                            <label htmlFor="sample-readonly">
                                Thông tin chỉ đọc
                                <input id="sample-readonly" value="Bookaria Studio" readOnly />
                            </label>
                        </div>
                        <label htmlFor="sample-disabled">
                            Ô tạm khóa
                            <input id="sample-disabled" value="Đang chờ xử lý" disabled />
                        </label>
                        <label className="checkbox">
                            <input type="checkbox" name="remember" />
                            Ghi nhớ lựa chọn mẫu
                        </label>
                        <div className="theme-demo-row">
                            <Button type="submit">
                                <Check size={18} aria-hidden="true" />
                                Lưu bản mẫu
                            </Button>
                        </div>
                    </form>
                </section>

                <section
                    id="feedback"
                    className="theme-guide-section"
                    aria-labelledby="feedback-title"
                >
                    <h2 id="feedback-title">Thông báo & trạng thái</h2>
                    <div className="theme-feedback-samples">
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
                    <div className="theme-demo-row">
                        <Badge>Bản nháp</Badge>
                        <Badge tone="success">Đã xuất bản</Badge>
                        <Badge tone="warning">Có thay đổi</Badge>
                        <Badge tone="danger">Cần kiểm tra</Badge>
                        <Badge tone="info">Thông tin</Badge>
                    </div>
                </section>

                <section
                    id="spacing"
                    className="theme-guide-section"
                    aria-labelledby="spacing-title"
                >
                    <h2 id="spacing-title">Khoảng cách & bo góc</h2>
                    <p>
                        Thang khoảng cách theo bước 4px. Ưu tiên 8, 12, 16, 24 và 32px trong màn
                        hình mới.
                    </p>
                    <div className="theme-space-samples">
                        {([1, 2, 3, 4, 6, 8, 12, 16] as const).map((step) => (
                            <div key={step}>
                                <code>space-{step}</code>
                                <span style={{ width: `var(--space-${step})` }} />
                                <small>{step * 4}px</small>
                            </div>
                        ))}
                    </div>
                    <div className="theme-radius-samples">
                        {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                            <div key={size} style={{ borderRadius: `var(--radius-${size})` }}>
                                <code>radius-{size}</code>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
            <footer className="theme-guide-footer">
                Bookaria Studio · Theme mẫu, có thể thay đổi dần theo thiết kế chính thức.
            </footer>
        </div>
    );
}
