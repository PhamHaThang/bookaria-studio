import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/ui/primitives/input-group';

type Axis = 'X' | 'Y' | 'Z';
const axisColor = { X: 'text-[#ba2548]', Y: 'text-[#167142]', Z: 'text-[#215dd0]' };

function compactNumber(value: number) {
    if (!Number.isFinite(value)) return '';
    if (value !== 0 && Math.abs(value) < 0.001) return Number(value.toPrecision(3)).toExponential();
    return String(Number(value.toFixed(3)));
}

export function NumericField({
    id,
    label,
    value,
    onChange,
    disabled = false,
    axis,
    positive = false,
    displayFactor = 1,
    unit,
}: {
    disabled?: boolean;
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    axis?: Axis;
    positive?: boolean;
    displayFactor?: number;
    unit?: string;
}) {
    const displayValue = value * displayFactor;
    const [text, setText] = useState(
        Number.isFinite(displayValue)
            ? axis || unit
                ? compactNumber(displayValue)
                : String(displayValue)
            : '',
    );
    const emitted = useRef(value);
    const previousFactor = useRef(displayFactor);
    useEffect(() => {
        if (!Object.is(value, emitted.current) || previousFactor.current !== displayFactor) {
            setText(
                Number.isFinite(displayValue)
                    ? axis || unit
                        ? compactNumber(displayValue)
                        : String(displayValue)
                    : '',
            );
            emitted.current = value;
            previousFactor.current = displayFactor;
        }
    }, [value, axis, displayFactor, displayValue, unit]);
    const inputError = !Number.isFinite(value)
        ? 'Vui lòng nhập một số hợp lệ.'
        : positive && value <= 0
          ? 'Tỉ lệ phải lớn hơn 0.'
          : undefined;
    const Control = axis ? InputGroupInput : Input;
    const control = (
        <Control
            id={id}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={text}
            title={
                inputError ||
                (Number.isFinite(displayValue) && (axis || unit)
                    ? `${displayValue}${unit ? ` ${unit}` : ''}`
                    : undefined)
            }
            className={
                axis ? 'h-full px-2 py-0 text-right text-sm tabular-nums leading-none' : undefined
            }
            aria-invalid={Boolean(inputError)}
            aria-describedby={inputError ? `${id}-error` : undefined}
            onBlur={() => {
                if ((axis || unit) && Number.isFinite(displayValue))
                    setText(compactNumber(displayValue));
            }}
            onChange={(event) => {
                const raw = event.currentTarget.value;
                const normalized = raw.trim().replace(',', '.');
                const parsed = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)
                    ? Number(normalized)
                    : Number.NaN;
                const next = parsed / displayFactor;
                emitted.current = next;
                setText(raw);
                onChange(next);
            }}
        />
    );
    return (
        <Field
            orientation={axis ? 'vertical' : 'contents'}
            className={axis ? 'relative min-w-0 gap-0' : undefined}
            data-invalid={Boolean(inputError)}
            data-disabled={disabled}
        >
            <FieldLabel htmlFor={id} className={axis ? 'sr-only' : undefined}>
                {label}
                {unit ? ` (${unit})` : ''}
            </FieldLabel>
            <span id={`${id}-error`} hidden>
                {inputError}
            </span>
            {axis ? (
                <InputGroup className="h-10 min-h-10" data-disabled={disabled}>
                    <InputGroupAddon
                        aria-hidden="true"
                        className={cn(
                            'h-full w-6 shrink-0 pt-1 text-sm leading-none',
                            axisColor[axis],
                        )}
                    >
                        {axis}
                    </InputGroupAddon>
                    {control}
                </InputGroup>
            ) : (
                control
            )}
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
    resetValues,
    positive = false,
    displayFactor = 1,
    unit,
}: {
    id: string;
    label: string;
    disabled?: boolean;
    disabledAxes?: readonly number[];
    values: [number, number, number];
    onChange: (values: [number, number, number]) => void;
    resetValues?: [number, number, number];
    positive?: boolean;
    displayFactor?: number;
    unit?: string;
}) {
    const resettable = resetValues?.some(
        (value, index) => !disabledAxes.includes(index) && !Object.is(value, values[index]),
    );
    return (
        <FieldSet disabled={disabled} className="scene-vector m-0 min-w-0 gap-2 border-0 p-0">
            <FieldLegend
                variant="label"
                className="mb-2 flex w-full items-center justify-between font-medium text-muted-foreground tracking-wide data-[variant=label]:text-[12px]"
            >
                <span>
                    {label}
                    {unit ? ` (${unit})` : ''}
                </span>
                {resetValues && (
                    <Button
                        variant="plain"
                        aria-label={`Đặt lại ${label.toLowerCase()}`}
                        title={`Đặt lại ${label.toLowerCase()}`}
                        disabled={disabled || !resettable}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 [&_svg]:size-3.5"
                        onClick={() => {
                            const next: [number, number, number] = [...values];
                            for (let index = 0; index < 3; index++) {
                                if (!disabledAxes.includes(index)) next[index] = resetValues[index];
                            }
                            onChange(next);
                        }}
                    >
                        <RotateCcw aria-hidden="true" />
                    </Button>
                )}
            </FieldLegend>
            <div className="scene-vector-inputs grid min-w-0 grid-cols-3 gap-2">
                {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <NumericField
                        key={axis}
                        id={`${id}-${axis}`}
                        label={`${label} ${axis}`}
                        axis={axis}
                        positive={positive}
                        displayFactor={displayFactor}
                        unit={unit}
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
        </FieldSet>
    );
}
