import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { TextPresentation } from '@/shared/contracts/scene.schema';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Switch } from '@/shared/ui/primitives/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';

type ScreenStyle = NonNullable<Extract<TextPresentation, { kind: 'screen' }>['titleStyle']>;

export function ScreenTextStyle({
    label,
    controlId,
    value,
    fallback,
    onChange,
    children,
}: {
    label: string;
    controlId: string;
    value?: ScreenStyle;
    fallback: ScreenStyle;
    onChange: (style: ScreenStyle | undefined) => void;
    children: ReactNode;
}) {
    const id = useId();
    const current = value ?? fallback;
    const saved = useRef(value ?? fallback);
    const [sizeInput, setSizeInput] = useState(String(current.size));
    useEffect(() => setSizeInput(String(current.size)), [current.size]);
    return (
        <Field data-text-style={label}>
            <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
                <div className="flex shrink-0 items-center gap-2">
                    <Switch
                        id={`${id}-enabled`}
                        aria-label={`Kiểu chữ ${label.toLowerCase()}`}
                        checked={Boolean(value)}
                        aria-controls={value ? `${id}-fields` : undefined}
                        onCheckedChange={(enabled) => {
                            if (enabled) onChange(saved.current);
                            else {
                                saved.current = current;
                                onChange(undefined);
                            }
                        }}
                    />
                </div>
            </div>
            {children}
            {value && (
                <FieldGroup id={`${id}-fields`} className="grid grid-cols-2 gap-3">
                    <Field>
                        <FieldLabel htmlFor={`${id}-size`}>Cỡ chữ</FieldLabel>
                        <Input
                            id={`${id}-size`}
                            type="number"
                            min={10}
                            max={40}
                            step={1}
                            value={sizeInput}
                            onBlur={() => setSizeInput(String(current.size))}
                            onChange={(event) => {
                                setSizeInput(event.target.value);
                                const size = event.target.valueAsNumber;
                                if (Number.isInteger(size) && size >= 10 && size <= 40)
                                    onChange({ ...current, size });
                            }}
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${id}-weight`}>Độ đậm</FieldLabel>
                        <FormSelect
                            id={`${id}-weight`}
                            className="mt-0"
                            value={current.weight}
                            options={[
                                { value: 400, label: 'Thường' },
                                { value: 500, label: 'Vừa' },
                                { value: 600, label: 'Đậm vừa' },
                                { value: 700, label: 'Đậm' },
                            ]}
                            onValueChange={(weight) =>
                                onChange({
                                    ...current,
                                    weight: Number(weight) as ScreenStyle['weight'],
                                })
                            }
                        />
                    </Field>
                    <Field className="col-span-2">
                        <FieldLabel id={`${id}-align-label`}>Căn chữ</FieldLabel>
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            className="grid w-full grid-cols-3"
                            aria-labelledby={`${id}-align-label`}
                            value={current.align ?? 'center'}
                            onValueChange={(align) => {
                                if (align === 'left' || align === 'center' || align === 'right')
                                    onChange({ ...current, align });
                            }}
                        >
                            {[
                                { value: 'left', label: 'Căn trái', icon: AlignLeft },
                                { value: 'center', label: 'Căn giữa', icon: AlignCenter },
                                { value: 'right', label: 'Căn phải', icon: AlignRight },
                            ].map((item) => (
                                <ToggleGroupItem
                                    key={item.value}
                                    value={item.value}
                                    aria-label={item.label}
                                    title={item.label}
                                >
                                    <item.icon />
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    </Field>
                </FieldGroup>
            )}
        </Field>
    );
}
