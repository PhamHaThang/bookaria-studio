import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, Info, Move, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { facesCamera } from '@/shared/scene/audio-kind';
import { Disclosure, DisclosureGroup } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Switch } from '@/shared/ui/primitives/switch';
import { errorMessage } from '../../../shared/api/errors';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { SceneObject } from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';
import { objectInspectorMeta } from '../model/object-inspector';
import type { SceneAudioStore } from '../model/scene-audio-store';
import type { SceneLoadStore } from '../model/scene-load-store';
import { isPlanarObject } from '../model/selection-frame';
import { withObjectPosition } from '../model/transforms';
import { VectorFields } from './NumericField';
import { ObjectSpecificProperties } from './ObjectSpecificProperties';
import { useSceneWidthMm } from './SceneUnits';

export function ObjectEditor({
    object,
    loadStore,
    audioStore,
    assetRef,
    disabled,
    onChange,
    onColorPreview,
    onBegin,
    onEnd,
    onBillboardChange,
    onChooseAsset,
    onEditText,
    onDuplicate,
    onDelete,
}: {
    object: SceneObject;
    loadStore: SceneLoadStore;
    audioStore: SceneAudioStore;
    assetRef?: AssetRef;
    disabled: boolean;
    onChange: (object: SceneObject) => void;
    onColorPreview?: (color: string) => void;
    onBegin?: () => void;
    onEnd?: () => void;
    onBillboardChange: (enabled: boolean) => void;
    onChooseAsset: () => void;
    onEditText: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const widthMm = useSceneWidthMm();
    const unavailable = useSyncExternalStore(loadStore.subscribe, loadStore.getSnapshot).has(
        object.id,
    );
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
        <section className="scene-inspector min-w-0" aria-labelledby="inspector-heading">
            <Field
                orientation="horizontal"
                className="mb-4 items-center justify-between gap-3 rounded-lg border border-border px-3 py-3"
            >
                <FieldLabel htmlFor={`${id}-locked`} className="m-0">
                    Khóa đối tượng
                </FieldLabel>
                <Switch
                    id={`${id}-locked`}
                    checked={object.locked}
                    disabled={disabled}
                    onCheckedChange={(checked) => patch({ locked: checked })}
                />
            </Field>
            {object.locked && (
                <p className="mb-4 text-muted-foreground text-xs">
                    Mở khóa để chỉnh sửa, nhân bản hoặc xóa đối tượng.
                </p>
            )}
            <DisclosureGroup
                defaultValue={objectInspectorMeta(object).defaultSections}
                disabledContent={disabled || object.locked}
            >
                <fieldset className="scene-object-fields m-0 flex min-w-0 flex-col gap-3 border-0 p-0 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0 [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:min-w-0 [&_textarea]:w-full [&_textarea]:min-w-0 [.workbench-panel_&]:gap-[14px]">
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
                                                variant="outline"
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
                    {object.type !== 'model' && (
                        <Disclosure
                            value="content"
                            title={
                                <>
                                    <SlidersHorizontal size={17} />
                                    {objectInspectorMeta(object).contentTitle}
                                </>
                            }
                            variant="panel"
                            className="property-section"
                        >
                            <ObjectSpecificProperties
                                object={object}
                                id={id}
                                disabled={disabled}
                                unavailable={unavailable}
                                patch={patch}
                                onColorPreview={onColorPreview}
                                onColorBegin={onBegin}
                                onColorEnd={onEnd}
                                onEditText={onEditText}
                                audioStore={audioStore}
                            />
                        </Disclosure>
                    )}
                    {object.type === 'model' && (
                        <Disclosure
                            value="animation"
                            title={
                                <>
                                    <Play size={17} />
                                    {objectInspectorMeta(object).contentTitle}
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
                                                Chuyển động
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
                                        ['editorHidden', 'Ẩn trong editor'],
                                    ] as const
                                ).map(([key, label]) => (
                                    <Field
                                        orientation="horizontal"
                                        className="items-center justify-between gap-3"
                                        key={key}
                                    >
                                        <FieldLabel
                                            htmlFor={`${id}-${key}`}
                                            className="m-0 flex-1 font-normal"
                                        >
                                            {label}
                                        </FieldLabel>
                                        <Switch
                                            id={`${id}-${key}`}
                                            checked={
                                                key === 'billboard'
                                                    ? facesCamera(object)
                                                    : object[key]
                                            }
                                            disabled={
                                                key === 'billboard' && object.type === 'audio'
                                            }
                                            onCheckedChange={(checked) =>
                                                key === 'billboard'
                                                    ? onBillboardChange(checked)
                                                    : patch({ [key]: checked })
                                            }
                                        />
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
                        <div className="flex min-w-0 flex-col gap-5">
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
                                    unit={
                                        key === 'position'
                                            ? 'mm'
                                            : key === 'rotation'
                                              ? '°'
                                              : undefined
                                    }
                                    displayFactor={key === 'position' ? widthMm : 1}
                                    values={object.transform[key]}
                                    resetValues={key === 'scale' ? [1, 1, 1] : [0, 0, 0]}
                                    positive={key === 'scale'}
                                    disabled={
                                        unavailable || (key === 'rotation' && facesCamera(object))
                                    }
                                    disabledAxes={
                                        key === 'scale' && isPlanarObject(object) ? [2] : []
                                    }
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
                            {facesCamera(object) && (
                                <p className="m-0 text-muted-foreground text-xs">
                                    {object.type === 'audio'
                                        ? 'Thẻ âm thanh luôn hướng về camera; góc xoay được khóa.'
                                        : 'Tắt “Luôn hướng về camera” để chỉnh góc xoay.'}
                                </p>
                            )}
                            <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                                Tâm trang là (0, 0, 0) mm. X sang phải, Y lên trên, Z nhô khỏi
                                trang.
                            </p>
                        </div>
                    </Disclosure>
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
                <Button variant="outline" disabled={disabled || object.locked} onClick={onDelete}>
                    <Trash2 data-icon="inline-start" />
                    Xóa đối tượng
                </Button>
            </div>
        </section>
    );
}
