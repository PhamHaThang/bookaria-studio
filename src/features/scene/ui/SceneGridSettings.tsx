import { Grid2X2, RotateCcw } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/shared/ui/primitives/field';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import { Slider } from '@/shared/ui/primitives/slider';
import { Switch } from '@/shared/ui/primitives/switch';
import { DEFAULT_EDITOR_GRID, type EditorGridSettings } from '../model/editor-grid';

export function SceneGridSettings({
    value,
    disabled,
    onChange,
}: {
    value: EditorGridSettings;
    disabled: boolean;
    onChange: (value: EditorGridSettings) => void;
}) {
    const id = useId();
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label="Cài đặt lưới"
                    title={value.visible ? 'Cài đặt lưới · Đang bật' : 'Cài đặt lưới · Đang tắt'}
                >
                    <Grid2X2 data-icon="inline-start" />
                    <span>{value.visible ? 'Lưới: bật' : 'Lưới: tắt'}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                sideOffset={10}
                collisionPadding={16}
                className="max-h-[calc(100dvh-32px)] w-72 gap-4 overflow-y-auto p-4"
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-description`}
            >
                <PopoverHeader className="gap-2">
                    <PopoverTitle id={`${id}-title`} className="m-0">
                        Lưới trong editor
                    </PopoverTitle>
                    <PopoverDescription id={`${id}-description`} className="m-0">
                        Dùng để căn chỉnh trong editor. Lưới không xuất hiện trong sách.
                    </PopoverDescription>
                </PopoverHeader>
                <FieldGroup className="gap-4">
                    <Field orientation="horizontal" className="items-center justify-between gap-3">
                        <FieldLabel htmlFor={`${id}-visible`} className="m-0">
                            Hiện lưới
                        </FieldLabel>
                        <Switch
                            id={`${id}-visible`}
                            checked={value.visible}
                            disabled={disabled}
                            onCheckedChange={(visible) => onChange({ ...value, visible })}
                        />
                    </Field>
                    <FieldSet disabled={disabled || !value.visible} className="gap-3">
                        <Field className="gap-2">
                            <FieldLabel htmlFor={`${id}-spacing`} className="m-0">
                                Khoảng cách ô (mm)
                            </FieldLabel>
                            <FormSelect
                                id={`${id}-spacing`}
                                className="mt-0"
                                value={String(value.spacingMm)}
                                disabled={disabled || !value.visible}
                                options={[1, 2, 5, 10, 20, 50, 100].map((step) => ({
                                    value: String(step),
                                    label: `${step} mm`,
                                }))}
                                onValueChange={(spacing) =>
                                    onChange({ ...value, spacingMm: Number(spacing) })
                                }
                            />
                        </Field>
                        <Field className="gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <FieldLabel
                                    id={`${id}-opacity-label`}
                                    className="m-0"
                                    htmlFor={`${id}-opacity`}
                                >
                                    Độ rõ đường lưới
                                </FieldLabel>
                                <output
                                    className="text-muted-foreground text-xs tabular-nums"
                                    aria-hidden="true"
                                >
                                    {Math.round(value.opacity * 100)}%
                                </output>
                            </div>
                            <Slider
                                id={`${id}-opacity`}
                                min={10}
                                max={100}
                                step={5}
                                value={[Math.round(value.opacity * 100)]}
                                disabled={disabled || !value.visible}
                                aria-labelledby={`${id}-opacity-label`}
                                aria-valuetext={`${Math.round(value.opacity * 100)}%`}
                                onValueChange={([opacity]) =>
                                    onChange({ ...value, opacity: opacity / 100 })
                                }
                                className="my-0"
                            />
                        </Field>
                    </FieldSet>
                    <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                        Lưới và snap được điều chỉnh riêng. Thay đổi lưới không di chuyển đối tượng.
                    </p>
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => onChange({ ...DEFAULT_EDITOR_GRID })}
                        >
                            <RotateCcw data-icon="inline-start" />
                            Mặc định
                        </Button>
                    </div>
                </FieldGroup>
            </PopoverContent>
        </Popover>
    );
}
