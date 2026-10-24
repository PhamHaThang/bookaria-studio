import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Box,
    CircleHelp,
    Copy,
    Download,
    Eye,
    EyeOff,
    Image,
    Layers,
    LockKeyhole,
    MousePointer2,
    Pencil,
    QrCode,
    Redo2,
    RefreshCw,
    Save,
    Send,
    Settings2,
    Tag,
    Trash2,
    Type,
    Undo2,
    Upload,
    Video,
    Volume2,
    X,
    Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset, BookDetail, Page } from '../../../shared/contracts/dto.schema';
import {
    getSceneWarnings,
    SCENE_LIMITS,
    type SceneObject,
    type SceneObjectType,
    SceneSchema,
} from '../../../shared/contracts/scene.schema';
import { BookariaLogo } from '../../../shared/ui/BookariaLogo';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { PreviewPanel } from '../../preview/ui/PreviewPanel';
import { PublicationPanel } from '../../publication/ui/PublicationPanel';
import {
    addObject,
    duplicateObject,
    moveObject,
    newObject,
    objectAssetTypes,
    objectLabels,
    removeObject,
    replaceObjectAsset,
    usesAsset,
} from '../model/objects';
import { useSceneAssets } from '../model/use-scene-assets';
import { useSceneDraft } from '../model/use-scene-draft';
import { AssetPicker } from './AssetPicker';
import { InteractionEditor } from './InteractionEditor';
import { NavigationGuard } from './NavigationGuard';
import { ObjectEditor } from './ObjectEditor';
import { PageSettingsEditor } from './PageSettingsEditor';
import { PageStrip } from './PageStrip';
import { SceneCanvas } from './SceneCanvas';
import './scene.css';
import './assemblr.css';

