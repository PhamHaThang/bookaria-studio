import { useState } from 'react';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldError, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';

const other = '__other__';
const licenseOptions = [
    { value: '', label: 'Chọn giấy phép', disabled: true },
    {
        value: 'CC0',
        label: 'CC0',
        description: 'Dùng, sửa và chia sẻ, kể cả thương mại. Không yêu cầu ghi công.',
    },
    {
        value: 'CC-BY-4.0',
        label: 'CC BY 4.0',
        description: 'Được chỉnh sửa và dùng thương mại khi ghi công.',
    },
    {
        value: 'CC-BY-SA-4.0',
        label: 'CC BY-SA 4.0',
        description: 'Ghi công, được dùng thương mại. Chia sẻ bản sửa cùng giấy phép.',
    },
    {
        value: 'CC-BY-NC-4.0',
        label: 'CC BY-NC 4.0',
        description: 'Ghi công. Được chỉnh sửa và chia sẻ cho mục đích phi thương mại.',
    },
    {
        value: 'CC-BY-NC-SA-4.0',
        label: 'CC BY-NC-SA 4.0',
        description: 'Ghi công, chỉ dùng phi thương mại. Chia sẻ bản sửa cùng giấy phép.',
    },
    {
        value: 'CC-BY-ND-4.0',
        label: 'CC BY-ND 4.0',
        description: 'Ghi công. Được chia sẻ bản chưa chỉnh sửa, kể cả thương mại.',
    },
    {
        value: 'CC-BY-NC-ND-4.0',
        label: 'CC BY-NC-ND 4.0',
        description: 'Ghi công. Chỉ chia sẻ bản chưa chỉnh sửa cho mục đích phi thương mại.',
    },
    { value: other, label: 'Giấy phép khác', description: 'Nhập tên giấy phép ghi tại nguồn.' },
];

export function LibraryLicenseField({
    id,
    value,
    onValueChange,
    disabled,
    error,
}: {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    error?: string;
}) {
    const [custom, setCustom] = useState(false);
    const standard = licenseOptions.some((option) => option.value === value && value !== other);
    const showCustom = custom || !standard;
    const errorId = error ? `${id}-error` : undefined;

    return (
        <Field>
            <FieldLabel htmlFor={id}>
                Giấy phép sử dụng <span className="text-destructive">*</span>
            </FieldLabel>
            <FormSelect
                id={id}
                options={licenseOptions}
                value={showCustom ? other : value}
                onValueChange={(next) => {
                    setCustom(next === other);
                    onValueChange(next === other ? '' : next);
                }}
                disabled={disabled}
                aria-invalid={Boolean(error && !showCustom)}
                aria-describedby={showCustom ? undefined : errorId}
            />
            {showCustom && (
                <Input
                    aria-label="Tên giấy phép khác"
                    value={value}
                    onChange={(event) => {
                        setCustom(true);
                        onValueChange(event.currentTarget.value);
                    }}
                    placeholder="Nhập tên giấy phép"
                    maxLength={50}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    aria-describedby={errorId}
                />
            )}
            {error && <FieldError id={errorId}>{error}</FieldError>}
        </Field>
    );
}
