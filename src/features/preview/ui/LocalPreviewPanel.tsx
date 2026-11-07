import { Focus, RotateCcw, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import type { Scene } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import { WorkflowState } from '@/shared/scene-runtime/WorkflowState';
import { Alert } from '@/shared/ui/Alert';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { assetsApi } from '../../assets';
import { useOptionalBookDraft } from '../../book-draft/ui/BookDraftProvider';
import { pagesApi } from '../../pages';
import type { InteractionProblem } from '../../scene/model/interaction-health';
import { LocalPreviewStage, type PreviewView } from '../model/LocalPreviewStage';
import { PreviewRendererCache } from '../model/PreviewRendererCache';
import { makePreviewPayload } from '../model/preview';
import { type PreviewFailure, type PreviewRepair, previewFailure } from '../model/preview-problem';
import { PhonePreviewDialog } from './PhonePreviewDialog';
import { PreviewPageStrip } from './PreviewPageStrip';

/** Let the loading UI and header paint before allocating a WebGL context.
 * Aborted StrictMode probes and rapid mode changes must not allocate one at all.
 */
function afterPreviewPaint(signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        let first = 0,
            second = 0;
        const abort = () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
            reject(signal.reason);
        };
        signal.addEventListener('abort', abort, { once: true });
        first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => {
                signal.removeEventListener('abort', abort);
                resolve();
            });
        });
    });
}

