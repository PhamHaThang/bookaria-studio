import { Focus, RotateCcw, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import type { Scene } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { assetsApi } from '../../assets';
import { useOptionalBookDraft } from '../../book-draft/ui/BookDraftProvider';
import { pagesApi } from '../../pages';
import { LocalPreviewStage, type PreviewView } from '../model/LocalPreviewStage';
import { PreviewRendererCache } from '../model/PreviewRendererCache';
import { makePreviewPayload } from '../model/preview';
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
}) {
    const [rendererCache] = useState(() => new PreviewRendererCache());
    useEffect(() => () => rendererCache.dispose(), [rendererCache]);
    return props.active ? (
        <ActivePreview key={props.page.id} {...props} rendererCache={rendererCache} />
    ) : null;
}
function ActivePreview({
    page,
    book,
    scene,
    unsaved,
    initialView,
    rendererCache,
}: {
    page: Page;
    book: BookDetail;
    scene: Scene;
    unsaved: boolean;
    initialView?: PreviewView;
    rendererCache: PreviewRendererCache;
}) {
    const bookDraft = useOptionalBookDraft();
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<LocalPreviewStage | null>(null),
        runtime = useRef<PageRuntime | null>(null);
    const [previewPageId, setPreviewPageId] = useState(page.id);
    const loadedPageId = useRef(page.id);
    const pages = [...book.pages].sort((a, b) => a.orderIndex - b.orderIndex);
    const view = useRef(initialView),
        muted = useRef(false),
        autoStart = useRef(false);
    const [revision, setRevision] = useState(0),
        [state, setState] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
    const [error, setError] = useState(''),
        [isMuted, setIsMuted] = useState(false),
        [phone, setPhone] = useState(false);
    useEffect(() => {
        void revision;
        if (!host.current) return;
        const controller = new AbortController(),
            element = host.current;
        let currentStage: LocalPreviewStage | undefined, currentRuntime: PageRuntime | undefined;
        setState('loading');
        setError('');
        const fail = (message: string) => {
            if (!controller.signal.aborted) {
                runtime.current?.stopMedia();
                setError(message);
                setState('error');
            }
        };
        const contextError = (event: Event) => fail((event as CustomEvent<string>).detail);
        element.addEventListener('preview-error', contextError);
        void (async () => {
            try {
                const initialForPage =
                    loadedPageId.current === previewPageId
                        ? view.current
                        : previewPageId === page.id
                          ? initialView
                          : undefined;
                await afterPreviewPaint(controller.signal);
                controller.signal.throwIfAborted();
                loadedPageId.current = previewPageId;
                currentStage = new LocalPreviewStage(
                    element,
                    initialForPage,
                    rendererCache.acquire(),
                );
                stage.current = currentStage;
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
                );
                controller.signal.throwIfAborted();
                currentRuntime = await buildScene(payload.page, payload.assets, controller.signal, {
                    notice: (message) => {
                        if (!controller.signal.aborted)
                            toast.warning(message, { id: 'local-preview-media' });
                    },
                    log: () => {},
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
                if (!controller.signal.aborted)
                    fail(
                        cause instanceof Error
                            ? cause.message
                            : 'Chưa mở được bản xem trước. Hãy thử lại.',
                    );
            }
        })();
        return () => {
            view.current = currentStage?.getView() || view.current;
            currentRuntime?.dispose();
            controller.abort();
            currentStage?.dispose();
            if (currentStage) rendererCache.release(currentStage.renderer);
            if (runtime.current === currentRuntime) runtime.current = null;
            if (stage.current === currentStage) stage.current = null;
            element.removeEventListener('preview-error', contextError);
            toast.dismiss('local-preview-media');
        };
    }, [page, book, scene, revision, previewPageId, initialView, rendererCache, bookDraft]);
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
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/40 p-6 backdrop-blur-md">
                        <div className="flex max-w-96 flex-col items-center gap-8 text-center">
                            {state === 'loading' ? (
                                <LoadingScreen compact message="Đang chuẩn bị bản xem trước…" />
                            ) : state === 'error' ? (
                                <>
                                    <p role="alert" className="m-0 text-sm leading-6">
                                        {error}
                                    </p>
                                    <Button onClick={() => setRevision((v) => v + 1)}>
                                        <RotateCcw />
                                        Thử lại
                                    </Button>
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
            <div className="flex h-10 shrink-0 items-center justify-between gap-4 border-border border-t px-5 text-muted-foreground text-xs">
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
