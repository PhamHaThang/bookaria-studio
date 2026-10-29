import {
    Check,
    ChevronDown,
    Circle,
    Download,
    FileText,
    Layers,
    MoreHorizontal,
    Redo2,
    RefreshCw,
    Save,
    Send,
    TriangleAlert,
    Undo2,
    Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Disclosure } from '@/shared/ui/Disclosure';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Input } from '@/shared/ui/primitives/input';
import { Separator } from '@/shared/ui/primitives/separator';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent } from '@/shared/ui/primitives/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
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
import type { ImageAttachmentContext } from '../../pages/ui/PageImageForm';
import type { PreviewView } from '../../preview/model/LocalPreviewStage';
import { LocalPreviewPanel } from '../../preview/ui/LocalPreviewPanel';
import { PublicationPanel } from '../../publication/ui/PublicationPanel';
import { type AnnotationObject, placeAnnotation } from '../model/annotation-placement';
import { createFittedAssetObject } from '../model/asset-insertion';
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
import { SceneAudioStore } from '../model/scene-audio-store';
import { SceneLoadStore } from '../model/scene-load-store';
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
import {
    type PageSettingsDraftView,
    PageSettingsEditor,
    type PageSettingsEditorHandle,
} from './PageSettingsEditor';
import { PageStrip } from './PageStrip';
import { SceneCanvas, type SceneCanvasHandle } from './SceneCanvas';
import { SceneEditorSidebar } from './SceneEditorSidebar';
import { SceneInspectorContent } from './SceneInspectorContent';
import { SceneInspectorEmpty } from './SceneInspectorEmpty';
import { SceneInspectorHeader } from './SceneInspectorHeader';
import { SceneModeSwitcher } from './SceneModeSwitcher';
import { SceneObjectsPanel } from './SceneObjectsPanel';
import { SceneShortcutsDialog } from './SceneShortcutsDialog';
import { SceneWorkbench } from './SceneWorkbench';
import { SelectionEditor } from './SelectionEditor';
import { TextComposer, type TextMode, type TextualObject } from './TextComposer';
import { useSaveBeforeAction } from './use-save-before-action';

