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
3. `src/index.css`: điểm nhập Tailwind v4, `tw-animate-css`, font, token, base và ánh xạ `@theme inline` cho utility/shadcn.
4. `src/shared/ui/primitives/`: primitive shadcn dùng Radix, đã chỉnh biến thể và utility theo token Bookaria.
5. `src/shared/ui/Button.tsx`, `Badge.tsx`, `Alert.tsx`: API wrapper React giữ cách gọi của sản phẩm.
6. `src/pages/StyleGuidePage.tsx`: ví dụ sử dụng thực tế; các page/feature TSX giữ bố cục bằng utility.

Chỉ còn bốn file CSS: `src/index.css`, `src/shared/theme/fonts.css`, `src/shared/theme/tokens.css` và `src/shared/theme/base.css`. `main.tsx` nhập `index.css` một lần. Base nằm trong cascade layer `base`; component và bố cục dùng class Tailwind trong TSX. Các tên class cũ còn lại là hook cho selector/ngữ cảnh, không cần tạo lại file CSS theo từng feature. Các control primitive có `data-slot` để tránh nhận chồng kiểu control native trong base.

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

`--radius-sm/md/lg/xl` = 6/8/12/16px. Input/nút dùng md, panel dùng lg. Nút mặc định cao 48px, cỡ nhỏ 40px. Dùng cỡ mặc định cho thao tác chính trên điện thoại. Focus 3px có offset, không xóa outline. Token chuyển động chung giữ 120/180ms; primitive Button hiện dùng chuyển màu 150ms. Spinner chỉ quay khi người dùng không yêu cầu reduced motion; hiệu ứng mới cần dùng `motion-safe:` hoặc `motion-reduce:` phù hợp.

## Dùng component khi viết màn mới

```tsx
import { Link } from 'react-router-dom';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonStyles } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/primitives/spinner';

<Button type="submit" disabled={isPending} aria-busy={isPending}>
    {isPending && <Spinner data-icon="inline-start" aria-hidden="true" />}
    {isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
</Button>
<Button variant="secondary" onClick={cancel}>Hủy bỏ</Button>
<Button variant="danger" disabled={!canDelete} onClick={remove}>Xóa</Button>
<Button size="sm">Thao tác phụ</Button>
<Button fullWidth>Tiếp tục</Button>
<Link to="/books" className={buttonStyles({ variant: 'secondary' })}>Về danh sách</Link>
<Badge tone="success">Đã xuất bản</Badge>
<Alert tone="danger">Không lưu được. Hãy thử lại.</Alert>
```

`Button` mặc định `type="button"`, chỉ submit khi khai báo rõ. Wrapper không có prop `loading`: nơi gọi chủ động truyền `disabled`, `aria-busy`, `Spinner` và nhãn dễ hiểu như “Đang lưu…”. Spinner trang trí trong nút có `aria-hidden`; trạng thái và nhãn của nút mô tả tiến trình. Điều hướng dùng Link với `buttonStyles` hoặc `Button asChild` bọc Link. `Button` mặc định rộng theo nội dung; `fullWidth` dành cho form xác thực.

Wrapper giữ biến thể `primary/secondary/ghost/danger`, ánh xạ sang primitive `default/secondary/outline/destructive`; `ghost` của wrapper vẫn là nút viền mảnh. Primitive còn có `ghost` không viền, `link`, cỡ `icon` và `asChild`. Dùng `cn` từ `@/shared/lib/cn` để ghép class (`clsx` + `tailwind-merge`), giữ focus/disabled và màu ngữ nghĩa khi ghi đè bố cục.

`Badge` có tone neutral/success/warning/danger/info. `Alert` có info/success/warning/danger: lỗi mặc định role alert, các tone còn lại role status. `Feedback` của các form hiện có dùng lại Alert; không phải thay API của form.

Biểu mẫu dùng `FieldGroup`, `Field`, `FieldLabel` cùng `Input`, `Textarea`, `NativeSelect` từ `@/shared/ui/primitives`. Các control vẫn giữ ngữ nghĩa và prop HTML native. `Field` mặc định xếp dọc; hướng `contents` đang dùng ở nhiều form để giữ bố cục gọn và nhãn bọc control của giao diện hiện có. Luôn nối lỗi/hint tới ô nhập; `data-invalid` của Field và `aria-invalid` của control phải dùng cùng điều kiện:

