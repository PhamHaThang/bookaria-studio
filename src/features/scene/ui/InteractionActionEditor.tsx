import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import type { Action, Easing, Scene, SceneObject } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import { BufferedInput } from '@/shared/ui/BufferedTextInput';
import { Button } from '@/shared/ui/Button';
import { Disclosure } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/shared/ui/primitives/field';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';
import { actionOperationChoices, changeActionOperation } from '../model/interaction-blocks';
import { audioActionChoices } from '../model/interaction-targets';
import { objectName } from '../model/interaction-templates';
import { targetObjects } from '../model/interactions';
import { AssetMediaPreview } from './AssetMediaPreview';
import { AssetPicker } from './AssetPicker';
import { NumericField, VectorFields } from './NumericField';
import { useSceneWidthMm } from './SceneUnits';
import { WorkflowActionFields } from './WorkflowFields';

export function InteractionActionEditor({
    action,
    scene,
    pages = [],
    objects,
    assets,
    id,
    disabled,
    onChange,
}: {
    action: Action;
    scene?: Scene;
    pages?: BookDetail['pages'];
    objects: SceneObject[];
    assets: Record<string, AssetRef>;
    id: string;
    disabled: boolean;
    defaultTarget?: SceneObject;
    onChange: (action: Action) => void;
}) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const widthMm = useSceneWidthMm();
    const [picking, setPicking] = useState(false);
    const target = 'objectId' in action ? objects.find((o) => o.id === action.objectId) : undefined;
    const rotationLocked = Boolean(target && facesCamera(target));
    const assetId =
        action.type === 'playAudio' || action.type === 'stopAudio'
            ? action.assetId
            : action.type === 'playAnimation' && target?.type === 'model'
              ? target.assetId
              : undefined;
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => assetsApi.detail(assetId || '', signal),
        enabled:
            Boolean(assetId) &&
            (action.type === 'playAudio' || action.type === 'stopAudio' || !assets[assetId || '']),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
    });
    const asset = detail.data || (assetId ? assets[assetId] : undefined);
    const clips = [
        ...new Set((asset?.meta.animations || []).filter((c) => c.length > 0 && c.length <= 100)),
    ];
    const audioObject = objects.find(
        (object) => object.type === 'audio' && object.assetId === assetId,
    );
    const audioName =
        detail.data?.name || (audioObject ? objectName(audioObject) : 'Âm thanh đang chọn');
    const operation = actionOperationChoices(action);
    const patch = (value: Partial<Action>) => onChange({ ...action, ...value } as Action);
    if (['condition', 'setState', 'askQuestion', 'navigate'].includes(action.type))
        return (
            <WorkflowActionFields
                key={id}
                action={action}
                scene={scene || { schemaVersion: 1, objects, interactions: [] }}
                pages={pages}
                disabled={disabled}
                onChange={onChange}
            />
        );
    return (
        <>
            <FieldSet disabled={disabled} className="m-0 min-w-0 shrink-0 border-0 p-0">
                <FieldGroup className="shrink-0 gap-4">
                    {operation && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-operation`}>Thao tác</FieldLabel>
                            <FormSelect
                                size="sm"
                                id={`${id}-operation`}
                                value={operation.value}
                                options={operation.options}
                                onValueChange={(value) =>
                                    onChange(changeActionOperation(action, value))
                                }
                            />
                        </Field>
                    )}
                    {'objectId' in action && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-target`}>Áp dụng cho</FieldLabel>
                            <FormSelect
                                size="sm"
                                id={`${id}-target`}
                                value={action.objectId}
                                options={[
                                    { value: '', label: 'Chọn đối tượng' },
                                    ...(!objects.some((o) => o.id === action.objectId) &&
                                    action.objectId
                                        ? [
                                              {
                                                  value: action.objectId,
                                                  label: 'Đối tượng đã xóa — hãy chọn lại',
                                              },
                                          ]
                                        : []),
                                    ...targetObjects(objects, action.type).map((o) => ({
                                        value: o.id,
                                        label: objectName(o),
                                    })),
                                ]}
                                onValueChange={(objectId) => {
                                    const next = objects.find((o) => o.id === objectId);
                                    patch({
                                        objectId,
                                        ...(action.type === 'playAnimation'
                                            ? {
                                                  clip:
                                                      next?.type === 'model'
                                                          ? assets[next.assetId]?.meta
                                                                .animations?.[0] || ''
                                                          : '',
                                              }
                                            : {}),
                                        ...(action.type === 'transformTo'
                                            ? {
                                                  ...(action.position
                                                      ? {
                                                            position: next?.transform.position || [
                                                                0, 0, 0,
                                                            ],
                                                        }
                                                      : {}),
                                                  ...(action.rotation
                                                      ? {
                                                            rotation: next?.transform.rotation || [
                                                                0, 0, 0,
                                                            ],
                                                        }
                                                      : {}),
                                                  ...(action.scale
                                                      ? {
                                                            scale: next?.transform.scale || [
                                                                1, 1, 1,
                                                            ],
                                                        }
                                                      : {}),
                                              }
                                            : {}),
                                    });
                                }}
                            />
                        </Field>
                    )}
                    {(action.type === 'playAudio' || action.type === 'stopAudio') && (
                        <FieldGroup className="gap-3">
                            <Field>
                                <div className="flex items-center justify-between gap-2">
                                    <FieldLabel htmlFor={`${id}-audio`}>Âm thanh</FieldLabel>
                                    {assetId && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label="Bỏ chọn âm thanh"
                                            disabled={disabled}
                                            onClick={() => patch({ assetId: '' })}
                                        >
                                            <X data-icon="inline-start" />
                                            Bỏ chọn
                                        </Button>
                                    )}
                                </div>
                                <FormSelect
                                    size="sm"
                                    id={`${id}-audio`}
                                    value={
                                        audioActionChoices(
                                            action,
                                            objects,
                                            assets,
                                            detail.data?.name,
                                        ).value
                                    }
                                    options={
                                        audioActionChoices(
                                            action,
                                            objects,
                                            assets,
                                            detail.data?.name,
                                        ).options
                                    }
                                    onValueChange={(assetId) =>
                                        patch({
                                            assetId: assetId === 'all-audio' ? undefined : assetId,
                                        } as Partial<Action>)
                                    }
                                />
                            </Field>
                            <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                                Chọn từ tài nguyên âm thanh
                            </Button>
                            {assetId && asset?.url && (
                                <section
                                    aria-label="Âm thanh đang chọn"
                                    className="flex min-w-0 flex-col gap-2"
                                >
                                    <div className="min-h-12 min-w-0">
                                        {!picking && (
                                            <AssetMediaPreview
                                                type="AUDIO"
                                                url={asset.url}
                                                audioLabel={`Nghe thử ${audioName}`}
                                            />
                                        )}
                                    </div>
                                </section>
                            )}
                            {detail.isError && (
                                <p className="m-0 text-danger-foreground text-xs">
                                    Không tải được thông tin âm thanh.{' '}
                                    <button
                                        type="button"
                                        className="underline"
                                        onClick={() => {
                                            void detail.refetch();
                                        }}
                                    >
                                        Thử lại
                                    </button>
                                </p>
                            )}
                        </FieldGroup>
                    )}
                    {action.type === 'playAnimation' && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-clip`}>Hoạt cảnh có sẵn</FieldLabel>
                            <FormSelect
                                size="sm"
                                id={`${id}-clip`}
                                value={action.clip}
                                options={[
                                    {
                                        value: '',
                                        label: detail.isFetching
                                            ? 'Đang đọc hoạt cảnh…'
                                            : 'Chọn hoạt cảnh',
                                    },
                                    ...clips.map((value) => ({ value, label: value })),
                                    ...(action.clip && !clips.includes(action.clip)
                                        ? [
                                              {
                                                  value: action.clip,
                                                  label: `${action.clip} · cần kiểm tra lại`,
                                              },
                                          ]
                                        : []),
                                ]}
                                onValueChange={(clip) => patch({ clip })}
                            />
                            {!detail.isFetching && !clips.length && (
                                <p className="m-0 text-muted-foreground text-xs">
                                    Mô hình này chưa có hoạt cảnh. Chọn mô hình khác hoặc dùng mẫu
                                    di chuyển / phóng to.
                                </p>
                            )}
                        </Field>
                    )}
                    {(action.type === 'playAudio' || action.type === 'playAnimation') && (
                        <Field orientation="horizontal">
                            <Checkbox
                                id={`${id}-loop`}
                                checked={action.loop}
                                onCheckedChange={(v) => patch({ loop: v === true })}
                            />
                            <FieldLabel htmlFor={`${id}-loop`} className="font-normal">
                                Phát lặp
                            </FieldLabel>
                        </Field>
                    )}
                    {action.type === 'playAudio' && (
                        <NumericField
                            id={`${id}-volume`}
                            label="Âm lượng (%)"
                            value={action.volume * 100}
                            onChange={(v) => patch({ volume: v / 100 })}
                        />
                    )}
                    {action.type === 'openUrl' && (
                        <Field>
                            <FieldLabel htmlFor={`${id}-url`}>Địa chỉ liên kết</FieldLabel>
                            <BufferedInput
                                id={`${id}-url`}
                                type="url"
                                value={action.url}
                                placeholder="https://..."
                                onValueChange={(url) => patch({ url })}
                            />
                        </Field>
                    )}
                    {action.type === 'wait' && (
                        <NumericField
                            id={`${id}-wait`}
                            label="Chờ bao lâu? (giây, 0–60)"
                            value={action.ms / 1000}
                            onChange={(v) => patch({ ms: Math.round(v * 1000) })}
                        />
                    )}
                    {action.type === 'transformTo' && (
                        <FieldGroup className="gap-4">
                            {(['position', 'rotation', 'scale'] as const).map((key) => (
                                <FieldGroup key={key} className="gap-2">
                                    <Field orientation="horizontal">
                                        <Checkbox
                                            disabled={key === 'rotation' && rotationLocked}
                                            id={`${id}-${key}-use`}
                                            checked={action[key] !== undefined}
                                            onCheckedChange={(v) =>
                                                patch({
                                                    [key]:
                                                        v === true
                                                            ? [
                                                                  ...(target?.transform[key] ||
                                                                      (key === 'scale'
                                                                          ? [1, 1, 1]
                                                                          : [0, 0, 0])),
                                                              ]
                                                            : undefined,
                                                })
                                            }
                                        />
                                        <FieldLabel
                                            htmlFor={`${id}-${key}-use`}
                                            className="font-normal"
                                        >
                                            {
                                                {
                                                    position: 'Thay đổi vị trí',
                                                    rotation: 'Thay đổi góc xoay',
                                                    scale: 'Thay đổi kích thước',
                                                }[key]
                                            }
                                        </FieldLabel>
                                    </Field>
                                    {action[key] && (
                                        <VectorFields
                                            id={`${id}-${key}`}
                                            label={
                                                {
                                                    position: 'Vị trí cuối',
                                                    rotation: 'Góc cuối',
                                                    scale: 'Tỉ lệ cuối',
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
                                            values={action[key]}
                                            positive={key === 'scale'}
                                            disabled={
                                                disabled || (key === 'rotation' && rotationLocked)
                                            }
                                            onChange={(v) => patch({ [key]: v })}
                                        />
                                    )}
                                </FieldGroup>
                            ))}
                            {rotationLocked && (
                                <p className="m-0 text-muted-foreground text-xs leading-5">
                                    {target?.type === 'audio'
                                        ? 'Thẻ âm thanh luôn hướng về camera nên góc xoay được khóa.'
                                        : 'Tắt “Luôn hướng về camera” của đối tượng để chỉnh góc xoay.'}
                                </p>
                            )}
                        </FieldGroup>
                    )}
                    {action.type !== 'wait' && (
                        <Disclosure
                            title={
                                action.type === 'transformTo'
                                    ? 'Thời gian và cách chuyển động'
                                    : 'durationMs' in action
                                      ? 'Thời gian chuyển đổi'
                                      : 'Thời gian bắt đầu'
                            }
                        >
                            <FieldGroup className="gap-4">
                                <NumericField
                                    id={`${id}-delay`}
                                    label="Chờ trước khi bắt đầu (giây, 0–60)"
                                    value={action.delayMsSchema / 1000}
                                    onChange={(v) => patch({ delayMsSchema: Math.round(v * 1000) })}
                                />
                                {'durationMs' in action && (
                                    <NumericField
                                        id={`${id}-duration`}
                                        label="Thời gian chuyển đổi (giây, 0–10)"
                                        value={action.durationMs / 1000}
                                        onChange={(v) =>
                                            patch({ durationMs: Math.round(v * 1000) })
                                        }
                                    />
                                )}{' '}
                                {action.type === 'transformTo' && (
                                    <Field>
                                        <FieldLabel htmlFor={`${id}-easing`}>
                                            Cách chuyển động
                                        </FieldLabel>
                                        <FormSelect
                                            size="sm"
                                            id={`${id}-easing`}
                                            value={action.easing}
                                            options={[
                                                { value: 'linear', label: 'Tốc độ đều' },
                                                { value: 'easeIn', label: 'Bắt đầu chậm' },
                                                { value: 'easeOut', label: 'Kết thúc chậm' },
                                                { value: 'easeInOut', label: 'Mượt ở đầu và cuối' },
                                            ]}
                                            onValueChange={(v) => patch({ easing: v as Easing })}
                                        />
                                    </Field>
                                )}
                            </FieldGroup>
                        </Disclosure>
                    )}
                </FieldGroup>
            </FieldSet>
            {picking &&
                !disabled &&
                (action.type === 'playAudio' || action.type === 'stopAudio') && (
                    <AssetPicker
                        type="AUDIO"
                        selectedAssetId={action.assetId}
                        selectedAsset={detail.data?.type === 'AUDIO' ? detail.data : undefined}
                        usedAssetIds={action.assetId ? [action.assetId] : []}
                        chooseLabel="Chọn âm thanh"
                        onClear={() => {
                            patch({ assetId: '' });
                            setPicking(false);
                        }}
                        onClose={() => setPicking(false)}
                        onChoose={(chosen) => {
                            queryClient.setQueryData(
                                assetKeys.detail(user?.id || '', chosen.id),
                                chosen,
                            );
                            patch({ assetId: chosen.id });
                            setPicking(false);
                        }}
                    />
                )}
        </>
    );
}
