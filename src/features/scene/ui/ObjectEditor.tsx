import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
}: {
    object: SceneObject;
    assetRef?: AssetRef;
    disabled: boolean;
    onChange: (object: SceneObject) => void;
    onChooseAsset: () => void;
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
        <section className="scene-inspector" aria-labelledby="object-editor-heading">
            <h3 id="object-editor-heading">
                Thuộc tính {objectLabels[object.type].charAt(0).toLowerCase()}
                {objectLabels[object.type].slice(1)}
            </h3>
            <label className="checkbox">
                <input
                    type="checkbox"
                    checked={object.locked}
                    disabled={disabled}
                    onChange={(event) => patch({ locked: event.currentTarget.checked })}
                />
                Khóa đối tượng
            </label>
            {object.locked && (
                <p className="field-hint">Mở khóa để chỉnh sửa, nhân bản hoặc xóa đối tượng.</p>
            )}
            <fieldset disabled={disabled || object.locked} className="scene-object-fields">
                <label htmlFor={`${id}-name`}>
                    Tên đối tượng
                    <input
                        id={`${id}-name`}
                        maxLength={100}
                        value={object.name || ''}
                        onChange={(event) => patch({ name: event.currentTarget.value })}
                    />
                </label>
                {assetId && (
                    <div className="scene-object-asset">
                        <p>Tài nguyên: {detail.data?.name || 'Tệp đã gắn trên trang'}</p>
                        <div className="form-actions">
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
                                className="scene-asset-preview"
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
                                className="scene-asset-preview"
                            >
                                <track kind="captions" />
                            </video>
                        )}
                    </div>
                )}
                <p className="field-hint">
                    Tâm trang là (0, 0, 0). Một đơn vị bằng chiều rộng trang; X sang phải, Y lên
                    trên, Z nhô khỏi giấy. Góc xoay tính bằng độ.
                </p>
                {(['position', 'rotation', 'scale'] as const).map((key) => (
                    <VectorFields
                        key={key}
                        id={`${id}-${key}`}
                        label={{ position: 'Vị trí', rotation: 'Góc xoay', scale: 'Tỉ lệ' }[key]}
                        values={object.transform[key]}
                        onChange={(values) =>
                            patch({ transform: { ...object.transform, [key]: values } })
                        }
                    />
                ))}
                <div className="scene-flags">
                    {(
                        [
                            ['visible', 'Hiện khi mở trang'],
                            ['billboard', 'Luôn hướng về camera'],
                            ['snapToPaper', 'Bám mặt giấy'],
                            ['editorHidden', 'Ẩn khỏi sơ đồ chỉnh sửa'],
                        ] as const
                    ).map(([key, label]) => (
                        <label key={key} className="checkbox">
                            <input
                                type="checkbox"
                                checked={object[key]}
                                onChange={(event) => patch({ [key]: event.currentTarget.checked })}
                            />
                            {label}
                        </label>
                    ))}
                </div>
                {object.type === 'model' && (
                    <>
                        <label htmlFor={`${id}-animation`}>
                            Animation
                            <select
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
                            </select>
                        </label>
                        {!clips.length && (
                            <p className="field-hint">
                                Mô hình này chưa có clip animation trong metadata.
                            </p>
                        )}
                        {object.animation &&
                            (['autoplay', 'loop'] as const).map((key) => (
                                <label key={key} className="checkbox">
                                    <input
                                        type="checkbox"
                                        checked={object.animation?.[key]}
                                        onChange={(event) => {
                                            if (object.animation)
                                                patch({
                                                    animation: {
                                                        ...object.animation,
                                                        [key]: event.currentTarget.checked,
                                                    },
                                                });
                                        }}
                                    />
                                    {key === 'loop' ? 'Lặp animation' : 'Tự chạy animation'}
                                </label>
                            ))}
                    </>
                )}
                {(object.type === 'text' || object.type === 'label') && (
                    <>
                        <label htmlFor={`${id}-text`}>
                            Nội dung chữ
                            <textarea
                                id={`${id}-text`}
                                rows={3}
                                maxLength={SCENE_LIMITS.maxTextChars}
                                value={object.text}
                                onChange={(event) => patch({ text: event.currentTarget.value })}
                            />
                        </label>
                        <label htmlFor={`${id}-color`}>
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
                        </label>
                        <NumericField
                            id={`${id}-text-size`}
                            label="Cỡ chữ (theo chiều rộng trang)"
                            value={object.style.size}
                            onChange={(size) => patch({ style: { ...object.style, size } })}
                        />
                        <label htmlFor={`${id}-font`}>
                            Kiểu chữ
                            <select
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
                            </select>
                        </label>
                        <label className="checkbox">
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
                        </label>
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
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                checked={object.autoplay}
                                onChange={(event) =>
                                    patch({ autoplay: event.currentTarget.checked })
                                }
                            />
                            Tự phát khi đọc trang
                        </label>
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                checked={object.loop}
                                onChange={(event) => patch({ loop: event.currentTarget.checked })}
                            />
                            Phát lặp
                        </label>
                        <NumericField
                            id={`${id}-volume`}
                            label="Âm lượng (0–1)"
                            value={object.volume}
                            onChange={(volume) => patch({ volume })}
                        />
                        {object.type === 'video' && (
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={object.muted}
                                    onChange={(event) =>
                                        patch({ muted: event.currentTarget.checked })
                                    }
                                />
                                Tắt tiếng video
                            </label>
                        )}
                        <p className="field-hint">
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
                            value={object.size[0]}
                            onChange={(value) => patch({ size: [value, object.size[1]] })}
                        />
                        <NumericField
                            id={`${id}-height`}
                            label="Cao vùng chạm"
                            value={object.size[1]}
                            onChange={(value) => patch({ size: [object.size[0], value] })}
                        />
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                checked={object.showHint}
                                onChange={(event) =>
                                    patch({ showHint: event.currentTarget.checked })
                                }
                            />
                            Hiện gợi ý vùng chạm
                        </label>
                    </>
                )}
            </fieldset>
        </section>
    );
}
