import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
    describeSceneChange,
    historyFeedback,
} from '../../src/features/book-draft/model/history-description';
import {
    notifyHistoryFeedback,
    SceneHistoryControls,
} from '../../src/features/scene/ui/SceneHistoryControls';
import { Toaster } from '../../src/shared/ui/primitives/sonner';
import '../../src/index.css';
import { newObject } from '../../src/features/scene/model/objects';
import {
    InteractionEditor,
    type InteractionEditorHandle,
} from '../../src/features/scene/ui/InteractionEditor';
import { SceneUnitsProvider } from '../../src/features/scene/ui/SceneUnits';
import { BookDetailSchema, PageSchema } from '../../src/shared/contracts/dto.schema';
import {
    PageSettingsSchema,
    type Scene,
    SceneObjectSchema,
    type WorkflowVariable,
} from '../../src/shared/contracts/scene.schema';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';
import { Button } from '../../src/shared/ui/primitives/button';
import { TooltipProvider } from '../../src/shared/ui/primitives/tooltip';

const source = newObject('text', 'source'),
    target = newObject('text', 'target');
source.name = 'Khủng long';
source.text = 'Khủng long';
source.transform.position = [-0.2, 0, 0];
target.name = 'Thông tin';
target.text = 'Thông tin thử nghiệm';
target.visible = false;
if (new URLSearchParams(location.search).has('visible-content')) target.visible = true;
target.transform.position = [0.2, 0, 0.1];
const initial: Scene = {
    schemaVersion: 1,
    objects: [source, target],
    interactions: [
        {
            id: 'test-rule',
            name: 'Chạm để khám phá',
            enabled: true,
            trigger: { type: 'onTap', objectId: 'source' },
            onRetrigger: 'ignore',
            actions: [
                {
                    type: 'setVisible',
                    objectId: 'target',
                    value: true,
                    durationMs: 100,
                    delayMsSchema: 0,
                },
                { type: 'wait', ms: 800 },
                {
                    type: 'setVisible',
                    objectId: 'target',
                    value: false,
                    durationMs: 100,
                    delayMsSchema: 0,
                },
            ],
        },
    ],
};
if (new URLSearchParams(location.search).has('model-controls')) {
    initial.objects.push(
        SceneObjectSchema.parse({
            id: 'car',
            name: 'Xe thử nghiệm',
            type: 'model',
            assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            transform: {},
        }),
    );
}
const id = '11111111-1111-4111-8111-111111111111',
    bookId = '22222222-2222-4222-8222-222222222222';
