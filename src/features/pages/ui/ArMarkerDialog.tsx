import { useQueryClient } from '@tanstack/react-query';
import { Image, ImageOff, QrCode, RotateCcw, Scan, Star, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ContractError } from '@/shared/api/contract';
import { errorMessage } from '@/shared/api/errors';
import type { BookDetail, Job, Page } from '@/shared/contracts/dto.schema';
import {
    defaultMarkerTransform,
    MARKER_RULES,
    markerToMm,
    pageWidthMm,
} from '@/shared/contracts/marker.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button as IconButton } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { compileMarker } from '../api/compile-marker';
import { type MindCheckpoint, prepareMarkerUpload } from '../model/marker-upload';
import { pageKeys, pagesApi } from '../model/pages';
import { placementFromForm } from '../model/placement';
import { MarkerPlacementPreview } from './MarkerPlacementPreview';

const options = [
    {
        value: 'BOOKARIA_MARKER',
        label: 'Marker Bookaria',
        description: 'Marker tạo sẵn trên bản in',
        icon: QrCode,
    },
    {
        value: 'CUSTOM_MARKER',
        label: 'Dùng ảnh trang',
        description: 'Quét trực tiếp ảnh trong sách',
        icon: Image,
    },
    {
        value: 'NONE',
        label: 'Không dùng AR',
        description: 'Trang không cần nhận diện',
        icon: ImageOff,
    },
] as const;

