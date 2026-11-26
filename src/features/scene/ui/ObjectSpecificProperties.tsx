import type { SceneObject } from '@/shared/contracts/scene.schema';
import { SCENE_LIMITS } from '@/shared/contracts/scene.schema';
import { AUDIO_KIND_OPTIONS } from '@/shared/scene/audio-kind';
import { BufferedInput, BufferedTextarea } from '@/shared/ui/BufferedTextInput';
import { Button } from '@/shared/ui/Button';
import { ColorInput } from '@/shared/ui/ColorInput';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/primitives/field';
import { Switch } from '@/shared/ui/primitives/switch';
import type { SceneAudioStore } from '../model/scene-audio-store';
import { NumericField, VectorFields } from './NumericField';
import { SceneAudioControls } from './SceneAudioControls';
import { useSceneWidthMm } from './SceneUnits';

export function ObjectSpecificProperties({
    object,
    id,
    disabled,
    unavailable,
    patch,
    onEditText,
    audioStore,
    onColorPreview,
    onColorBegin,
    onColorEnd,
}: {
    object: Exclude<SceneObject, { type: 'model' }>;
    id: string;
    disabled: boolean;
    unavailable: boolean;
    patch: (value: Partial<SceneObject>) => void;
    onEditText: () => void;
    audioStore: SceneAudioStore;
    onColorPreview?: (color: string) => void;
    onColorBegin?: () => void;
    onColorEnd?: () => void;
}) {
    const widthMm = useSceneWidthMm();
    return (
        <div className="flex flex-col gap-4">
            {(object.type === 'text' || object.type === 'label') && (
                <>
                    <Button
                        variant="outline"
                        disabled={disabled || object.locked}
                        onClick={onEditText}
                    >
                        Chỉnh nội dung & kiểu chữ
                    </Button>
                    {(object.presentation?.kind === 'screen' ||
                        object.presentation?.kind === 'bubble') && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-title`}>Tiêu đề</FieldLabel>
                            <BufferedInput
                                id={`${id}-title`}
                                maxLength={100}
                                value={object.presentation.title}
                                onValueChange={(value) => {
                                    if (
                                        object.presentation?.kind === 'screen' ||
                                        object.presentation?.kind === 'bubble'
                                    )
                                        patch({
                                            presentation: {
                                                ...object.presentation,
                                                title: value,
                                            },
                                        });
                                }}
                            />
                        </Field>
                    )}
                    <Field>
                        <FieldLabel htmlFor={`${id}-text`}>
                            {object.presentation?.kind === 'screen'
                                ? 'Nội dung thẻ'
                                : object.presentation?.kind === 'bubble'
                                  ? 'Hội thoại (mỗi dòng một lượt)'
                                  : object.presentation?.kind === 'annotation'
                                    ? 'Nhãn'
                                    : 'Nội dung chữ'}
                        </FieldLabel>
                        <BufferedTextarea
                            id={`${id}-text`}
                            rows={3}
                            maxLength={SCENE_LIMITS.maxTextChars}
                            value={object.text}
                            onValueChange={(text) => patch({ text })}
                            className="field-sizing-content resize-none overflow-hidden"
                        />
                    </Field>
                    {object.presentation?.kind === 'annotation' && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-description`}>Mô tả</FieldLabel>
                            <BufferedTextarea
                                id={`${id}-description`}
                                rows={3}
                                maxLength={1000}
                                value={object.presentation.description}
                                className="field-sizing-content resize-none overflow-hidden"
                                onValueChange={(value) => {
                                    if (object.presentation?.kind === 'annotation')
                                        patch({
                                            presentation: {
                                                ...object.presentation,
                                                description: value,
                                            },
                                        });
                                }}
                            />
                        </Field>
                    )}
                    {object.presentation?.kind === 'extruded' && (
                        <NumericField
                            id={`${id}-depth`}
                            label="Độ nổi chữ 3D"
                            value={object.presentation.depth}
                            onChange={(depth) => {
                                if (object.presentation?.kind === 'extruded')
                                    patch({ presentation: { ...object.presentation, depth } });
                            }}
                        />
                    )}
                    <Field>
                        <FieldLabel htmlFor={`${id}-color`}>Màu chữ</FieldLabel>
                        <ColorInput
                            id={`${id}-color`}
                            label="Màu chữ"
                            value={object.style.color}
                            disabled={disabled || object.locked || unavailable}
                            onPreview={onColorPreview}
                            onInteractionStart={onColorBegin}
                            onInteractionEnd={onColorEnd}
                            onValueChange={(color) => patch({ style: { ...object.style, color } })}
                        />
                    </Field>
                    <NumericField
                        id={`${id}-text-size`}
                        label={
                            object.presentation?.kind === 'screen' ||
                            object.presentation?.kind === 'bubble'
                                ? 'Chiều rộng thẻ'
                                : object.presentation?.kind === 'annotation'
                                  ? 'Cỡ chữ nhãn'
                                  : 'Cỡ chữ'
                        }
                        unit="mm"
                        displayFactor={
                            widthMm *
                            (object.presentation?.kind === 'screen' ||
                            object.presentation?.kind === 'bubble'
                                ? 16
                                : 1)
                        }
                        value={object.style.size}
                        onChange={(size) => patch({ style: { ...object.style, size } })}
                    />
                    {(!object.presentation || object.presentation.kind === 'extruded') && (
                        <>
                            <Field orientation="contents">
                                <FieldLabel htmlFor={`${id}-font`}>
                                    Kiểu chữ
                                    <FormSelect
                                        id={`${id}-font`}
                                        disabled={object.presentation?.kind === 'extruded'}
                                        value={object.style.font}
                                        onValueChange={(value) =>
                                            patch({
                                                style: {
                                                    ...object.style,
                                                    font: value as typeof object.style.font,
                                                },
                                            })
                                        }
                                        options={[
                                            { value: 'sans', label: 'Không chân' },
                                            { value: 'serif', label: 'Có chân' },
                                            { value: 'rounded', label: 'Bo tròn' },
                                        ]}
                                    />
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                    <Checkbox
                                        checked={object.style.bold}
                                        onCheckedChange={(checked) =>
                                            patch({
                                                style: {
                                                    ...object.style,
                                                    bold: checked === true,
                                                },
                                            })
                                        }
                                    />
                                    Chữ đậm
                                </FieldLabel>
                            </Field>
                        </>
                    )}
                </>
            )}
            {object.type === 'label' &&
                !(
                    object.presentation?.kind === 'annotation' &&
                    (object.presentation.shape === 'circle' || object.presentation.anchorAtTarget)
                ) && (
                    <VectorFields
                        id={`${id}-target`}
                        label="Đầu mũi chỉ"
                        unit="mm"
                        displayFactor={widthMm}
                        values={object.target}
                        onChange={(target) => patch({ target })}
                    />
                )}
            {object.type === 'image' && (
                <NumericField
                    id={`${id}-opacity`}
                    label="Độ hiện ảnh (0–1)"
                    value={object.opacity}
                    onChange={(opacity) => patch({ opacity })}
                />
            )}
            {object.type === 'audio' && (
                <>
                    <SceneAudioControls
                        id={object.id}
                        store={audioStore}
                        disabled={disabled || unavailable}
                    />
                    <Field>
                        <FieldLabel htmlFor={`${id}-audio-kind`}>Loại âm thanh</FieldLabel>
                        <FormSelect
                            id={`${id}-audio-kind`}
                            value={object.audioKind || 'BGM'}
                            options={AUDIO_KIND_OPTIONS}
                            onValueChange={(value) =>
                                patch({
                                    audioKind: value as 'BGM' | 'SFX' | 'VOICE',
                                })
                            }
                        />
                    </Field>
                </>
            )}
            {(object.type === 'audio' || object.type === 'video') && (
                <>
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={object.autoplay}
                                onCheckedChange={(checked) => patch({ autoplay: checked === true })}
                            />
                            Tự phát khi đọc trang
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={object.loop}
                                onCheckedChange={(checked) => patch({ loop: checked === true })}
                            />
                            Phát lặp
                        </FieldLabel>
                    </Field>
                    <NumericField
                        id={`${id}-volume`}
                        label="Âm lượng (0–1)"
                        value={object.volume}
                        onChange={(volume) => patch({ volume })}
                    />
                    {object.type === 'video' && (
                        <Field orientation="contents">
                            <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                <Checkbox
                                    checked={object.muted}
                                    onCheckedChange={(checked) =>
                                        patch({
                                            muted: checked === true,
                                        })
                                    }
                                />
                                Tắt tiếng video
                            </FieldLabel>
                        </Field>
                    )}
                    {object.type === 'audio' ? (
                        <Field className="gap-1.5">
                            <div className="flex items-center justify-between gap-3">
                                <FieldLabel htmlFor={`${id}-reader-player`}>
                                    Hiện nút phát cho người đọc
                                </FieldLabel>
                                <Switch
                                    id={`${id}-reader-player`}
                                    aria-describedby={`${id}-reader-player-hint`}
                                    checked={object.visible}
                                    onCheckedChange={(visible) => patch({ visible })}
                                />
                            </div>
                            <FieldDescription
                                id={`${id}-reader-player-hint`}
                                className="m-0 text-xs"
                            >
                                Khi ẩn nút phát, dùng tự phát hoặc hành động “Phát âm thanh” để
                                người đọc nghe được.
                            </FieldDescription>
                        </Field>
                    ) : (
                        <FieldDescription className="m-0 text-xs">
                            Trình duyệt có thể yêu cầu người đọc chạm trước khi phát video có tiếng.
                        </FieldDescription>
                    )}
                </>
            )}
            {object.type === 'hotspot' && (
                <>
                    <NumericField
                        id={`${id}-width`}
                        label="Rộng vùng chạm"
                        unit="mm"
                        displayFactor={widthMm}
                        value={object.size[0]}
                        onChange={(value) => patch({ size: [value, object.size[1]] })}
                    />
                    <NumericField
                        id={`${id}-height`}
                        label="Cao vùng chạm"
                        unit="mm"
                        displayFactor={widthMm}
                        value={object.size[1]}
                        onChange={(value) => patch({ size: [object.size[0], value] })}
                    />
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={object.showHint}
                                onCheckedChange={(checked) => patch({ showHint: checked === true })}
                            />
                            Hiện gợi ý vùng chạm
                        </FieldLabel>
                    </Field>
                </>
            )}
        </div>
    );
}
