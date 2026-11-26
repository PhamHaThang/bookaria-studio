import { Download, ImagePlus, ScanLine, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import type {
    MarkerAnalysisMetrics,
    MarkerImagePreview,
} from '@/shared/contracts/marker-analysis.schema';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
import { Button } from '@/shared/ui/primitives/button';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Progress } from '@/shared/ui/primitives/progress';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { analyzeMarkerImage } from '../pages/api/compile-marker';
import { MarkerMetrics } from '../pages/ui/MarkerMetrics';
import { AdminDialog } from './components/AdminDialog';
import { libraryApi } from './library-ui';
import { MarkerAnalysisPreview } from './MarkerAnalysisPreview';
import { useAdminMutation } from './use-admin-mutation';

const MAX_BYTES = 10 * 1024 * 1024;
export function MarkerTestDialog({
    marker,
    onClose,
    onSaved,
}: {
    marker?: BookariaMarker;
    onClose: () => void;
    onSaved: (marker: BookariaMarker) => void;
}) {
    const input = useRef<HTMLInputElement>(null),
        request = useRef<AbortController | null>(null);
    const [file, setFile] = useState<File | null>(null),
        [result, setResult] = useState<MarkerImagePreview | null>(null),
        [busy, setBusy] = useState(false),
        [progress, setProgress] = useState(0),
        [error, setError] = useState<string | null>(null),
        [over, setOver] = useState(false);
    const close = () => {
        request.current?.abort();
        onClose();
    };
    const save = useAdminMutation({
        mutationFn: (metrics: MarkerAnalysisMetrics) => {
            if (!marker) throw new Error('Không tìm thấy marker.');
            return libraryApi.saveMarkerAssessment(marker.id, metrics);
        },
        onSuccess: (updated) => {
            toast.success('Đã lưu kết quả đánh giá marker.');
            onSaved(updated);
        },
        onError: (cause) => toast.error(errorMessage(cause)),
    });
    const runAnalysis = useCallback(async (source: File | BookariaMarker) => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setResult(null);
        setError(null);
        setBusy(true);
        setProgress(0);
        try {
            let next: File;
            if (source instanceof File) {
                next = source;
            } else {
                setFile(null);
                const response = await fetch(source.imageUrl, {
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
                    credentials: 'omit',
                });
                if (!response.ok) throw new Error('Không tải được ảnh gốc của marker.');
                if (Number(response.headers.get('Content-Length')) > MAX_BYTES) {
                    throw new Error('Ảnh marker vượt quá 10 MB.');
                }
                const blob = await response.blob();
                if (!blob.size || blob.size > MAX_BYTES) {
                    throw new Error('Ảnh marker phải có dữ liệu và không quá 10 MB.');
                }
                next = new File([blob], `marker-${source.number}`, { type: blob.type });
            }
            controller.signal.throwIfAborted();
            setFile(next);
            const value = await analyzeMarkerImage(next, controller.signal, (percent) => {
                if (request.current === controller) setProgress(percent);
            });
            if (request.current === controller && !controller.signal.aborted) setResult(value);
        } catch (cause) {
            if (request.current === controller && !controller.signal.aborted)
                setError(
                    cause instanceof TypeError
                        ? 'Không tải được ảnh gốc của marker. Hãy thử lại.'
                        : errorMessage(cause),
                );
        } finally {
            if (request.current === controller && !controller.signal.aborted) setBusy(false);
        }
    }, []);
    useEffect(() => {
        if (marker) void runAnalysis(marker);
        return () => request.current?.abort();
    }, [marker, runAnalysis]);
    function analyzeLocal(next: File) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) {
            toast.error('Chọn ảnh JPG, PNG hoặc WebP.');
            return;
        }
        if (!next.size || next.size > MAX_BYTES) {
            toast.error('Ảnh phải có dữ liệu và không quá 10 MB.');
            return;
        }
        void runAnalysis(next);
    }
    const download = () => {
        if (!result || !file) return;
        const { image: _image, ...report } = result;
        const url = URL.createObjectURL(
            new Blob([JSON.stringify({ fileName: file.name, ...report }, null, 2)], {
                type: 'application/json',
            }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name.replace(/\.[^.]+$/, '')}-marker-report.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const retrySource = marker || (error && file);
    return (
        <AdminDialog
            open
            busy={save.isPending}
            onClose={close}
            title={
                marker
                    ? `${marker.assessment ? 'Đánh giá lại' : 'Đánh giá'} marker số #${marker.number}`
                    : 'Phân tích ảnh marker'
            }
            description={
                marker
                    ? 'Xem kết quả phân tích ảnh gốc trước khi lưu.'
                    : 'Kiểm tra ảnh trước khi đưa vào kho marker Bookaria.'
            }
            className="h-[calc(100dvh-32px)] max-w-[min(1280px,calc(100vw-32px))] sm:h-[min(840px,calc(100dvh-80px))]"
        >
            {!marker && (
                <input
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                        const next = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (next) analyzeLocal(next);
                    }}
                />
            )}
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(240px,30%)]">
                <section
                    className="flex min-w-0 flex-col gap-3 max-sm:min-h-80 sm:min-h-0"
                    aria-label="Xem ảnh marker"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="m-0 truncate font-medium text-sm">
                                {marker
                                    ? `Ảnh gốc của marker #${marker.number}`
                                    : file?.name || 'Ảnh marker của bạn'}
                            </p>
                            <p className="m-0 mt-1 text-muted-foreground text-xs">
                                {file
                                    ? `${(file.size / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} KB`
                                    : 'JPG, PNG hoặc WebP · Tối đa 10 MB'}
                            </p>
                        </div>
                        {!marker && file && (
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => input.current?.click()}
                            >
                                <ImagePlus data-icon="inline-start" />
                                Đổi ảnh
                            </Button>
                        )}
                    </div>
                    {result ? (
                        <MarkerAnalysisPreview result={result} />
                    ) : (
                        <fieldset
                            className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface p-5 data-[over=true]:border-primary"
                            data-over={over}
                            aria-label="Vùng thả ảnh marker"
                            onDragOver={(event) => {
                                event.preventDefault();
                                if (!marker) setOver(true);
                            }}
                            onDragLeave={() => setOver(false)}
                            onDrop={(event) => {
                                event.preventDefault();
                                setOver(false);
                                const next = event.dataTransfer.files[0];
                                if (!marker && next) analyzeLocal(next);
                            }}
                        >
                            {busy ? (
                                <div
                                    className="flex w-full max-w-75 flex-col items-center gap-4"
                                    role="status"
                                >
                                    <Spinner className="size-7" />
                                    <p className="m-0 font-medium">
                                        {marker && !file
                                            ? 'Đang tải ảnh gốc…'
                                            : 'Đang phân tích marker…'}
                                    </p>
                                    <Progress value={progress} className="w-full" />
                                    <p className="m-0 text-center text-muted-foreground text-xs">
                                        Đang tìm điểm đặc trưng và kiểm tra phân bố trên ảnh.
                                    </p>
                                </div>
                            ) : (
                                <Empty className="border-0 p-0">
                                    <EmptyHeader>
                                        <EmptyMedia>
                                            <Upload className="size-10" />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            {error
                                                ? 'Chưa phân tích được ảnh'
                                                : marker
                                                  ? 'Chuẩn bị ảnh marker'
                                                  : 'Kéo ảnh marker vào đây'}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            {error ||
                                                (!marker &&
                                                    'Chọn một ảnh để xem điểm, vùng thiếu chi tiết và gợi ý cải thiện.')}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <Button
                                        onClick={() => {
                                            if (retrySource) void runAnalysis(retrySource);
                                            else input.current?.click();
                                        }}
                                    >
                                        {retrySource ? 'Thử lại' : 'Chọn ảnh marker'}
                                    </Button>
                                </Empty>
                            )}
                        </fieldset>
                    )}
                </section>
                <aside
                    className="flex min-w-0 flex-col gap-4 rounded-lg bg-muted/40 p-4 sm:min-h-0 sm:overflow-y-auto"
                    aria-label="Kết quả chấm marker"
                    aria-live="polite"
                >
                    {busy ? (
                        <>
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-22 w-full" />
                            <Skeleton className="h-34 w-full" />
                        </>
                    ) : result ? (
                        <>
                            <MarkerMetrics analysis={result.analysis} />
                            <dl className="m-0 flex flex-col gap-4 border-border border-y py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground text-sm">
                                        Điểm đặc trưng
                                    </dt>
                                    <dd className="m-0 font-semibold tabular-nums">
                                        {result.features.toLocaleString('vi-VN')}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-muted-foreground text-sm">
                                        Vùng có chi tiết
                                    </dt>
                                    <dd className="m-0 font-semibold tabular-nums">
                                        {result.cells.filter((count) => count > 0).length} / 100
                                    </dd>
                                </div>
                                <div>
                                    <Progress value={result.coverage * 100} />
                                    <p className="m-0 mt-2 text-muted-foreground text-xs">
                                        Phủ {Math.round(result.coverage * 100)}% lưới phân tích
                                    </p>
                                </div>
                            </dl>
                            <div>
                                <h3 className="m-0 font-semibold text-sm">Gợi ý cải thiện</h3>
                                <ul className="m-0 mt-3 flex list-disc flex-col gap-3 pl-4 text-muted-foreground text-sm">
                                    {(result.hints.length
                                        ? result.hints
                                        : [
                                              'Giữ nguyên các chi tiết khi in. Hãy thử camera với bản in thật, ánh sáng và góc nhìn khác nhau.',
                                          ]
                                    ).map((hint) => (
                                        <li key={hint}>{hint}</li>
                                    ))}
                                </ul>
                            </div>
                            <p className="m-0 text-muted-foreground text-xs">
                                Ảnh gốc: {result.analysis.sourceWidth} ×{' '}
                                {result.analysis.sourceHeight} px. Ảnh phân tích: {result.width} ×{' '}
                                {result.height} px.
                            </p>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col justify-center gap-3">
                            <ScanLine className="size-8 text-muted-foreground" />
                            <h3 className="m-0 font-semibold">Xem ảnh có dễ nhận diện không</h3>
                            <p className="m-0 text-muted-foreground text-sm">
                                Kiểm tra phân bố điểm, độ độc đáo và kích thước ảnh ngay trong trình
                                duyệt trước khi đăng ký marker.
                            </p>
                        </div>
                    )}
                    <Alert>
                        <AlertDescription>
                            Hãy quét bản in bằng camera để kiểm tra khả năng nhận diện trong điều
                            kiện thực tế.
                        </AlertDescription>
                    </Alert>
                </aside>
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end gap-x-4 border-0 pt-0 sm:justify-between">
                <p className="m-0 text-muted-foreground text-xs">
                    {marker
                        ? 'Lưu để xem lại kết quả trong chi tiết marker.'
                        : 'Kết quả dùng để tham khảo trước khi đăng ký.'}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {result && (
                        <Button variant="outline" disabled={save.isPending} onClick={download}>
                            <Download data-icon="inline-start" />
                            Tải kết quả
                        </Button>
                    )}
                    <Button variant="outline" disabled={save.isPending} onClick={close}>
                        {busy ? 'Hủy phân tích' : 'Đóng'}
                    </Button>
                    {marker && result && (
                        <Button
                            disabled={save.isPending}
                            onClick={() => save.mutate(result.analysis)}
                        >
                            {save.isPending ? 'Đang lưu…' : 'Lưu đánh giá'}
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </AdminDialog>
    );
}
