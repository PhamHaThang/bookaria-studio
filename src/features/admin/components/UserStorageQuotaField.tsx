import { LIMITS } from '@/shared/contracts/common.schema';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldError, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';

const unitBytes = { MiB: 1024 ** 2, GiB: 1024 ** 3 };
type QuotaUnit = keyof typeof unitBytes;

const presets = [
    { value: LIMITS.defaultQuotaBytes, label: '500 MiB (mặc định)' },
    { value: unitBytes.GiB, label: '1 GiB' },
    { value: 2 * unitBytes.GiB, label: '2 GiB' },
    { value: 5 * unitBytes.GiB, label: '5 GiB' },
];
const quotaOptions = [...presets, { value: 'custom', label: 'Tùy chỉnh' }];
const unitOptions = [
    { value: 'MiB', label: 'MiB' },
    { value: 'GiB', label: 'GiB' },
];
const decimal = new Intl.NumberFormat('vi-VN', {
    useGrouping: false,
    maximumSignificantDigits: 17,
});

type QuotaValue = number | { amount: string; unit: QuotaUnit };

function customQuota(bytes: number, unit: QuotaUnit = bytes >= unitBytes.GiB ? 'GiB' : 'MiB') {
    return { amount: decimal.format(bytes / unitBytes[unit]), unit };
}

export function initialUserStorageQuota(bytes: number = LIMITS.defaultQuotaBytes): QuotaValue {
    return presets.some((preset) => preset.value === bytes) ? bytes : customQuota(bytes);
}

export function userStorageQuotaBytes(value: QuotaValue) {
    if (typeof value === 'number') return value;
    const amount = value.amount.trim();
    if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(amount)) return null;
    const bytes = Math.round(Number(amount.replace(',', '.')) * unitBytes[value.unit]);
    return Number.isSafeInteger(bytes) && bytes > 0 ? bytes : null;
}

export function UserStorageQuotaField({
    id,
    value,
    onChange,
    disabled,
    error,
}: {
    id: string;
    value: QuotaValue;
    onChange: (value: QuotaValue) => void;
    disabled: boolean;
    error?: string;
}) {
    const custom = typeof value !== 'number';
    const errorId = error ? `${id}-error` : undefined;

    return (
        <Field className="sm:col-span-2">
            <FieldLabel htmlFor={id}>Hạn mức lưu trữ</FieldLabel>
            <FormSelect
                id={id}
                value={custom ? 'custom' : value}
                options={quotaOptions}
                disabled={disabled}
                onValueChange={(next) => {
                    onChange(
                        next === 'custom'
                            ? customQuota(userStorageQuotaBytes(value) ?? LIMITS.defaultQuotaBytes)
                            : Number(next),
                    );
                }}
            />
            {custom && (
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2">
                    <Input
                        className="mt-0"
                        aria-label="Dung lượng tùy chỉnh"
                        aria-invalid={Boolean(error)}
                        aria-describedby={errorId}
                        inputMode="decimal"
                        placeholder="Ví dụ: 1,5"
                        value={value.amount}
                        disabled={disabled}
                        onChange={(event) => onChange({ ...value, amount: event.target.value })}
                    />
                    <FormSelect
                        className="mt-0"
                        aria-label="Đơn vị dung lượng"
                        value={value.unit}
                        options={unitOptions}
                        disabled={disabled}
                        onValueChange={(next) => {
                            const unit = next === 'GiB' ? 'GiB' : 'MiB';
                            const bytes = userStorageQuotaBytes(value);
                            onChange(
                                bytes === null ? { ...value, unit } : customQuota(bytes, unit),
                            );
                        }}
                    />
                </div>
            )}
            {error && <FieldError id={errorId}>{error}</FieldError>}
        </Field>
    );
}