export function LocalPreviewPanel(props: {
    active: boolean;
    page: Page;
    book: BookDetail;
    scene: Scene;
    unsaved: boolean;
    initialView?: PreviewView;
    onRepair?: (repair: PreviewRepair, pageId: string) => void;
}) {
    const [rendererCache] = useState(() => new PreviewRendererCache());
    useEffect(() => () => rendererCache.dispose(), [rendererCache]);
    return props.active ? (
        <ActivePreview
            key={`${props.page.id}:${JSON.stringify(props.book.workflowVariables || [])}`}
            {...props}
            rendererCache={rendererCache}
        />
    ) : null;
}
function ActivePreview({
    page,
    book,
    scene,
    unsaved,
    initialView,
    rendererCache,
    onRepair,
}: {
    page: Page;
    book: BookDetail;
    scene: Scene;
    unsaved: boolean;
    initialView?: PreviewView;
    rendererCache: PreviewRendererCache;
    onRepair?: (repair: PreviewRepair, pageId: string) => void;
}) {
    const bookDraft = useOptionalBookDraft();
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<LocalPreviewStage | null>(null),
        runtime = useRef<PageRuntime | null>(null);
    const pages = useMemo(
        () => [...book.pages].sort((a, b) => a.orderIndex - b.orderIndex),
        [book.pages],
    );
    const [previewPageId, setPreviewPageId] = useState(() => pages[0]?.id || page.id);
    const loadedPageId = useRef(previewPageId);
    const progress = useRef(new WorkflowState(undefined, book.workflowVariables || []));
    const retiring = useRef<Promise<void>>(Promise.resolve());
    const automaticHops = useRef(0);
    const view = useRef(previewPageId === page.id ? initialView : undefined),
        muted = useRef(false),
        autoStart = useRef(false);
    const [revision, setRevision] = useState(0),
        [state, setState] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
    const [error, setError] = useState(''),
        [isMuted, setIsMuted] = useState(false),
        [phone, setPhone] = useState(false);
    const [failure, setFailure] = useState<PreviewFailure | null>(null);
    const [problems, setProblems] = useState<InteractionProblem[]>([]);
    useEffect(() => {
        void revision;
        if (!host.current) return;
        const controller = new AbortController(),
            element = host.current;
        let currentStage: LocalPreviewStage | undefined, currentRuntime: PageRuntime | undefined;
        setState('loading');
        setError('');
        setFailure(null);
        setProblems([]);
        const fail = (message: string) => {
            if (!controller.signal.aborted) {
                runtime.current?.stopMedia();
                setError(message);
                setState('error');
            }
        };
        const contextError = (event: Event) => {
            setFailure(null);
            fail((event as CustomEvent<string>).detail);
        };
        element.addEventListener('preview-error', contextError);
        void (async () => {
            try {
                const initialForPage =
                    loadedPageId.current === previewPageId
                        ? view.current
                        : previewPageId === page.id
                          ? initialView
                          : undefined;
                await retiring.current;
                controller.signal.throwIfAborted();
                await afterPreviewPaint(controller.signal);
                controller.signal.throwIfAborted();
                loadedPageId.current = previewPageId;
                const previewPage =
                    previewPageId === page.id
                        ? page
                        : bookDraft
                          ? await bookDraft.loadPage(previewPageId)
                          : await pagesApi.detail(previewPageId, controller.signal);
                const payload = await makePreviewPayload(
                    previewPage,
                    book,
                    structuredClone(previewPageId === page.id ? scene : previewPage.scene),
                    assetsApi.detail,
                    controller.signal,
                    { allowInvalidInteractions: true },
                );
                controller.signal.throwIfAborted();
                setProblems(payload.problems);
                currentStage = new LocalPreviewStage(
                    element,
                    initialForPage,
                    rendererCache.acquire(),
                );
                stage.current = currentStage;
                currentRuntime = await buildScene(payload.page, payload.assets, controller.signal, {
                    notice: (message) => {
                        if (!controller.signal.aborted)
                            toast.warning(message, { id: 'local-preview-media' });
                    },
                    log: () => {},
                    state: progress.current,
                    tap: () => {
                        automaticHops.current = 0;
                    },
                    navigate: (navigation) =>
                        queueMicrotask(() => {
                            if (controller.signal.aborted) return;
                            if (++automaticHops.current > 8) {
                                toast.error(
                                    'Luồng đang chuyển trang liên tục. Kiểm tra sự kiện vào trang.',
                                );
                                return;
                            }
                            if (navigation.target === 'end') {
                                currentRuntime?.runner.cancelAll();
                                currentRuntime?.stopMedia();
                                autoStart.current = false;
                                setState('ready');
                                toast.success(navigation.message || 'Đã hoàn thành trải nghiệm.');
                                return;
                            }
                            const index = pages.findIndex((item) => item.id === previewPageId);
                            const next =
                                navigation.target === 'next'
                                    ? pages[index + 1]
                                    : navigation.target === 'previous'
                                      ? pages[index - 1]
                                      : pages.find((item) => item.id === navigation.pageId);
                            if (!next || next.id === previewPageId) {
                                toast.info('Không có trang tiếp theo ở hướng này.');
                                return;
                            }
                            autoStart.current = true;
                            view.current = undefined;
                            setPreviewPageId(next.id);
                        }),
                    link: (url) => {
                        if (!controller.signal.aborted && /^https?:\/\//i.test(url))
                            window.open(url, '_blank', 'noopener,noreferrer');
                    },
                });
                if (controller.signal.aborted) {
                    currentRuntime.dispose();
                    return;
                }
                runtime.current = currentRuntime;
                currentStage.setRuntime(currentRuntime, payload.page);
                currentRuntime.mute(muted.current);
                if (autoStart.current) {
                    currentStage.start();
                    setState('playing');
                } else setState('ready');
            } catch (cause) {
                if (!controller.signal.aborted) {
                    const problem = previewFailure(cause);
                    setFailure(problem);
                    fail(problem.message);
                }
            }
        })();
        return () => {
            view.current = currentStage?.getView() || view.current;
            if (currentRuntime) {
                const previous = currentRuntime;
                const leaving = previous.leave().finally(() => {
                    previous.dispose();
                    controller.abort();
                });
                retiring.current = Promise.all([retiring.current, leaving])
                    .then(() => undefined)
                    .catch(() => undefined);
            } else controller.abort();
            currentStage?.dispose();
            if (currentStage) rendererCache.release(currentStage.renderer);
            if (runtime.current === currentRuntime) runtime.current = null;
            if (stage.current === currentStage) stage.current = null;
            element.removeEventListener('preview-error', contextError);
            toast.dismiss('local-preview-media');
        };
    }, [page, book, scene, revision, previewPageId, initialView, rendererCache, bookDraft, pages]);
    const start = () => {
        if (state !== 'ready') return;
        autoStart.current = true;
        runtime.current?.retryMedia();
        stage.current?.start();
        setState('playing');
    };
    return (
        <section
            aria-label="Xem trước trực tiếp"
            className="relative flex h-full min-h-0 flex-col bg-[var(--editor-ground)]"
        >
            {problems.length > 0 && state !== 'loading' && state !== 'error' && (
                <Alert tone="warning" className="shrink-0 rounded-none border-x-0 border-t-0">
                    <p className="m-0 font-medium">
                        Tạm bỏ qua {new Set(problems.map((problem) => problem.ruleId)).size} luồng
                        cần sửa. Các nội dung khác vẫn xem được.
                    </p>
                    <ul className="m-0 mt-2 flex max-h-24 list-none flex-col gap-2 overflow-y-auto p-0">
                        {[
                            ...new Map(
                                problems.map((problem) => [problem.ruleId, problem]),
                            ).values(),
                        ].map((problem) => (
                            <li
                                key={problem.ruleId}
                                className="flex items-center justify-between gap-4"
                            >
                                <span>
                                    “{problem.ruleName}”: {problem.message}
                                </span>
                                {onRepair && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        aria-label={`Sửa luồng ${problem.ruleName}`}
                                        onClick={() =>
                                            onRepair(
                                                {
                                                    kind: 'interaction',
                                                    ruleId: problem.ruleId,
                                                    actionIndex: problem.actionIndex,
                                                },
                                                previewPageId,
                                            )
                                        }
                                    >
                                        Sửa tương tác
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </Alert>
            )}
            <div className="relative min-h-0 flex-1" data-testid="local-preview-stage">
                <div
                    ref={host}
                    inert={state !== 'playing'}
                    className={cn(
                        'absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none',
                        state === 'loading' ? 'opacity-0' : 'opacity-100',
                    )}
                />
                <div
                    inert={state !== 'playing'}
                    className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center"
                >
                    <PreviewPageStrip
                        pages={pages}
                        currentPageId={previewPageId}
                        loading={state === 'loading'}
                        onSelect={(id) => {
                            if (id === previewPageId) return;
                            setState('loading');
                            setPreviewPageId(id);
                        }}
                    />
                </div>
                <fieldset
                    aria-label="Công cụ xem trước"
                    inert={state !== 'playing'}
                    className="absolute top-4 right-4 flex items-center gap-1 rounded-2xl border border-border bg-surface p-1.5"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isMuted ? 'Bật tiếng xem trước' : 'Tắt tiếng xem trước'}
                        title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
                        disabled={state === 'loading' || state === 'error'}
                        onClick={() => {
                            muted.current = !muted.current;
                            setIsMuted(muted.current);
                            runtime.current?.mute(muted.current);
                        }}
                    >
                        {isMuted ? <VolumeX /> : <Volume2 />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Khôi phục góc nhìn xem trước"
                        title="Góc nhìn ban đầu"
                        onClick={() => stage.current?.resetView()}
                        disabled={state === 'loading'}
                    >
                        <Focus />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={state === 'loading'}
                        onClick={() => {
                            autoStart.current = state === 'playing';
                            setRevision((v) => v + 1);
                        }}
                    >
                        <RotateCcw />
                        Chạy lại
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPhone(true)}>
                        <Smartphone />
                        Thử AR
                    </Button>
                </fieldset>
                {state !== 'playing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface p-6">
                        <div className="flex max-w-96 flex-col items-center gap-8 text-center">
                            {state === 'loading' ? (
                                <LoadingScreen compact message="Đang chuẩn bị bản xem trước…" />
                            ) : state === 'error' ? (
                                <>
                                    <p role="alert" className="m-0 text-sm leading-6">
                                        {error}
                                    </p>
                                    {failure?.repair && onRepair && (
                                        <Button
                                            onClick={() =>
                                                onRepair(
                                                    failure.repair as PreviewRepair,
                                                    previewPageId,
                                                )
                                            }
                                        >
                                            {failure.repair.kind === 'memory'
                                                ? 'Sửa thông tin ghi nhớ'
                                                : failure.repair.kind === 'interaction'
                                                  ? 'Sửa tương tác'
                                                  : 'Về Thiết kế'}
                                        </Button>
                                    )}
                                    {failure?.retryable !== false && (
                                        <Button onClick={() => setRevision((v) => v + 1)}>
                                            <RotateCcw />
                                            Thử lại
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <BookariaLogo symbol className="w-30" />
                                    <Button className="min-w-40" onClick={start}>
                                        Bắt đầu xem
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex h-10 shrink-0 items-center justify-between gap-4 border-border border-t bg-surface px-5 text-muted-foreground text-xs">
                <span>
                    Nhấp: tương tác · Kéo trái: xoay · Phải / Space + kéo: dịch · Giữa + kéo / Cuộn:
                    zoom
                </span>
                <span>Về editor để tiếp tục chỉnh sửa</span>
            </div>
            {phone && (
                <PhonePreviewDialog
                    bookId={book.id}
                    pageId={previewPageId}
                    unsaved={unsaved}
                    onClose={() => setPhone(false)}
                />
            )}
        </section>
    );
}
