import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { errorMessage } from '../../../shared/api/errors';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import {
    type Action,
    type ActionType,
    type Easing,
    EasingSchema,
    type SceneObject,
} from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';
import { scopedAction } from '../model/interaction-scope';
import { actionLabels, targetObjects } from '../model/interactions';
import { AssetPicker } from './AssetPicker';
import { InteractionTarget } from './InteractionTarget';
import { NumericField, VectorFields } from './NumericField';

export function InteractionActionEditor({
    action,
    objects,
    assets,
    id,
    disabled,
    defaultTarget,
    onChange,
}: {
    action: Action;
    objects: SceneObject[];
    assets: Record<string, AssetRef>;
    id: string;
    disabled: boolean;
    defaultTarget?: SceneObject;
    onChange: (action: Action) => void;
}) {
    const { user } = useAuth();
    const [picking, setPicking] = useState(false);
    const target =
        'objectId' in action ? objects.find((object) => object.id === action.objectId) : undefined;
    const assetId =
        action.type === 'playAudio' || action.type === 'stopAudio'
            ? action.assetId
            : action.type === 'playAnimation' && target?.type === 'model'
              ? target.assetId
              : undefined;
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', assetId || ''),
        queryFn: ({ signal }) => assetsApi.detail(assetId || '', signal),
        enabled: Boolean(assetId),
        refetchOnWindowFocus: false,
    });
    const asset = detail.data || (assetId ? assets[assetId] : undefined);
    const clips = [
        ...new Set(
            (asset?.meta.animations || []).filter((clip) => clip.length > 0 && clip.length <= 100),
        ),
    ];
    const patch = (value: Partial<Action>) => onChange({ ...action, ...value } as Action);
    return (
        <>
            <fieldset
                disabled={disabled}
                className="interaction-fields m-0 grid min-w-0 grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 border-0 border-[transparent] border-solid p-0 max-[600px]:grid-cols-[1fr] min-[1100px]:[.scene-editor[data-panel=interactions]_&]:grid-cols-[repeat(2,_minmax(0,_1fr))] [.workbench-panel_&]:grid-cols-[minmax(0,_1fr)] [.workbench-panel_&]:gap-3"
            >
                <Field orientation="contents">
                    <FieldLabel htmlFor={`${id}-type`}>
                        Loại hành động
                        <FormSelect
                            id={`${id}-type`}
                            value={action.type}
                            onValueChange={(value) =>
                                onChange(scopedAction(value as ActionType, defaultTarget))
                            }
                            options={[
                                ...(Object.entries(actionLabels).map(([value, label]) => ({
                                    value: value,
                                    label: label,
                                })) ?? []),
                            ]}
                        />
                    </FieldLabel>
                </Field>
                {'objectId' in action && (
                    <InteractionTarget
                        id={`${id}-object`}
                        value={action.objectId}
                        objects={targetObjects(objects, action.type)}
                        onChange={(objectId) => patch({ objectId })}
                    />
                )}
                {(action.type === 'playAudio' || action.type === 'stopAudio') && (
                    <div className="interaction-audio col-[1_/_-1]">
                        <p>
                            {assetId
                                ? `Âm thanh: ${detail.data?.name || assetId}`
                                : action.type === 'stopAudio'
                                  ? 'Dừng tất cả âm thanh của trang.'
                                  : 'Chưa chọn âm thanh.'}
                        </p>
                        <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                            <Button variant="secondary" onClick={() => setPicking(true)}>
                                {assetId ? 'Đổi âm thanh' : 'Chọn âm thanh'}
                            </Button>
                            {action.type === 'stopAudio' && assetId && (
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        onChange({
                                            type: 'stopAudio',
                                            delayMsSchema: action.delayMsSchema,
                                        })
                                    }
                                >
                                    Dừng tất cả thay thế
                                </Button>
                            )}
                        </div>
                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Chọn tài nguyên AUDIO đã sẵn sàng; không cần thêm đối tượng âm thanh lên
                            trang.
                        </p>
                    </div>
                )}
                {detail.isError && (
                    <div className="interaction-wide col-[1_/_-1]">
                        <Feedback error={errorMessage(detail.error)} />
                        <Button
                            variant="outline"
                            onClick={() => {
                                void detail.refetch();
                            }}
                        >
                            Đọc lại tài nguyên hành động
                        </Button>
                    </div>
                )}
                {action.type === 'playAnimation' && (
                    <>
                        <Field orientation="contents">
                            <FieldLabel htmlFor={`${id}-clip`}>
                                Tên clip animation
                                <Input
                                    id={`${id}-clip`}
                                    aria-label="Tên clip animation"
                                    aria-describedby={`${id}-clip-hint`}
                                    list={`${id}-clips`}
                                    maxLength={100}
                                    value={action.clip}
                                    onChange={(event) => patch({ clip: event.currentTarget.value })}
                                />
                                <datalist id={`${id}-clips`}>
                                    {clips.map((clip) => (
                                        <option key={clip} value={clip} />
                                    ))}
                                </datalist>
                                <span
                                    id={`${id}-clip-hint`}
                                    className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                                >
                                    {clips.length
                                        ? `Clip trong mô hình: ${clips.join(', ')}`
                                        : 'Chọn mô hình rồi nhập đúng tên clip từ tài nguyên.'}
                                </span>
                            </FieldLabel>
                        </Field>
                        {asset && action.clip && !clips.includes(action.clip) && (
                            <p className="scene-reference-error text-danger-foreground">
                                Clip đang nhập không có trong metadata mô hình. Kiểm tra trước khi
                                chạy thử.
                            </p>
                        )}
                    </>
                )}
                {(action.type === 'playAudio' || action.type === 'playAnimation') && (
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={action.loop}
                                onCheckedChange={(checked) => patch({ loop: checked === true })}
                            />
                            Phát lặp hành động
                        </FieldLabel>
                    </Field>
                )}
                {action.type === 'playAudio' && (
                    <NumericField
                        id={`${id}-volume`}
                        label="Âm lượng hành động (0–1)"
                        value={action.volume}
                        onChange={(volume) => patch({ volume })}
                    />
                )}
                {action.type === 'setVisible' && (
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={action.value}
                                onCheckedChange={(checked) => patch({ value: checked === true })}
                            />
                            Hiện đối tượng
                        </FieldLabel>
                    </Field>
                )}
                {action.type === 'openUrl' && (
                    <Field orientation="contents">
                        <FieldLabel htmlFor={`${id}-url`}>
                            Liên kết HTTP hoặc HTTPS
                            <Input
                                id={`${id}-url`}
                                aria-label="Liên kết HTTP hoặc HTTPS"
                                aria-describedby={`${id}-url-hint`}
                                type="url"
                                value={action.url}
                                onChange={(event) => patch({ url: event.currentTarget.value })}
                            />
                            <span
                                id={`${id}-url-hint`}
                                className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                            >
                                Trình đọc sẽ xử lý liên kết khi chạy tương tác. Kiểm tra địa chỉ
                                trước khi xuất bản.
                            </span>
                        </FieldLabel>
                    </Field>
                )}
                {action.type === 'wait' ? (
                    <NumericField
                        id={`${id}-wait`}
                        label="Thời gian chờ (ms, 0–60000)"
                        value={action.ms}
                        onChange={(ms) => patch({ ms })}
                    />
                ) : (
                    <NumericField
                        id={`${id}-delay`}
                        label="Độ trễ (ms, 0–60000)"
                        value={action.delayMsSchema}
                        onChange={(delayMsSchema) => patch({ delayMsSchema })}
                    />
                )}
                {'durationMs' in action && (
                    <NumericField
                        id={`${id}-duration`}
                        label="Thời lượng chuyển đổi (ms, 0–10000)"
                        value={action.durationMs}
                        onChange={(durationMs) => patch({ durationMs })}
                    />
                )}
                {action.type === 'transformTo' && (
                    <>
                        <Field orientation="contents">
                            <FieldLabel htmlFor={`${id}-easing`}>
                                Kiểu chuyển động
                                <FormSelect
                                    id={`${id}-easing`}
                                    value={action.easing}
                                    onValueChange={(value) => patch({ easing: value as Easing })}
                                    options={[
                                        ...(EasingSchema.options.map((value) => ({
                                            value: value,
                                            label: {
                                                linear: 'Đều',
                                                easeIn: 'Chậm rồi nhanh',
                                                easeOut: 'Nhanh rồi chậm',
                                                easeInOut: 'Chậm ở hai đầu',
                                            }[value],
                                        })) ?? []),
                                    ]}
                                />
                            </FieldLabel>
                        </Field>
                        <p className="field-hint interaction-wide col-[1_/_-1] mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Bật ít nhất một thuộc tính đích. Vị trí theo chiều rộng trang; góc xoay
                            dùng độ; tỉ lệ phải lớn hơn 0.
                        </p>
                        {(['position', 'rotation', 'scale'] as const).map((key) => {
                            const label = {
                                position: 'Vị trí đích',
                                rotation: 'Góc xoay đích',
                                scale: 'Tỉ lệ đích',
                            }[key];
                            return (
                                <div key={key} className="interaction-wide col-[1_/_-1]">
                                    <Field orientation="contents">
                                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                            <Checkbox
                                                checked={action[key] !== undefined}
                                                onCheckedChange={(checked) =>
                                                    patch({
                                                        [key]:
                                                            checked === true
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
                                            Thay đổi {label.toLowerCase()}
                                        </FieldLabel>
                                    </Field>
                                    {action[key] !== undefined && (
                                        <VectorFields
                                            id={`${id}-${key}`}
                                            label={label}
                                            values={action[key]}
                                            onChange={(value) => patch({ [key]: value })}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}
            </fieldset>
            {picking &&
                !disabled &&
                (action.type === 'playAudio' || action.type === 'stopAudio') && (
                    <AssetPicker
                        type="AUDIO"
                        onClose={() => setPicking(false)}
                        onChoose={(chosen) => {
                            patch({ assetId: chosen.id });
                            setPicking(false);
                        }}
                    />
                )}
        </>
    );
}
