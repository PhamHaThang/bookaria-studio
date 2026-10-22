import clsx from 'clsx';
import { ArrowDown, ArrowUp, Box, Copy, EyeOff, LockKeyhole, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset, BookDetail, Page } from '../../../shared/contracts/dto.schema';
import {
    findSceneReferenceIssues,
    getSceneWarnings,
    SCENE_LIMITS,
    type SceneObject,
    type SceneObjectType,
    SceneSchema,
} from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import {
    addObject,
    duplicateObject,
    moveObject,
    newObject,
    objectAssetTypes,
    objectLabels,
    previewPosition,
    removeObject,
    replaceObjectAsset,
    usesAsset,
} from '../model/objects';
import { useSceneDraft } from '../model/use-scene-draft';
import { AssetPicker } from './AssetPicker';
import { NavigationGuard } from './NavigationGuard';
import { ObjectEditor } from './ObjectEditor';
import { PageSettingsEditor } from './PageSettingsEditor';
import './scene.css';

export function SceneEditor({
    page,
    book,
    disabled,
    onBusyChange,
}: {
    page: Page;
    book: BookDetail;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const editor = useSceneDraft(page);
    const [selectedId, setSelectedId] = useState(page.scene.objects[0]?.id || '');
    const [kind, setKind] = useState<SceneObjectType>('text'),
        [picker, setPicker] = useState<{
            type: keyof typeof objectAssetTypes;
            replace?: string;
        } | null>(null);
    const [assets, setAssets] = useState<Record<string, Asset>>({}),
        [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<SceneObject | null>(null),
        [resetting, setResetting] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false),
        [settingsBusy, setSettingsBusy] = useState(false);
    useEffect(() => {
        onBusyChange(editor.busy || settingsBusy);
        return () => onBusyChange(false);
    }, [editor.busy, settingsBusy, onBusyChange]);
    const blocked = disabled || editor.busy || settingsBusy || editor.uncertain;
    const selected =
        editor.draft.objects.find((object) => object.id === selectedId) || editor.draft.objects[0];
    const validation = SceneSchema.safeParse(editor.draft);
    const referenceIssues = findSceneReferenceIssues(editor.draft);
    const warnings = getSceneWarnings(editor.draft, { pageAspect: book.pageAspect });
    function change(object: SceneObject) {
        editor.setDraft((current) => ({
            ...current,
            objects: current.objects.map((item) => (item.id === object.id ? object : item)),
        }));
        setError(null);
    }
    function insert(type: SceneObjectType, asset?: Asset) {
        try {
            const object = newObject(type, crypto.randomUUID(), asset);
            editor.setDraft((current) => addObject(current, object));
            setSelectedId(object.id);
            setError(null);
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <section className="scene-editor" aria-labelledby="scene-heading">
            <NavigationGuard
                dirty={editor.dirty || settingsDirty || editor.uncertain}
                saving={editor.busy || settingsBusy}
            />
            <div className="scene-heading">
                <div>
                    <h2 id="scene-heading">Nội dung AR của trang</h2>
                    <p>
                        {editor.draft.objects.length} / {SCENE_LIMITS.hardMaxObjects} đối tượng ·{' '}
                        {editor.dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ nội dung'}
                    </p>
                </div>
                <div className="form-actions">
                    <Button
                        loading={editor.busy}
                        disabled={
                            disabled ||
                            settingsBusy ||
                            !editor.dirty ||
                            !validation.success ||
                            editor.conflict ||
                            editor.uncertain
                        }
                        onClick={() => {
                            void editor.save();
                        }}
                    >
                        Lưu nội dung
                    </Button>
                    <Button variant="ghost" disabled={blocked} onClick={() => setResetting(true)}>
                        Tải nội dung mới nhất
                    </Button>
                </div>
            </div>
            <Feedback error={error || editor.error} success={editor.notice} />
            {!validation.success && (
                <Feedback
                    error={`Nội dung chưa hợp lệ${typeof validation.error.issues[0]?.path[1] === 'number' ? ` ở đối tượng ${Number(validation.error.issues[0].path[1]) + 1}` : ''}: ${validation.error.issues[0]?.message || 'Kiểm tra các trường đang nhập.'}`}
                />
            )}
            {(editor.conflict || editor.uncertain) && (
                <div className="scene-reconcile">
                    <p>
                        {editor.uncertain
                            ? 'Chưa xác nhận được kết quả lưu. Hãy kiểm tra trước khi tiếp tục chỉnh sửa hoặc gửi lại.'
                            : 'Máy chủ có nội dung mới hơn. Bản đang sửa vẫn được giữ; tải bản sao trước khi chọn tải nội dung mới nhất.'}
                    </p>
                    <div className="form-actions">
                        {editor.uncertain && (
                            <Button
                                variant="secondary"
                                loading={editor.busy}
                                disabled={disabled || settingsBusy}
                                onClick={() => {
                                    void editor.readLatest(false);
                                }}
                            >
                                Kiểm tra kết quả lưu
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            disabled={!validation.success || editor.busy}
                            onClick={() => {
                                if (!validation.success) return;
                                const blob = new Blob(
                                    [
                                        JSON.stringify(
                                            { pageId: page.id, scene: validation.data },
                                            null,
                                            2,
                                        ),
                                    ],
                                    { type: 'application/json' },
                                );
                                const url = URL.createObjectURL(blob),
                                    link = document.createElement('a');
                                link.href = url;
                                link.download = `bookaria-scene-${page.id}.json`;
                                link.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }}
                        >
                            Tải bản đang sửa
                        </Button>
                        {editor.conflict && (
                            <Button
                                variant="secondary"
                                disabled={editor.busy || disabled || settingsBusy}
                                onClick={() => setResetting(true)}
                            >
                                Tải nội dung mới nhất
                            </Button>
                        )}
                    </div>
                </div>
            )}
            <div className="scene-add">
                <label htmlFor="scene-new-kind">
                    Loại đối tượng
                    <select
                        id="scene-new-kind"
                        value={kind}
                        disabled={blocked}
                        onChange={(event) => setKind(event.currentTarget.value as SceneObjectType)}
                    >
                        {Object.entries(objectLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    variant="secondary"
                    disabled={blocked || editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects}
                    onClick={() => {
                        if (usesAsset(kind)) setPicker({ type: kind });
                        else insert(kind);
                    }}
                >
                    Thêm đối tượng
                </Button>
            </div>
            <div className="scene-workspace">
                <section className="scene-layers" aria-labelledby="layers-heading">
                    <h3 id="layers-heading">Đối tượng trên trang</h3>
                    {editor.draft.objects.length === 0 && (
                        <p>Chưa có đối tượng. Thêm văn bản hoặc chọn tài nguyên để bắt đầu.</p>
                    )}
                    <ol>
                        {editor.draft.objects.map((object, index) => (
                            <li
                                key={object.id}
                                className={selected?.id === object.id ? 'is-selected' : ''}
                            >
                                <button
                                    type="button"
                                    className="scene-layer-select"
                                    aria-pressed={selected?.id === object.id}
                                    disabled={blocked}
                                    onClick={() => setSelectedId(object.id)}
                                >
                                    <span>{object.name || objectLabels[object.type]}</span>
                                    <small>
                                        {objectLabels[object.type]}
                                        {!object.visible ? ' · Ẩn khi mở trang' : ''}
                                    </small>
                                    {object.locked && (
                                        <LockKeyhole size={16} aria-label="Đã khóa" />
                                    )}
                                    {object.editorHidden && (
                                        <EyeOff size={16} aria-label="Ẩn khỏi sơ đồ" />
                                    )}
                                </button>
                                <div className="scene-layer-actions">
                                    <Button
                                        variant="ghost"
                                        disabled={blocked || object.locked || index === 0}
                                        aria-label={`Đưa đối tượng ${index + 1} lên`}
                                        onClick={() =>
                                            editor.setDraft((current) =>
                                                moveObject(current, object.id, -1),
                                            )
                                        }
                                    >
                                        <ArrowUp size={16} aria-hidden="true" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        disabled={
                                            blocked ||
                                            object.locked ||
                                            index === editor.draft.objects.length - 1
                                        }
                                        aria-label={`Đưa đối tượng ${index + 1} xuống`}
                                        onClick={() =>
                                            editor.setDraft((current) =>
                                                moveObject(current, object.id, 1),
                                            )
                                        }
                                    >
                                        <ArrowDown size={16} aria-hidden="true" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        disabled={
                                            blocked ||
                                            object.locked ||
                                            editor.draft.objects.length >=
                                                SCENE_LIMITS.hardMaxObjects
                                        }
                                        aria-label={`Nhân bản đối tượng ${index + 1}`}
                                        onClick={() => {
                                            const id = crypto.randomUUID();
                                            editor.setDraft((current) =>
                                                duplicateObject(current, object.id, id),
                                            );
                                            setSelectedId(id);
                                        }}
                                    >
                                        <Copy size={16} aria-hidden="true" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        disabled={blocked || object.locked}
                                        aria-label={`Xóa đối tượng ${index + 1}`}
                                        onClick={() => setDeleting(object)}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
                <div className="scene-map-column">
                    <h3>Sơ đồ vị trí</h3>
                    <p className="field-hint">
                        Mốc tâm của đối tượng nhìn từ trên. Chọn mốc hoặc hàng trong danh sách để
                        sửa; sơ đồ chưa mô phỏng hình dạng 3D.
                    </p>
                    <div className="scene-map" style={{ aspectRatio: `1 / ${book.pageAspect}` }}>
                        <img src={page.image.url} alt="Ảnh trang làm nền cho sơ đồ" />
                        {editor.draft.objects
                            .filter((object) => !object.editorHidden)
                            .map((object) => {
                                const point = previewPosition(object, book.pageAspect);
                                return point ? (
                                    <button
                                        type="button"
                                        key={object.id}
                                        className={clsx('scene-map-point', {
                                            'is-selected': selected?.id === object.id,
                                            'is-hidden': !object.visible,
                                        })}
                                        style={{ left: `${point.left}%`, top: `${point.top}%` }}
                                        disabled={blocked}
                                        aria-label={`Chọn vị trí ${object.name || objectLabels[object.type]}`}
                                        onClick={() => setSelectedId(object.id)}
                                    >
                                        <Box size={18} aria-hidden="true" />
                                        <span>{object.name || objectLabels[object.type]}</span>
                                    </button>
                                ) : null;
                            })}
                    </div>
                </div>
                {selected ? (
                    <ObjectEditor
                        key={selected.id}
                        object={selected}
                        assetRef={
                            'assetId' in selected
                                ? assets[selected.assetId] || page.assets[selected.assetId]
                                : undefined
                        }
                        disabled={blocked}
                        onChange={change}
                        onChooseAsset={() => {
                            if (usesAsset(selected.type))
                                setPicker({ type: selected.type, replace: selected.id });
                        }}
                    />
                ) : (
                    <p className="scene-no-selection">
                        Thuộc tính sẽ xuất hiện khi bạn thêm hoặc chọn một đối tượng.
                    </p>
                )}
            </div>
            {(warnings.length > 0 || (!editor.dirty && editor.warnings.length > 0)) && (
                <div className="scene-warnings">
                    <h3>Gợi ý trước khi xuất bản</h3>
                    <ul>
                        {[
                            ...new Map(
                                [...warnings, ...(!editor.dirty ? editor.warnings : [])].map(
                                    (warning) => [
                                        `${warning.code}-${warning.objectId || ''}`,
                                        warning,
                                    ],
                                ),
                            ).values(),
                        ].map((warning) => (
                            <li key={`${warning.code}-${warning.objectId || ''}`}>
                                {warning.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <section className="scene-interactions">
                <h3>Tương tác hiện có</h3>
                <p>
                    {editor.draft.interactions.length} quy tắc được giữ nguyên khi lưu. Phần chỉnh
                    quy tắc “khi chạm thì…” sẽ được bổ sung tiếp.
                </p>
                {referenceIssues.length > 0 && (
                    <>
                        <p className="scene-reference-error">
                            Có quy tắc trỏ tới đối tượng không còn phù hợp. Có thể lưu bản nháp; cần
                            sửa quy tắc trước khi xuất bản.
                        </p>
                        <ul>
                            {referenceIssues.map((issue) => (
                                <li
                                    key={`${issue.interactionId}-${issue.actionIndex ?? 'trigger'}`}
                                >
                                    {editor.draft.interactions.find(
                                        (rule) => rule.id === issue.interactionId,
                                    )?.name || 'Quy tắc chưa đặt tên'}
                                    : {issue.message}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
            <PageSettingsEditor
                page={page}
                disabled={disabled || editor.busy || editor.uncertain}
                onDirtyChange={setSettingsDirty}
                onBusyChange={setSettingsBusy}
            />
            {picker && (
                <AssetPicker
                    type={objectAssetTypes[picker.type]}
                    onClose={() => setPicker(null)}
                    onChoose={(asset) => {
                        setAssets((current) => ({ ...current, [asset.id]: asset }));
                        if (picker.replace) {
                            const object = editor.draft.objects.find(
                                (item) => item.id === picker.replace,
                            );
                            if (object) change(replaceObjectAsset(object, asset));
                        } else insert(picker.type, asset);
                        setPicker(null);
                    }}
                />
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa đối tượng khỏi trang?"
                    busy={false}
                    onClose={() => setDeleting(null)}
                >
                    <p>
                        Đối tượng “{deleting.name || objectLabels[deleting.type]}” sẽ bị bỏ khỏi bản
                        đang sửa. Tệp tài nguyên vẫn được giữ. Quy tắc tương tác liên quan sẽ được
                        giữ và đánh dấu để bạn sửa.
                    </p>
                    <div className="form-actions">
                        <Button variant="secondary" onClick={() => setDeleting(null)}>
                            Giữ đối tượng
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                editor.setDraft((current) => removeObject(current, deleting.id));
                                setDeleting(null);
                            }}
                        >
                            Xóa đối tượng
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
            {resetting && (
                <ConfirmDialog
                    title="Tải nội dung mới nhất?"
                    busy={editor.busy}
                    onClose={() => {
                        if (!editor.busy) setResetting(false);
                    }}
                >
                    <p>
                        {editor.dirty
                            ? 'Bản đang sửa sẽ được thay bằng nội dung từ máy chủ. Cài đặt âm thanh và ánh sáng chưa lưu vẫn được giữ.'
                            : 'Lấy lại nội dung đối tượng và quy tắc đang lưu trên máy chủ.'}
                    </p>
                    <div className="form-actions">
                        <Button
                            variant="secondary"
                            disabled={editor.busy}
                            onClick={() => setResetting(false)}
                        >
                            Giữ bản đang sửa
                        </Button>
                        <Button
                            loading={editor.busy}
                            onClick={async () => {
                                await editor.readLatest(true);
                                setResetting(false);
                            }}
                        >
                            Xác nhận tải nội dung
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </section>
    );
}
