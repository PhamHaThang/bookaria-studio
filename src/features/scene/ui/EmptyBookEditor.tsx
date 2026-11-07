import { ChevronDown, FileText, Plus, Save, Send, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Separator } from '@/shared/ui/primitives/separator';
import { ThemeSwitcher } from '@/shared/ui/ThemeSwitcher';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { useBookDraft } from '../../book-draft/ui/BookDraftProvider';
import { BookInfoDialog } from '../../books/ui/BookInfoDialog';
import { PublicationDialog } from '../../publication/ui/PublicationDialog';
import { EditorSaveStatus } from './EditorSaveStatus';
import { NavigationGuard } from './NavigationGuard';
import { PageStrip } from './PageStrip';
import { SceneCanvasHints } from './SceneCanvasHints';
import { SceneEditorFrame, SceneEditorHeader, ScenePageDock } from './SceneEditorFrame';
import { SceneEditorSidebar } from './SceneEditorSidebar';
import { SceneHistoryControls } from './SceneHistoryControls';
import { SceneModeSwitcher } from './SceneModeSwitcher';
import { SceneShortcutsDialog } from './SceneShortcutsDialog';
import { SceneWorkbench } from './SceneWorkbench';
import { useSaveBeforeAction } from './use-save-before-action';

export function EmptyBookEditor({ book }: { book: BookDetail }) {
    const { store, state } = useBookDraft();
    const beforeInfo = useSaveBeforeAction({
        dirty: state.dirty,
        blocked: state.saving,
        save: async () =>
            (await store.save()) ? null : store.getSnapshot().error || 'Chưa lưu được sách.',
    });
    const navigate = useNavigate();
    const [adding, setAdding] = useState(false),
        [info, setInfo] = useState(false);
    const [busy, setBusy] = useState(false),
        [dirty, setDirty] = useState(false);
    const [infoBusy, setInfoBusy] = useState(false),
        [infoDirty, setInfoDirty] = useState(false);
    const [help, setHelp] = useState(false),
        [sharing, setSharing] = useState(false);
    const [shareBusy, setShareBusy] = useState(false);
    const [resetting, setResetting] = useState(false);
    const shortcutsAnchor = useRef<HTMLButtonElement | null>(null),
        infoAnchor = useRef<HTMLButtonElement | null>(null);
    const blocked = busy || infoBusy || shareBusy || (state.saving && !state.autosaving);
    const firstPageId = book.pages[0]?.id;
    // Keep an import mounted until it finishes or the author closes it, then open its pages.
    useEffect(() => {
        if (firstPageId && !adding && !busy && !dirty && !info && !infoBusy && !infoDirty)
            navigate(`/books/${book.id}/pages/${firstPageId}`, { replace: true });
    }, [firstPageId, adding, busy, dirty, info, infoBusy, infoDirty, book.id, navigate]);
    function historyStep(redo = false) {
        if (blocked || dirty || infoDirty) return;
        const id = redo ? store.redo() : store.undo();
        if (id) navigate(`/books/${book.id}/pages/${id}`, { replace: true });
    }
    useEffect(() => {
        store.setAutosavePaused(
            'empty-editor',
            busy || infoBusy || shareBusy || dirty || infoDirty,
        );
        return () => store.setAutosavePaused('empty-editor', false);
    }, [store, busy, infoBusy, shareBusy, dirty, infoDirty]);
    useEffect(() => {
        const save = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
            )
                return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!blocked && !dirty && !infoDirty) void store.save();
            }
            if (
                (event.target as HTMLElement)?.closest(
                    'input,textarea,select,[contenteditable=true]',
                )
            )
                return;
            if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
                event.preventDefault();
                if (blocked || dirty || infoDirty) return;
                const id =
                    event.shiftKey || event.key.toLowerCase() === 'y' ? store.redo() : store.undo();
                if (id) navigate(`/books/${book.id}/pages/${id}`, { replace: true });
            }
        };
        document.addEventListener('keydown', save);
        return () => document.removeEventListener('keydown', save);
    }, [store, dirty, infoDirty, blocked, navigate, book.id]);
    return (
        <SceneEditorFrame data-panel="properties" data-empty-book aria-labelledby="scene-heading">
            <NavigationGuard
                dirty={dirty || infoDirty || state.dirty || state.uncertain}
                allowBookNavigation={!dirty && !infoDirty && !blocked && !state.saving}
                onSave={async () => {
                    if (dirty || infoDirty)
                        return 'Hãy hoàn tất hoặc đóng hộp thoại đang chỉnh sửa trước khi lưu sách.';
                    return store.save();
                }}
                saving={blocked || state.saving}
                dirtyDescription="Tài liệu hoặc thông tin bạn đang chọn chưa được lưu. Trang đã thêm vẫn được giữ trong sách."
            />
            <SceneEditorHeader>
                <div className="editor-project flex min-w-0 items-center gap-4">
                    <Link
                        to="/books"
                        aria-label="Bookaria - Về Studio"
                        className="editor-brand inline-flex size-12 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-primary focus-visible:bg-primary [&_img]:transition-[filter] hover:[&_img]:[filter:var(--logo-on-primary-filter)] focus-visible:[&_img]:[filter:var(--logo-on-primary-filter)]"
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
                                aria-label="Thông tin sách"
                                disabled={blocked || adding}
                                onClick={() =>
                                    beforeInfo.request('Sửa thông tin sách', () => setInfo(true))
                                }
                                className="inline-flex max-w-full items-center gap-2 rounded-sm p-0 text-left [font:inherit]"
                            >
                                <FileText className="size-4 shrink-0" aria-hidden="true" />
                                <span className="truncate">{book.title}</span>
                                <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                            </ActionButton>
                        </h1>
                        <p className="m-0 text-muted-foreground text-xs leading-4">Chưa có trang</p>
                    </div>
                    <Separator orientation="vertical" className="my-auto h-7 w-px" />
                    <fieldset className="m-0 flex shrink-0 items-center gap-1 border-0 p-0">
                        <legend className="sr-only">Công cụ trang</legend>
                        <ThemeSwitcher />
                        <SceneHistoryControls
                            undoChange={state.undoChange}
                            redoChange={state.redoChange}
                            canUndo={state.canUndo}
                            canRedo={state.canRedo}
                            disabled={blocked || dirty || infoDirty || adding}
                            onUndo={() => historyStep()}
                            onRedo={() => historyStep(true)}
                        />
                    </fieldset>
                </div>
                <SceneModeSwitcher value="properties" disabled onValueChange={() => undefined} />
                <div className="editor-save-actions flex min-w-0 items-center justify-end gap-3">
                    <EditorSaveStatus
                        dirty={state.dirty}
                        saving={state.saving}
                        autosaving={state.autosaving}
                        conflict={state.conflict}
                        uncertain={state.uncertain}
                        error={state.error}
                        disabled={busy || infoBusy}
                        onCheck={() => void store.readLatest(false)}
                        onReload={() => setResetting(true)}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 min-w-26"
                        aria-label="Lưu sách"
                        aria-busy={state.saving}
                        disabled={
                            !state.dirty ||
                            blocked ||
                            dirty ||
                            infoDirty ||
                            state.saving ||
                            state.conflict ||
                            state.uncertain
                        }
                        onClick={() => void store.save()}
                    >
                        <Save data-icon="inline-start" /> Lưu
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10"
                        disabled={
                            blocked ||
                            !book.currentVersion ||
                            book.visibility === 'PRIVATE' ||
                            book.takenDown
                        }
                        onClick={() => setSharing(true)}
                    >
                        <Share2 data-icon="inline-start" />
                        Chia sẻ
                    </Button>
                    <Button
                        size="sm"
                        className="editor-publish h-10 min-w-26"
                        disabled
                        title="Thêm trang để xuất bản sách"
                    >
                        <Send data-icon="inline-start" />
                        Xuất bản
                    </Button>
                </div>
            </SceneEditorHeader>
            <Feedback success={state.notice} />
            {resetting && (
                <ConfirmationDialog
                    title="Đọc lại sách đã lưu?"
                    description="Bản nháp sách và thay đổi các trang sẽ được thay bằng nội dung đã lưu trên máy chủ."
                    busy={state.saving}
                    onClose={() => setResetting(false)}
                >
                    <div className="mt-6 flex justify-end gap-2">
                        <Button
                            variant="outline"
                            disabled={state.saving}
                            onClick={() => setResetting(false)}
                        >
                            Giữ bản đang sửa
                        </Button>
                        <Button
                            disabled={state.saving}
                            onClick={async () => {
                                await store.readLatest(true);
                                setResetting(false);
                            }}
                        >
                            Xác nhận tải nội dung
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
            {beforeInfo.dialog}
            <SceneWorkbench hints={<SceneCanvasHints mode="translate" objects={[]} />}>
                <div>
                    <SceneEditorSidebar
                        activePanel="properties"
                        disabled
                        pageUnavailable
                        objectLimitReached={false}
                        helpOpen={help}
                        onAdd={() => undefined}
                        onInteractions={() => undefined}
                        onRecognition={() => undefined}
                        onSettings={() => undefined}
                        onShortcuts={() => setHelp(true)}
                        shortcutsRef={shortcutsAnchor}
                    />
                </div>
                <div
                    className="scene-workspace relative grid h-[calc(100dvh_-_64px)] min-h-125 min-w-0 flex-1 bg-[var(--editor-ground)] [--inspector-offset:0px]"
                    data-inspector-visible="false"
                >
                    <Empty
                        className="min-h-0 gap-7 px-8 pt-8 pb-[calc(var(--canvas-hints-height)_+_128px)]"
                        role="region"
                        aria-labelledby="empty-book-heading"
                    >
                        <EmptyMedia className="mb-0" aria-hidden="true">
                            <div
                                className="flex max-h-40 w-28 flex-col items-center justify-center gap-5 rounded-lg border border-border bg-surface px-5 py-6"
                                style={{ aspectRatio: 1 / book.pageAspect }}
                            >
                                <Plus className="size-7 text-muted-foreground" strokeWidth={1.5} />
                                <div className="flex w-full flex-col gap-2">
                                    <span className="h-1 w-full rounded-sm bg-border" />
                                    <span className="h-1 w-3/4 rounded-sm bg-border" />
                                </div>
                            </div>
                        </EmptyMedia>
                        <EmptyHeader className="max-w-96 gap-3">
                            <EmptyTitle className="text-2xl">
                                <h2 id="empty-book-heading">Sách chưa có trang</h2>
                            </EmptyTitle>
                            <EmptyDescription className="max-w-80 text-sm leading-6">
                                <p>
                                    Thêm trang trắng hoặc nhập PDF, ảnh bằng nút + ở thanh trang bên
                                    dưới.
                                </p>
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                    <ScenePageDock>
                        <PageStrip
                            book={book}
                            pageId=""
                            dirty={dirty || infoDirty}
                            disabled={infoBusy || state.saving || state.conflict || state.uncertain}
                            requestAction={(_label, action) => action()}
                            onBusyChange={setBusy}
                            onDraftChange={setDirty}
                            onAddingChange={setAdding}
                        />
                    </ScenePageDock>
                </div>
            </SceneWorkbench>
            {help && (
                <SceneShortcutsDialog
                    onClose={() => setHelp(false)}
                    returnFocus={shortcutsAnchor.current}
                />
            )}
            {sharing && (
                <PublicationDialog
                    book={book}
                    open
                    mode="share"
                    prepare={() => store.save()}
                    onShare={() => undefined}
                    onClose={() => setSharing(false)}
                    onEditInfo={() => {
                        setSharing(false);
                        setInfo(true);
                    }}
                    onBusyChange={setShareBusy}
                    onTaskChange={() => undefined}
                />
            )}
            {info && (
                <BookInfoDialog
                    bookId={book.id}
                    guardNavigation={false}
                    opener={infoAnchor.current}
                    onClose={() => setInfo(false)}
                    onBusyChange={setInfoBusy}
                    onDirtyChange={setInfoDirty}
                />
            )}
        </SceneEditorFrame>
    );
}
