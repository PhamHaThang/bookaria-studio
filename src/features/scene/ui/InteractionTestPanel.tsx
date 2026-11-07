import { ExternalLink, Play, RotateCcw, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import type { InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import type { InteractionStepEvent } from '@/shared/scene-runtime/InteractionRunner';
import { WorkflowState } from '@/shared/scene-runtime/WorkflowState';
import { Button } from '@/shared/ui/primitives/button';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { assetsApi } from '../../assets';
import { LocalPreviewStage } from '../../preview/model/LocalPreviewStage';
import { makePreviewPayload } from '../../preview/model/preview';
import {
    type PreviewFailure,
    type PreviewRepair,
    previewFailure,
} from '../../preview/model/preview-problem';
import { memoryName, memoryValue } from '../model/memory-variables';

export function InteractionTestPanel({
    scene,
    rule,
    page,
    book,
    onStep,
    onClose,
    onReset,
    onMemoryChange,
    onRepair,
}: {
    scene: Scene;
    rule: InteractionRule;
    page: Page;
    book: BookDetail;
    onStep: (event: InteractionStepEvent) => void;
    onClose: () => void;
    onReset?: () => void;
    onMemoryChange?: (values: Record<string, boolean | number | string>) => void;
    onRepair: (repair: PreviewRepair) => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const stage = useRef<LocalPreviewStage | null>(null);
    const runtime = useRef<PageRuntime | null>(null);
    const [revision, setRevision] = useState(0);
    const [state, setState] = useState<'loading' | 'ready' | 'running' | 'done' | 'error'>(
        'loading',
    );
    const [message, setMessage] = useState('');
    const [failure, setFailure] = useState<PreviewFailure | null>(null);
    const [memory, setMemory] = useState<Record<string, boolean | number | string>>({});
    const [link, setLink] = useState<string | null>(null);
    const callback = useRef(onStep);
    callback.current = onStep;
    const memoryCallback = useRef(onMemoryChange);
    memoryCallback.current = onMemoryChange;
    useEffect(() => {
        void revision;
        const controller = new AbortController();
        let current: PageRuntime | undefined, currentStage: LocalPreviewStage | undefined;
        setState('loading');
        setMessage('');
        setFailure(null);
        setMemory({});
        setLink(null);
        const error = (event: Event) => {
            if (!controller.signal.aborted) {
                setMessage((event as CustomEvent<string>).detail);
                setState('error');
                runtime.current?.runner.cancelAll();
                runtime.current?.stopMedia();
            }
        };
        host.current?.addEventListener('preview-error', error);
        const element = host.current;
        void (async () => {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            if (controller.signal.aborted || !element) return;
            try {
                const isolated = structuredClone(scene);
                isolated.interactions = [{ ...structuredClone(rule), enabled: true }];
                const payload = await makePreviewPayload(
                    page,
                    book,
                    isolated,
                    assetsApi.detail,
                    controller.signal,
                );
                controller.signal.throwIfAborted();
                currentStage = new LocalPreviewStage(element);
                stage.current = currentStage;
                current = await buildScene(payload.page, payload.assets, controller.signal, {
                    state: new WorkflowState(undefined, payload.workflowVariables),
                    notice: (notice) => {
                        if (!controller.signal.aborted) setMessage(notice);
                    },
                    log: () => {},
                    navigate: (navigation) => {
                        const target =
                            navigation.target === 'page'
                                ? book.pages.find((item) => item.id === navigation.pageId)?.title ||
                                  'trang đã chọn'
                                : navigation.target === 'next'
                                  ? 'trang tiếp theo'
                                  : navigation.target === 'previous'
                                    ? 'trang trước'
                                    : 'kết thúc trải nghiệm';
                        setMessage(
                            `Đích của nhánh: ${target}. Mở Xem trước sách để thử chuyển trang thực tế.`,
                        );
                    },
                    link: (url) => {
                        if (!controller.signal.aborted) setLink(url);
                    },
                    step: (event) => {
                        if (!controller.signal.aborted) {
                            callback.current(event);
                            const values = current?.runner.progress.snapshot().values || {};
                            setMemory(values);
                            memoryCallback.current?.(values);
                            if (event.state === 'error') setState('error');
                            if (event.state === 'cancelled') {
                                setState('ready');
                                setMessage('Đã dừng bước đang chạy. Bạn có thể chạy lại.');
                            }
                        }
                    },
                });
                if (controller.signal.aborted) {
                    current.dispose();
                    return;
                }
                const values = current.runner.progress.snapshot().values;
                setMemory(values);
                memoryCallback.current?.(values);
                runtime.current = current;
                currentStage.setRuntime(current, payload.page);
                currentStage.start({ startRuntime: false });
                setState('ready');
            } catch (cause) {
                if (!controller.signal.aborted) {
                    current?.dispose();
                    const problem = previewFailure(cause);
                    setFailure(problem);
                    setMessage(problem.message);
                    setState('error');
                }
            }
        })();
        return () => {
            controller.abort();
            current?.dispose();
            currentStage?.dispose();
            element?.removeEventListener('preview-error', error);
            if (runtime.current === current) runtime.current = null;
            if (stage.current === currentStage) stage.current = null;
        };
    }, [scene, rule, page, book, revision]);
    async function run() {
        if (!runtime.current || !['ready', 'done'].includes(state)) return;
        const current = runtime.current;
        setState('running');
        setMessage('');
        setMemory({});
        setLink(null);
        await current.runner.run(rule.id);
        if (runtime.current === current)
            setState((previous) =>
                previous === 'error' || previous === 'ready' ? previous : 'done',
            );
    }
    const reset = () => {
        onReset?.();
        runtime.current?.runner.cancelAll();
        runtime.current?.stopMedia();
        // Rebuild from the authored snapshot; test transforms never touch the editor draft.
        setRevision((value) => value + 1);
    };
    return (
        <section
            aria-label="Chạy thử tương tác"
            className="flex h-full min-h-0 w-[min(42vw,600px)] shrink-0 flex-col border-border border-l bg-surface"
        >
            <header className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-4 py-3">
                <div className="min-w-0">
                    <h3 className="m-0 font-semibold text-sm">Thử tương tác</h3>
                    <p className="m-0 mt-1 text-muted-foreground text-xs">
                        Thử riêng luồng này. Scene gốc được giữ nguyên.
                    </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Đóng chạy thử" onClick={onClose}>
                    <X />
                </Button>
            </header>
            <div className="relative min-h-40 flex-1">
                <div ref={host} className="absolute inset-0" />
                {state === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface text-muted-foreground text-sm">
                        <Spinner />
                        Đang chuẩn bị scene…
                    </div>
                )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 border-border border-t p-4">
                {Object.keys(memory).length > 0 && (
                    <dl
                        aria-label="Ghi nhớ khi chạy thử"
                        className="m-0 flex max-h-24 flex-col gap-1 overflow-y-auto text-xs"
                    >
                        {Object.entries(memory).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-3">
                                <dt className="truncate text-muted-foreground">
                                    {memoryName(key, book.workflowVariables || [])}
                                </dt>
                                <dd className="m-0 font-medium">
                                    {memoryValue(
                                        book.workflowVariables?.find((item) => item.key === key)
                                            ?.initialValue ??
                                            (typeof value === 'number'
                                                ? 0
                                                : typeof value === 'boolean'
                                                  ? false
                                                  : ''),
                                    )}{' '}
                                    → {memoryValue(value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
                <p role="status" className="m-0 text-muted-foreground text-xs leading-5">
                    {message ||
                        (state === 'ready'
                            ? 'Bấm Chạy để mô phỏng sự kiện bắt đầu.'
                            : state === 'running'
                              ? 'Theo dõi các bước đang sáng trên sơ đồ.'
                              : state === 'done'
                                ? 'Đã chạy hết chuỗi lệnh. Âm thanh hoặc hoạt cảnh có thể vẫn đang phát.'
                                : state === 'error'
                                  ? 'Chưa chạy được tương tác.'
                                  : 'Đang tải nội dung…')}
                </p>
                {link && (
                    <Button variant="outline" size="sm" asChild>
                        <a href={link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink data-icon="inline-start" />
                            Mở liên kết vừa yêu cầu
                        </a>
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    <Button size="sm" disabled={state !== 'ready'} onClick={() => void run()}>
                        <Play data-icon="inline-start" />
                        Chạy
                    </Button>
                    {failure?.repair ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRepair(failure.repair as PreviewRepair)}
                        >
                            {failure.repair.kind === 'memory'
                                ? 'Sửa thông tin ghi nhớ'
                                : 'Sửa tương tác'}
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={state === 'loading'}
                            onClick={reset}
                        >
                            {state === 'running' ? (
                                <Square data-icon="inline-start" />
                            ) : (
                                <RotateCcw data-icon="inline-start" />
                            )}
                            {state === 'running'
                                ? 'Dừng và đặt lại'
                                : state === 'error'
                                  ? 'Thử lại'
                                  : 'Đặt lại scene'}
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}
