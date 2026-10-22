import { useEffect, useRef, useState } from 'react';

export function NumericField({
    id,
    label,
    value,
    onChange,
}: {
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
        <label htmlFor={id}>
            {label}
            <input
                id={id}
                type="text"
                inputMode="decimal"
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
        </label>
    );
}

export function VectorFields({
    id,
    label,
    values,
    onChange,
}: {
    id: string;
    label: string;
    values: [number, number, number];
    onChange: (values: [number, number, number]) => void;
}) {
    return (
        <fieldset className="scene-vector">
            <legend>{label}</legend>
            <div className="scene-vector-inputs">
                {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                    <NumericField
                        key={axis}
                        id={`${id}-${axis}`}
                        label={`${label} ${axis}`}
                        value={values[index]}
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
