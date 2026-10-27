import { useEffect, useRef, useState } from 'react';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';

export function NumericField({
    id,
    label,
    value,
    onChange,
    disabled = false,
}: {
    disabled?: boolean;
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    const [text, setText] = useState(Number.isFinite(value) ? String(value) : '');
    const emitted = useRef(value);
    useEffect(() => {
        if (!Object.is(value, emitted.current)) {
            setText(Number.isFinite(value) ? String(value) : '');
            emitted.current = value;
        }
    }, [value]);
    return (
        <Field
            orientation="contents"
            data-invalid={!Number.isFinite(value)}
            data-disabled={disabled}
        >
            <FieldLabel htmlFor={id}>
                {label}
                <Input
                    id={id}
                    type="text"
                    inputMode="decimal"
                    disabled={disabled}
                    value={text}
                    aria-invalid={!Number.isFinite(value)}
                    onChange={(event) => {
                        const raw = event.currentTarget.value;
                        const parsed = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())
                            ? Number(raw)
                            : Number.NaN;
                        emitted.current = parsed;
                        setText(raw);
                        onChange(parsed);
                    }}
                />
            </FieldLabel>
        </Field>
    );
}

export function VectorFields({
    id,
    label,
    values,
    onChange,
    disabled = false,
    disabledAxes = [],
}: {
    id: string;
    label: string;
    disabled?: boolean;
    disabledAxes?: readonly number[];
    values: [number, number, number];
    onChange: (values: [number, number, number]) => void;
}) {
    return (
        <fieldset
            disabled={disabled}
            className="scene-vector m-0 min-w-0 border-0 border-[transparent] border-solid p-0 [&_legend]:mb-2 [&_legend]:font-semibold [.property-section_&]:mb-3 [.property-section_&]:rounded-[10px] [.property-section_&]:bg-muted [.property-section_&]:p-[10px] [.property-section_&_legend]:mx-0 [.property-section_&_legend]:mt-0 [.property-section_&_legend]:mb-2 [.property-section_&_legend]:w-full [.property-section_&_legend]:text-[length:10px] [.property-section_&_legend]:text-muted-foreground [.property-section_&_legend]:[float:left] [.property-section_&_legend]:[text-transform:uppercase]"
        >
            <legend>{label}</legend>
            <div className="scene-vector-inputs grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-2 [&_input]:px-2 [&_input]:text-foreground [&_input]:tabular-nums [&_label:nth-child(1)]:text-[#ba2548] [&_label:nth-child(2)]:text-[#167142] [&_label:nth-child(3)]:text-[#215dd0] [&_label]:text-[length:var(--text-xs)] [.property-section_&]:gap-[7px] [.property-section_&]:[clear:both]">
                {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <NumericField
                        key={axis}
                        id={`${id}-${axis}`}
                        label={`${label} ${axis}`}
                        value={values[index]}
                        disabled={disabledAxes.includes(index)}
                        onChange={(value) => {
                            const next: [number, number, number] = [...values];
                            next[index] = value;
                            onChange(next);
                        }}
                    />
                ))}
            </div>
        </fieldset>
    );
}
