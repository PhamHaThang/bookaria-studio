import { ExternalLink, List, Play, RotateCcw, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { BookDetail, Page } from '@/shared/contracts/dto.schema';
import type { InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { buildScene, type PageRuntime } from '@/shared/scene-runtime/buildScene';
import type { InteractionStepEvent } from '@/shared/scene-runtime/InteractionRunner';
import { WorkflowState } from '@/shared/scene-runtime/WorkflowState';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';
import { ScrollArea } from '@/shared/ui/primitives/scroll-area';
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

const simulatedEvents = [
    { type: 'onMarkerFound', label: 'Nhận diện AR' },
    { type: 'onMarkerLost', label: 'Mất dấu AR' },
    { type: 'onPageLeave', label: 'Rời trang' },
] as const;

export function InteractionTestPanel({
    scene,
    rule,
    page,
    book,
    onStep,
    onReset,
    onMemoryChange,
    onRepair,
    mode = 'rule',
}: {
    scene: Scene;
    rule: InteractionRule;
    page: Page;
    book: BookDetail;
    onStep: (event: InteractionStepEvent) => void;
    onReset?: () => void;
    onMemoryChange?: (values: Record<string, boolean | number | string>) => void;
    onRepair: (repair: PreviewRepair) => void;
    mode?: 'page' | 'rule';
}) {
    const host = useRef<HTMLDivElement>(null);
    const controls = useRef<HTMLDivElement>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const stage = useRef<LocalPreviewStage | null>(null);
    const runtime = useRef<PageRuntime | null>(null);
    const [revision, setRevision] = useState(0);
    const [state, setState] = useState<'loading' | 'ready' | 'running' | 'done' | 'error'>(
        'loading',
    );
    const [message, setMessage] = useState('');
    const [pagePhase, setPagePhase] = useState<'active' | 'leaving' | 'left'>('active');
    const [failure, setFailure] = useState<PreviewFailure | null>(null);
    const [memory, setMemory] = useState<Record<string, boolean | number | string>>({});
    const [link, setLink] = useState<string | null>(null);
    const [events, setEvents] = useState<(InteractionStepEvent & { sequence: number })[]>([]);
    const sequence = useRef(0);
    const [tapTarget, setTapTarget] = useState(
        scene.objects.find((object) => object.type !== 'audio')?.id || '',
    );
    const callback = useRef(onStep);
    callback.current = onStep;
    const memoryCallback = useRef(onMemoryChange);
    memoryCallback.current = onMemoryChange;
    useEffect(() => {
        heading.current?.focus();
    }, []);
    useEffect(() => {
        void revision;
        const controller = new AbortController();
        let current: PageRuntime | undefined, currentStage: LocalPreviewStage | undefined;
        setState('loading');
        setPagePhase('active');
        setMessage('');
        setFailure(null);
        setMemory({});
        setLink(null);
        setEvents([]);
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
                if (mode === 'rule')
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
                            const item = { ...event, sequence: ++sequence.current };
                            setEvents((previous) => [...previous.slice(-5), item]);
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
                setState('ready');
                currentStage.start({ startRuntime: mode === 'page' });
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
    }, [scene, rule, page, book, revision, mode]);
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
    const availableEvents =
        mode === 'page'
            ? simulatedEvents.filter(({ type }) =>
                  scene.interactions.some((item) => item.enabled && item.trigger.type === type),
              )
            : [];
    const canInteract = state === 'ready' && pagePhase === 'active';
    async function simulate(event: (typeof simulatedEvents)[number]) {
        const current = runtime.current;
        if (!current || !canInteract) return;
        setMessage(`Đã mô phỏng ${event.label.toLowerCase()}.`);
        if (event.type === 'onMarkerFound') current.markerFound();
        else if (event.type === 'onMarkerLost') current.markerLost();
        else {
            setPagePhase('leaving');
            await current.leave();
            if (runtime.current === current) setPagePhase('left');
        }
    }
    const status =
        pagePhase === 'leaving'
            ? 'Đang chạy các bước khi rời trang…'
            : pagePhase === 'left' && state !== 'error'
              ? 'Đã rời trang. Chọn Đặt lại từ đầu để thử lại.'
              : message ||
                {
                    loading: 'Đang tải nội dung…',
                    ready:
                        mode === 'page'
                            ? 'Chạm nội dung trong khung hoặc dùng Chạm thử.'
                            : 'Bấm Chạy để mô phỏng sự kiện bắt đầu.',
                    running: 'Theo dõi các bước đang sáng trên sơ đồ.',
                    done: 'Đã chạy hết các bước của luồng.',
                    error: 'Chưa chạy được tương tác.',
                }[state];
    return (
        <section
            aria-label="Chạy thử tương tác"
            className="flex h-full min-h-0 w-[min(42vw,600px)] shrink-0 flex-col border-border border-l-2 bg-surface"
        >
            <header className="min-w-0 shrink-0 border-border border-b px-4 py-3">
                <div className="min-w-0">
                    <h3
                        ref={heading}
                        tabIndex={-1}
                        className="m-0 truncate font-semibold text-sm outline-none"
                        title={mode === 'rule' ? rule.name : undefined}
                    >
                        {mode === 'page'
                            ? 'Thử cả trang'
                            : `Thử riêng: ${rule.name || 'Luồng chưa đặt tên'}`}
                    </h3>
                    <p className="m-0 mt-1 text-muted-foreground text-xs">
                        {mode === 'page'
                            ? 'Các luồng đang bật dùng chung ghi nhớ và chạy theo sự kiện.'
                            : rule.trigger.type === 'onStateCondition'
                              ? 'Thử riêng các bước. Dùng nút Chạy thử để kiểm tra ghi nhớ kích hoạt luồng trên cả trang.'
                              : 'Mô phỏng sự kiện của luồng này; các luồng khác không chạy.'}
                    </p>
                </div>
            </header>
            <div className="relative min-h-40 flex-1">
                <div
                    ref={host}
                    inert={pagePhase !== 'active'}
                    className="absolute inset-0 [--editor-ground:var(--bg-surface-subtle)]"
                />
                {state === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface text-muted-foreground text-sm">
                        <Spinner />
                        Đang chuẩn bị scene…
                    </div>
                )}
            </div>
            <div
                ref={controls}
                className="flex shrink-0 flex-col gap-2 border-border border-t px-4 py-3"
            >
                {mode === 'page' && (
                    <div className="flex items-center gap-2">
                        <FormSelect
                            aria-label="Đối tượng chạm khi thử"
                            value={tapTarget}
                            disabled={!canInteract}
                            options={scene.objects
                                .filter((object) => object.type !== 'audio')
                                .map((object) => ({
                                    value: object.id,
                                    label: object.name || object.type,
                                }))}
                            onValueChange={setTapTarget}
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={!tapTarget || !canInteract}
                            onClick={() => {
                                runtime.current?.tap(tapTarget);
                            }}
                        >
                            Chạm thử
                        </Button>
                    </div>
                )}
                <div className="flex h-5 shrink-0 items-center gap-2">
                    <p
                        role="status"
                        title={status}
                        className="m-0 min-w-0 flex-1 truncate text-muted-foreground text-xs leading-5"
                    >
                        {status}
                    </p>
                    {link && (
                        <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Mở liên kết vừa yêu cầu"
                            className="inline-flex shrink-0 items-center gap-1 text-link text-xs underline underline-offset-4"
                        >
                            <ExternalLink className="size-3.5" />
                            Mở liên kết
                        </a>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {mode === 'rule' && (
                        <Button
                            size="sm"
                            disabled={!['ready', 'done'].includes(state)}
                            onClick={() => void run()}
                        >
                            <Play data-icon="inline-start" />
                            Chạy
                        </Button>
                    )}
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
                            disabled={state === 'loading' || pagePhase === 'leaving'}
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
                                  : 'Đặt lại từ đầu'}
                        </Button>
                    )}
                    {availableEvents.length > 0 && (
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild disabled={!canInteract}>
                                <Button variant="outline" size="sm" disabled={!canInteract}>
                                    Mô phỏng sự kiện
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                                {availableEvents.map((event) => (
                                    <DropdownMenuItem
                                        key={event.type}
                                        onSelect={() => void simulate(event)}
                                    >
                                        {event.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" aria-label="Chi tiết chạy thử">
                                <List data-icon="inline-start" />
                                Chi tiết
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            aria-label="Chi tiết chạy thử"
                            side="top"
                            align="end"
                            collisionPadding={12}
                            className="max-h-[min(28rem,70dvh)] w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
                            onInteractOutside={(event) => {
                                // Keep live details open while tapping or resetting the preview controls.
                                if (
                                    event.target instanceof Node &&
                                    controls.current?.contains(event.target)
                                )
                                    event.preventDefault();
                            }}
                        >
                            <div className="flex shrink-0 items-center justify-between gap-3 border-border border-b px-3 py-2">
                                <h4 className="m-0 font-semibold text-sm">Chi tiết chạy thử</h4>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Đóng chi tiết chạy thử"
                                    onClick={() => setDetailsOpen(false)}
                                >
                                    <X />
                                </Button>
                            </div>
                            <ScrollArea
                                className="min-h-0"
                                viewportProps={{
                                    tabIndex: 0,
                                    'aria-label': 'Thông tin và nhật ký chạy thử',
                                    className: 'max-h-[min(23rem,calc(70dvh-3.5rem))]',
                                }}
                            >
                                <div className="space-y-4 p-3">
                                    <section aria-label="Thông tin ghi nhớ">
                                        <h5 className="mt-0 mb-2 font-medium text-xs">Ghi nhớ</h5>
                                        {Object.keys(memory).length > 0 && (
                                            <dl
                                                aria-label="Ghi nhớ khi chạy thử"
                                                className="m-0 flex flex-col gap-2 text-xs"
                                            >
                                                {Object.entries(memory).map(([key, value]) => (
                                                    <div
                                                        key={key}
                                                        className="flex items-center justify-between gap-3"
                                                    >
                                                        <dt className="truncate text-muted-foreground">
                                                            {memoryName(
                                                                key,
                                                                book.workflowVariables || [],
                                                            )}
                                                        </dt>
                                                        <dd className="wrap-anywhere m-0 max-w-[60%] text-right font-medium">
                                                            {memoryValue(
                                                                book.workflowVariables?.find(
                                                                    (item) => item.key === key,
                                                                )?.initialValue ??
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

                                        {!Object.keys(memory).length && (
                                            <p className="m-0 text-muted-foreground text-xs">
                                                Chưa có giá trị ghi nhớ.
                                            </p>
                                        )}
                                    </section>
                                    <section aria-label="Hoạt động của luồng">
                                        <h5 className="mt-0 mb-2 font-medium text-xs">Nhật ký</h5>
                                        {events.length > 0 && (
                                            <ol
                                                aria-label="Nhật ký chạy thử"
                                                className="m-0 flex list-none flex-col gap-2 p-0 text-xs"
                                            >
                                                {events.map((event) => (
                                                    <li
                                                        key={event.sequence}
                                                        className="wrap-anywhere"
                                                    >
                                                        <span className="font-medium">
                                                            {scene.interactions.find(
                                                                (item) => item.id === event.ruleId,
                                                            )?.name || 'Tương tác'}
                                                        </span>
                                                        : bước {event.index + 1} —{' '}
                                                        {event.state === 'waiting'
                                                            ? 'đang đợi'
                                                            : event.state === 'running'
                                                              ? 'đang chạy'
                                                              : event.state === 'done'
                                                                ? 'đã xong'
                                                                : event.state === 'cancelled'
                                                                  ? 'đã dừng'
                                                                  : 'có lỗi'}
                                                        {event.branch
                                                            ? ` · nhánh ${event.branch === 'true' ? 'Đúng' : 'Sai'}`
                                                            : ''}
                                                    </li>
                                                ))}
                                            </ol>
                                        )}

                                        {!events.length && (
                                            <p className="m-0 text-muted-foreground text-xs">
                                                Chưa có hoạt động nào.
                                            </p>
                                        )}
                                    </section>
                                    {message && (
                                        <section>
                                            <h5 className="mt-0 mb-2 font-medium text-xs">
                                                Thông báo
                                            </h5>
                                            <p className="m-0 break-words text-muted-foreground text-xs leading-5">
                                                {message}
                                            </p>
                                        </section>
                                    )}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </section>
    );
}