export function ArMarkerDialog({
    page,
    book,
    disabled,
    scoring,
    job,
    jobError,
    onCheckJob,
    onRefresh,
    onJob,
    onBusyChange,
    onClose,
}: {
    page: Page;
    book: BookDetail;
    disabled: boolean;
    scoring: boolean;
    job?: Job;
    jobError?: string | null;
    onCheckJob: () => void;
    onRefresh: () => void;
    onJob: (id: string | null) => void;
    onBusyChange: (value: boolean) => void;
    onClose: () => void;
}) {
    const { user } = useAuth(),
        cache = useQueryClient();
    const geometry = {
        format: book.pageFormat,
        aspect: book.pageAspect,
        widthMm: book.pageWidthMm,
    };
    const initial = markerToMm(
        page.bookariaMarker?.transform || defaultMarkerTransform(geometry, page.orderIndex),
        geometry,
    );
    const [mode, setMode] = useState(page.markerMode);
    const initialPlacement = useRef({
        centerX: initial.centerXMm.toFixed(1),
        centerY: initial.centerYMm.toFixed(1),
        size: initial.sizeMm.toFixed(1),
    });
    const [placement, setPlacement] = useState(initialPlacement.current);
    const [busy, setBusy] = useState(false),
        [stage, setStage] = useState(''),
        [progress, setProgress] = useState(0);
    const [notice, setNotice] = useState<string | null>(null);
    const errorToastId = useId();
    const [heatmap, setHeatmap] = useState(false);
    const controller = useRef<AbortController | null>(null),
        checkpoint = useRef<MindCheckpoint | null>(null);
    const guard = useRef(false),
        alive = useRef(true);
    const dirty =
        mode !== page.markerMode ||
        (mode === 'BOOKARIA_MARKER' &&
            JSON.stringify(placement) !== JSON.stringify(initialPlacement.current));
    useEffect(() => {
        onBusyChange(busy);
        return () => onBusyChange(false);
    }, [busy, onBusyChange]);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            controller.current?.abort();
        };
    }, []);
    const currentSession = () => alive.current && auth.store.getState().user?.id === user?.id;
    async function refresh() {
        await Promise.all([
            cache.invalidateQueries({ queryKey: pageKeys.all }),
            cache.invalidateQueries({ queryKey: bookKeys.all }),
        ]);
    }
    async function run(action: (signal: AbortSignal) => Promise<boolean>) {
        if (guard.current || disabled || scoring) return;
        guard.current = true;
        const active = new AbortController();
        controller.current = active;
        setBusy(true);
        toast.dismiss(errorToastId);
        setNotice(null);
        setProgress(0);
        try {
            const close = await action(active.signal);
            if (!currentSession() || active.signal.aborted) return;
            await refresh();
            if (!currentSession() || active.signal.aborted) return;
            if (close) onClose();
        } catch (cause) {
            if (currentSession() && !active.signal.aborted)
                toast.error(errorMessage(cause), { id: errorToastId, duration: 6000 });
        } finally {
            guard.current = false;
            controller.current = null;
            if (alive.current) {
                setBusy(false);
                setStage('');
            }
        }
    }
    function updatePage(value: Partial<Page>) {
        if (!currentSession()) return;
        cache.setQueryData<Page>(pageKeys.detail(user?.id || '', page.id), (current) =>
            current ? { ...current, ...value } : current,
        );
    }
    async function apply() {
        if (!dirty) return;
        await run(async (signal) => {
            if (mode === 'NONE') {
                setStage('Đang tắt nhận diện AR…');
                const result = await pagesApi.update(page.id, { noAr: true });
                if (!currentSession()) return false;
                updatePage({ ...result, bookariaMarker: null, markerReport: null });
                onJob(null);
                return true;
            }
            if (mode === 'BOOKARIA_MARKER') {
                const form = new FormData();
                for (const [key, value] of Object.entries(placement)) form.set(key, value);
                const transform = placementFromForm(form, geometry);
                setStage('Đang áp dụng marker Bookaria…');
                const result = await pagesApi.setMarker(page.id, { mode, transform });
                if (!currentSession()) return false;
                if (result.processing) throw new ContractError();
                updatePage({
                    markerMode: 'BOOKARIA_MARKER',
                    markerNumber: result.markerNumber,
                    bookariaMarker: { number: result.markerNumber, transform: result.transform },
                    markerScore: null,
                    markerReport: null,
                    markerWarnings: [],
                });
                onJob(null);
                return true;
            }
            const markerMindPublicId = await prepareMarkerUpload({
                source: page.image.url,
                signal,
                checkpoint: checkpoint.current,
                onCheckpoint: (value) => {
                    checkpoint.current = value;
                },
                compile: compileMarker,
                api: assetsApi,
                transfer: uploadFile,
                onStage: (value) => {
                    setProgress(0);
                    setStage(
                        value === 'compiling'
                            ? 'Đang chuẩn bị nhận diện ảnh…'
                            : 'Đang tải dữ liệu nhận diện…',
                    );
                },
                onProgress: setProgress,
            });
            signal.throwIfAborted();
            setStage('Đang lưu nhận diện…');
            const result = await pagesApi.setMarker(page.id, {
                mode: 'CUSTOM_MARKER',
                markerMindPublicId,
            });
            if (!currentSession()) return false;
            if (!result.processing) throw new ContractError();
            updatePage({
                markerMode: 'CUSTOM_MARKER',
                markerNumber: null,
                bookariaMarker: null,
                markerScore: null,
                markerReport: null,
                markerWarnings: ['NOT_SCORED'],
            });
            onJob(result.jobId);
            setNotice('Đã áp dụng ảnh trang. Bạn có thể đóng cửa sổ trong lúc ảnh được đánh giá.');
            return false;
        });
    }
    const previewTransform = (() => {
        try {
            const form = new FormData();
            for (const [key, value] of Object.entries(placement)) form.set(key, value);
            return placementFromForm(form, geometry);
        } catch {
            return null;
        }
    })();
    return (
        <Dialog
            open
            onOpenChange={(value) => {
                if (!value && !busy) onClose();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="h-[min(820px,calc(100dvh-48px))] max-w-[min(1280px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogHeader className="relative gap-2 border-border border-b p-6 pr-16">
                    <DialogTitle className="m-0 flex items-center gap-3">
                        <QrCode className="size-6 shrink-0" aria-hidden="true" />
                        Thiết lập AR Marker
                    </DialogTitle>
                    <DialogDescription className="m-0">
                        Trang {page.orderIndex + 1} · Chọn cách người đọc quét và mở nội dung AR.
                    </DialogDescription>
                    <IconButton
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-5 right-5"
                        aria-label="Đóng thiết lập AR Marker"
                        disabled={busy}
                        onClick={onClose}
                    >
                        <X />
                    </IconButton>
                </DialogHeader>
                <form
                    className="flex min-h-0 flex-col"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void apply();
                    }}
                >
                    <Tabs
                        orientation="vertical"
                        value={mode}
                        onValueChange={(value) => {
                            setMode(value as typeof mode);
                            toast.dismiss(errorToastId);
                            setNotice(null);
                            setHeatmap(false);
                        }}
                        className="min-h-0 flex-1 gap-0 overflow-hidden"
                    >
                        <TabsList
                            variant="navigation"
                            aria-label="Cách nhận diện AR"
                            className="w-52 shrink-0 justify-start self-stretch rounded-none border-border border-r px-3 py-5"
                        >
                            {options.map(({ value, label, description, icon: Icon }) => (
                                <TabsTrigger
                                    key={value}
                                    value={value}
                                    disabled={busy || disabled || scoring}
                                    className="min-h-20 items-center gap-3 whitespace-normal"
                                >
                                    <Icon className="size-5! shrink-0" aria-hidden="true" />
                                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                                        <span>{label}</span>
                                        <span className="font-normal text-xs leading-4">
                                            {description}
                                        </span>
                                    </span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-6">
                            <fieldset
                                disabled={busy || disabled || scoring}
                                className="m-0 h-full min-h-0 min-w-0 border-0 p-0"
                            >
                                <TabsContent
                                    value="BOOKARIA_MARKER"
                                    className="m-0 flex h-full min-h-0 flex-col gap-5"
                                >
                                    <div className="flex shrink-0 flex-col gap-1.5">
                                        <h3 className="m-0 font-semibold text-base">
                                            Sắp xếp marker trên trang in
                                        </h3>
                                        <p className="m-0 text-muted-foreground text-sm">
                                            Marker được chèn vào bản PDF in. Kéo trực tiếp trên
                                            trang để chọn vị trí phù hợp.
                                        </p>
                                    </div>
                                    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_264px] gap-6">
                                        <MarkerPlacementPreview
                                            imageUrl={page.image.url}
                                            geometry={geometry}
                                            transform={
                                                previewTransform ||
                                                page.bookariaMarker?.transform ||
                                                defaultMarkerTransform(geometry, page.orderIndex)
                                            }
                                            markerNumber={page.markerNumber}
                                            disabled={busy || disabled || scoring}
                                            onChange={(value) => {
                                                setPlacement({
                                                    centerX: value.centerXMm.toFixed(1),
                                                    centerY: value.centerYMm.toFixed(1),
                                                    size: value.sizeMm.toFixed(1),
                                                });
                                                toast.dismiss(errorToastId);
                                            }}
                                        />
                                        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain pr-1">
                                            <div className="flex flex-col gap-2">
                                                <span className="font-medium text-sm">
                                                    Vị trí và kích thước
                                                </span>
                                                {page.markerNumber && (
                                                    <Badge variant="outline" className="w-fit">
                                                        Marker #{page.markerNumber}
                                                    </Badge>
                                                )}
                                                <p className="m-0 text-muted-foreground text-xs">
                                                    Tọa độ tâm tính từ góc trên trái của trang, đơn
                                                    vị mm.
                                                </p>
                                            </div>
                                            <FieldGroup className="gap-4">
                                                <FieldGroup className="grid grid-cols-2 gap-3">
                                                    {(
                                                        [
                                                            ['centerX', 'Tâm ngang (mm)'],
                                                            ['centerY', 'Tâm dọc (mm)'],
                                                            ['size', 'Cạnh (mm)'],
                                                        ] as const
                                                    ).map(([key, label]) => (
                                                        <Field
                                                            key={key}
                                                            className={
                                                                key === 'size'
                                                                    ? 'col-span-2 min-w-0 gap-1.5'
                                                                    : 'min-w-0 gap-1.5'
                                                            }
                                                        >
                                                            <FieldLabel
                                                                htmlFor={`ar-marker-${key}`}
                                                                className="m-0 text-xs"
                                                            >
                                                                {label}
                                                            </FieldLabel>
                                                            <Input
                                                                id={`ar-marker-${key}`}
                                                                name={key}
                                                                type="number"
                                                                step="0.1"
                                                                min={
                                                                    key === 'size'
                                                                        ? MARKER_RULES.minSizeMm
                                                                        : 0
                                                                }
                                                                required
                                                                value={placement[key]}
                                                                className="h-10 tabular-nums"
                                                                onChange={(event) => {
                                                                    const value =
                                                                        event.currentTarget.value;
                                                                    setPlacement((current) => ({
                                                                        ...current,
                                                                        [key]: value,
                                                                    }));
                                                                    toast.dismiss(errorToastId);
                                                                }}
                                                            />
                                                        </Field>
                                                    ))}
                                                </FieldGroup>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const width = pageWidthMm(
                                                                book.pageFormat,
                                                                book.pageWidthMm,
                                                            );
                                                            setPlacement((current) => ({
                                                                ...current,
                                                                centerX: (width / 2).toFixed(1),
                                                                centerY: (
                                                                    (width * book.pageAspect) /
                                                                    2
                                                                ).toFixed(1),
                                                            }));
                                                            toast.dismiss(errorToastId);
                                                        }}
                                                    >
                                                        <Scan data-icon="inline-start" />
                                                        Căn giữa
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            const value = markerToMm(
                                                                defaultMarkerTransform(
                                                                    geometry,
                                                                    page.orderIndex,
                                                                ),
                                                                geometry,
                                                            );
                                                            setPlacement({
                                                                centerX: value.centerXMm.toFixed(1),
                                                                centerY: value.centerYMm.toFixed(1),
                                                                size: value.sizeMm.toFixed(1),
                                                            });
                                                            toast.dismiss(errorToastId);
                                                        }}
                                                    >
                                                        <RotateCcw data-icon="inline-start" />
                                                        Mặc định
                                                    </Button>
                                                </div>
                                            </FieldGroup>
                                            <FieldDescription className="m-0 border-border border-t pt-4 text-xs">
                                                Cạnh tối thiểu {MARKER_RULES.minSizeMm} mm. Đường
                                                nét đứt biểu thị khoảng cách an toàn{' '}
                                                {MARKER_RULES.minEdgeMarginMm} mm với mép trang.
                                                Marker không thể kéo ra ngoài vùng này.
                                            </FieldDescription>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent
                                    value="CUSTOM_MARKER"
                                    className="m-0 flex h-full min-h-0 flex-col gap-5"
                                >
                                    <div className="flex flex-col gap-2">
                                        <h3 className="m-0 font-semibold text-base">
                                            Nhận diện bằng ảnh trang
                                        </h3>
                                        <p className="m-0 text-muted-foreground text-sm">
                                            Người đọc quét trực tiếp ảnh trong sách để mở nội dung
                                            AR, không cần thêm marker vào bản in.
                                        </p>
                                    </div>
                                    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_264px] gap-6">
                                        <figure className="m-0 flex min-h-0 min-w-0 flex-col gap-3">
                                            <img
                                                src={
                                                    heatmap && page.markerReport?.heatmapUrl
                                                        ? page.markerReport.heatmapUrl
                                                        : page.image.url
                                                }
                                                alt={
                                                    heatmap
                                                        ? 'Phân bố chi tiết nhận diện'
                                                        : 'Ảnh trang dùng làm marker'
                                                }
                                                className="min-h-0 w-full flex-1 rounded-lg border border-border object-contain p-5"
                                            />
                                            <figcaption className="text-muted-foreground text-xs">
                                                Ảnh trang hiện tại · {page.image.width} ×{' '}
                                                {page.image.height} px
                                            </figcaption>
                                        </figure>
                                        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
                                            <p className="m-0 text-sm">
                                                Bookaria dùng chính ảnh nền của trang. Để dùng ảnh
                                                khác, đổi ảnh nền trong Thiết lập trang.
                                            </p>
                                            <p className="m-0 text-muted-foreground text-sm">
                                                Chọn ảnh nhiều chi tiết, tương phản rõ và ít họa
                                                tiết lặp để dễ quét.
                                            </p>
                                            {page.markerMode === 'CUSTOM_MARKER' && (
                                                <div className="flex flex-col gap-2">
                                                    <div
                                                        className="flex items-center gap-1"
                                                        role="img"
                                                        aria-label={`Chất lượng nhận diện ${page.markerScore ?? 0} trên 5 sao`}
                                                    >
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={
                                                                    star <= (page.markerScore ?? 0)
                                                                        ? 'size-4 fill-current'
                                                                        : 'size-4 text-muted-foreground'
                                                                }
                                                                aria-hidden="true"
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="m-0 text-sm">
                                                        {page.markerScore == null
                                                            ? 'Chưa có đánh giá.'
                                                            : `${page.markerScore}/5 sao · Cần tối thiểu ${MARKER_RULES.minPublishScore} sao để xuất bản.`}
                                                    </p>
                                                    {page.markerReport && (
                                                        <>
                                                            <p className="m-0 text-muted-foreground text-xs">
                                                                {page.markerReport.features} điểm
                                                                đặc trưng · Phủ{' '}
                                                                {Math.round(
                                                                    page.markerReport.coverage *
                                                                        100,
                                                                )}
                                                                % ảnh.
                                                            </p>
                                                            {page.markerReport.hints
                                                                .slice(0, 3)
                                                                .map((hint) => (
                                                                    <p
                                                                        key={hint}
                                                                        className="m-0 text-muted-foreground text-xs"
                                                                    >
                                                                        {hint}
                                                                    </p>
                                                                ))}
                                                            {page.markerReport.similarPages.length >
                                                                0 && (
                                                                <p className="m-0 text-destructive text-xs">
                                                                    Ảnh gần giống trang khác; nên
                                                                    đổi bố cục để tránh nhận nhầm.
                                                                </p>
                                                            )}
                                                            {page.markerReport.heatmapUrl && (
                                                                <Button
                                                                    type="button"
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        setHeatmap(
                                                                            (value) => !value,
                                                                        )
                                                                    }
                                                                >
                                                                    {heatmap
                                                                        ? 'Xem ảnh trang'
                                                                        : 'Xem vùng nhận diện'}
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            void run(async () => {
                                                                setStage('Đang gửi đánh giá lại…');
                                                                const result =
                                                                    await pagesApi.rescore(page.id);
                                                                if (currentSession()) {
                                                                    onJob(result.jobId);
                                                                    setNotice(
                                                                        'Đã gửi đánh giá lại ảnh.',
                                                                    );
                                                                }
                                                                return false;
                                                            })
                                                        }
                                                    >
                                                        Đánh giá lại
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent
                                    value="NONE"
                                    className="m-0 flex h-full flex-col items-center justify-center gap-5 text-center"
                                >
                                    <div className="flex flex-col gap-2">
                                        <h3 className="m-0 font-semibold text-base">
                                            Không dùng AR cho trang này
                                        </h3>
                                        <p className="m-0 text-muted-foreground text-sm">
                                            Phù hợp với trang chỉ đọc nội dung in như mục lục, lời
                                            giới thiệu hoặc hướng dẫn.
                                        </p>
                                    </div>
                                    <Alert tone="info" className="mb-0">
                                        Các đối tượng trong scene vẫn được giữ lại. Trang này sẽ
                                        không được nhận diện khi quét sách.
                                    </Alert>
                                </TabsContent>
                            </fieldset>
                        </div>
                    </Tabs>
                    <footer className="flex shrink-0 flex-col gap-3 border-border border-t px-6 py-4">
                        <Feedback success={notice} />
                        {mode === 'CUSTOM_MARKER' && jobError && (
                            <Alert tone="danger" className="mb-0">
                                Chưa đọc được tiến độ đánh giá.{' '}
                                <Button type="button" variant="link" size="sm" onClick={onCheckJob}>
                                    Kiểm tra lại
                                </Button>
                            </Alert>
                        )}
                        {mode === 'CUSTOM_MARKER' && job?.status === 'FAILED' && (
                            <Alert tone="warning" className="mb-0">
                                Đánh giá ảnh chưa thành công:{' '}
                                {job.error?.message || 'Vui lòng đánh giá lại.'}
                            </Alert>
                        )}
                        <div className="flex min-w-0 items-center justify-between gap-4">
                            <div className="min-w-0 flex-1" role="status" aria-live="polite">
                                {(busy || scoring) && (
                                    <div className="flex max-w-96 flex-col gap-2">
                                        <span className="flex items-center gap-2 text-muted-foreground text-xs">
                                            <Spinner className="size-4 shrink-0" />
                                            {busy
                                                ? stage
                                                : `Đang đánh giá ảnh… ${job?.progress ?? 0}%`}
                                        </span>
                                        <Progress
                                            value={busy ? progress : (job?.progress ?? 0)}
                                            className="h-1.5"
                                        />
                                    </div>
                                )}
                                {mode === 'CUSTOM_MARKER' &&
                                    !busy &&
                                    !scoring &&
                                    job?.status === 'SUCCEEDED' && (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="sm"
                                            onClick={onRefresh}
                                        >
                                            Cập nhật kết quả đánh giá
                                        </Button>
                                    )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {busy &&
                                [
                                    'Đang chuẩn bị nhận diện ảnh…',
                                    'Đang tải dữ liệu nhận diện…',
                                ].includes(stage) ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10"
                                        onClick={() => controller.current?.abort()}
                                    >
                                        Dừng chuẩn bị
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-10 min-w-24"
                                        disabled={busy}
                                        onClick={onClose}
                                    >
                                        {scoring ? 'Đóng' : 'Hủy'}
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    className="h-10 min-w-28"
                                    disabled={busy || disabled || scoring || !dirty}
                                    aria-busy={busy}
                                >
                                    Áp dụng
                                </Button>
                            </div>
                        </div>
                    </footer>
                </form>
            </DialogContent>
        </Dialog>
    );
}