export function SceneEditor({
    page,
    book,
    disabled,
    onBusyChange,
    onRecognition,
    onReplacePageImage,
}: {
    page: Page;
    book: BookDetail;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
    onRecognition: () => void;
    onReplacePageImage: (asset: Asset, context: ImageAttachmentContext) => Promise<void>;
}) {
    const editor = useSceneDraft(page);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    const settingsEditor = useRef<PageSettingsEditorHandle>(null);
    const [settingsDraft, setSettingsDraft] = useState<PageSettingsDraftView | null>(null);
    const displayTitle = settingsDraft?.title ?? page.title;
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
    const inspectorVisible =
        panel !== 'preview' && (panel !== 'properties' || selection.length > 0);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const saveBeforeAction = useSaveBeforeAction({
        dirty: editor.dirty || settingsDirty,
        blocked,
        save: async () => {
            if (!SceneSchema.safeParse(editor.draft).success)
                return 'Thông số chưa hợp lệ. Hãy kiểm tra các ô được đánh dấu trước khi lưu.';
            if (editor.conflict || editor.uncertain)
                return 'Cần kiểm tra phiên bản trên máy chủ trước khi tiếp tục. Bản đang sửa vẫn được giữ.';
            if (
                settingsDirty &&
                (!settingsEditor.current || !(await settingsEditor.current.save()))
            )
                return 'Chưa lưu được thiết lập trang. Bản đang sửa vẫn được giữ; vui lòng thử lại.';
            if (!(await commands.current.editor.save()))
                return 'Chưa lưu được nội dung trang. Bản đang sửa vẫn được giữ; hãy kiểm tra kết nối hoặc phiên bản trên máy chủ.';
            return null;
        },
    });
    useEffect(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        // This attribute only controls CSS motion. Avoid rendering the whole editor
        // again just to start or finish the inspector's transition.
        if (!inspectorVisible) {
            workspace.dataset.inspectorVisible = 'false';
            return;
        }
        const frame = requestAnimationFrame(() => {
            workspace.dataset.inspectorVisible = 'true';
        });
        return () => cancelAnimationFrame(frame);
    }, [inspectorVisible]);
    function runOutsideSettings(action: () => void) {
        if (panel === 'settings' && settingsDirty) settingsEditor.current?.confirmLeave(action);
        else action();
    }
    const previewView = useRef<PreviewView | undefined>(undefined);
    function changePanel(next: typeof panel) {
        if (next !== panel)
            runOutsideSettings(() => {
                if (next === 'preview')
                    previewView.current = commands.current.canvas?.getPreviewView();
                setPanel(next);
            });
    }
    function selectMany(ids: string[], mode: SelectionMode = 'replace') {
        const select = () => {
            if (ids.length > 0 && panel !== 'preview') setPanel('properties');
            setSelectedIds((current) =>
                updateSelection(
                    current.filter((id) => editor.draft.objects.some((item) => item.id === id)),
                    ids,
                    mode,
                ),
            );
        };
        if (ids.length > 0) runOutsideSettings(select);
        else select();
    }
    const sceneAssets = useSceneAssets(editor.draft, { ...page.assets, ...assets });
    const validation = SceneSchema.safeParse(editor.draft);
    const validationIssue = validation.success ? undefined : validation.error.issues[0];
    const invalidObjectIndex =
        validationIssue?.path[0] === 'objects' && typeof validationIssue.path[1] === 'number'
            ? validationIssue.path[1]
            : undefined;
    const invalidObject =
        invalidObjectIndex === undefined ? undefined : editor.draft.objects[invalidObjectIndex];
    const invalidField = validationIssue?.path.includes('position')
        ? 'Vị trí'
        : validationIssue?.path.includes('rotation')
          ? 'Góc xoay'
          : validationIssue?.path.includes('scale')
            ? 'Tỉ lệ'
            : 'Thông số';
    const invalidAxis =
        invalidField !== 'Thông số' && typeof validationIssue?.path.at(-1) === 'number'
            ? ['X', 'Y', 'Z'][Number(validationIssue.path.at(-1))]
            : undefined;
    const validationMessage = validationIssue
        ? `${invalidObject?.name ? `${invalidObject.name}: ` : ''}${invalidField}${invalidAxis ? ` ${invalidAxis}` : ''} chưa hợp lệ. ${validationIssue.code === 'invalid_type' ? 'Vui lòng nhập một số hợp lệ.' : validationIssue.code === 'too_small' && invalidField === 'Tỉ lệ' ? 'Tỉ lệ phải lớn hơn 0.' : 'Kiểm tra giá trị trước khi lưu.'}`
        : null;
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
                    billboard: object.type === 'audio' || enabled,
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
    function insertObject(object: SceneObject) {
        editor.setDraft((current) => addObject(current, object));
        setSelectedId(object.id);
        setPanel('properties');
        setError(null);
    }
    function insert(type: SceneObjectType, asset?: Asset) {
        try {
            insertObject(newObject(type, crypto.randomUUID(), asset));
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    async function savePage() {
        if (
            blocked ||
            !SceneSchema.safeParse(editor.draft).success ||
            editor.conflict ||
            editor.uncertain
        )
            return false;
        if (settingsDirty && (!settingsEditor.current || !(await settingsEditor.current.save()))) {
            setPanel('settings');
            return false;
        }
        return commands.current.editor.dirty ? commands.current.editor.save() : true;
    }
    const commands = useRef({
        editor,
        previewing: panel === 'preview',
        blocked,
        selection,
        duplicateChosen,
        savePage,
        canvas: null as SceneCanvasHandle | null,
        layersButton: null as HTMLButtonElement | null,
        shortcutsButton: null as HTMLButtonElement | null,
        loads: new SceneLoadStore(),
        audio: new SceneAudioStore(),
    });
    commands.current = {
        editor,
        previewing: panel === 'preview',
        blocked,
        selection,
        duplicateChosen,
        savePage,
        canvas: commands.current.canvas,
        layersButton: commands.current.layersButton,
        shortcutsButton: commands.current.shortcutsButton,
        loads: commands.current.loads,
        audio: commands.current.audio,
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
            if (state.previewing) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setPanel('properties');
                    return;
                }
                if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')) return;
            }

            const typing = (event.target as HTMLElement)?.closest(
                'input,textarea,select,[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[data-slot="accordion-trigger"],[contenteditable="true"]',
            );
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!state.blocked && SceneSchema.safeParse(state.editor.draft).success)
                    void state.savePage();
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
            <header className="scene-heading editor-header grid min-h-19 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-border border-b bg-surface px-5 py-3">
                <div className="editor-project flex min-w-0 items-center gap-4">
                    <Link
                        to="/books"
                        aria-label="Bookaria - Về Studio"
                        className="editor-brand inline-flex size-12 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-primary focus-visible:bg-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&_img]:transition-[filter] hover:[&_img]:brightness-0 hover:[&_img]:invert focus-visible:[&_img]:brightness-0 focus-visible:[&_img]:invert"
                    >
                        <BookariaLogo symbol />
                    </Link>
                    <div className="flex min-w-0 flex-col items-start gap-1">
                        <h1
                            id="scene-heading"
                            className="m-0 min-w-0 max-w-full font-medium text-sm leading-5"
                        >
                            <ActionButton
                                variant="plain"
                                ref={infoAnchor}
                                className="inline-flex max-w-full items-center gap-2 rounded-sm p-0 text-left [font:inherit] aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground"
                                aria-label="Thông tin sách"
                                title={
                                    editor.dirty || settingsDirty
                                        ? 'Lưu thay đổi để sửa thông tin sách'
                                        : undefined
                                }
                                aria-disabled={blocked}
                                onClick={() => {
                                    saveBeforeAction.request('Sửa thông tin sách', () =>
                                        setInfoOpen(true),
                                    );
                                }}
                            >
                                <FileText className="size-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">{book.title}</span>
                                <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                            </ActionButton>
                        </h1>
                        <p className="m-0 max-w-full truncate text-muted-foreground text-xs leading-4">
                            Trang {page.orderIndex + 1}
                            {displayTitle && displayTitle.trim() !== `Trang ${page.orderIndex + 1}`
                                ? ` · ${displayTitle}`
                                : ''}
                        </p>
                    </div>
                    <Separator orientation="vertical" className="h-7 w-px self-center" />
                    <fieldset className="m-0 flex shrink-0 items-center gap-1 border-0 p-0">
                        <legend className="sr-only">Công cụ trang</legend>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Hoàn tác (Ctrl Z)"
                            title="Hoàn tác (Ctrl Z)"
                            disabled={blocked || !editor.canUndo}
                            onClick={editor.undo}
                        >
                            <Undo2 />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Làm lại (Ctrl Shift Z)"
                            title="Làm lại (Ctrl Shift Z)"
                            disabled={blocked || !editor.canRedo}
                            onClick={editor.redo}
                        >
                            <Redo2 />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Tác vụ trang">
                                    <MoreHorizontal />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="start"
                                sideOffset={10}
                                className="w-64"
                                onCloseAutoFocus={(event) => {
                                    if (document.querySelector('[role=dialog],[role=alertdialog]'))
                                        event.preventDefault();
                                }}
                            >
                                <DropdownMenuLabel>
                                    Nội dung trang {page.orderIndex + 1}
                                </DropdownMenuLabel>
                                <DropdownMenuGroup>
                                    <DropdownMenuItem onSelect={exportScene}>
                                        <Download /> Xuất bản sao scene JSON
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={blocked}
                                        onSelect={() => importFile.current?.click()}
                                    >
                                        <Upload /> Nhập scene JSON
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={blocked}
                                        onSelect={() => setResetting(true)}
                                    >
                                        <RefreshCw /> Tải nội dung mới nhất
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </fieldset>
                </div>
                <SceneModeSwitcher
                    value={panel === 'settings' ? 'properties' : panel}
                    onValueChange={changePanel}
                    disabled={blocked}
                />
                <div className="editor-save-actions flex min-w-0 items-center justify-end gap-3">
                    <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                            <span
                                role="status"
                                tabIndex={validationMessage ? 0 : undefined}
                                className={cn(
                                    'flex w-32 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap text-muted-foreground text-xs max-[1280px]:w-5',
                                    validationMessage && 'text-destructive',
                                )}
                            >
                                {validationMessage ? (
                                    <TriangleAlert
                                        className="size-3.5 shrink-0"
                                        aria-hidden="true"
                                    />
                                ) : editor.busy || settingsBusy ? (
                                    <Spinner className="size-3.5" aria-hidden="true" />
                                ) : editor.dirty || settingsDirty ? (
                                    <Circle className="size-2 fill-current" aria-hidden="true" />
                                ) : (
                                    <Check className="size-3.5" aria-hidden="true" />
                                )}
                                <span className="max-[1280px]:sr-only">
                                    {validationMessage
                                        ? 'Kiểm tra thông số'
                                        : editor.busy || settingsBusy
                                          ? 'Đang lưu…'
                                          : editor.dirty || settingsDirty
                                            ? 'Chưa lưu thay đổi'
                                            : 'Đã lưu nội dung'}
                                </span>
                            </span>
                        </TooltipTrigger>
                        {validationMessage && (
                            <TooltipContent side="bottom" sideOffset={8}>
                                {validationMessage}
                            </TooltipContent>
                        )}
                    </Tooltip>
                    <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                            <span className="inline-flex shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 min-w-26"
                                    aria-label="Lưu nội dung"
                                    aria-busy={editor.busy || settingsBusy}
                                    disabled={
                                        disabled ||
                                        settingsBusy ||
                                        Boolean(annotationPlacement) ||
                                        (!editor.dirty && !settingsDirty) ||
                                        !validation.success ||
                                        editor.conflict ||
                                        editor.uncertain ||
                                        editor.busy
                                    }
                                    onClick={() => void savePage()}
                                >
                                    <Save data-icon="inline-start" /> Lưu
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8}>
                            Lưu nội dung · Ctrl S
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                            <span className="inline-flex shrink-0">
                                <Button
                                    size="sm"
                                    className="editor-publish h-10 min-w-26 disabled:pointer-events-none"
                                    disabled={blocked}
                                    onClick={() =>
                                        saveBeforeAction.request('Xuất bản sách', () =>
                                            setPublishOpen(true),
                                        )
                                    }
                                >
                                    <Send data-icon="inline-start" /> Xuất bản
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={8}>
                            {editor.dirty || settingsDirty
                                ? 'Lưu thay đổi trước khi xuất bản'
                                : 'Kiểm tra và xuất bản sách'}
                        </TooltipContent>
                    </Tooltip>
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
                </div>
            </header>
            <Feedback
                error={error || editor.error}
                success={editor.notice}
                warning={editor.warning}
            />
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
            <SceneWorkbench>
                <div hidden={panel === 'preview'} className="[&[hidden]]:hidden">
                    <SceneEditorSidebar
                        activeObjectType={picker?.type || (textDialog ? 'text' : undefined)}
                        activePanel={panel}
                        disabled={Boolean(blocked)}
                        objectLimitReached={
                            editor.draft.objects.length >= SCENE_LIMITS.hardMaxObjects
                        }
                        helpOpen={helpOpen}
                        onAdd={(type) =>
                            runOutsideSettings(() => {
                                if (usesAsset(type)) setPicker({ type });
                                else if (type === 'text') setTextDialog({ start: 'text' });
                                else insert(type);
                            })
                        }
                        onInteractions={() => changePanel('interactions')}
                        onRecognition={() => runOutsideSettings(onRecognition)}
                        onSettings={() => changePanel('settings')}
                        onShortcuts={() => setHelpOpen(true)}
                        shortcutsRef={(element) => {
                            commands.current.shortcutsButton = element;
                        }}
                    />
                </div>
                <div
                    ref={workspaceRef}
                    data-inspector-visible="false"
                    className="scene-workspace relative m-0 grid h-[calc(100dvh_-_76px)] min-h-125 min-w-0 flex-1 grid-cols-[minmax(0,_1fr)] items-stretch gap-0 overflow-hidden [--inspector-offset:var(--inspector-width)] [--inspector-width:340px] [container-type:inline-size] data-[inspector-visible=false]:[--inspector-offset:0px] max-[1100px]:[--inspector-width:300px] min-[1600px]:[--inspector-width:380px] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [&_h3]:text-[length:var(--text-lg)] min-[1100px]:[.scene-editor[data-panel=interactions]_&]:[--inspector-width:max(480px,45cqw)]"
                >
                    <SceneObjectsPanel
                        objects={editor.draft.objects}
                        selectedIds={activeIds}
                        query={layerSearch}
                        onQueryChange={setLayerSearch}
                        hidden={!layersOpen || panel === 'preview'}
                        disabled={blocked}
                        canDuplicate={editor.draft.objects.length < SCENE_LIMITS.hardMaxObjects}
                        onClose={() => {
                            setLayersOpen(false);
                            commands.current.layersButton?.focus();
                        }}
                        onSelect={selectMany}
                        onFlag={(id, flag, value) => {
                            if (blocked) return;
                            try {
                                editor.setDraft((current) =>
                                    setSelectionFlag(current, [id], flag, value),
                                );
                                setError(null);
                            } catch (cause) {
                                setError(errorMessage(cause));
                            }
                        }}
                        onMove={(id, direction) => {
                            if (!blocked)
                                editor.setDraft((current) => moveObject(current, id, direction));
                        }}
                        onDuplicate={(id) => duplicateChosen([id])}
                        onDelete={(object) => {
                            if (!blocked && !object.locked) setDeleting([object]);
                        }}
                    />
                    <SceneCanvas
                        lighting={settingsDraft?.lighting ?? page.settings.lighting}
                        imageUrl={settingsDraft?.imageUrl ?? page.image.url}
                        audioStore={commands.current.audio}
                        loadStore={commands.current.loads}
                        onRemoveObject={(id) => {
                            const object = commands.current.editor.draft.objects.find(
                                (item) => item.id === id,
                            );
                            if (object && !object.locked && !commands.current.blocked)
                                setDeleting([object]);
                        }}
                        ref={(handle) => {
                            commands.current.canvas = handle;
                        }}
                        suspended={
                            panel === 'preview' || Boolean(textDialog && !annotationPlacement)
                        }
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
                            <Button
                                ref={(element) => {
                                    commands.current.layersButton = element;
                                }}
                                variant={layersOpen ? 'default' : 'outline'}
                                size="sm"
                                aria-expanded={layersOpen}
                                aria-controls="scene-object-layers"
                                onKeyDown={(event) => {
                                    if (event.key !== 'Escape' || !layersOpen) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setLayersOpen(false);
                                }}
                                onClick={() => setLayersOpen(!layersOpen)}
                            >
                                <Layers data-icon="inline-start" aria-hidden="true" />
                                Đối tượng
                                <span className="tabular-nums">
                                    ({editor.draft.objects.length})
                                </span>
                            </Button>
                        }
                    />
                    <div className="inspector-slot pointer-events-none absolute top-0 right-0 bottom-[var(--canvas-hints-height)] z-10 min-h-0 w-[var(--inspector-width)] min-w-0 [.scene-editor[data-panel=preview]_&]:hidden">
                        <Tabs
                            className="gap-0"
                            value={panel}
                            onValueChange={(value) => changePanel(value as typeof panel)}
                            asChild
                        >
                            <aside
                                aria-hidden={!inspectorVisible}
                                inert={!inspectorVisible}
                                className="workbench-panel motion-reduce:translate-none! pointer-events-auto flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-border border-l bg-surface transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-[opacity,visibility] motion-reduce:duration-75 [&>section[hidden]]:hidden [&_[data-slot=select-trigger]]:mt-1 [&_[data-slot=select-trigger]]:min-w-0 [&_[data-slot=select-trigger]]:border-input [&_[data-slot=select-trigger]]:text-xs [&_input:not([type=checkbox])]:mt-1 [&_input:not([type=checkbox])]:border-input [&_input:not([type=checkbox])]:text-xs [&_textarea]:mt-1 [&_textarea]:border-input [&_textarea]:text-xs [.scene-editor[data-panel=interactions]_&]:w-full [.scene-editor[data-panel=preview]_&]:w-full [.scene-editor[data-panel=preview]_&]:border-l-0 [.scene-workspace[data-inspector-visible=false]_&]:pointer-events-none [.scene-workspace[data-inspector-visible=false]_&]:invisible [.scene-workspace[data-inspector-visible=false]_&]:translate-x-full [.scene-workspace[data-inspector-visible=false]_&]:opacity-0 [.scene-workspace[data-inspector-visible=false]_&]:duration-150"
                                aria-label="Bảng chỉnh sửa"
                            >
                                <SceneInspectorContent active={inspectorVisible}>
                                    <div
                                        hidden={panel === 'preview'}
                                        className="[&[hidden]]:hidden"
                                    >
                                        <SceneInspectorHeader
                                            panel={panel}
                                            selected={selected}
                                            count={selection.length}
                                            pageNumber={page.orderIndex + 1}
                                            disabled={Boolean(blocked)}
                                            onBack={() =>
                                                runOutsideSettings(() => {
                                                    setPanel('properties');
                                                    const focusTarget = selection.length
                                                        ? document.getElementById(
                                                              'inspector-heading',
                                                          )
                                                        : document.querySelector<HTMLCanvasElement>(
                                                              '.scene-three-host canvas',
                                                          );
                                                    focusTarget?.focus({ preventScroll: true });
                                                })
                                            }
                                            onClear={() =>
                                                runOutsideSettings(() => {
                                                    setSelectedId('');
                                                    setPanel('properties');
                                                    document
                                                        .querySelector<HTMLCanvasElement>(
                                                            '.scene-three-host canvas',
                                                        )
                                                        ?.focus({ preventScroll: true });
                                                })
                                            }
                                        />
                                    </div>
                                    <TabsContent value="properties" forceMount asChild>
                                        <section
                                            key={`${selected?.id || 'empty'}:${selection.length > 1 ? 'group' : 'single'}`}
                                            id="panel-properties"
                                            hidden={panel !== 'properties'}
                                            aria-labelledby="inspector-heading"
                                            className="inspector-panel flex min-h-0 flex-1 flex-col overflow-y-auto p-4"
                                        >
                                            {selection.length > 1 ? (
                                                <SelectionEditor
                                                    objects={selection}
                                                    disabled={blocked}
                                                    canDuplicate={
                                                        editor.draft.objects.length +
                                                            selection.length <=
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
                                                    loadStore={commands.current.loads}
                                                    audioStore={commands.current.audio}
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
                                                            setError(
                                                                'Trang đã đạt giới hạn đối tượng.',
                                                            );
                                                            return;
                                                        }
                                                        const id = crypto.randomUUID();
                                                        editor.setDraft((current) =>
                                                            duplicateObject(
                                                                current,
                                                                selected.id,
                                                                id,
                                                            ),
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
                                                <SceneInspectorEmpty
                                                    empty={editor.draft.objects.length === 0}
                                                    disabled={Boolean(blocked)}
                                                    onList={() => setLayersOpen(true)}
                                                    onAddText={() =>
                                                        setTextDialog({ start: 'text' })
                                                    }
                                                />
                                            )}
                                        </section>
                                    </TabsContent>
                                    <TabsContent value="interactions" forceMount asChild>
                                        <section
                                            id="panel-interactions"
                                            hidden={panel !== 'interactions'}
                                            aria-labelledby="inspector-heading"
                                            className="inspector-panel min-h-0 flex-1 overflow-y-auto p-4"
                                        >
                                            {panel === 'interactions' &&
                                                (warnings.length > 0 ||
                                                    (!editor.dirty &&
                                                        editor.warnings.length > 0)) && (
                                                    <Disclosure
                                                        title="Gợi ý trước khi xuất bản"
                                                        className="mb-4"
                                                    >
                                                        <Alert tone="warning" className="mb-4">
                                                            <h3>Gợi ý trước khi xuất bản</h3>
                                                            <ul>
                                                                {[
                                                                    ...new Map(
                                                                        [
                                                                            ...warnings,
                                                                            ...(!editor.dirty
                                                                                ? editor.warnings
                                                                                : []),
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
                                                    </Disclosure>
                                                )}
                                            <InteractionEditor
                                                onShowPageRules={() => setPanel('interactions')}
                                                scene={editor.draft}
                                                assets={sceneAssets}
                                                disabled={blocked}
                                                onChange={(scene) => editor.setDraft(scene)}
                                            />
                                        </section>
                                    </TabsContent>
                                </SceneInspectorContent>
                                <TabsContent value="settings" forceMount asChild>
                                    <section
                                        id="panel-settings"
                                        hidden={panel !== 'settings'}
                                        aria-labelledby="inspector-heading"
                                        className="inspector-panel flex min-h-0 flex-1 flex-col overflow-hidden"
                                    >
                                        <PageSettingsEditor
                                            ref={settingsEditor}
                                            page={page}
                                            active={panel === 'settings'}
                                            onReplaceImage={onReplacePageImage}
                                            onDraftChange={setSettingsDraft}
                                            disabled={
                                                disabled ||
                                                editor.busy ||
                                                editor.uncertain ||
                                                publicationBusy ||
                                                pagesBusy ||
                                                infoBusy ||
                                                transforming
                                            }
                                            onDirtyChange={setSettingsDirty}
                                            onBusyChange={setSettingsBusy}
                                        />
                                    </section>
                                </TabsContent>
                            </aside>
                        </Tabs>
                    </div>
                    <section
                        id="panel-preview"
                        hidden={panel !== 'preview'}
                        aria-label="Xem trước sách"
                        className="pointer-events-auto absolute inset-0 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden [&[hidden]]:hidden"
                    >
                        <LocalPreviewPanel
                            active={panel === 'preview'}
                            initialView={previewView.current}
                            page={page}
                            book={book}
                            scene={editor.draft}
                            unsaved={editor.dirty || settingsDirty}
                        />
                    </section>
                    <div
                        className="pointer-events-none absolute inset-x-0 bottom-12 z-5 grid [grid-template-columns:inherit] [.scene-editor[data-panel=preview]_&]:hidden"
                        data-page-dock
                    >
                        <div className="col-start-1 flex min-w-0 -translate-x-[calc(var(--inspector-offset)/2)] justify-center px-4 transition-[translate] duration-200 ease-out motion-reduce:transition-none [.scene-editor[data-panel=preview]_&]:translate-x-0">
                            <PageStrip
                                requestAction={saveBeforeAction.request}
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
            </SceneWorkbench>
            {saveBeforeAction.dialog}
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
                <SceneShortcutsDialog
                    onClose={() => setHelpOpen(false)}
                    returnFocus={commands.current.shortcutsButton}
                />
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
                    onChoose={async (asset, signal) => {
                        const fitted = picker.replace
                            ? null
                            : await createFittedAssetObject(
                                  picker.type,
                                  crypto.randomUUID(),
                                  asset,
                                  book.pageAspect,
                                  signal,
                              );
                        signal.throwIfAborted();
                        if (commands.current.blocked)
                            throw new Error('Trang đang bận. Vui lòng thử lại.');
                        if (
                            commands.current.editor.draft.objects.length >=
                                SCENE_LIMITS.hardMaxObjects &&
                            fitted
                        )
                            throw new Error(
                                `Mỗi trang tối đa ${SCENE_LIMITS.hardMaxObjects} đối tượng.`,
                            );
                        setAssets((current) => ({ ...current, [asset.id]: asset }));
                        if (picker.replace) {
                            const object = commands.current.editor.draft.objects.find(
                                (item) => item.id === picker.replace,
                            );
                            if (object) change(replaceObjectAsset(object, asset));
                        } else if (fitted) insertObject(fitted);
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
