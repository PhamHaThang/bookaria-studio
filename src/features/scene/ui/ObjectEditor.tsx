import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, Info, Move, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Disclosure, DisclosureGroup } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { errorMessage } from '../../../shared/api/errors';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { SceneObject } from '../../../shared/contracts/scene.schema';
import { SCENE_LIMITS } from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';
import { objectLabels } from '../model/objects';
import { withObjectPosition, withPaperSnap } from '../model/transforms';
import { NumericField, VectorFields } from './NumericField';

export function ObjectEditor({
    object,
    assetRef,
    disabled,
    onChange,
    onChooseAsset,
    onDuplicate,
    onDelete,
}: {
    object: SceneObject;
    assetRef?: AssetRef;
    disabled: boolean;
    onChange: (object: SceneObject) => void;
    onChooseAsset: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const { user } = useAuth();
    const assetId = 'assetId' in object ? object.assetId : null;
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => assetsApi.detail(assetId || '', signal),
        enabled: Boolean(assetId),
        refetchOnWindowFocus: false,
    });
    const asset = detail.data || assetRef;
    const patch = (value: Partial<SceneObject>) => onChange({ ...object, ...value } as SceneObject);
    const clips = [
        ...new Set(
            (asset?.meta.animations || []).filter((clip) => clip.length > 0 && clip.length <= 100),
        ),
    ];
    if (object.type === 'model' && object.animation && !clips.includes(object.animation.clip))
        clips.push(object.animation.clip);
    const id = `object-${object.id}`;
    return (
        <section
            className="scene-inspector min-w-0 rounded-[var(--radius-md)] border border-border border-solid bg-surface p-4 max-[1200px]:col-[1_/_-1] max-[600px]:col-[auto] [&.scene-inspector>h3]:text-[length:15px] [&_>_h3]:mb-4 [.workbench-panel_&]:border-0 [.workbench-panel_&]:border-[transparent] [.workbench-panel_&]:border-solid [.workbench-panel_&]:bg-[transparent] [.workbench-panel_&]:p-0"
            aria-labelledby="object-editor-heading"
        >
            <h3 id="object-editor-heading">
                Thuộc tính {objectLabels[object.type].charAt(0).toLowerCase()}
                {objectLabels[object.type].slice(1)}
            </h3>
            <p className="inspector-object-name mx-0 mt-[-8px] mb-[18px] text-muted-foreground">
                {object.name || objectLabels[object.type]}
            </p>
            <Field orientation="contents">
                <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                    <Checkbox
                        checked={object.locked}
                        disabled={disabled}
                        onCheckedChange={(checked) => patch({ locked: checked === true })}
                    />
                    Khóa đối tượng
                </FieldLabel>
            </Field>
            {object.locked && (
                <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                    Mở khóa để chỉnh sửa, nhân bản hoặc xóa đối tượng.
                </p>
            )}
            <DisclosureGroup
                defaultValue={
                    object.type === 'text' || object.type === 'label' ? 'content' : 'transform'
                }
                disabledContent={disabled || object.locked}
            >
                <fieldset className="scene-object-fields m-0 grid min-w-0 gap-4 border-0 border-[transparent] border-solid p-0 max-[1200px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[600px]:grid-cols-[1fr] [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0 [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:min-w-0 [&_textarea]:w-full [&_textarea]:min-w-0 [.workbench-panel_&]:gap-[14px]">
                    <Disclosure
                        value="identity"
                        title={
                            <>
                                <Info size={17} />
                                Thông tin cơ bản
                            </>
                        }
                        variant="panel"
                        className="property-section"
                    >
                        <div>
                            {' '}
                            <Field orientation="contents">
                                <FieldLabel htmlFor={`${id}-name`}>
                                    Tên đối tượng
                                    <Input
                                        id={`${id}-name`}
                                        maxLength={100}
                                        value={object.name || ''}
                                        onChange={(event) =>
                                            patch({ name: event.currentTarget.value })
                                        }
                                    />
                                </FieldLabel>
                            </Field>
                            {assetId && (
                                <div className="scene-object-asset [&_p]:wrap-anywhere max-[1200px]:col-[1_/_-1] [&_.button]:shrink-1">
                                    <p>
                                        Tài nguyên: {detail.data?.name || 'Tệp đã gắn trên trang'}
                                    </p>
                                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                                        <Button variant="secondary" onClick={onChooseAsset}>
                                            Đổi tài nguyên
                                        </Button>
                                        <Link to={`/assets/${assetId}`}>Xem tài nguyên</Link>
                                    </div>
                                    {detail.isError && (
                                        <>
                                            <Feedback error={errorMessage(detail.error)} />
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    void detail.refetch();
                                                }}
                                            >
                                                Đọc lại tài nguyên
                                            </Button>
                                        </>
                                    )}
                                    {asset?.type === 'IMAGE' && (
                                        <img
                                            src={asset.url}
                                            className="scene-asset-preview my-3 block max-h-50 w-full object-contain"
                                            alt="Tài nguyên của đối tượng"
                                        />
                                    )}
                                    {asset?.type === 'AUDIO' && (
                                        <audio
                                            key={asset.url}
                                            controls
                                            preload="none"
                                            src={asset.url}
                                        >
                                            <track kind="captions" />
                                        </audio>
                                    )}
                                    {asset?.type === 'VIDEO' && (
                                        <video
                                            key={asset.url}
                                            controls
                                            playsInline
                                            preload="none"
                                            src={asset.url}
                                            className="scene-asset-preview my-3 block max-h-50 w-full object-contain"
                                        >
                                            <track kind="captions" />
                                        </video>
                                    )}
                                </div>
                            )}
                        </div>
                    </Disclosure>
                    {object.type === 'model' && (
                        <Disclosure
                            value="animation"
                            title={
                                <>
                                    <Play size={17} />
                                    Animations
                                </>
                            }
                            variant="panel"
                            className="property-section"
                        >
                            <div>
                                {' '}
                                {object.type === 'model' && (
                                    <>
                                        <Field orientation="contents">
                                            <FieldLabel htmlFor={`${id}-animation`}>
                                                Animation
                                                <FormSelect
                                                    id={`${id}-animation`}
                                                    value={object.animation?.clip || ''}
                                                    onValueChange={(value) =>
                                                        patch({
                                                            animation: value
                                                                ? {
                                                                      clip: value,
                                                                      loop: false,
                                                                      autoplay: true,
                                                                  }
                                                                : undefined,
                                                        })
                                                    }
                                                    options={[
                                                        {
                                                            value: '',
                                                            label: 'Không chạy animation',
                                                        },
                                                        ...(clips.map((clip) => ({
                                                            value: clip,
                                                            label: clip,
                                                        })) ?? []),
                                                    ]}
                                                />
                                            </FieldLabel>
                                        </Field>
                                        {!clips.length && (
                                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                                Mô hình này chưa có clip animation trong metadata.
                                            </p>
                                        )}
                                        {object.animation &&
                                            (['autoplay', 'loop'] as const).map((key) => (
                                                <Field orientation="contents" key={key}>
                                                    <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                                        <Checkbox
                                                            checked={object.animation?.[key]}
                                                            onCheckedChange={(checked) => {
                                                                if (object.animation)
                                                                    patch({
                                                                        animation: {
                                                                            ...object.animation,
                                                                            [key]: checked === true,
                                                                        },
                                                                    });
                                                            }}
                                                        />
                                                        {key === 'loop'
                                                            ? 'Lặp animation'
                                                            : 'Tự chạy animation'}
                                                    </FieldLabel>
                                                </Field>
                                            ))}
                                    </>
                                )}
                            </div>
                        </Disclosure>
                    )}
                    <Disclosure
                        value="display"
                        title={
                            <>
                                <Eye size={17} />
                                Hiển thị & hành vi
                            </>
                        }
                        variant="panel"
                        className="property-section"
                    >
                        <div>
                            {' '}
                            <div className="scene-flags grid gap-3 max-[1200px]:col-[1_/_-1]">
                                {(
                                    [
                                        ['visible', 'Hiện khi mở trang'],
                                        ['billboard', 'Luôn hướng về camera'],
                                        ['editorHidden', 'Ẩn khỏi sơ đồ chỉnh sửa'],
                                    ] as const
                                ).map(([key, label]) => (
                                    <Field orientation="contents" key={key}>
                                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                            <Checkbox
                                                checked={object[key]}
                                                onCheckedChange={(checked) =>
                                                    patch({ [key]: checked === true })
                                                }
                                            />
                                            {label}
                                        </FieldLabel>
                                    </Field>
                                ))}
                            </div>
                        </div>
                    </Disclosure>
                    <Disclosure
                        value="transform"
                        title={
                            <>
                                <Move size={17} />
                                Biến đổi
                            </>
                        }
                        variant="panel"
                        className="property-section"
                    >
                        <div>
                            {' '}
                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                Tâm trang là (0, 0, 0). Một đơn vị bằng chiều rộng trang; X sang
                                phải, Y lên trên, Z nhô khỏi giấy. Góc xoay tính bằng độ.
                            </p>
                            <Field className="mb-4 gap-2">
                                <FieldLabel className="mb-0">
                                    <span className="flex items-center gap-2 font-normal">
                                        <Checkbox
                                            checked={object.snapToPaper}
                                            onCheckedChange={(checked) =>
                                                onChange(withPaperSnap(object, checked === true))
                                            }
                                        />
                                        Bám mặt giấy (Z = 0)
                                    </span>{' '}
                                </FieldLabel>
                                <p className="m-0 text-muted-foreground text-xs">
                                    Kéo trục Z hoặc nhập độ cao để di chuyển trong 3D. Chọn Phối
                                    cảnh để dễ kéo Z.
                                </p>
                            </Field>
                            {(['position', 'rotation', 'scale'] as const).map((key) => (
                                <VectorFields
                                    key={key}
                                    id={`${id}-${key}`}
                                    label={
                                        {
                                            position: 'Vị trí',
                                            rotation: 'Góc xoay',
                                            scale: 'Tỉ lệ',
                                        }[key]
                                    }
                                    values={object.transform[key]}
                                    onChange={(values) => {
                                        if (key === 'position')
                                            onChange(withObjectPosition(object, values));
                                        else
                                            patch({
                                                transform: { ...object.transform, [key]: values },
                                            });
                                    }}
                                />
                            ))}
                        </div>
                    </Disclosure>
                    {object.type !== 'model' && (
                        <Disclosure
                            value="content"
                            title={
                                <>
                                    <SlidersHorizontal size={17} />
                                    Nội dung
                                </>
                            }
                            variant="panel"
                            className="property-section"
                        >
                            <div>
                                {' '}
                                {(object.type === 'text' || object.type === 'label') && (
                                    <>
                                        <Field orientation="contents">
                                            <FieldLabel htmlFor={`${id}-text`}>
                                                Nội dung chữ
                                                <Textarea
                                                    id={`${id}-text`}
                                                    rows={3}
                                                    maxLength={SCENE_LIMITS.maxTextChars}
                                                    value={object.text}
                                                    onChange={(event) =>
                                                        patch({ text: event.currentTarget.value })
                                                    }
                                                />
                                            </FieldLabel>
                                        </Field>
                                        <Field orientation="contents">
                                            <FieldLabel htmlFor={`${id}-color`}>
                                                Màu chữ
                                                <Input
                                                    id={`${id}-color`}
                                                    type="color"
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
                                            </FieldLabel>
                                        </Field>
                                        <NumericField
                                            id={`${id}-text-size`}
                                            label="Cỡ chữ (theo chiều rộng trang)"
                                            value={object.style.size}
                                            onChange={(size) =>
                                                patch({ style: { ...object.style, size } })
                                            }
                                        />
                                        <Field orientation="contents">
                                            <FieldLabel htmlFor={`${id}-font`}>
                                                Kiểu chữ
                                                <FormSelect
                                                    id={`${id}-font`}
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
                                {object.type === 'label' && (
                                    <VectorFields
                                        id={`${id}-target`}
                                        label="Đầu mũi chỉ"
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
                                {(object.type === 'audio' || object.type === 'video') && (
                                    <>
                                        <Field orientation="contents">
                                            <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                                <Checkbox
                                                    checked={object.autoplay}
                                                    onCheckedChange={(checked) =>
                                                        patch({ autoplay: checked === true })
                                                    }
                                                />
                                                Tự phát khi đọc trang
                                            </FieldLabel>
                                        </Field>
                                        <Field orientation="contents">
                                            <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                                <Checkbox
                                                    checked={object.loop}
                                                    onCheckedChange={(checked) =>
                                                        patch({ loop: checked === true })
                                                    }
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
                                            Trình duyệt có thể yêu cầu người đọc chạm trước khi phát
                                            âm thanh hoặc video.
                                        </p>
                                    </>
                                )}
                                {object.type === 'hotspot' && (
                                    <>
                                        <NumericField
                                            id={`${id}-width`}
                                            label="Rộng vùng chạm"
                                            value={object.size[0]}
                                            onChange={(value) =>
                                                patch({ size: [value, object.size[1]] })
                                            }
                                        />
                                        <NumericField
                                            id={`${id}-height`}
                                            label="Cao vùng chạm"
                                            value={object.size[1]}
                                            onChange={(value) =>
                                                patch({ size: [object.size[0], value] })
                                            }
                                        />
                                        <Field orientation="contents">
                                            <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                                <Checkbox
                                                    checked={object.showHint}
                                                    onCheckedChange={(checked) =>
                                                        patch({ showHint: checked === true })
                                                    }
                                                />
                                                Hiện gợi ý vùng chạm
                                            </FieldLabel>
                                        </Field>
                                    </>
                                )}
                            </div>
                        </Disclosure>
                    )}
                </fieldset>
            </DisclosureGroup>
            <div className="inspector-object-actions mt-[18px] flex flex-wrap gap-2 [&_.button:last-child]:border [&_.button:last-child]:border-border [&_.button:last-child]:border-solid [&_.button:last-child]:bg-surface [&_.button:last-child]:text-destructive">
                <Button
                    variant="secondary"
                    disabled={disabled || object.locked}
                    onClick={onDuplicate}
                >
                    <Copy data-icon="inline-start" />
                    Nhân bản
                </Button>
                <Button variant="ghost" disabled={disabled || object.locked} onClick={onDelete}>
                    <Trash2 data-icon="inline-start" />
                    Xóa đối tượng
                </Button>
            </div>
        </section>
    );
}
