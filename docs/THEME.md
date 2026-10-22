# Theme mẫu của Bookaria Studio

Bộ giao diện sáng dùng chung cho các màn hiện tại. Đây là nền tảng có thể chỉnh dần, chưa phải thiết kế thương hiệu cuối cùng. Không cần thêm theme provider hoặc lưu lựa chọn trong localStorage.

## Xem mẫu trước

```powershell
pnpm dev
```

Mở **http://localhost:5173/style-guide** hoặc chọn **Giao diện mẫu** trong menu Studio khi chạy dev. Trang này không cần đăng nhập hoặc backend, có mẫu màu/chữ/nút/form/thông báo/trạng thái/khoảng cách. Nút Lưu bản mẫu chỉ hoạt động tại trang, không gọi API. Route và menu mẫu không có trong bản build production.

## Nên đọc theo thứ tự nào?

1. `src/shared/theme/tokens.css`: màu, font, cỡ chữ, khoảng cách, bo góc và chuyển động.
2. `src/shared/theme/base.css`: kiểu mặc định cho chữ, focus, input/select/textarea và reduced motion.
3. `src/shared/theme/components.css`: kiểu chung của nút, thông báo, badge, dialog.
4. `src/shared/ui/Button.tsx`, `Badge.tsx`, `Alert.tsx`: API của các thành phần React.
5. `src/pages/StyleGuidePage.tsx`: ví dụ sử dụng thực tế.
6. `src/features/auth/ui/auth.css` và `src/app/studio.css`: bố cục riêng của từng khu vực.

`src/index.css` là điểm nhập CSS duy nhất từ `main.tsx`. Nó nối Tailwind, font, token, base, component rồi bố cục. Base và component dùng CSS cascade layers; utility Tailwind có thể ghi đè chúng. CSS bố cục riêng không đặt trong layer, vì vậy tránh đặt lại màu/nút/form dùng chung ở đó.

## Đổi màu sau này tại một nơi

Token chia hai mức:

- **Palette** là màu gốc: `--palette-blue-600`, `--palette-slate-900`.
- **Ngữ nghĩa** mô tả mục đích: `--action-primary`, `--bg-surface`, `--text-muted`, `--border-input`, `--status-success-bg`. Màn hình dùng mức này, không chọn trực tiếp màu gốc.

Ví dụ muốn đổi màu nút chính, sửa trong `tokens.css`:

```css
:root {
    --action-primary: #3653ad;
    --action-primary-hover: #28428f;
}
```

Các nút và liên kết dùng cùng token sẽ cập nhật. Kiểm tra lại độ tương phản của chữ trắng, hover và focus sau mỗi lần đổi. Màu trạng thái cũng cần đổi theo cặp nền/chữ. Chữ nội dung hướng tới WCAG AA 4.5:1; trạng thái luôn có nhãn, không chỉ dùng màu.

Nếu cần dark mode về sau, đặt nhóm token ngữ nghĩa tương ứng trong `[data-theme="dark"]` rồi mới thêm công tắc. Hiện chỉ có light theme, chưa có cơ chế đổi/lưu theme.

## Font và thang chữ

**Be Vietnam Pro** được cài qua `@fontsource/be-vietnam-pro`, giấy phép SIL Open Font License 1.1 trong package. `fonts.css` nạp độ đậm **400/500/600/700**, gồm Vietnamese/Latin với unicode ranges và `font-display: swap`. Vite đóng gói font cùng ứng dụng; không gọi Google Fonts/CDN. Trình duyệt chỉ tải subset cần cho ký tự đang hiển thị. Có fallback Segoe UI/sans-serif.

Đổi font:

1. Cài package font mới có hỗ trợ tiếng Việt và giấy phép phù hợp.
2. Thay import trong `fonts.css`, chỉ nạp weight thực sự dùng.
3. Sửa `--font-body` trong `tokens.css`. `--font-heading` đang theo font body; có thể tách sau.
4. Xem lại tiếng Việt có dấu, độ dài nút, form, mobile và font weight. Không dùng weight chưa nạp vì đã tắt font tổng hợp.

| Token | Cỡ mặc định | Dùng cho |
| --- | --- | --- |
| `--text-xs` | 12px | Chú thích, badge |
| `--text-sm` | 14px | Nhãn, chữ phụ, nút |
| `--text-md` | 16px | Nội dung, input |
| `--text-lg` | 18px | Tiêu đề nhỏ |
| `--text-xl` | 20px | Tiêu đề phần |
| `--text-2xl` | 24px | Tiêu đề lớn |
| `--text-3xl` | 32px | Tiêu đề trang |

