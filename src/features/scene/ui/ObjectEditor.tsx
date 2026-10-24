import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, Info, Move, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
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
                    <input
                        type="checkbox"
                        checked={object.locked}
                        disabled={disabled}
                        onChange={(event) => patch({ locked: event.currentTarget.checked })}
                    />
                    Khóa đối tượng
                </FieldLabel>
            </Field>
            {object.locked && (
                <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                    Mở khóa để chỉnh sửa, nhân bản hoặc xóa đối tượng.
                </p>
            )}
            <fieldset
                disabled={disabled || object.locked}
                className="scene-object-fields m-0 grid min-w-0 gap-4 border-0 border-[transparent] border-solid p-0 max-[1200px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[600px]:grid-cols-[1fr] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:min-w-0 [&_select]:w-full [&_select]:min-w-0 [&_textarea]:w-full [&_textarea]:min-w-0 [.workbench-panel_&]:gap-[14px]"
            >
                <details
                    className={
                        'property-section [&_>_summary::after]:transform-[rotate(45deg)] [&[open]_>_summary::after]:transform-[rotate(225deg)] rounded-[16px] border border-border border-solid bg-surface [&_>_div]:px-[14px] [&_>_div]:pt-0 [&_>_div]:pb-4 [&_>_summary::-webkit-details-marker]:hidden [&_>_summary::after]:mr-1 [&_>_summary::after]:ml-auto [&_>_summary::after]:size-[6px] [&_>_summary::after]:border-r-[1px] [&_>_summary::after]:border-r-muted-foreground [&_>_summary::after]:border-b-[1px] [&_>_summary::after]:border-b-muted-foreground [&_>_summary::after]:[border-bottom-style:solid] [&_>_summary::after]:[border-right-style:solid] [&_>_summary::after]:[content:""] [&_>_summary]:flex [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary]:items-center [&_>_summary]:gap-[10px] [&_>_summary]:px-[14px] [&_>_summary]:py-[17px] [&_>_summary]:font-semibold [&_>_summary]:text-[length:12px] [&_>_summary_svg]:rounded-[10px] [&_>_summary_svg]:bg-selected [&_>_summary_svg]:p-[7px] [&_>_summary_svg]:text-primary [&_>_summary_svg]:[box-sizing:content-box]'
                    }
                    name={id}
                >
                    <summary>
                        <Info size={17} />
                        Thông tin cơ bản
                    </summary>
                    <div>
                        {' '}
                        <Field orientation="contents">
                            <FieldLabel htmlFor={`${id}-name`}>
                                Tên đối tượng
                                <Input
                                    id={`${id}-name`}
                                    maxLength={100}
                                    value={object.name || ''}
                                    onChange={(event) => patch({ name: event.currentTarget.value })}
                                />
                            </FieldLabel>
                        </Field>
                        {assetId && (
                            <div className="scene-object-asset [&_p]:wrap-anywhere max-[1200px]:col-[1_/_-1] [&_.button]:shrink-1">
                                <p>Tài nguyên: {detail.data?.name || 'Tệp đã gắn trên trang'}</p>
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
                                    <audio key={asset.url} controls preload="none" src={asset.url}>
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
                </details>
                {object.type === 'model' && (
                    <details
                        className={
                            'property-section [&_>_summary::after]:transform-[rotate(45deg)] [&[open]_>_summary::after]:transform-[rotate(225deg)] rounded-[16px] border border-border border-solid bg-surface [&_>_div]:px-[14px] [&_>_div]:pt-0 [&_>_div]:pb-4 [&_>_summary::-webkit-details-marker]:hidden [&_>_summary::after]:mr-1 [&_>_summary::after]:ml-auto [&_>_summary::after]:size-[6px] [&_>_summary::after]:border-r-[1px] [&_>_summary::after]:border-r-muted-foreground [&_>_summary::after]:border-b-[1px] [&_>_summary::after]:border-b-muted-foreground [&_>_summary::after]:[border-bottom-style:solid] [&_>_summary::after]:[border-right-style:solid] [&_>_summary::after]:[content:""] [&_>_summary]:flex [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary]:items-center [&_>_summary]:gap-[10px] [&_>_summary]:px-[14px] [&_>_summary]:py-[17px] [&_>_summary]:font-semibold [&_>_summary]:text-[length:12px] [&_>_summary_svg]:rounded-[10px] [&_>_summary_svg]:bg-selected [&_>_summary_svg]:p-[7px] [&_>_summary_svg]:text-primary [&_>_summary_svg]:[box-sizing:content-box]'
                        }
                        name={id}
                    >
                        <summary>
                            <Play size={17} />
                            Animations
                        </summary>
                        <div>
                            {' '}
                            {object.type === 'model' && (
                                <>
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor={`${id}-animation`}>
                                            Animation
                                            <NativeSelect
                                                id={`${id}-animation`}
                                                value={object.animation?.clip || ''}
                                                onChange={(event) =>
                                                    patch({
                                                        animation: event.currentTarget.value
                                                            ? {
                                                                  clip: event.currentTarget.value,
                                                                  loop: false,
                                                                  autoplay: true,
                                                              }
                                                            : undefined,
                                                    })
                                                }
                                            >
                                                <option value="">Không chạy animation</option>
                                                {clips.map((clip) => (
                                                    <option key={clip} value={clip}>
                                                        {clip}
                                                    </option>
                                                ))}
                                            </NativeSelect>
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
                                                    <input
                                                        type="checkbox"
                                                        checked={object.animation?.[key]}
                                                        onChange={(event) => {
                                                            if (object.animation)
                                                                patch({
                                                                    animation: {
                                                                        ...object.animation,
                                                                        [key]: event.currentTarget
                                                                            .checked,
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
                    </details>
                )}
                <details
                    className={
                        'property-section [&_>_summary::after]:transform-[rotate(45deg)] [&[open]_>_summary::after]:transform-[rotate(225deg)] rounded-[16px] border border-border border-solid bg-surface [&_>_div]:px-[14px] [&_>_div]:pt-0 [&_>_div]:pb-4 [&_>_summary::-webkit-details-marker]:hidden [&_>_summary::after]:mr-1 [&_>_summary::after]:ml-auto [&_>_summary::after]:size-[6px] [&_>_summary::after]:border-r-[1px] [&_>_summary::after]:border-r-muted-foreground [&_>_summary::after]:border-b-[1px] [&_>_summary::after]:border-b-muted-foreground [&_>_summary::after]:[border-bottom-style:solid] [&_>_summary::after]:[border-right-style:solid] [&_>_summary::after]:[content:""] [&_>_summary]:flex [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary]:items-center [&_>_summary]:gap-[10px] [&_>_summary]:px-[14px] [&_>_summary]:py-[17px] [&_>_summary]:font-semibold [&_>_summary]:text-[length:12px] [&_>_summary_svg]:rounded-[10px] [&_>_summary_svg]:bg-selected [&_>_summary_svg]:p-[7px] [&_>_summary_svg]:text-primary [&_>_summary_svg]:[box-sizing:content-box]'
                    }
                    name={id}
                >
                    <summary>
                        <Eye size={17} />
                        Hiển thị & hành vi
                    </summary>
                    <div>
                        {' '}
                        <div className="scene-flags grid gap-3 max-[1200px]:col-[1_/_-1]">
                            {(
                                [
                                    ['visible', 'Hiện khi mở trang'],
                                    ['billboard', 'Luôn hướng về camera'],
                                    ['snapToPaper', 'Bám mặt giấy'],
                                    ['editorHidden', 'Ẩn khỏi sơ đồ chỉnh sửa'],
                                ] as const
                            ).map(([key, label]) => (
                                <Field orientation="contents" key={key}>
                                    <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                        <input
                                            type="checkbox"
                                            checked={object[key]}
                                            onChange={(event) =>
                                                patch({ [key]: event.currentTarget.checked })
                                            }
                                        />
                                        {label}
                                    </FieldLabel>
                                </Field>
                            ))}
                        </div>
                    </div>
                </details>
                <details
                    className={
                        'property-section [&_>_summary::after]:transform-[rotate(45deg)] [&[open]_>_summary::after]:transform-[rotate(225deg)] rounded-[16px] border border-border border-solid bg-surface [&_>_div]:px-[14px] [&_>_div]:pt-0 [&_>_div]:pb-4 [&_>_summary::-webkit-details-marker]:hidden [&_>_summary::after]:mr-1 [&_>_summary::after]:ml-auto [&_>_summary::after]:size-[6px] [&_>_summary::after]:border-r-[1px] [&_>_summary::after]:border-r-muted-foreground [&_>_summary::after]:border-b-[1px] [&_>_summary::after]:border-b-muted-foreground [&_>_summary::after]:[border-bottom-style:solid] [&_>_summary::after]:[border-right-style:solid] [&_>_summary::after]:[content:""] [&_>_summary]:flex [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary]:items-center [&_>_summary]:gap-[10px] [&_>_summary]:px-[14px] [&_>_summary]:py-[17px] [&_>_summary]:font-semibold [&_>_summary]:text-[length:12px] [&_>_summary_svg]:rounded-[10px] [&_>_summary_svg]:bg-selected [&_>_summary_svg]:p-[7px] [&_>_summary_svg]:text-primary [&_>_summary_svg]:[box-sizing:content-box]'
                    }
                    name={id}
                    open={object.type !== 'text' && object.type !== 'label'}
                >
                    <summary>
                        <Move size={17} />
                        Biến đổi
                    </summary>
                    <div>
                        {' '}
                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Tâm trang là (0, 0, 0). Một đơn vị bằng chiều rộng trang; X sang phải, Y
                            lên trên, Z nhô khỏi giấy. Góc xoay tính bằng độ.
                        </p>
                        {(['position', 'rotation', 'scale'] as const).map((key) => (
                            <VectorFields
                                key={key}
                                id={`${id}-${key}`}
                                label={
                                    { position: 'Vị trí', rotation: 'Góc xoay', scale: 'Tỉ lệ' }[
                                        key
                                    ]
                                }
                                values={object.transform[key]}
                                onChange={(values) =>
                                    patch({ transform: { ...object.transform, [key]: values } })
                                }
                            />
                        ))}
                    </div>
                </details>
                {object.type !== 'model' && (
                    <details
                        className={
                            'property-section [&_>_summary::after]:transform-[rotate(45deg)] [&[open]_>_summary::after]:transform-[rotate(225deg)] rounded-[16px] border border-border border-solid bg-surface [&_>_div]:px-[14px] [&_>_div]:pt-0 [&_>_div]:pb-4 [&_>_summary::-webkit-details-marker]:hidden [&_>_summary::after]:mr-1 [&_>_summary::after]:ml-auto [&_>_summary::after]:size-[6px] [&_>_summary::after]:border-r-[1px] [&_>_summary::after]:border-r-muted-foreground [&_>_summary::after]:border-b-[1px] [&_>_summary::after]:border-b-muted-foreground [&_>_summary::after]:[border-bottom-style:solid] [&_>_summary::after]:[border-right-style:solid] [&_>_summary::after]:[content:""] [&_>_summary]:flex [&_>_summary]:cursor-pointer [&_>_summary]:list-none [&_>_summary]:items-center [&_>_summary]:gap-[10px] [&_>_summary]:px-[14px] [&_>_summary]:py-[17px] [&_>_summary]:font-semibold [&_>_summary]:text-[length:12px] [&_>_summary_svg]:rounded-[10px] [&_>_summary_svg]:bg-selected [&_>_summary_svg]:p-[7px] [&_>_summary_svg]:text-primary [&_>_summary_svg]:[box-sizing:content-box]'
                        }
                        name={id}
                        open={object.type === 'text' || object.type === 'label'}
                    >
                        <summary>
                            <SlidersHorizontal size={17} />
                            Nội dung
                        </summary>
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
                                            <input
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
                                            <NativeSelect
                                                id={`${id}-font`}
                                                value={object.style.font}
                                                onChange={(event) =>
                                                    patch({
                                                        style: {
                                                            ...object.style,
                                                            font: event.currentTarget
                                                                .value as typeof object.style.font,
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="sans">Không chân</option>
                                                <option value="serif">Có chân</option>
                                                <option value="rounded">Bo tròn</option>
                                            </NativeSelect>
                                        </FieldLabel>
                                    </Field>
                                    <Field orientation="contents">
                                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                            <input
                                                type="checkbox"
                                                checked={object.style.bold}
                                                onChange={(event) =>
                                                    patch({
                                                        style: {
                                                            ...object.style,
                                                            bold: event.currentTarget.checked,
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
                                            <input
                                                type="checkbox"
                                                checked={object.autoplay}
                                                onChange={(event) =>
                                                    patch({ autoplay: event.currentTarget.checked })
                                                }
                                            />
                                            Tự phát khi đọc trang
                                        </FieldLabel>
                                    </Field>
                                    <Field orientation="contents">
                                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                            <input
                                                type="checkbox"
                                                checked={object.loop}
                                                onChange={(event) =>
                                                    patch({ loop: event.currentTarget.checked })
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
                                                <input
                                                    type="checkbox"
                                                    checked={object.muted}
                                                    onChange={(event) =>
                                                        patch({
                                                            muted: event.currentTarget.checked,
                                                        })
                                                    }
                                                />
                                                Tắt tiếng video
                                            </FieldLabel>
                                        </Field>
                                    )}
                                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                        Trình duyệt có thể yêu cầu người đọc chạm trước khi phát âm
                                        thanh hoặc video.
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
                                            <input
                                                type="checkbox"
                                                checked={object.showHint}
                                                onChange={(event) =>
                                                    patch({ showHint: event.currentTarget.checked })
                                                }
                                            />
                                            Hiện gợi ý vùng chạm
                                        </FieldLabel>
                                    </Field>
                                </>
                            )}
                        </div>
                    </details>
                )}
            </fieldset>
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