```tsx
import {
    Field, FieldDescription, FieldError, FieldGroup, FieldLabel,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';

<FieldGroup>
    <Field orientation="contents" data-invalid={Boolean(error)}>
        <FieldLabel htmlFor="book-title">
            Tên sách
            <Input id="book-title" name="title" required
                aria-invalid={Boolean(error)} aria-describedby="book-title-help" />
        </FieldLabel>
        {error ? (
            <FieldError id="book-title-help">{error}</FieldError>
        ) : (
            <FieldDescription id="book-title-help">Tối đa 200 ký tự.</FieldDescription>
        )}
    </Field>
</FieldGroup>
```

`Textarea` không ép chiều cao tối thiểu; giữ `rows` và cỡ gọn của inspector, tăng chữ lên 16px trên mobile theo lớp bố cục hiện có. `NativeSelect` giữ chọn lựa native. Một số input file/radio/range/color và menu trang dùng popover native được giữ để bảo toàn sự kiện/hành vi nền tảng; không cần thay chỉ để đồng nhất thư viện.

Nếu form có nhiều trường, có thể khóa cả fieldset khi gửi. Phần kiểm tra Zod/API và state vẫn ở feature/model, không đưa nghiệp vụ vào shared UI.

## Tailwind và primitive dùng chung

Giữ bố cục/presentation trong utility TSX; không thêm stylesheet riêng cho từng phần. Tailwind v4 nối tới cùng token bằng `@theme inline` trong `index.css`, ví dụ:

```tsx
<section className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 text-foreground">
    <p className="text-muted-foreground">Nội dung phụ</p>
</section>
```

Các tên dùng chung:

- Font/nền/chữ: `font-sans`, `font-mono`, `bg-background`/`bg-canvas`, `bg-surface`, `text-foreground`, `text-muted-foreground`.
- Hành động: `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover`, `bg-secondary`, `text-secondary-foreground`, `bg-destructive`, `text-destructive-foreground`, `text-destructive` cho chữ hành động xóa/hủy.
- Chọn/hover/viền/focus: `bg-selected`/`bg-accent`, `text-accent-foreground`, `bg-hover`, `border-border`/`border-line`, `border-input`, `outline-ring`.
- Trạng thái: `bg-success`/`text-success-foreground`, `bg-warning`/`text-warning-foreground`, `bg-danger`/`text-danger-foreground`, và các cặp `neutral`/`info` tương tự.

`muted` nay là màu nền dịu (`--bg-surface-subtle`), nên chữ phụ phải dùng `text-muted-foreground`. `danger` là nền trạng thái lỗi; dùng `text-danger-foreground` cho chữ lỗi và `text-destructive` cho hành động phá hủy. Không dùng lại `text-muted` hoặc `text-danger` như màu chữ của bộ alias cũ. Ưu tiên wrapper/primitive cho nút để giữ focus/disabled thống nhất và truyền busy state rõ ràng. Không tạo thêm bảng màu độc lập trong từng feature hoặc lạm dụng giá trị tùy ý của Tailwind.

`components.json` chọn `radix-nova`, icon Lucide và thư mục `@/shared/ui/primitives`; primitive là mã cục bộ có thể đọc/chỉnh theo token sản phẩm. Khi dùng Toggle/ToggleGroup của Radix, trạng thái chọn là `data-state="on"`; các selector dựa trên `aria-pressed` chỉ dùng khi control thực sự xuất thuộc tính đó. Dialog dùng primitive Radix; ConfirmDialog chặn tương tác bên ngoài và chặn Escape khi busy, cho phép Escape khi rảnh. Giữ quy tắc này ở các luồng tạo/xác nhận hiện có.

Lucide là bộ icon hiện hành. Thông báo nội tuyến qua Alert/Feedback đang đủ cho các luồng này, nên chưa thêm thư viện toast.

## Khi đổi theme hoặc thêm component

Chỉnh token trước, mở style-guide rồi kiểm tra ít nhất màn đăng nhập/sách/hồ sơ ở desktop và mobile. Xem hover/focus/disabled/loading/lỗi, zoom chữ và reduced motion. Chỉ tách component mới khi có pattern thực sự lặp lại; giữ bố cục nghiệp vụ trong feature/page.

```powershell
pnpm check
pnpm test
pnpm build
```
