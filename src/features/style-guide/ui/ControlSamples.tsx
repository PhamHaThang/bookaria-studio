import { BookOpen, Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, type ButtonVariant, buttonStyles } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { FormSelect } from '@/shared/ui/FormSelect';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { Button as PrimitiveButton } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { SearchInput } from '@/shared/ui/SearchInput';
import { GuideSection, Sample } from './GuideSection';

export function ButtonSamples() {
    return (
        <GuideSection
            id="buttons"
            title="Nút & liên kết"
            description="Button Bookaria và primitive dùng cùng tên biến thể và kích thước. Chọn theo mục đích; icon-only luôn có nhãn đọc được."
        >
            <div className="flex flex-col gap-8">
                <Sample title="Biến thể dùng chung" source="@/shared/ui/Button">
                    <div className="flex flex-wrap gap-4">
                        {(['default', 'secondary', 'outline', 'ghost', 'destructive'] as const).map(
                            (variant) => (
                                <Button key={variant} variant={variant}>
                                    {variant}
                                </Button>
                            ),
                        )}
                    </div>
                    <p className="m-0 text-muted-foreground text-sm">
                        default: hành động chính · secondary: viền đen · outline: viền nhẹ · ghost:
                        không viền · destructive: xóa.
                    </p>
                </Sample>
                <Sample
                    title="Trạng thái và kích thước"
                    source="Button: size=default | sm; disabled; aria-busy"
                >
                    <div className="flex flex-wrap items-center gap-4">
                        <Button asChild>
                            <a href="#forms">
                                <Plus data-icon="inline-start" />
                                Thử biểu mẫu
                            </a>
                        </Button>
                        <Button size="sm">Cỡ nhỏ</Button>
                        <Button disabled>Chưa khả dụng</Button>
                        <Button disabled aria-busy="true">
                            <Spinner data-icon="inline-start" aria-hidden="true" />
                            Đang lưu…
                        </Button>
                        <Link to="/books" className={buttonStyles({ variant: 'secondary' })}>
                            Về Studio
                        </Link>
                    </div>
                </Sample>
                <Sample title="Công cụ và nút icon" source="@/shared/ui/primitives/button">
                    <div className="flex flex-wrap items-center gap-4">
                        <PrimitiveButton variant="ghost">ghost không viền</PrimitiveButton>
                        <PrimitiveButton variant="link" asChild>
                            <a href="#audit">Xem điểm khác nhau</a>
                        </PrimitiveButton>
                        <PrimitiveButton
                            variant="secondary"
                            size="icon"
                            aria-label="Thêm mẫu"
                            title="Thêm mẫu"
                        >
                            <Plus />
                        </PrimitiveButton>
                        <PrimitiveButton
                            variant="outline"
                            size="icon-sm"
                            disabled
                            aria-label="Xóa mẫu chưa khả dụng"
                        >
                            <Trash2 />
                        </PrimitiveButton>
                    </div>
                </Sample>
                <Sample
                    title="So sánh hover, focus và disabled"
                    source="Tab để di chuyển focus; hover để xem trạng thái thật"
                >
                    {(
                        [
                            'default',
                            'secondary',
                            'outline',
                            'ghost',
                            'destructive',
                        ] satisfies ButtonVariant[]
                    ).map((variant) => (
                        <div key={variant} className="flex flex-wrap items-center gap-4">
                            <code className="w-24 text-xs">{variant}</code>
                            <Button variant={variant}>Thử tương tác</Button>
                            <Button variant={variant} disabled>
                                Đã khóa
                            </Button>
                        </div>
                    ))}
                </Sample>
            </div>
        </GuideSection>
    );
}