export function SceneEditor({
    page,
    book,
    disabled,
    onBusyChange,
    onRecognition,
}: {
    page: Page;
    book: BookDetail;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
    onRecognition: () => void;
}) {
    const editor = useSceneDraft(page);
    const [selectedId, setSelectedId] = useState(page.scene.objects[0]?.id || '');
    const [picker, setPicker] = useState<{
        type: keyof typeof objectAssetTypes;
        replace?: string;
    } | null>(null);
    const [assets, setAssets] = useState<Record<string, Asset>>({}),
        [error, setError] = useState<string | null>(null);
    const [panel, setPanel] = useState<'properties' | 'interactions' | 'settings' | 'preview'>(
        'properties',
    );
    const [layersOpen, setLayersOpen] = useState(false),
        [helpOpen, setHelpOpen] = useState(false),
        [publishOpen, setPublishOpen] = useState(false),
        [publicationBusy, setPublicationBusy] = useState(false);
    const [layerSearch, setLayerSearch] = useState('');
    const [pagesBusy, setPagesBusy] = useState(false);
    const importFile = useRef<HTMLInputElement>(null);
    const [deleting, setDeleting] = useState<SceneObject | null>(null),
        [resetting, setResetting] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false),
        [settingsBusy, setSettingsBusy] = useState(false);
    useEffect(() => {
        onBusyChange(editor.busy || settingsBusy || publicationBusy || pagesBusy);
        return () => onBusyChange(false);
    }, [editor.busy, settingsBusy, publicationBusy, pagesBusy, onBusyChange]);
    const blocked =
        disabled || editor.busy || settingsBusy || publicationBusy || pagesBusy || editor.uncertain;
    const selected = editor.draft.objects.find((object) => object.id === selectedId);
    const sceneAssets = useSceneAssets(editor.draft, { ...page.assets, ...assets });
    const validation = SceneSchema.safeParse(editor.draft);
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
            setPanel('properties');
            setError(null);
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    const commands = useRef({ editor, blocked, selected });
    commands.current = { editor, blocked, selected };
    useEffect(() => {
        function keyboard(event: KeyboardEvent) {
            if (document.getElementById('scene-heading')?.closest('[hidden]')) return;
            const state = commands.current;
            const typing = (event.target as HTMLElement)?.closest(
                'input,textarea,select,[contenteditable="true"]',
            );
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!state.blocked) void state.editor.save();
                return;
            }
            if (typing || state.blocked) return;
            if (modifier && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) state.editor.redo();
                else state.editor.undo();
            }
            if (modifier && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                state.editor.redo();
            }
            if (
                modifier &&
                event.key.toLowerCase() === 'd' &&
                state.selected &&
                !state.selected.locked
            ) {
                event.preventDefault();
                if (state.editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects) return;
                const id = crypto.randomUUID(),
                    sourceId = state.selected.id;
                state.editor.setDraft((current) => duplicateObject(current, sourceId, id));
                setSelectedId(id);
            }
            if (
                (event.key === 'Delete' || event.key === 'Backspace') &&
                state.selected &&
                !state.selected.locked
            ) {
                event.preventDefault();
                setDeleting(state.selected);
            }
            if (event.key === 'Escape') setSelectedId('');
        }
        window.addEventListener('keydown', keyboard);
        return () => window.removeEventListener('keydown', keyboard);
    }, []);
    function exportScene() {
        const blob = new Blob([JSON.stringify({ pageId: page.id, scene: editor.draft }, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob),
            link = document.createElement('a');
        link.href = url;
        link.download = `bookaria-scene-${page.id}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return (
        <section
            className="scene-editor"
            data-panel={panel}
            data-layers={layersOpen}
            aria-labelledby="scene-heading"
        >
            <NavigationGuard
                dirty={editor.dirty || settingsDirty || editor.uncertain}
                saving={editor.busy || settingsBusy || publicationBusy || pagesBusy}
            />
            <header className="scene-heading editor-header">
                <div className="editor-project">
                    <Link
                        to="/books"
                        className="editor-brand"
                        aria-label="Bookaria Studio — Sách của tôi"
                    >
                        <BookariaLogo symbol />
                    </Link>
                    <Link
                        to={`/books/${book.id}`}
                        className="editor-back"
                        aria-label="Về cuốn sách"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 id="scene-heading">{book.title}</h1>
                        <p>
                            Trang {page.orderIndex + 1} ·{' '}
                            {editor.dirty ? 'Chưa lưu thay đổi' : 'Đã lưu nội dung'}
                        </p>
                    </div>
                </div>
                <fieldset className="editor-mode-switch" aria-label="Chế độ editor">
                    <Button
                        variant="ghost"
                        aria-pressed={panel !== 'preview'}
                        onClick={() => setPanel('properties')}
                    >
                        <Pencil size={17} />
                        Chỉnh sửa
                    </Button>
                    <Button
                        variant="ghost"
                        aria-pressed={panel === 'preview'}
                        onClick={() => setPanel('preview')}
                    >
                        <Eye size={17} />
                        Xem trước
                    </Button>
                </fieldset>
                <div className="form-actions editor-save-actions">
                    <Button
                        variant="ghost"
                        aria-label="Hoàn tác (Ctrl Z)"
                        title="Hoàn tác (Ctrl Z)"
                        disabled={blocked || !editor.canUndo}
                        onClick={editor.undo}
                    >
                        <Undo2 size={18} />
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Làm lại (Ctrl Shift Z)"
                        title="Làm lại (Ctrl Shift Z)"
                        disabled={blocked || !editor.canRedo}
                        onClick={editor.redo}
                    >
                        <Redo2 size={18} />
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Xuất bản sao scene JSON"
                        title="Xuất bản sao scene JSON"
                        onClick={exportScene}
                    >
                        <Download size={18} />
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Nhập scene JSON"
                        title="Nhập scene JSON"
                        disabled={blocked}
                        onClick={() => importFile.current?.click()}
                    >
                        <Upload size={18} />
                    </Button>
                    <input
                        ref={importFile}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={async (event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = '';
                            if (!file) return;
                            try {
                                if (file.size > 1024 * 1024)
                                    throw new Error('Tệp JSON tối đa 1 MB.');
                                const data = JSON.parse(await file.text());
                                const parsed = SceneSchema.parse(data.scene ?? data);
                                if (commands.current.blocked) return;
                                editor.setDraft(parsed);
                                setSelectedId(parsed.objects[0]?.id || '');
                                setError(null);
                            } catch {
                                setError(
                                    'Không nhập được scene. Hãy dùng bản JSON hợp lệ được xuất từ Bookaria (tối đa 1 MB).',
                                );
                            }
                        }}
                    />
                    <Button
                        aria-label="Lưu nội dung"
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
                        <Save size={17} /> Lưu
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Tải nội dung mới nhất"
                        title="Tải nội dung mới nhất"
                        disabled={blocked}
                        onClick={() => setResetting(true)}
                    >
                        <RefreshCw size={18} />
                    </Button>
                </div>
                <Button
                    className="editor-publish"
                    disabled={blocked || editor.dirty || settingsDirty}
                    title={
                        editor.dirty || settingsDirty
                            ? 'Lưu thay đổi trước khi xuất bản'
                            : 'Kiểm tra và xuất bản sách'
                    }
                    onClick={() => setPublishOpen(true)}
                >
                    <Send size={17} />
                    Xuất bản
                </Button>
            </header>
            <Feedback error={error || editor.error} success={editor.notice} />
            {!validation.success && (
                <Feedback
                    error={`Nội dung chưa hợp lệ${typeof validation.error.issues[0]?.path[1] === 'number' ? ` ở ${validation.error.issues[0].path[0] === 'interactions' ? 'quy tắc' : 'đối tượng'} ${Number(validation.error.issues[0].path[1]) + 1}` : ''}: ${validation.error.issues[0]?.message || 'Kiểm tra các trường đang nhập.'}`}
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
            <div className="workbench-body">
                <div className="scene-add" role="toolbar" aria-label="Thêm đối tượng">
                    {(
                        [
                            { type: 'model', icon: Box },
                            { type: 'image', icon: Image },
                            { type: 'text', icon: Type },
                            { type: 'video', icon: Video },
                            { type: 'audio', icon: Volume2 },
                            { type: 'hotspot', icon: MousePointer2 },
                            { type: 'label', icon: Tag },
                        ] as const
                    ).map((item) => (
                        <Button
                            key={item.type}
                            variant="ghost"
                            disabled={
                                blocked ||
                                editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects
                            }
                            onClick={() => {
                                if (usesAsset(item.type)) setPicker({ type: item.type });
                                else insert(item.type);
                            }}
                        >
                            <item.icon size={18} />
                            {objectLabels[item.type]}
                        </Button>
                    ))}
                    <span className="rail-separator" />
                    <Button
                        variant="ghost"
                        aria-label="Mở tương tác"
                        title="Tương tác"
                        onClick={() => setPanel('interactions')}
                    >
                        <Zap size={22} />
                        <span>Tương tác</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Trang và nhận diện AR"
                        title="Trang và nhận diện AR"
                        disabled={blocked}
                        onClick={onRecognition}
                    >
                        <QrCode size={22} />
                        <span>AR Marker</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Cài đặt trang"
                        title="Cài đặt trang"
                        onClick={() => setPanel('settings')}
                    >
                        <Settings2 size={22} />
                        <span>Cài đặt</span>
                    </Button>
                    <Button
                        variant="ghost"
                        aria-label="Hướng dẫn editor"
                        title="Hướng dẫn editor"
                        onClick={() => setHelpOpen(true)}
                    >
                        <CircleHelp size={22} />
                        <span>Trợ giúp</span>
                    </Button>
                </div>
                <div className="scene-workspace">
                    <section
                        className="scene-layers"
                        aria-labelledby="layers-heading"
                        hidden={!layersOpen}
                    >
                        <button
                            className="layers-close"
                            type="button"
                            aria-label="Đóng danh sách đối tượng"
                            onClick={() => setLayersOpen(false)}
                        >
                            <X size={16} />
                        </button>
                        <h3 id="layers-heading">
                            Đối tượng <span>{editor.draft.objects.length}</span>
                        </h3>
                        <label className="layer-search">
                            <span className="sr-only">Tìm đối tượng</span>
                            <input
                                type="search"
                                placeholder="Tìm đối tượng…"
                                value={layerSearch}
                                onChange={(event) => setLayerSearch(event.currentTarget.value)}
                            />
                        </label>
                        {editor.draft.objects.length === 0 && (
                            <p>Chưa có đối tượng. Thêm văn bản hoặc chọn tài nguyên để bắt đầu.</p>
                        )}
                        <ol>
                            {editor.draft.objects.map((object, index) => (
                                <li
                                    hidden={
                                        Boolean(layerSearch) &&
                                        !(object.name || objectLabels[object.type])
                                            .toLocaleLowerCase()
                                            .includes(layerSearch.toLocaleLowerCase())
                                    }
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
                    <SceneCanvas
                        page={page}
                        aspect={book.pageAspect}
                        scene={editor.draft}
                        assets={sceneAssets}
                        selectedId={selected?.id}
                        disabled={blocked}
                        onSelect={setSelectedId}
                        onChange={change}
                        onBegin={editor.begin}
                        onEnd={editor.end}
                        footer={
                            <div className="editor-footer-actions">
                                <Button
                                    variant="ghost"
                                    aria-pressed={layersOpen}
                                    onClick={() => setLayersOpen(!layersOpen)}
                                >
                                    <Layers size={18} />
                                    Đối tượng ({editor.draft.objects.length})
                                </Button>
                                <Button variant="ghost" onClick={() => setHelpOpen(true)}>
                                    Phím tắt
                                </Button>
                            </div>
                        }
                    />
                    <aside className="workbench-panel" aria-label="Bảng chỉnh sửa">
                        <div className="workbench-tabs" role="tablist" aria-label="Bảng công cụ">
                            {(
                                [
                                    ['properties', 'Thuộc tính'],
                                    ['interactions', 'Tương tác'],
                                    ['settings', 'Cài đặt'],
                                    ['preview', 'Xem thử'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    id={`panel-tab-${value}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={panel === value}
                                    aria-controls={`panel-${value}`}
                                    tabIndex={panel === value ? 0 : -1}
                                    onKeyDown={(event) => {
                                        const tabs = [
                                            'properties',
                                            'interactions',
                                            'settings',
                                            'preview',
                                        ] as const;
                                        const index = tabs.indexOf(value);
                                        const next =
                                            event.key === 'ArrowRight'
                                                ? tabs[(index + 1) % tabs.length]
                                                : event.key === 'ArrowLeft'
                                                  ? tabs[(index + tabs.length - 1) % tabs.length]
                                                  : event.key === 'Home'
                                                    ? tabs[0]
                                                    : event.key === 'End'
                                                      ? tabs.at(-1)
                                                      : undefined;
                                        if (next) {
                                            event.preventDefault();
                                            setPanel(next);
                                            document.getElementById(`panel-tab-${next}`)?.focus();
                                        }
                                    }}
                                    onClick={() => setPanel(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div
                            id="panel-properties"
                            role="tabpanel"
                            aria-labelledby="panel-tab-properties"
                            hidden={panel !== 'properties'}
                        >
                            {selected ? (
                                <ObjectEditor
                                    key={selected.id}
                                    object={selected}
                                    assetRef={
                                        'assetId' in selected
                                            ? assets[selected.assetId] ||
                                              page.assets[selected.assetId]
                                            : undefined
                                    }
                                    disabled={blocked}
                                    onChange={change}
                                    onDuplicate={() => {
                                        if (
                                            editor.draft.objects.length >=
                                            SCENE_LIMITS.hardMaxObjects
                                        ) {
                                            setError('Trang đã đạt giới hạn đối tượng.');
                                            return;
                                        }
                                        const id = crypto.randomUUID();
                                        editor.setDraft((current) =>
                                            duplicateObject(current, selected.id, id),
                                        );
                                        setSelectedId(id);
                                    }}
                                    onDelete={() => setDeleting(selected)}
                                    onChooseAsset={() => {
                                        if (usesAsset(selected.type))
                                            setPicker({
                                                type: selected.type,
                                                replace: selected.id,
                                            });
                                    }}
                                />
                            ) : (
                                <p className="scene-no-selection">
                                    Thuộc tính sẽ xuất hiện khi bạn thêm hoặc chọn một đối tượng.
                                </p>
                            )}
                        </div>
                        <div
                            id="panel-interactions"
                            role="tabpanel"
                            aria-labelledby="panel-tab-interactions"
                            hidden={panel !== 'interactions'}
                        >
                            {(warnings.length > 0 ||
                                (!editor.dirty && editor.warnings.length > 0)) && (
                                <div className="scene-warnings">
                                    <h3>Gợi ý trước khi xuất bản</h3>
                                    <ul>
                                        {[
                                            ...new Map(
                                                [
                                                    ...warnings,
                                                    ...(!editor.dirty ? editor.warnings : []),
                                                ].map((warning) => [
                                                    `${warning.code}-${warning.objectId || ''}`,
                                                    warning,
                                                ]),
                                            ).values(),
                                        ].map((warning) => (
                                            <li key={`${warning.code}-${warning.objectId || ''}`}>
                                                {warning.message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <InteractionEditor
                                scene={editor.draft}
                                assets={sceneAssets}
                                disabled={blocked}
                                onChange={(scene) => editor.setDraft(scene)}
                            />
                        </div>
                        <div
                            id="panel-settings"
                            role="tabpanel"
                            aria-labelledby="panel-tab-settings"
                            hidden={panel !== 'settings'}
                        >
                            <PageSettingsEditor
                                page={page}
                                disabled={disabled || editor.busy || editor.uncertain}
                                onDirtyChange={setSettingsDirty}
                                onBusyChange={setSettingsBusy}
                            />
                        </div>
                        <div
                            id="panel-preview"
                            role="tabpanel"
                            aria-labelledby="panel-tab-preview"
                            hidden={panel !== 'preview'}
                        >
                            <PreviewPanel
                                page={page}
                                book={book}
                                scene={editor.draft}
                                disabled={blocked || settingsDirty}
                                unsaved={editor.dirty || settingsDirty}
                            />
                        </div>
                    </aside>
                </div>
            </div>
            <PageStrip
                bookId={book.id}
                pageId={page.id}
                pageAspect={book.pageAspect}
                dirty={editor.dirty || settingsDirty}
                disabled={blocked}
                onBusyChange={setPagesBusy}
            />
            {helpOpen && (
                <ConfirmDialog
                    title="Thao tác trong editor"
                    busy={false}
                    onClose={() => setHelpOpen(false)}
                >
                    <dl className="editor-shortcuts">
                        <dt>Chọn đối tượng</dt>
                        <dd>Nhấp trên canvas hoặc mở Đối tượng</dd>
                        <dt>Di chuyển / xoay / kích thước</dt>
                        <dd>W / E / R</dd>
                        <dt>Đưa đối tượng vào giữa</dt>
                        <dd>F</dd>
                        <dt>Hoàn tác / làm lại</dt>
                        <dd>Ctrl Z / Ctrl Shift Z</dd>
                        <dt>Nhân bản</dt>
                        <dd>Ctrl D</dd>
                        <dt>Xóa đối tượng</dt>
                        <dd>Delete</dd>
                        <dt>Lưu nội dung</dt>
                        <dd>Ctrl S</dd>
                        <dt>Bỏ chọn</dt>
                        <dd>Esc</dd>
                    </dl>
                    <p>
                        Kéo vùng trống để xoay góc nhìn; cuộn chuột để thu/phóng; kéo chuột phải để
                        dịch góc nhìn. Trên macOS, dùng ⌘ thay cho Ctrl.
                    </p>
                    <Button onClick={() => setHelpOpen(false)}>Đã hiểu</Button>
                </ConfirmDialog>
            )}
            {publishOpen && (
                <ConfirmDialog
                    className="editor-publication-dialog"
                    title="Xuất bản sách"
                    busy={publicationBusy}
                    onClose={() => setPublishOpen(false)}
                >
                    <PublicationPanel
                        book={book}
                        disabled={disabled || editor.busy || editor.uncertain}
                        unsaved={editor.dirty || settingsDirty}
                        onBusyChange={setPublicationBusy}
                    />
                </ConfirmDialog>
            )}
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
