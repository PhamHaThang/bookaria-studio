import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Box,
    ChevronDown,
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
import { Alert } from '@/shared/ui/Alert';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { SearchInput } from '@/shared/ui/SearchInput';
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
import { BookInfoDialog } from '../../books/ui/BookInfoDialog';
import { PreviewPanel } from '../../preview/ui/PreviewPanel';
import { PublicationPanel } from '../../publication/ui/PublicationPanel';
import { type AnnotationObject, placeAnnotation } from '../model/annotation-placement';
import {
    addObject,
    duplicateObject,
    moveObject,
    newObject,
    objectAssetTypes,
    objectLabels,
    replaceObjectAsset,
    usesAsset,
} from '../model/objects';
import {
    duplicateSelection,
    removeSelection,
    type SelectionMode,
    setSelectionFlag,
    updateSelection,
} from '../model/selection';
import { useSceneAssets } from '../model/use-scene-assets';
import { useSceneDraft } from '../model/use-scene-draft';
import { AssetPicker } from './AssetPicker';
import { InteractionEditor } from './InteractionEditor';
import { NavigationGuard } from './NavigationGuard';
import { ObjectEditor } from './ObjectEditor';
import { PageSettingsEditor } from './PageSettingsEditor';
import { PageStrip } from './PageStrip';
import { SceneCanvas, type SceneCanvasHandle } from './SceneCanvas';
import { SelectionEditor } from './SelectionEditor';
import { TextComposer, type TextMode, type TextualObject } from './TextComposer';

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
    const [selectedIds, setSelectedIds] = useState<string[]>(
        page.scene.objects[0] ? [page.scene.objects[0].id] : [],
    );
    const [transforming, setTransforming] = useState(false);
    function setSelectedId(id: string) {
        setSelectedIds(id ? [id] : []);
    }
    const [textDialog, setTextDialog] = useState<{
        start: TextMode;
        initial?: TextualObject;
        placement?: AnnotationObject;
    } | null>(null);
    const annotationPlacement = textDialog?.placement;
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
    const [pagesDirty, setPagesDirty] = useState(false);
    const [infoOpen, setInfoOpen] = useState(false),
        [infoBusy, setInfoBusy] = useState(false),
        [infoDirty, setInfoDirty] = useState(false);
    const infoAnchor = useRef<HTMLButtonElement | null>(null);
    const importFile = useRef<HTMLInputElement>(null);
    const [deleting, setDeleting] = useState<SceneObject[] | null>(null),
        [resetting, setResetting] = useState(false);
    const [settingsDirty, setSettingsDirty] = useState(false),
        [settingsBusy, setSettingsBusy] = useState(false);
    useEffect(() => {
        onBusyChange(
            editor.busy || settingsBusy || publicationBusy || pagesBusy || infoBusy || transforming,
        );
        return () => onBusyChange(false);
    }, [
        editor.busy,
        settingsBusy,
        publicationBusy,
        pagesBusy,
        infoBusy,
        transforming,
        onBusyChange,
    ]);
    const sceneBlocked =
        disabled ||
        editor.busy ||
        settingsBusy ||
        publicationBusy ||
        pagesBusy ||
        infoBusy ||
        editor.uncertain;
    const blocked = sceneBlocked || transforming || Boolean(annotationPlacement);
    const selection = selectedIds.flatMap((id) => {
        const object = editor.draft.objects.find((item) => item.id === id);
        return object ? [object] : [];
    });
    const activeIds = selection.map((object) => object.id);
    const selected = selection.at(-1);
    function selectMany(ids: string[], mode: SelectionMode = 'replace') {
        setSelectedIds((current) =>
            updateSelection(
                current.filter((id) => editor.draft.objects.some((item) => item.id === id)),
                ids,
                mode,
            ),
        );
    }
    function chooseAll() {
        selectMany(
            editor.draft.objects
                .filter((object) => !object.locked && !object.editorHidden)
                .map((object) => object.id),
        );
    }
    const sceneAssets = useSceneAssets(editor.draft, { ...page.assets, ...assets });
    const validation = SceneSchema.safeParse(editor.draft);
    const warnings = getSceneWarnings(editor.draft, { pageAspect: book.pageAspect });
    function changeMany(objects: SceneObject[]) {
        const replacements = new Map(objects.map((object) => [object.id, object]));
        editor.setDraft((current) => ({
            ...current,
            objects: current.objects.map((item) => replacements.get(item.id) || item),
        }));
        setError(null);
    }
    function change(object: SceneObject) {
        changeMany([object]);
    }
    function billboardChosen(enabled: boolean) {
        if (blocked || selection.some((object) => object.locked)) return;
        changeMany(
            selection.map((object) => {
                const rotation =
                    !enabled && object.billboard
                        ? commands.current.canvas?.getDisplayedRotation(object.id)
                        : undefined;
                return {
                    ...object,
                    billboard: enabled,
                    transform: {
                        ...object.transform,
                        rotation: rotation ?? object.transform.rotation,
                    },
                };
            }),
        );
    }
    function duplicateChosen(ids: string[]) {
        const state = commands.current;
        if (state.blocked) return;
        try {
            const copy = duplicateSelection(state.editor.draft, ids, () => crypto.randomUUID());
            state.editor.setDraft(copy.scene);
            setSelectedIds(copy.ids);
            setError(null);
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    function flagChosen(flag: 'locked' | 'editorHidden', value: boolean) {
        if (blocked) return;
        try {
            editor.setDraft((current) => setSelectionFlag(current, activeIds, flag, value));
            setError(null);
        } catch (cause) {
            setError(errorMessage(cause));
        }
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
    const commands = useRef({
        editor,
        blocked,
        selection,
        duplicateChosen,
        canvas: null as SceneCanvasHandle | null,
    });
    commands.current = {
        editor,
        blocked,
        selection,
        duplicateChosen,
        canvas: commands.current.canvas,
    };
    useEffect(() => {
        function keyboard(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                document.querySelector(
                    '[role=dialog], [role=alertdialog], [role=menu], [data-slot=select-content][data-state=open]',
                )
            )
                return;
            if (document.getElementById('scene-heading')?.closest('[hidden]')) return;
            const state = commands.current;
            const typing = (event.target as HTMLElement)?.closest(
                'input,textarea,select,[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[data-slot="accordion-trigger"],[contenteditable="true"]',
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
            if (modifier && event.key.toLowerCase() === 'a') {
                event.preventDefault();
                setSelectedIds(
                    state.editor.draft.objects
                        .filter((object) => !object.locked && !object.editorHidden)
                        .map((object) => object.id),
                );
            }
            if (modifier && event.key.toLowerCase() === 'd' && state.selection.length) {
                event.preventDefault();
                state.duplicateChosen(state.selection.map((object) => object.id));
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && state.selection.length) {
                event.preventDefault();
                if (!state.selection.some((object) => object.locked)) setDeleting(state.selection);
            }
            if (event.key === 'Escape') setSelectedIds([]);
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
            className="scene-editor m-0 min-h-[100dvh] bg-surface p-0 [--control-height:40px] [--text-md:0.8125rem] [--text-sm:0.75rem] [--text-xs:0.6875rem] [&_[data-slot=select-trigger]]:m-0 [&_audio]:my-3 [&_audio]:block [&_audio]:w-full [&_audio]:max-w-105 [&_input:not([type=checkbox])]:m-0 [&_label]:m-0 [&_textarea]:m-0 [.scene-editor_&_.button]:min-h-10 [.scene-editor_&_.button]:w-auto [.scene-editor_&_.button]:rounded-[10px] [.scene-editor_&_.button]:px-[13px] [.scene-editor_&_.button]:py-[9px] [.scene-editor_&_.button]:text-[length:12px]"
            data-panel={panel}
            data-layers={layersOpen}
            aria-labelledby="scene-heading"
        >
            <NavigationGuard
                dirty={
                    editor.dirty ||
                    settingsDirty ||
                    editor.uncertain ||
                    pagesDirty ||
                    infoDirty ||
                    Boolean(annotationPlacement)
                }
                dirtyDescription={
                    infoDirty
                        ? 'Thông tin và ảnh bìa bạn đang sửa chưa được lưu. Rời editor sẽ bỏ phần này.'
                        : pagesDirty
                          ? 'Tài liệu và tiến độ thêm trang chỉ được giữ trong tab hiện tại. Trang đã thêm vẫn ở trong sách; rời editor sẽ bỏ phần nhập còn lại.'
                          : undefined
                }
                saving={editor.busy || settingsBusy || publicationBusy || pagesBusy || infoBusy}
            />
            <header className="scene-heading editor-header flex flex-wrap items-start justify-between gap-4 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_p]:m-0 [&_p]:text-muted-foreground [.scene-editor_&]:m-0 [.scene-editor_&]:flex [.scene-editor_&]:min-h-19 [.scene-editor_&]:items-center [.scene-editor_&]:gap-[14px] [.scene-editor_&]:border-b-[1px] [.scene-editor_&]:border-b-border [.scene-editor_&]:px-5 [.scene-editor_&]:py-3 [.scene-editor_&]:[border-bottom-style:solid] max-[760px]:[.scene-editor_&]:grid max-[760px]:[.scene-editor_&]:min-h-28 max-[760px]:[.scene-editor_&]:grid-cols-[minmax(0,_1fr)_auto] max-[760px]:[.scene-editor_&]:flex-wrap max-[760px]:[.scene-editor_&]:gap-2 max-[760px]:[.scene-editor_&]:px-3 max-[760px]:[.scene-editor_&]:py-[10px]">
                <div className="editor-project mr-auto flex min-w-0 max-w-[30%] items-center gap-[13px] max-[1100px]:max-w-[23%] max-[760px]:max-w-[60%] max-[760px]:flex-[1] [&_>_div]:min-w-0 [&_h1]:m-0 [&_h1]:truncate [&_h1]:font-medium [&_h1]:text-[length:14px] [&_h1]:tracking-0 max-[760px]:[&_h1]:max-w-full max-[760px]:[&_h1]:text-[length:12px] [&_p]:mx-0 [&_p]:mt-[3px] [&_p]:mb-0 [&_p]:text-[length:10px] [&_p]:text-muted-foreground max-[760px]:[.scene-editor_&]:col-[1] max-[760px]:[.scene-editor_&]:row-[1] max-[760px]:[.scene-editor_&]:w-full max-[760px]:[.scene-editor_&]:max-w-full max-[760px]:[.scene-editor_&]:overflow-hidden max-[760px]:[.scene-editor_.editor-header_&]:col-[1_/_-1] max-[760px]:[.scene-editor_.editor-header_&]:w-[calc(100%_-_56px)] max-[760px]:[.scene-editor_.editor-header_&]:max-w-[calc(100%_-_56px)]">
                    <Link
                        to="/"
                        className="editor-brand inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] p-2 [&:hover]:bg-hover"
                        aria-label="Bookaria - Trang chủ"
                    >
                        <BookariaLogo symbol />
                    </Link>
                    <Link
                        to="/books"
                        className="editor-back rounded-[8px] p-2 text-muted-foreground [&:hover]:bg-hover"
                        aria-label="Về sách của tôi"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 id="scene-heading">
                            <ActionButton
                                variant="plain"
                                ref={infoAnchor}
                                className="inline-flex h-auto max-w-full items-center justify-start gap-2 p-0 text-left [font:inherit]"
                                aria-label="Thông tin sách"
                                title={
                                    editor.dirty || settingsDirty
                                        ? 'Lưu nội dung trước khi sửa thông tin sách'
                                        : 'Thông tin sách'
                                }
                                disabled={blocked || editor.dirty || settingsDirty}
                                onClick={() => setInfoOpen(true)}
                            >
                                <span className="truncate">{book.title}</span>
                                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                            </ActionButton>
                        </h1>
                        <p>
                            Trang {page.orderIndex + 1} ·{' '}
                            {editor.dirty ? 'Chưa lưu thay đổi' : 'Đã lưu nội dung'}
                        </p>
                    </div>
                </div>
                <fieldset
                    className="editor-mode-switch flex gap-1 rounded-[13px] bg-muted p-1 max-[760px]:m-auto max-[760px]:[order:4] max-[760px]:[.scene-editor_&]:col-[2] max-[760px]:[.scene-editor_&]:row-[2] max-[760px]:[.scene-editor_&]:m-0 max-[760px]:[.scene-editor_&]:p-[2px] [.scene-editor_&_.button[aria-pressed=true]]:bg-surface [.scene-editor_&_.button[aria-pressed=true]]:text-foreground [.scene-editor_&_.button[aria-pressed=true]]:shadow-[0_2px_5px_#00000008] [.scene-editor_&_.button]:min-h-9 [.scene-editor_&_.button]:text-muted-foreground max-[760px]:[.scene-editor_&_.button]:min-h-8 max-[760px]:[.scene-editor_&_.button]:gap-1 max-[760px]:[.scene-editor_&_.button]:p-[6px] max-[1100px]:[.scene-editor_&_.button]:px-2 max-[760px]:[.scene-editor_&_.button]:text-[length:10px] max-[760px]:[.scene-editor_&_svg]:w-[14px]"
                    aria-label="Chế độ editor"
                >
                    <Button
                        variant="outline"
                        aria-pressed={panel !== 'preview'}
                        onClick={() => setPanel('properties')}
                    >
                        <Pencil data-icon="inline-start" />
                        Chỉnh sửa
                    </Button>
                    <Button
                        variant="outline"
                        aria-pressed={panel === 'preview'}
                        disabled={Boolean(annotationPlacement)}
                        onClick={() => setPanel('preview')}
                    >
                        <Eye data-icon="inline-start" />
                        Xem trước
                    </Button>
                </fieldset>
                <div className="form-actions editor-save-actions mt-3 ml-auto flex flex-wrap flex-nowrap items-center gap-5 gap-[3px] max-[760px]:ml-0 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 [&_>_.button.primary:hover]:bg-hover [&_>_.button.primary]:gap-[7px] [&_>_.button.primary]:border [&_>_.button.primary]:border-border [&_>_.button.primary]:border-solid [&_>_.button.primary]:bg-surface [&_>_.button.primary]:px-[14px] [&_>_.button.primary]:text-[length:12px] [&_>_.button.primary]:text-foreground max-[1100px]:[&_>_.button:nth-child(3)]:hidden max-[1100px]:[&_>_.button:nth-child(4)]:hidden [&_>_.button]:min-w-9 [&_>_.button]:gap-0 [&_>_.button]:p-2 [&_>_.button]:text-[length:0] max-[760px]:[&_>_a]:text-center [&_>_input[hidden]]:hidden [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-editor_&]:w-auto [.scene-editor_&]:flex-row [.scene-editor_&]:flex-nowrap [.scene-editor_&]:items-center max-[760px]:[.scene-editor_&]:col-[1] max-[760px]:[.scene-editor_&]:row-[2] max-[760px]:[.scene-editor_&]:m-0 max-[760px]:[.scene-editor_&]:justify-start max-[760px]:[.scene-editor_&]:gap-[1px] max-[760px]:[.scene-editor_&_>_.button.primary]:gap-0 max-[760px]:[.scene-editor_&_>_.button.primary]:p-[6px] max-[760px]:[.scene-editor_&_>_.button.primary]:text-[length:0] max-[760px]:[.scene-editor_&_>_.button:last-child]:hidden max-[760px]:[.scene-editor_&_>_.button]:min-h-[34px] max-[760px]:[.scene-editor_&_>_.button]:min-w-[30px] max-[760px]:[.scene-editor_&_>_.button]:p-[6px] [.scene-object-asset_&]:gap-2">
                    <Button
                        variant="outline"
                        aria-label="Hoàn tác (Ctrl Z)"
                        title="Hoàn tác (Ctrl Z)"
                        disabled={blocked || !editor.canUndo}
                        onClick={editor.undo}
                    >
                        <Undo2 data-icon="inline-start" />
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Làm lại (Ctrl Shift Z)"
                        title="Làm lại (Ctrl Shift Z)"
                        disabled={blocked || !editor.canRedo}
                        onClick={editor.redo}
                    >
                        <Redo2 data-icon="inline-start" />
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Xuất bản sao scene JSON"
                        title="Xuất bản sao scene JSON"
                        onClick={exportScene}
                    >
                        <Download data-icon="inline-start" />
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Nhập scene JSON"
                        title="Nhập scene JSON"
                        disabled={blocked}
                        onClick={() => importFile.current?.click()}
                    >
                        <Upload data-icon="inline-start" />
                    </Button>
                    <Input
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
                        aria-busy={editor.busy}
                        disabled={
                            disabled ||
                            settingsBusy ||
                            Boolean(annotationPlacement) ||
                            !editor.dirty ||
                            !validation.success ||
                            editor.conflict ||
                            editor.uncertain ||
                            editor.busy
                        }
                        onClick={() => {
                            void editor.save();
                        }}
                    >
                        {editor.busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        <Save data-icon="inline-start" /> Lưu
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Tải nội dung mới nhất"
                        title="Tải nội dung mới nhất"
                        disabled={blocked}
                        onClick={() => setResetting(true)}
                    >
                        <RefreshCw data-icon="inline-start" />
                    </Button>
                </div>
                <Button
                    className="editor-publish shrink-0 max-[760px]:[.scene-editor_&]:col-[2] max-[760px]:[.scene-editor_&]:row-[1] max-[760px]:[.scene-editor_&]:w-10 max-[760px]:[.scene-editor_&]:min-w-10 max-[760px]:[.scene-editor_&]:max-w-10 max-[760px]:[.scene-editor_&]:gap-0 max-[760px]:[.scene-editor_&]:p-[9px] max-[760px]:[.scene-editor_&]:text-[length:0] max-[760px]:[.scene-editor_&]:[justify-self:end]"
                    disabled={blocked || editor.dirty || settingsDirty}
                    title={
                        editor.dirty || settingsDirty
                            ? 'Lưu thay đổi trước khi xuất bản'
                            : 'Kiểm tra và xuất bản sách'
                    }
                    onClick={() => setPublishOpen(true)}
                >
                    <Send data-icon="inline-start" />
                    Xuất bản
                </Button>
            </header>
            <Feedback
                error={error || editor.error}
                success={editor.notice}
                warning={editor.warning}
            />
            {!validation.success && (
                <Feedback
                    error={`Nội dung chưa hợp lệ${typeof validation.error.issues[0]?.path[1] === 'number' ? ` ở ${validation.error.issues[0].path[0] === 'interactions' ? 'quy tắc' : 'đối tượng'} ${Number(validation.error.issues[0].path[1]) + 1}` : ''}: ${validation.error.issues[0]?.message || 'Kiểm tra các trường đang nhập.'}`}
                />
            )}
            {(editor.conflict || editor.uncertain) && (
                <Alert tone="warning" className="my-4">
                    <p>
                        {editor.uncertain
                            ? 'Chưa xác nhận được kết quả lưu. Hãy kiểm tra trước khi tiếp tục chỉnh sửa hoặc gửi lại.'
                            : 'Máy chủ có nội dung mới hơn. Bản đang sửa vẫn được giữ; tải bản sao trước khi chọn tải nội dung mới nhất.'}
                    </p>
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        {editor.uncertain && (
                            <Button
                                variant="secondary"
                                aria-busy={editor.busy}
                                disabled={disabled || settingsBusy || editor.busy}
                                onClick={() => {
                                    void editor.readLatest(false);
                                }}
                            >
                                {editor.busy && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}
                                Kiểm tra kết quả lưu
                            </Button>
                        )}
                        <Button
                            variant="outline"
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
                </Alert>
            )}
            <div className="workbench-body grid grid-cols-[72px_minmax(0,_1fr)] max-[760px]:grid-cols-[56px_minmax(0,_1fr)]">
                <div
                    className="scene-add m-0 flex h-[calc(100dvh_-_76px)] min-h-125 flex-col flex-wrap items-center gap-[6px] overflow-y-auto border-t-[0] border-t-[transparent] border-r-[1px] border-r-border border-b-[0] border-b-[transparent] border-l-[0] border-l-[transparent] border-solid px-[6px] py-5 max-[760px]:h-auto max-[760px]:min-h-0 max-[760px]:gap-[3px] max-[760px]:px-[3px] max-[760px]:py-3 max-[600px]:[&_>_.button]:w-full [&_label]:grid [&_label]:min-w-45 [&_label]:gap-2 max-[600px]:[&_label]:w-full [.scene-editor_&_.button:hover]:border-[transparent] [.scene-editor_&_.button:hover]:bg-selected [.scene-editor_&_.button:hover]:text-primary [.scene-editor_&_.button]:flex [.scene-editor_&_.button]:min-h-[54px] [.scene-editor_&_.button]:w-[58px] [.scene-editor_&_.button]:flex-col [.scene-editor_&_.button]:gap-[5px] [.scene-editor_&_.button]:rounded-[11px] [.scene-editor_&_.button]:border-[transparent] [.scene-editor_&_.button]:px-1 [.scene-editor_&_.button]:py-2 [.scene-editor_&_.button]:font-medium [.scene-editor_&_.button]:text-[length:9px] [.scene-editor_&_.button]:text-muted-foreground max-[760px]:[.scene-editor_&_.button]:min-h-12 max-[760px]:[.scene-editor_&_.button]:w-12 max-[760px]:[.scene-editor_&_.button]:text-[length:8px] [.scene-editor_&_.button_svg]:size-[22px]"
                    role="toolbar"
                    aria-label="Thêm đối tượng"
                >
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
                            variant="outline"
                            disabled={
                                blocked ||
                                editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects
                            }
                            onClick={() => {
                                if (usesAsset(item.type)) setPicker({ type: item.type });
                                else if (item.type === 'text' || item.type === 'label')
                                    setTextDialog({
                                        start: item.type === 'label' ? 'annotation' : 'text',
                                    });
                                else insert(item.type);
                            }}
                        >
                            <item.icon size={18} />
                            {objectLabels[item.type]}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        aria-label="Mở tương tác"
                        title="Tương tác"
                        onClick={() => setPanel('interactions')}
                    >
                        <Zap data-icon="inline-start" />
                        <span>Tương tác</span>
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Trang và nhận diện AR"
                        title="Trang và nhận diện AR"
                        disabled={blocked}
                        onClick={onRecognition}
                    >
                        <QrCode data-icon="inline-start" />
                        <span>AR Marker</span>
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Cài đặt trang"
                        title="Cài đặt trang"
                        onClick={() => setPanel('settings')}
                    >
                        <Settings2 data-icon="inline-start" />
                        <span>Cài đặt</span>
                    </Button>
                    <Button
                        variant="outline"
                        aria-label="Hướng dẫn editor"
                        title="Hướng dẫn editor"
                        onClick={() => setHelpOpen(true)}
                    >
                        <CircleHelp data-icon="inline-start" />
                        <span>Trợ giúp</span>
                    </Button>
                </div>
                <div className="scene-workspace relative m-0 grid h-[calc(100dvh_-_76px)] min-h-125 grid-cols-[minmax(0,_1fr)_340px] items-stretch gap-0 max-[760px]:h-auto max-[760px]:min-h-0 max-[1100px]:grid-cols-[minmax(0,_1fr)_300px] max-[1200px]:grid-cols-[minmax(180px,_0.8fr)_minmax(240px,_1fr)] max-[600px]:grid-cols-[1fr] max-[760px]:grid-cols-[minmax(0,_1fr)] min-[1600px]:grid-cols-[minmax(0,_1fr)_380px] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [&_h3]:text-[length:var(--text-lg)] min-[1100px]:[.scene-editor[data-panel=interactions]_&]:grid-cols-[minmax(0,_1fr)_minmax(480px,_45%)] [.scene-editor[data-panel=preview]_&]:grid-cols-[minmax(0,_1fr)]">
                    <section
                        className="scene-layers absolute bottom-[152px] left-[18px] z-4 max-h-[70%] w-70 min-w-0 overflow-auto rounded-[14px] border border-border border-solid bg-surface px-3 py-[18px] shadow-[0_12px_30px_#00000020] max-[760px]:top-15 max-[760px]:bottom-auto max-[760px]:left-2 max-[760px]:w-[calc(100%_-_16px)] max-[760px]:max-w-70 [&[hidden]]:hidden [&_h3]:mt-0 [&_h3]:mr-[22px] [&_h3]:mb-[14px] [&_h3]:ml-1 [&_h3]:flex [&_h3]:gap-3 [&_h3]:text-[length:14px] [&_h3_span]:text-muted-foreground [&_h3_span]:tabular-nums [&_li.is-selected]:border-0 [&_li.is-selected]:border-[transparent] [&_li.is-selected]:border-solid [&_li.is-selected]:bg-selected [&_li:hover]:bg-hover [&_li[hidden]]:hidden [&_li]:rounded-[8px] [&_li]:border-0 [&_li]:border-[transparent] [&_li]:border-solid [&_li]:bg-[transparent] [&_li]:p-[3px] [&_ol]:m-0 [&_ol]:list-none [&_ol]:gap-[5px] [&_ol]:p-0"
                        aria-labelledby="layers-heading"
                        hidden={!layersOpen}
                    >
                        <ActionButton
                            variant="plain"
                            className="layers-close absolute top-4 right-3 border-0 border-[transparent] border-solid bg-[transparent] p-1 text-muted-foreground"
                            type="button"
                            aria-label="Đóng danh sách đối tượng"
                            onClick={() => setLayersOpen(false)}
                        >
                            <X size={16} />
                        </ActionButton>
                        <h3 id="layers-heading">
                            Đối tượng <span>{editor.draft.objects.length}</span>
                        </h3>
                        <Field className="mx-1 mb-3 block w-auto">
                            <FieldLabel htmlFor="scene-object-search" className="sr-only">
                                Tìm đối tượng
                            </FieldLabel>
                            <SearchInput
                                id="scene-object-search"
                                placeholder="Tìm đối tượng…"
                                value={layerSearch}
                                onValueChange={setLayerSearch}
                            />
                        </Field>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Button variant="outline" disabled={blocked} onClick={chooseAll}>
                                Chọn tất cả
                            </Button>
                            <Button
                                variant="outline"
                                disabled={blocked || !activeIds.length}
                                onClick={() => setSelectedId('')}
                            >
                                Bỏ chọn
                            </Button>
                            <span className="text-muted-foreground text-xs" role="status">
                                Đã chọn {activeIds.length}
                            </span>
                        </div>
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
                                    className={activeIds.includes(object.id) ? 'is-selected' : ''}
                                >
                                    <ActionButton
                                        variant="plain"
                                        type="button"
                                        className="scene-layer-select [&_span]:wrap-anywhere flex min-h-10 w-full flex-wrap items-center gap-[5px] border-0 border-[transparent] border-solid bg-[transparent] p-[6px] text-left text-[length:12px] text-foreground [&_small]:text-[length:10px] [&_small]:text-muted-foreground [&_span]:w-full [&_span]:font-semibold"
                                        aria-pressed={activeIds.includes(object.id)}
                                        disabled={blocked}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            selectMany(
                                                [object.id],
                                                event.shiftKey || event.ctrlKey || event.metaKey
                                                    ? 'toggle'
                                                    : 'replace',
                                            );
                                        }}
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
                                    </ActionButton>
                                    <div className="scene-layer-actions flex flex-wrap gap-0 px-1 py-1 max-[600px]:justify-end [.scene-editor_&_.button]:min-h-7 [.scene-editor_&_.button]:min-w-11 [.scene-editor_&_.button]:px-[7px] [.scene-editor_&_.button]:py-[3px]">
                                        <Button
                                            variant="outline"
                                            disabled={blocked || object.locked || index === 0}
                                            aria-label={`Đưa đối tượng ${index + 1} lên`}
                                            onClick={() =>
                                                editor.setDraft((current) =>
                                                    moveObject(current, object.id, -1),
                                                )
                                            }
                                        >
                                            <ArrowUp data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="outline"
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
                                            <ArrowDown
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                        <Button
                                            variant="outline"
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
                                            <Copy data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={blocked || object.locked}
                                            aria-label={`Xóa đối tượng ${index + 1}`}
                                            onClick={() => setDeleting([object])}
                                        >
                                            <Trash2 data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                    <SceneCanvas
                        ref={(handle) => {
                            commands.current.canvas = handle;
                        }}
                        suspended={Boolean(textDialog && !annotationPlacement)}
                        annotationToPlace={annotationPlacement}
                        onCancelAnnotationPlacement={() => setTextDialog(null)}
                        onPlaceAnnotation={(placement) => {
                            if (sceneBlocked || !annotationPlacement) return;
                            try {
                                const object = placeAnnotation(annotationPlacement, placement);
                                editor.setDraft((current) => addObject(current, object));
                                setSelectedId(object.id);
                                setTextDialog(null);
                                setPanel('properties');
                                setError(null);
                            } catch (cause) {
                                setError(errorMessage(cause));
                            }
                        }}
                        page={page}
                        aspect={book.pageAspect}
                        scene={editor.draft}
                        assets={sceneAssets}
                        selectedIds={annotationPlacement ? [] : activeIds}
                        disabled={sceneBlocked}
                        selectionActions={{
                            canDuplicate:
                                editor.draft.objects.length + selection.length <=
                                SCENE_LIMITS.hardMaxObjects,
                            onDuplicate: () => duplicateChosen(activeIds),
                            onDelete: () => {
                                if (
                                    !blocked &&
                                    selection.length &&
                                    !selection.some((object) => object.locked)
                                )
                                    setDeleting(selection);
                            },
                            onLock: () =>
                                flagChosen('locked', !selection.some((object) => object.locked)),
                            onBillboardChange: billboardChosen,
                            onResetAnnotationOffset: () => {
                                if (blocked || selection.length !== 1 || selection[0].locked)
                                    return;
                                const object = selection[0];
                                if (
                                    (object.type === 'text' || object.type === 'label') &&
                                    object.presentation?.kind === 'annotation'
                                )
                                    change({
                                        ...object,
                                        presentation: {
                                            ...object.presentation,
                                            labelOffset: undefined,
                                        },
                                    });
                            },
                        }}
                        onSelect={selectMany}
                        onChange={changeMany}
                        onBegin={() => {
                            editor.begin();
                            setTransforming(true);
                        }}
                        onEnd={() => {
                            editor.end();
                            setTransforming(false);
                        }}
                        footer={
                            <div className="editor-footer-actions absolute right-90 bottom-[118px] z-3 flex justify-center gap-2 bg-[transparent] p-0 max-[1100px]:right-80 max-[760px]:justify-center max-[760px]:bg-[var(--editor-ground)] max-[760px]:p-[10px] max-[760px]:[position:static] [.canvas-footer_&]:bg-[transparent] [.canvas-footer_&]:p-0 [.canvas-footer_&]:[position:static] max-[760px]:[.canvas-footer_&]:max-w-full max-[760px]:[.canvas-footer_&]:flex-wrap max-[760px]:[.canvas-footer_&]:justify-center max-[760px]:[.canvas-footer_&_.button]:min-w-0 max-[760px]:[.canvas-footer_&_.button]:px-[9px] max-[760px]:[.canvas-footer_&_.button]:py-[7px] max-[760px]:[.canvas-footer_&_.button]:text-[length:10px] [.scene-editor[data-panel=preview]_&]:hidden [.scene-editor_&_.button]:min-h-9 [.scene-editor_&_.button]:border [.scene-editor_&_.button]:border-border [.scene-editor_&_.button]:border-solid [.scene-editor_&_.button]:bg-surface [.scene-editor_&_.button]:text-[length:11px]">
                                <Button
                                    variant="outline"
                                    aria-pressed={layersOpen}
                                    onClick={() => setLayersOpen(!layersOpen)}
                                >
                                    <Layers data-icon="inline-start" />
                                    Đối tượng ({editor.draft.objects.length})
                                </Button>
                                <Button variant="outline" onClick={() => setHelpOpen(true)}>
                                    Phím tắt
                                </Button>
                            </div>
                        }
                    />
                    <Tabs
                        value={panel}
                        onValueChange={(value) => setPanel(value as typeof panel)}
                        asChild
                    >
                        <aside
                            className="workbench-panel min-w-0 overflow-auto border-l-[1px] border-l-border bg-muted [border-left-style:solid] max-[760px]:max-h-125 max-[760px]:border-t-[1px] max-[760px]:border-t-border max-[760px]:border-l-[0] max-[760px]:border-l-[transparent] max-[760px]:[border-left-style:solid] max-[760px]:[border-top-style:solid] [&_[data-slot=select-trigger]]:mt-1 [&_[data-slot=select-trigger]]:border-input [&_[data-slot=select-trigger]]:p-2 [&_[data-slot=select-trigger]]:text-[length:12px] max-[760px]:[&_[data-slot=select-trigger]]:text-[length:16px] [&_[role=tabpanel][hidden]]:hidden [&_[role=tabpanel]]:px-4 [&_[role=tabpanel]]:py-[18px] max-[760px]:[&_[role=tabpanel]]:m-auto max-[760px]:[&_[role=tabpanel]]:max-w-150 [&_h2]:text-[length:15px] [&_input:not([type=checkbox])]:mt-1 [&_input:not([type=checkbox])]:border-input [&_input:not([type=checkbox])]:p-2 [&_input:not([type=checkbox])]:text-[length:12px] max-[760px]:[&_input:not([type=checkbox])]:text-[length:16px] [&_label]:mb-[10px] [&_label]:text-[length:12px] [&_p]:text-[length:11px] [&_textarea]:mt-1 [&_textarea]:border-input [&_textarea]:p-2 [&_textarea]:text-[length:12px] max-[760px]:[&_textarea]:text-[length:16px] [.scene-editor[data-panel=preview]_&]:border-l-[0] [.scene-editor[data-panel=preview]_&]:border-l-[transparent] [.scene-editor[data-panel=preview]_&]:bg-surface [.scene-editor[data-panel=preview]_&]:[border-left-style:solid] [.scene-editor[data-panel=preview]_&_[role=tabpanel]]:m-auto [.scene-editor[data-panel=preview]_&_[role=tabpanel]]:max-w-300"
                            aria-label="Bảng chỉnh sửa"
                        >
                            <TabsList
                                variant="line"
                                className="workbench-tabs sticky top-0 z-2 bg-surface px-3"
                                aria-label="Bảng công cụ"
                            >
                                {(
                                    [
                                        ['properties', 'Thuộc tính'],
                                        ['interactions', 'Tương tác'],
                                        ['settings', 'Cài đặt'],
                                        ['preview', 'Xem thử'],
                                    ] as const
                                ).map(([value, label]) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        id={`panel-tab-${value}`}
                                        aria-controls={`panel-${value}`}
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <TabsContent
                                value="properties"
                                forceMount
                                id="panel-properties"
                                aria-labelledby="panel-tab-properties"
                            >
                                {selection.length > 1 ? (
                                    <SelectionEditor
                                        objects={selection}
                                        disabled={blocked}
                                        canDuplicate={
                                            editor.draft.objects.length + selection.length <=
                                            SCENE_LIMITS.hardMaxObjects
                                        }
                                        onDuplicate={() => duplicateChosen(activeIds)}
                                        onDelete={() => setDeleting(selection)}
                                        onFlag={flagChosen}
                                        onClear={() => setSelectedId('')}
                                    />
                                ) : selected ? (
                                    <ObjectEditor
                                        onEditText={() => {
                                            if (
                                                selected?.type === 'text' ||
                                                selected?.type === 'label'
                                            )
                                                setTextDialog({
                                                    start:
                                                        selected.type === 'label'
                                                            ? 'annotation'
                                                            : 'text',
                                                    initial: selected,
                                                });
                                        }}
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
                                        onBillboardChange={billboardChosen}
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
                                        onDelete={() => setDeleting([selected])}
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
                                        Thuộc tính sẽ xuất hiện khi bạn thêm hoặc chọn một đối
                                        tượng.
                                    </p>
                                )}
                            </TabsContent>
                            <TabsContent
                                value="interactions"
                                forceMount
                                id="panel-interactions"
                                aria-labelledby="panel-tab-interactions"
                            >
                                {(warnings.length > 0 ||
                                    (!editor.dirty && editor.warnings.length > 0)) && (
                                    <Alert tone="warning" className="my-4">
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
                                                <li
                                                    key={`${warning.code}-${warning.objectId || ''}`}
                                                >
                                                    {warning.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </Alert>
                                )}
                                <InteractionEditor
                                    scene={editor.draft}
                                    assets={sceneAssets}
                                    disabled={blocked}
                                    onChange={(scene) => editor.setDraft(scene)}
                                />
                            </TabsContent>
                            <TabsContent
                                value="settings"
                                forceMount
                                id="panel-settings"
                                aria-labelledby="panel-tab-settings"
                            >
                                <PageSettingsEditor
                                    page={page}
                                    disabled={disabled || editor.busy || editor.uncertain}
                                    onDirtyChange={setSettingsDirty}
                                    onBusyChange={setSettingsBusy}
                                />
                            </TabsContent>
                            <TabsContent
                                value="preview"
                                forceMount
                                id="panel-preview"
                                aria-labelledby="panel-tab-preview"
                            >
                                <PreviewPanel
                                    page={page}
                                    book={book}
                                    scene={editor.draft}
                                    disabled={blocked || settingsDirty}
                                    unsaved={editor.dirty || settingsDirty}
                                />
                            </TabsContent>
                        </aside>
                    </Tabs>
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-12 z-5 grid [grid-template-columns:inherit] [.scene-editor[data-panel=preview]_&]:bottom-4"
                        data-page-dock
                    >
                        <div className="col-start-1 flex min-w-0 justify-center px-4">
                            <PageStrip
                                book={book}
                                pageId={page.id}
                                dirty={editor.dirty || settingsDirty}
                                disabled={blocked}
                                onBusyChange={setPagesBusy}
                                onDraftChange={setPagesDirty}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {infoOpen && (
                <BookInfoDialog
                    bookId={book.id}
                    opener={infoAnchor.current}
                    guardNavigation={false}
                    onClose={() => setInfoOpen(false)}
                    onBusyChange={setInfoBusy}
                    onDirtyChange={setInfoDirty}
                />
            )}
            {helpOpen && (
                <ConfirmDialog
                    title="Thao tác trong editor"
                    busy={false}
                    onClose={() => setHelpOpen(false)}
                >
                    <dl className="editor-shortcuts grid grid-cols-[1fr_1fr] gap-3 text-[length:13px] max-[760px]:grid-cols-[1fr] max-[760px]:gap-1 [&_dd]:m-0 [&_dd]:text-muted-foreground max-[760px]:[&_dd]:mb-[10px]">
                        <dt>Chọn đối tượng</dt>
                        <dd>Nhấp trên canvas hoặc mở Đối tượng; Shift/Ctrl + nhấp để chọn nhiều</dd>
                        <dt>Kéo khung chọn</dt>
                        <dd>
                            Shift + kéo trên canvas; Ctrl A chọn tất cả đối tượng có thể chỉnh sửa
                        </dd>
                        <dt>Di chuyển / xoay / kích thước</dt>
                        <dd>W / E / R</dd>
                        <dt>Trục thế giới / cục bộ</dt>
                        <dd>L · Nhóm biến đổi quanh tâm chung theo trục thế giới</dd>
                        <dt>Bật / tắt bắt bước</dt>
                        <dd>
                            N · Giữ Shift khi kéo gizmo để bắt bước tạm thời. Chỉnh bước di chuyển,
                            xoay và kích thước trong Cài đặt snap ở góc trên trái.
                        </dd>
                        <dt>Hủy thao tác đang kéo</dt>
                        <dd>Esc · Khôi phục trạng thái trước khi kéo</dd>
                        <dt>Đưa đối tượng vào giữa</dt>
                        <dd>F</dd>
                        <dt>Hoàn tác / làm lại</dt>
                        <dd>Ctrl Z / Ctrl Shift Z</dd>
                        <dt>Nhân bản</dt>
                        <dd>Ctrl D (toàn bộ nhóm đang chọn)</dd>
                        <dt>Xóa đối tượng</dt>
                        <dd>Delete</dd>
                        <dt>Lưu nội dung</dt>
                        <dd>Ctrl S</dd>
                        <dt>Bỏ chọn</dt>
                        <dd>Esc</dd>
                    </dl>
                    <p>
                        Nhấp đối tượng để chọn rồi kéo trục/vòng gizmo để chỉnh. Kéo chuột trái
                        ngoài gizmo để xoay camera; chuột phải hoặc Space + kéo để dịch góc nhìn.
                        Giữ chuột giữa và kéo lên để phóng to, kéo xuống để thu nhỏ liên tục. Cuộn
                        thu/phóng về phía con trỏ. Trên macOS, dùng ⌘ thay cho Ctrl.
                    </p>
                    <Button onClick={() => setHelpOpen(false)}>Đã hiểu</Button>
                </ConfirmDialog>
            )}
            {publishOpen && (
                <ConfirmDialog
                    className="editor-publication-dialog w-[min(900px,_calc(100vw_-_32px))] max-w-225"
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
            {textDialog && !annotationPlacement && (
                <TextComposer
                    initial={textDialog.initial}
                    start={textDialog.start}
                    assets={sceneAssets}
                    disabled={blocked}
                    onClose={() => setTextDialog(null)}
                    onCommit={(object, chosen) => {
                        if (blocked) return;
                        const original = textDialog.initial;
                        setAssets((current) => ({ ...current, ...chosen }));
                        if (original) {
                            change({
                                ...object,
                                id: original.id,
                                name: original.name,
                                transform: {
                                    ...original.transform,
                                    rotation: object.transform.rotation,
                                },
                                visible: original.visible,
                                locked: original.locked,
                                editorHidden: original.editorHidden,
                                groupId: original.groupId,
                                snapToPaper: original.snapToPaper,
                            });
                            setSelectedId(original.id);
                        } else {
                            if (editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects) return;
                            if (
                                object.type === 'label' &&
                                object.presentation?.kind === 'annotation'
                            ) {
                                setTextDialog({ start: 'annotation', placement: object });
                                setPanel('properties');
                                setError(null);
                                return;
                            }
                            editor.setDraft((current) => addObject(current, object));
                            setSelectedId(object.id);
                        }
                        setPanel('properties');
                        setTextDialog(null);
                        setError(null);
                    }}
                />
            )}
            {picker && (
                <AssetPicker
                    type={objectAssetTypes[picker.type]}
                    usedAssetIds={editor.draft.objects.flatMap((object) =>
                        'assetId' in object ? [object.assetId] : [],
                    )}
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
                <ConfirmationDialog
                    description={
                        <>
                            {deleting.length > 1
                                ? `${deleting.length} đối tượng đã chọn`
                                : `Đối tượng “${deleting[0].name || objectLabels[deleting[0].type]}”`}{' '}
                            sẽ bị bỏ khỏi bản đang sửa. Tệp tài nguyên vẫn được giữ. Quy tắc tương
                            tác liên quan sẽ được giữ và đánh dấu để bạn sửa.
                        </>
                    }
                    title={
                        deleting.length > 1
                            ? `Xóa ${deleting.length} đối tượng khỏi trang?`
                            : 'Xóa đối tượng khỏi trang?'
                    }
                    busy={false}
                    onClose={() => setDeleting(null)}
                >
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button variant="secondary" onClick={() => setDeleting(null)}>
                                Giữ đối tượng
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (blocked) return;
                                    try {
                                        editor.setDraft((current) =>
                                            removeSelection(
                                                current,
                                                deleting.map((object) => object.id),
                                            ),
                                        );
                                        setDeleting(null);
                                        setError(null);
                                    } catch (cause) {
                                        setDeleting(null);
                                        setError(errorMessage(cause));
                                    }
                                }}
                            >
                                Xóa đối tượng
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
            {resetting && (
                <ConfirmationDialog
                    description={
                        editor.dirty
                            ? 'Bản đang sửa sẽ được thay bằng nội dung từ máy chủ. Cài đặt âm thanh và ánh sáng chưa lưu vẫn được giữ.'
                            : 'Lấy lại nội dung đối tượng và quy tắc đang lưu trên máy chủ.'
                    }
                    title="Tải nội dung mới nhất?"
                    busy={editor.busy}
                    onClose={() => {
                        if (!editor.busy) setResetting(false);
                    }}
                >
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant="secondary"
                                disabled={editor.busy}
                                onClick={() => setResetting(false)}
                            >
                                Giữ bản đang sửa
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                aria-busy={editor.busy}
                                onClick={async () => {
                                    await editor.readLatest(true);
                                    setResetting(false);
                                }}
                                disabled={editor.busy}
                            >
                                {editor.busy && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}
                                Xác nhận tải nội dung
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