export function ControlSamples() {
    const [search, setSearch] = useState('Sách của tôi');
    const [title, setTitle] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [selection, setSelection] = useState('blank');
    const [format, setFormat] = useState('A4');
    return (
        <GuideSection
            id="forms"
            title="Ô nhập & lựa chọn"
            description="Dùng Field và nhãn tách riêng khỏi control. SearchInput, PasswordInput và FormSelect là component dùng chung, không tự ghép lại ở mỗi màn."
        >
            <div className="flex flex-col gap-10">
                <Sample
                    title="Tìm kiếm"
                    source="@/shared/ui/SearchInput · onValueChange; loading; disabled"
                >
                    <FieldGroup className="grid grid-cols-2 gap-6 max-[800px]:grid-cols-1">
                        <Field className="block">
                            <FieldLabel className="mb-2" htmlFor="guide-search">
                                Nhập và xóa từ khóa
                            </FieldLabel>
                            <SearchInput
                                id="guide-search"
                                value={search}
                                onValueChange={setSearch}
                                placeholder="Tìm theo tên sách"
                            />
                            <FieldDescription className="mt-2 last:mt-2">
                                Từ khóa mẫu: {search || '(trống)'}
                            </FieldDescription>
                        </Field>
                        <Field className="block">
                            <FieldLabel className="mb-2" htmlFor="guide-search-loading">
                                Đang tìm kiếm
                            </FieldLabel>
                            <SearchInput
                                id="guide-search-loading"
                                defaultValue="Mô hình 3D"
                                loading
                            />
                        </Field>
                        <Field className="block" data-disabled>
                            <FieldLabel className="mb-2" htmlFor="guide-search-disabled">
                                Tìm kiếm bị khóa
                            </FieldLabel>
                            <SearchInput
                                id="guide-search-disabled"
                                defaultValue="Đang xử lý"
                                disabled
                            />
                        </Field>
                        <Field className="block">
                            <FieldLabel className="mb-2" htmlFor="guide-password">
                                Mật khẩu
                            </FieldLabel>
                            <PasswordInput
                                id="guide-password"
                                autoComplete="new-password"
                                placeholder="Nhập mật khẩu mẫu"
                            />
                        </Field>
                    </FieldGroup>
                </Sample>
                <Sample
                    title="Biểu mẫu hoạt động tại chỗ"
                    source="FieldGroup + Field + Input / FormSelect / Textarea / Feedback"
                >
                    <form
                        noValidate
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!title.trim()) {
                                setError('Vui lòng nhập tên sách.');
                                setSaved(null);
                                return;
                            }
                            setError(null);
                            setSaved(`Đã lưu bản mẫu “${title.trim()}”.`);
                        }}
                    >
                        <FieldGroup className="gap-5 [&_[data-slot=field-label]]:mb-0">
                            <FieldGroup className="grid grid-cols-2 gap-6 max-[800px]:grid-cols-1">
                                <Field className="block" data-invalid={Boolean(error)}>
                                    <FieldLabel htmlFor="guide-title">Tên sách</FieldLabel>
                                    <Input
                                        id="guide-title"
                                        value={title}
                                        onChange={(event) => {
                                            setTitle(event.currentTarget.value);
                                            setError(null);
                                        }}
                                        required
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error ? 'guide-title-error' : 'guide-title-help'
                                        }
                                        placeholder="Nhập tên sách"
                                    />
                                    {error ? (
                                        <FieldError className="mt-2" id="guide-title-error">
                                            {error}
                                        </FieldError>
                                    ) : (
                                        <FieldDescription
                                            className="mt-2 last:mt-2"
                                            id="guide-title-help"
                                        >
                                            Dữ liệu mẫu chỉ nằm trong trang này.
                                        </FieldDescription>
                                    )}
                                </Field>
                                <Field className="block">
                                    <FieldLabel htmlFor="guide-format">Khổ sách</FieldLabel>
                                    <FormSelect
                                        id="guide-format"
                                        name="format"
                                        value={format}
                                        onValueChange={setFormat}
                                        options={[
                                            { value: 'A4', label: 'A4' },
                                            { value: 'A5', label: 'A5' },
                                            { value: 'CUSTOM', label: 'Tùy chỉnh' },
                                            {
                                                value: 'unavailable',
                                                label: 'Mẫu bị khóa',
                                                disabled: true,
                                            },
                                        ]}
                                    />
                                </Field>
                                <Field className="block">
                                    <FieldLabel htmlFor="guide-readonly">Chỉ đọc</FieldLabel>
                                    <Input id="guide-readonly" value="Bookaria Studio" readOnly />
                                </Field>
                                <Field className="block" data-disabled>
                                    <FieldLabel htmlFor="guide-disabled">Tạm khóa</FieldLabel>
                                    <Input id="guide-disabled" value="Đang chờ xử lý" disabled />
                                </Field>
                            </FieldGroup>
                            <Field className="block">
                                <FieldLabel htmlFor="guide-description">Mô tả</FieldLabel>
                                <Textarea
                                    id="guide-description"
                                    rows={3}
                                    placeholder="Cuốn sách này dành cho ai?"
                                />
                            </Field>
                            <Feedback success={saved} />
                            <div className="flex flex-wrap gap-3">
                                <Button type="submit">
                                    <Check data-icon="inline-start" />
                                    Lưu bản mẫu
                                </Button>
                                <Button
                                    type="reset"
                                    variant="outline"
                                    onClick={() => {
                                        setTitle('');
                                        setError(null);
                                        setSaved(null);
                                        setFormat('A4');
                                    }}
                                >
                                    Xóa bản mẫu
                                </Button>
                            </div>
                        </FieldGroup>
                    </form>
                </Sample>
                <div className="grid grid-cols-2 gap-8 max-[800px]:grid-cols-1">
                    <Sample
                        title="Checkbox"
                        source="primitives/checkbox · checked / indeterminate / disabled"
                    >
                        <FieldSet>
                            <FieldLegend className="sr-only">Trạng thái checkbox</FieldLegend>
                            <FieldGroup className="gap-3">
                                <Field orientation="horizontal">
                                    <Checkbox id="guide-check" defaultChecked />
                                    <FieldLabel htmlFor="guide-check" className="m-0">
                                        Có animation
                                    </FieldLabel>
                                </Field>
                                <Field orientation="horizontal">
                                    <Checkbox id="guide-mixed" defaultChecked="indeterminate" />
                                    <FieldLabel htmlFor="guide-mixed" className="m-0">
                                        Một phần đã chọn (mẫu)
                                    </FieldLabel>
                                </Field>
                                <Field orientation="horizontal" data-disabled>
                                    <Checkbox id="guide-check-disabled" disabled />
                                    <FieldLabel htmlFor="guide-check-disabled" className="m-0">
                                        Chưa khả dụng
                                    </FieldLabel>
                                </Field>
                            </FieldGroup>
                        </FieldSet>
                    </Sample>
                    <Sample title="Radio: chọn đúng một" source="primitives/radio-group">
                        <FieldSet>
                            <FieldLegend className="sr-only">Quyền hiển thị mẫu</FieldLegend>
                            <RadioGroup defaultValue="private" aria-label="Quyền hiển thị mẫu">
                                {[
                                    ['private', 'Riêng tư'],
                                    ['public', 'Công khai'],
                                ].map(([value, label]) => (
                                    <Field key={value} orientation="horizontal">
                                        <RadioGroupItem id={`guide-${value}`} value={value} />
                                        <FieldLabel htmlFor={`guide-${value}`} className="m-0">
                                            {label}
                                        </FieldLabel>
                                    </Field>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </Sample>
                </div>
                <Sample
                    title="Nhóm tùy chọn"
                    source="primitives/toggle-group · type=single; variant=outline"
                >
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={selection}
                        onValueChange={(value) => {
                            if (value) setSelection(value);
                        }}
                        aria-label="Nguồn sách mẫu"
                    >
                        <ToggleGroupItem value="blank">
                            <BookOpen data-icon="inline-start" />
                            Sách trống
                        </ToggleGroupItem>
                        <ToggleGroupItem value="import">Nhập PDF / ảnh</ToggleGroupItem>
                    </ToggleGroup>
                    <p className="m-0 text-muted-foreground text-sm">
                        Lựa chọn mẫu: {selection === 'blank' ? 'Sách trống' : 'Nhập PDF / ảnh'}.
                    </p>
                </Sample>
            </div>
        </GuideSection>
    );
}