Cỡ dùng rem, theo cỡ chữ người dùng. Line-height 1.6 cho nội dung và 1.3 cho tiêu đề. Không dùng font-size nhỏ hơn 16px cho input trên điện thoại.

## Khoảng cách, bo góc và tương tác

`--space-1/2/3/4/5/6/8/10/12/16` tương ứng 4/8/12/16/20/24/32/40/48/64px ở cỡ gốc 16px. Dùng scale này cho padding/gap/margin; chiều rộng cột và breakpoint vẫn có thể riêng theo bố cục.

`--radius-sm/md/lg/xl` = 6/8/12/16px. Input/nút dùng md, panel dùng lg. Nút mặc định cao 48px, cỡ nhỏ 40px. Dùng cỡ mặc định cho thao tác chính trên điện thoại. Focus 3px có offset, không xóa outline. Chuyển màu 120ms; người bật reduced motion sẽ không thấy spinner quay hoặc chuyển màu.

## Dùng component khi viết màn mới

```tsx
import { Link } from 'react-router-dom';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonStyles } from '@/shared/ui/Button';

<Button type="submit" loading={isPending}>Lưu thay đổi</Button>
<Button variant="secondary" onClick={cancel}>Hủy bỏ</Button>
<Button variant="danger" disabled={!canDelete} onClick={remove}>Xóa</Button>
<Button size="sm">Thao tác phụ</Button>
<Button fullWidth>Tiếp tục</Button>
<Link to="/books" className={buttonStyles({ variant: 'secondary' })}>Về danh sách</Link>
<Badge tone="success">Đã xuất bản</Badge>
<Alert tone="danger">Không lưu được. Hãy thử lại.</Alert>
```

`Button` mặc định `type="button"`, chỉ submit khi khai báo rõ. `loading` tự khóa nút, thêm spinner ẩn khỏi trình đọc màn hình và đặt `aria-busy`; vẫn truyền nhãn dễ hiểu như “Đang lưu…”. Không dùng nút để điều hướng. Các màn đã có class `button` vẫn tương thích; ưu tiên component cho code mới. `Button` mặc định rộng theo nội dung; `fullWidth` dành cho form xác thực. `buttonStyles` cũng dùng để làm đẹp thẻ Link.

`Badge` có tone neutral/success/warning/danger/info. `Alert` có info/success/warning/danger: lỗi mặc định role alert, các tone còn lại role status. `Feedback` của các form hiện có dùng lại Alert; không phải thay API của form.

Input/select/textarea dùng phần tử HTML chuẩn và kiểu base. Chưa tạo wrapper form vì chưa có nhu cầu lặp đủ phức tạp. Luôn nối lỗi/hint tới ô nhập:

```tsx
<div className="book-title-field">
    <label htmlFor="book-title">Tên sách</label>
    <input id="book-title" name="title" required
        aria-invalid={Boolean(error)} aria-describedby="book-title-help" />
    <span id="book-title-help" className={error ? 'field-error' : 'field-hint'}>
        {error || 'Tối đa 200 ký tự.'}
    </span>
</div>
```

Nếu form có nhiều trường, có thể khóa cả fieldset khi gửi. Phần kiểm tra Zod/API và state vẫn ở feature/model, không đưa nghiệp vụ vào shared UI.

## CSS thường và Tailwind

```css
.new-feature-section {
    background: var(--bg-surface);
    color: var(--text-primary);
    padding: var(--space-6);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
}
```

Tailwind v4 cũng được nối tới cùng token bằng `@theme inline` trong `index.css`:

```tsx
<section className="bg-surface text-foreground border border-line p-6">
    <p className="text-muted">Nội dung phụ</p>
</section>
```

Các tên sẵn có: font-sans/font-mono, bg-canvas/bg-surface, text-foreground/text-muted, bg-primary/hover:bg-primary-hover, border-line, text-danger. Ưu tiên component cho nút để giữ focus/loading/disabled thống nhất. Không tạo thêm bảng màu độc lập trong từng feature hoặc lạm dụng giá trị tùy ý của Tailwind.

## Khi đổi theme hoặc thêm component

Chỉnh token trước, mở style-guide rồi kiểm tra ít nhất màn đăng nhập/sách/hồ sơ ở desktop và mobile. Xem hover/focus/disabled/loading/lỗi, zoom chữ và reduced motion. Chỉ tách component mới khi có pattern thực sự lặp lại; giữ bố cục nghiệp vụ trong feature/page.

```powershell
pnpm check
pnpm test
pnpm build
```
