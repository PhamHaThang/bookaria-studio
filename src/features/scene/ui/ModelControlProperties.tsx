import type { SceneObject } from '@/shared/contracts/scene.schema';
import { ModelControlSchema } from '@/shared/contracts/scene.schema';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Switch } from '@/shared/ui/primitives/switch';
import { NumericField } from './NumericField';
import { useSceneWidthMm } from './SceneUnits';

type Model = Extract<SceneObject, { type: 'model' }>;
export function ModelControlProperties({
    object,
    clips = [],
    id,
    disabled,
    onChange,
}: {
    object: Model;
    clips?: string[];
    id: string;
    disabled: boolean;
    onChange: (controls: NonNullable<Model['controls']>) => void;
}) {
    const widthMm = useSceneWidthMm();
    const controls = { ...ModelControlSchema.parse({}), ...object.controls };
    return (
        <FieldGroup className="gap-4">
            <Field orientation="horizontal">
                <FieldLabel htmlFor={`${id}-control-enabled`}>Bật khi mở trang</FieldLabel>
                <Switch
                    id={`${id}-control-enabled`}
                    checked={controls.enabled}
                    disabled={disabled}
                    onCheckedChange={(enabled) => onChange({ ...controls, enabled })}
                />
            </Field>
            <Field>
                <NumericField
                    id={`${id}-control-speed`}
                    label="Tốc độ"
                    value={controls.speed}
                    disabled={disabled}
                    displayFactor={widthMm}
                    unit="mm/giây"
                    onChange={(speed) => {
                        if (Number.isFinite(speed))
                            onChange({ ...controls, speed: Math.max(0.01, Math.min(5, speed)) });
                    }}
                />
                <FieldDescription>Di chuyển trên mặt trang, giữ nguyên độ cao.</FieldDescription>
            </Field>
            <Field>
                <FieldLabel htmlFor={`${id}-control-bounds`}>Vùng di chuyển</FieldLabel>
                <FormSelect
                    id={`${id}-control-bounds`}
                    value={controls.bounds}
                    disabled={disabled}
                    options={[
                        { value: 'page', label: 'Giữ tâm mô hình trong trang' },
                        { value: 'free', label: 'Không giới hạn' },
                    ]}
                    onValueChange={(bounds) =>
                        onChange({ ...controls, bounds: bounds as 'page' | 'free' })
                    }
                />
            </Field>
            {(
                [
                    ['idleClip', 'Hoạt ảnh khi đứng yên'],
                    ['moveClip', 'Hoạt ảnh khi di chuyển'],
                ] as const
            ).map(([key, label]) => (
                <Field key={key}>
                    <FieldLabel htmlFor={`${id}-control-${key}`}>{label}</FieldLabel>
                    <FormSelect
                        id={`${id}-control-${key}`}
                        value={controls[key] || ''}
                        disabled={disabled || !clips.length}
                        options={[
                            { value: '', label: 'Không chọn' },
                            ...clips.map((clip) => ({ value: clip, label: clip })),
                            ...(controls[key] && !clips.includes(controls[key])
                                ? [
                                      {
                                          value: controls[key],
                                          label: `${controls[key]} (không tìm thấy)`,
                                          disabled: true,
                                      },
                                  ]
                                : []),
                        ]}
                        onValueChange={(value) =>
                            onChange({ ...controls, [key]: value || undefined })
                        }
                    />
                </Field>
            ))}

            <Field orientation="horizontal">
                <FieldLabel htmlFor={`${id}-control-rotate`}>Xoay theo hướng di chuyển</FieldLabel>
                <Switch
                    id={`${id}-control-rotate`}
                    checked={controls.autoRotate}
                    disabled={disabled || object.billboard}
                    onCheckedChange={(autoRotate) => onChange({ ...controls, autoRotate })}
                />
            </Field>
            {controls.autoRotate && !object.billboard && (
                <Field>
                    <FieldLabel htmlFor={`${id}-control-forward`}>
                        Hướng phía trước (Cục bộ)
                    </FieldLabel>
                    <FormSelect
                        id={`${id}-control-forward`}
                        value={controls.forwardAxis}
                        disabled={disabled}
                        options={[
                            { value: '+z', label: '+Z (thường dùng)' },
                            { value: '-z', label: '−Z' },
                            { value: '+x', label: '+X' },
                            { value: '-x', label: '−X' },
                            { value: '+y', label: '+Y' },
                            { value: '-y', label: '−Y' },
                        ]}
                        onValueChange={(value) =>
                            onChange({
                                ...controls,
                                forwardAxis: value as typeof controls.forwardAxis,
                            })
                        }
                    />
                </Field>
            )}
            <p className="m-0 text-muted-foreground text-xs leading-5">
                Dùng WASD hoặc phím mũi tên trên máy tính, joystick trên điện thoại. Bạn cũng có thể
                bật/tắt điều khiển bằng luồng Tương tác.
                {object.billboard && ' Mô hình hướng về camera sẽ không xoay theo hướng đi.'}
            </p>
        </FieldGroup>
    );
}