const page = PageSchema.parse({
    id,
    bookId,
    orderIndex: 0,
    title: 'Trang thử nghiệm',
    thumbnailUrl: `${location.origin}/tests/browser/page.png`,
    markerMode: 'NONE',
    markerNumber: null,
    markerScore: null,
    markerWarnings: [],
    objectCount: 2,
    image: { url: `${location.origin}/tests/browser/page.png`, width: 1, height: 1 },
    markerReport: null,
    bookariaMarker: null,
    settings: PageSettingsSchema.parse({}),
    scene: initial,
    revision: 0,
    assets: {},
    updatedAt: new Date().toISOString(),
});
const book = BookDetailSchema.parse({
    id: bookId,
    title: 'Sách kiểm thử',
    coverUrl: null,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    takenDown: false,
    pageCount: 1,
    updatedAt: new Date().toISOString(),
    description: null,
    ageMin: null,
    ageMax: null,
    language: 'vi',
    topic: null,
    pageFormat: 'A4',
    pageAspect: Math.SQRT2,
    pageWidthMm: 210,
    slug: null,
    currentVersion: null,
    pages: [page],
});
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
    const [scene, setScene] = useState<Scene>(
        () => JSON.parse(localStorage.getItem('interaction-ui-saved') || 'null') || initial,
    );
    const [workflowVariables, setWorkflowVariables] = useState<WorkflowVariable[]>(() =>
        JSON.parse(localStorage.getItem('interaction-ui-memory') || '[]'),
    );
    const [invalid, setInvalid] = useState(false),
        [design, setDesign] = useState(false),
        [updates, setUpdates] = useState(0);
    const editor = useRef<InteractionEditorHandle>(null);
    const [requestedRule, setRequestedRule] = useState<{ id: string; request: number }>();
    const past = useRef<Scene[]>([]);
    const future = useRef<Scene[]>([]);
    const undoChange = past.current.at(-1)
        ? describeSceneChange(past.current.at(-1) as Scene, scene, id)
        : null;
    const redoChange = future.current.at(-1)
        ? describeSceneChange(scene, future.current.at(-1) as Scene, id)
        : null;
    const undo = useCallback(
        (redo = false) => {
            if (invalid) return;
            const from = redo ? future.current : past.current;
            const to = redo ? past.current : future.current;
            const previous = from.pop();
            if (!previous) return;
            const change = redo
                ? describeSceneChange(scene, previous, id)
                : describeSceneChange(previous, scene, id);
            to.push(scene);
            setScene(previous);
            notifyHistoryFeedback(historyFeedback(change, redo), !design, (target) => {
                setRequestedRule({ id: target.ruleId, request: Date.now() });
                setDesign(false);
            });
        },
        [invalid, scene, design],
    );
    useEffect(() => {
        function keyboard(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                invalid ||
                !(event.ctrlKey || event.metaKey) ||
                (event.target as HTMLElement).closest(
                    'input,textarea,[role=combobox],[contenteditable=true]',
                )
            )
                return;
            const key = event.key.toLowerCase();
            if (key !== 'z' && key !== 'y') return;
            event.preventDefault();
            undo(key === 'y' || event.shiftKey);
        }
        window.addEventListener('keydown', keyboard);
        return () => window.removeEventListener('keydown', keyboard);
    }, [invalid, undo]);
    Object.assign(window, { __interaction: { scene, invalid, updates, workflowVariables } });
    return (
        <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface text-foreground">
            <header className="flex h-16 shrink-0 items-center justify-between border-border border-b px-5">
                <strong>Sách kiểm thử tương tác</strong>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => editor.current?.confirmLeave(() => setDesign(true))}
                    >
                        Thiết kế
                    </Button>
                    <SceneHistoryControls
                        undoChange={undoChange}
                        redoChange={redoChange}
                        canUndo={past.current.length > 0}
                        canRedo={future.current.length > 0}
                        disabled={invalid}
                        onUndo={() => undo()}
                        onRedo={() => undo(true)}
                    />
                    <Button variant="ghost" onClick={() => setDesign(false)}>
                        Tương tác
                    </Button>
                    <Button
                        disabled={invalid}
                        onClick={() => {
                            localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
                            localStorage.setItem(
                                'interaction-ui-memory',
                                JSON.stringify(workflowVariables),
                            );
                        }}
                    >
                        Lưu sách
                    </Button>
                </div>
            </header>
            <div className="min-h-0 flex-1">
                {design ? (
                    <p>Đang ở thiết kế</p>
                ) : (
                    <InteractionEditor
                        ref={editor}
                        requestedRule={requestedRule}
                        scene={scene}
                        assets={{}}
                        disabled={false}
                        page={page}
                        book={{ ...book, workflowVariables }}
                        onWorkflowVariablesChange={setWorkflowVariables}
                        onDirtyChange={setInvalid}
                        onChange={(next) => {
                            past.current.push(scene);
                            future.current = [];
                            setUpdates((count) => count + 1);
                            setScene(next);
                        }}
                    />
                )}
            </div>
            <Toaster />
        </main>
    );
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing test root');
createRoot(root).render(
    <BrowserRouter>
        <QueryClientProvider client={client}>
            <ThemeProvider>
                <TooltipProvider>
                    <SceneUnitsProvider widthMm={210}>
                        <Harness />
                    </SceneUnitsProvider>
                </TooltipProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </BrowserRouter>,
);
