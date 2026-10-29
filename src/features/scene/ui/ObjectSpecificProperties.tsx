import type { SceneObject } from '@/shared/contracts/scene.schema';
import { SCENE_LIMITS } from '@/shared/contracts/scene.schema';
import { AUDIO_KIND_OPTIONS } from '@/shared/scene/audio-kind';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Textarea } from '@/shared/ui/primitives/textarea';
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
}: {
    object: Exclude<SceneObject, { type: 'model' }>;
    id: string;
    disabled: boolean;
    unavailable: boolean;
    patch: (value: Partial<SceneObject>) => void;
    onEditText: () => void;
    audioStore: SceneAudioStore;
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
                        <Field orientation="contents">
                            <FieldLabel htmlFor={`${id}-title`}>Tiêu đề</FieldLabel>
                            <Input
                                id={`${id}-title`}
                                maxLength={100}
                                value={object.presentation.title}
                                onChange={(event) => {
                                    if (
                                        object.presentation?.kind === 'screen' ||
                                        object.presentation?.kind === 'bubble'
                                    )
                                        patch({
                                            presentation: {
                                                ...object.presentation,
                                                title: event.currentTarget.value,
                                            },
                                        });
                                }}
                            />
                        </Field>
                    )}
                    <Field orientation="contents">
                        <FieldLabel htmlFor={`${id}-text`}>
                            {object.presentation?.kind === 'screen'
                                ? 'Nội dung thẻ'
                                : object.presentation?.kind === 'bubble'
                                  ? 'Hội thoại (mỗi dòng một lượt)'
                                  : object.presentation?.kind === 'annotation'
                                    ? 'Nhãn'
                                    : 'Nội dung chữ'}
                        </FieldLabel>
                        <Textarea
                            id={`${id}-text`}
                            rows={3}
                            maxLength={SCENE_LIMITS.maxTextChars}
                            value={object.text}
                            onChange={(event) => patch({ text: event.currentTarget.value })}
                            className="field-sizing-content resize-none overflow-hidden"
                        />
                    </Field>
                    {object.presentation?.kind === 'annotation' && (
                        <Field orientation="contents">
                            <FieldLabel htmlFor={`${id}-description`}>Mô tả</FieldLabel>
                            <Textarea
                                id={`${id}-description`}
                                rows={3}
                                maxLength={1000}
                                value={object.presentation.description}
                                className="field-sizing-content resize-none overflow-hidden"
                                onChange={(event) => {
                                    if (object.presentation?.kind === 'annotation')
                                        patch({
                                            presentation: {
                                                ...object.presentation,
                                                description: event.currentTarget.value,
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
                    <Field orientation="contents">
                        <FieldLabel htmlFor={`${id}-color`}>Màu chữ</FieldLabel>
                        <Input
                            id={`${id}-color`}
                            type="color"
                            className="h-10 cursor-pointer p-1"
                            value={object.style.color}
                            onChange={(event) =>
                                patch({
                                    style: {
                                        ...object.style,
                                        color: event.currentTarget.value,
                                    },
                                })
                            }
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
                    <SceneAudioControls
                        id={object.id}
                        store={audioStore}
                        disabled={disabled || unavailable}
                    />
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
                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                        Trình duyệt có thể yêu cầu người đọc chạm trước khi phát âm thanh hoặc
                        video.
                    </p>
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
