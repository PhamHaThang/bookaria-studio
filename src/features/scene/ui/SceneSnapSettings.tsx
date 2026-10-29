import { Magnet } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import {
    defaultSnapStepsForPage,
    parseSnapStep,
    SNAP_FIELDS,
    type SnapSteps,
    snapDisplayFactor,
} from '../model/snap';
import { useSceneWidthMm } from './SceneUnits';

const strings = (value: SnapSteps, widthMm: number) => ({
    translation: String(
        Number((value.translation * snapDisplayFactor('translation', widthMm)).toPrecision(12)),
    ),
    rotation: String(value.rotation),
    scale: String(Number((value.scale * snapDisplayFactor('scale', widthMm)).toPrecision(12))),
});

export function SceneSnapSettings({
    steps,
    enabled,
    disabled,
    onChange,
    onEnabledChange,
}: {
    steps: SnapSteps;
    enabled: boolean;
    disabled: boolean;
    onChange: (steps: SnapSteps) => void;
    onEnabledChange: (enabled: boolean) => void;
}) {
    const widthMm = useSceneWidthMm();
    const id = useId();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(strings(steps, widthMm));
    const [submitted, setSubmitted] = useState(false);
    return (
        <Popover
            open={open}
            onOpenChange={(value) => {
                if (value) {
                    setDraft(strings(steps, widthMm));
                    setSubmitted(false);
                }
                setOpen(value);
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    variant={enabled ? 'default' : 'ghost'}
                    size="sm"
                    disabled={disabled}
                    aria-label="Cài đặt snap"
                    title={enabled ? 'Cài đặt snap · Đang bật' : 'Cài đặt snap · Đang tắt'}
                >
                    <Magnet data-icon="inline-start" />
                    <span>{enabled ? 'Snap: bật' : 'Snap: tắt'}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={10}
                collisionPadding={16}
                className="max-h-[calc(100dvh-32px)] w-80 gap-4 overflow-y-auto p-4"
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-description`}
            >
                <PopoverHeader>
                    <PopoverTitle id={`${id}-title`}>Cài đặt snap</PopoverTitle>
                    <PopoverDescription id={`${id}-description`}>
                        Bật/tắt bằng N hoặc nút nam châm cạnh đối tượng. Giữ Shift để bắt bước tạm
                        thời.
                    </PopoverDescription>
                </PopoverHeader>
                <Button
                    variant={enabled ? 'default' : 'outline'}
                    size="sm"
                    aria-label="Bật snap"
                    aria-pressed={enabled}
                    title={enabled ? 'Tắt snap' : 'Bật snap'}
                    disabled={disabled}
                    onClick={() => onEnabledChange(!enabled)}
                >
                    <Magnet data-icon="inline-start" />
                    {enabled ? 'Snap đang bật' : 'Bật snap'}
                </Button>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (disabled) return;
                        setSubmitted(true);
                        const next = {} as SnapSteps;
                        for (const field of SNAP_FIELDS) {
                            const value = parseSnapStep(
                                field.key,
                                draft[field.key],
                                snapDisplayFactor(field.key, widthMm),
                            );
                            if (value === null) {
                                document.getElementById(`${id}-${field.key}`)?.focus();
                                return;
                            }
                            next[field.key] = value;
                        }
                        onChange(next);
                        setOpen(false);
                    }}
                >
                    <FieldGroup className="gap-4">
                        {SNAP_FIELDS.map((field) => {
                            const invalid =
                                submitted &&
                                parseSnapStep(
                                    field.key,
                                    draft[field.key],
                                    snapDisplayFactor(field.key, widthMm),
                                ) === null;
                            return (
                                <Field key={field.key} data-invalid={invalid}>
                                    <FieldLabel className="mb-0" htmlFor={`${id}-${field.key}`}>
                                        {field.label}
                                    </FieldLabel>
                                    <Input
                                        className="mt-0"
                                        id={`${id}-${field.key}`}
                                        inputMode="decimal"
                                        value={draft[field.key]}
                                        disabled={disabled}
                                        aria-invalid={invalid}
                                        aria-describedby={
                                            invalid ? `${id}-${field.key}-error` : undefined
                                        }
                                        onChange={(event) =>
                                            setDraft({
                                                ...draft,
                                                [field.key]: event.currentTarget.value,
                                            })
                                        }
                                    />
                                    {invalid && (
                                        <FieldError id={`${id}-${field.key}-error`}>
                                            Nhập số từ{' '}
                                            {(
                                                field.min * snapDisplayFactor(field.key, widthMm)
                                            ).toLocaleString('vi-VN', {
                                                maximumFractionDigits: 5,
                                            })}{' '}
                                            đến{' '}
                                            {(
                                                field.max * snapDisplayFactor(field.key, widthMm)
                                            ).toLocaleString('vi-VN')}
                                            .
                                        </FieldError>
                                    )}
                                </Field>
                            );
                        })}
                        <p className="m-0 text-muted-foreground text-xs">
                            Bước di chuyển tính bằng mm. Tỉ lệ 0,05 tương đương 5%. Snap chỉ áp dụng
                            khi bạn kéo đối tượng.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => {
                                    setDraft(strings(defaultSnapStepsForPage(widthMm), widthMm));
                                    setSubmitted(false);
                                }}
                            >
                                Mặc định
                            </Button>
                            <Button size="sm" type="submit" disabled={disabled}>
                                Áp dụng
                            </Button>
                        </div>
                    </FieldGroup>
                </form>
            </PopoverContent>
        </Popover>
    );
}
