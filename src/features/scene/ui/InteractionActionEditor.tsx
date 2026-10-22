import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
import { actionLabels, newAction, targetObjects } from '../model/interactions';
import { AssetPicker } from './AssetPicker';
import { InteractionTarget } from './InteractionTarget';
import { NumericField, VectorFields } from './NumericField';

export function InteractionActionEditor({
    action,
    objects,
    assets,
    id,
    disabled,
    onChange,
}: {
    action: Action;
    objects: SceneObject[];
    assets: Record<string, AssetRef>;
    id: string;
    disabled: boolean;
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
            <fieldset disabled={disabled} className="interaction-fields">
                <label htmlFor={`${id}-type`}>
                    Loại hành động
                    <select
                        id={`${id}-type`}
                        value={action.type}
                        onChange={(event) =>
                            onChange(newAction(event.currentTarget.value as ActionType))
                        }
                    >
                        {Object.entries(actionLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                {'objectId' in action && (
                    <InteractionTarget
                        id={`${id}-object`}
                        value={action.objectId}
                        objects={targetObjects(objects, action.type)}
                        onChange={(objectId) => patch({ objectId })}
                    />
                )}
                {(action.type === 'playAudio' || action.type === 'stopAudio') && (
                    <div className="interaction-audio">
                        <p>
                            {assetId
                                ? `Âm thanh: ${detail.data?.name || assetId}`
                                : action.type === 'stopAudio'
                                  ? 'Dừng tất cả âm thanh của trang.'
                                  : 'Chưa chọn âm thanh.'}
                        </p>
                        <div className="form-actions">
                            <Button variant="secondary" onClick={() => setPicking(true)}>
                                {assetId ? 'Đổi âm thanh' : 'Chọn âm thanh'}
                            </Button>
                            {action.type === 'stopAudio' && assetId && (
                                <Button
                                    variant="ghost"
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
                        <p className="field-hint">
                            Chọn tài nguyên AUDIO đã sẵn sàng; không cần thêm đối tượng âm thanh lên
                            trang.
                        </p>
                    </div>
                )}
                {detail.isError && (
                    <div className="interaction-wide">
                        <Feedback error={errorMessage(detail.error)} />
                        <Button
                            variant="ghost"
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
                        <label htmlFor={`${id}-clip`}>
                            Tên clip animation
                            <input
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
                            <span id={`${id}-clip-hint`} className="field-hint">
                                {clips.length
                                    ? `Clip trong mô hình: ${clips.join(', ')}`
                                    : 'Chọn mô hình rồi nhập đúng tên clip từ tài nguyên.'}
                            </span>
                        </label>
                        {asset && action.clip && !clips.includes(action.clip) && (
                            <p className="scene-reference-error">
                                Clip đang nhập không có trong metadata mô hình. Kiểm tra trước khi
                                chạy thử.
                            </p>
                        )}
                    </>
                )}
                {(action.type === 'playAudio' || action.type === 'playAnimation') && (
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={action.loop}
                            onChange={(event) => patch({ loop: event.currentTarget.checked })}
                        />
                        Phát lặp hành động
                    </label>
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
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={action.value}
                            onChange={(event) => patch({ value: event.currentTarget.checked })}
                        />
                        Hiện đối tượng
                    </label>
                )}
                {action.type === 'openUrl' && (
                    <label htmlFor={`${id}-url`}>
                        Liên kết HTTP hoặc HTTPS
                        <input
                            id={`${id}-url`}
                            aria-label="Liên kết HTTP hoặc HTTPS"
                            aria-describedby={`${id}-url-hint`}
                            type="url"
                            value={action.url}
                            onChange={(event) => patch({ url: event.currentTarget.value })}
                        />
                        <span id={`${id}-url-hint`} className="field-hint">
                            Trình đọc sẽ xử lý liên kết khi chạy tương tác. Kiểm tra địa chỉ trước
                            khi xuất bản.
                        </span>
                    </label>
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
                        <label htmlFor={`${id}-easing`}>
                            Kiểu chuyển động
                            <select
                                id={`${id}-easing`}
                                value={action.easing}
                                onChange={(event) =>
                                    patch({ easing: event.currentTarget.value as Easing })
                                }
                            >
                                {EasingSchema.options.map((value) => (
                                    <option key={value} value={value}>
                                        {
                                            {
                                                linear: 'Đều',
                                                easeIn: 'Chậm rồi nhanh',
                                                easeOut: 'Nhanh rồi chậm',
                                                easeInOut: 'Chậm ở hai đầu',
                                            }[value]
                                        }
                                    </option>
                                ))}
                            </select>
                        </label>
                        <p className="field-hint interaction-wide">
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
                                <div key={key} className="interaction-wide">
                                    <label className="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={action[key] !== undefined}
                                            onChange={(event) =>
                                                patch({
                                                    [key]: event.currentTarget.checked
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
                                    </label>
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
