import { Download, ImagePlus, Info, ScanLine, Star, Upload, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import type { MarkerTestResult } from '@/shared/contracts/api/admin.schema';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
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
import { libraryApi } from './library-ui';
import { MarkerAnalysisPreview } from './MarkerAnalysisPreview';

const MAX_BYTES = 10 * 1024 * 1024;
const ratings = [
    '',
    'Khó nhận diện',
    'Ít chi tiết',
    'Cần cải thiện',
    'Khá tốt',
    'Nhiều chi tiết, phân bố tốt',
];
export function MarkerTestDialog({ onClose }: { onClose: () => void }) {
    const id = useId(),
        input = useRef<HTMLInputElement>(null),
        request = useRef<AbortController | null>(null);
    const [file, setFile] = useState<File | null>(null),
        [result, setResult] = useState<MarkerTestResult | null>(null),
        [busy, setBusy] = useState(false),
        [progress, setProgress] = useState(0),
        [error, setError] = useState<string | null>(null),
        [over, setOver] = useState(false);
    useEffect(() => () => request.current?.abort(), []);
    const close = () => {
        request.current?.abort();
        onClose();
    };
    async function analyze(next: File) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) {
            toast.error('Chọn ảnh JPG, PNG hoặc WebP.');
            return;
        }
        if (!next.size || next.size > MAX_BYTES) {
            toast.error('Ảnh phải có dữ liệu và không quá 10 MB.');
            return;
        }
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setFile(next);
        setResult(null);
        setError(null);
        setBusy(true);
        setProgress(0);
        try {
            const value = await libraryApi.testMarker(next, controller.signal, (percent) => {
                if (request.current === controller) setProgress(percent);
            });
            if (request.current === controller && !controller.signal.aborted) setResult(value);
        } catch (cause) {
            if (request.current === controller && !controller.signal.aborted)
                setError(errorMessage(cause));
        } finally {
            if (request.current === controller) setBusy(false);
        }
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
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                aria-describedby={`${id}-description`}
                className="grid h-[min(900px,calc(100dvh-48px))] w-[min(1360px,calc(100vw-64px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 [--control-height:40px]"
            >
                <header className="flex items-start justify-between gap-6 border-border border-b px-6 py-5">
                    <div className="flex items-start gap-3">
                        <ScanLine className="mt-1 size-6 shrink-0" />
                        <div>
                            <DialogTitle className="text-xl">Thử điểm marker</DialogTitle>
                            <DialogDescription id={`${id}-description`} className="mt-1">
                                Kiểm tra ảnh trước khi đưa vào kho marker Bookaria.
                            </DialogDescription>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Đóng thử điểm marker"
                        onClick={close}
                    >
                        <X />
                    </Button>
                </header>
                <input
                    id={`${id}-file`}
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                        const next = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (next) void analyze(next);
                    }}
                />
                <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px]">
                    <section
                        className="flex min-h-0 min-w-0 flex-col gap-4 p-5"
                        aria-label="Xem ảnh marker"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="m-0 truncate font-medium text-sm">
                                    {file?.name || 'Ảnh marker của bạn'}
                                </p>
                                <p className="m-0 mt-1 text-muted-foreground text-xs">
                                    {file
                                        ? `${(file.size / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} KB`
                                        : 'JPG, PNG hoặc WebP · Tối đa 10 MB'}
                                </p>
                            </div>
                            {file && (
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
                                className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-input border-dashed bg-surface p-8 data-[over=true]:border-primary"
                                data-over={over}
                                aria-label="Vùng thả ảnh marker"
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setOver(true);
                                }}
                                onDragLeave={() => setOver(false)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setOver(false);
                                    const next = event.dataTransfer.files[0];
                                    if (next) void analyze(next);
                                }}
                            >
                                {busy ? (
                                    <div
                                        className="flex w-full max-w-75 flex-col items-center gap-4"
                                        role="status"
                                    >
                                        <Spinner className="size-7" />
                                        <p className="m-0 font-medium">
                                            {progress < 100
                                                ? 'Đang gửi ảnh…'
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
                                                    : 'Kéo ảnh marker vào đây'}
                                            </EmptyTitle>
                                            <EmptyDescription>
                                                {error ||
                                                    'Chọn một ảnh để xem điểm, vùng thiếu chi tiết và gợi ý cải thiện.'}
                                            </EmptyDescription>
                                        </EmptyHeader>
                                        <Button
                                            onClick={() =>
                                                error && file
                                                    ? void analyze(file)
                                                    : input.current?.click()
                                            }
                                        >
                                            {error && file ? 'Thử lại' : 'Chọn ảnh marker'}
                                        </Button>
                                    </Empty>
                                )}
                            </fieldset>
                        )}
                    </section>
                    <aside
                        className="flex min-h-0 flex-col gap-5 overflow-y-auto border-border border-l p-5"
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
                                <div>
                                    <p className="m-0 text-muted-foreground text-sm">
                                        Điểm tham khảo
                                    </p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <span className="font-semibold text-5xl">
                                            {result.score}
                                        </span>
                                        <span className="text-muted-foreground">/ 5</span>
                                    </div>
                                    <div
                                        className="mt-3 flex gap-1"
                                        role="img"
                                        aria-label={`${result.score} trên 5 sao`}
                                    >
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <Star
                                                key={star}
                                                className="size-5 text-warning-foreground"
                                                fill={
                                                    star <= result.score ? 'currentColor' : 'none'
                                                }
                                                aria-hidden="true"
                                            />
                                        ))}
                                    </div>
                                    <p className="m-0 mt-3 font-medium text-sm">
                                        {ratings[result.score]}
                                    </p>
                                </div>
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
                                            {result.cells.filter((count) => count > 0).length} / 16
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
                                    Ảnh phân tích: {result.width} × {result.height} px. Điểm dựa
                                    trên lượng chi tiết và phân bố, chưa kiểm tra độ giống với các
                                    marker khác.
                                </p>
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col justify-center gap-6">
                                <ScanLine className="mx-auto size-20 text-muted-foreground" />
                                <h3 className="m-0 font-semibold">Xem ảnh có dễ nhận diện không</h3>
                                <p className="m-0 text-muted-foreground text-sm">
                                    Công cụ tìm các điểm đặc trưng và chia ảnh thành 16 vùng để phát
                                    hiện nơi còn ít chi tiết.
                                </p>
                                <p className="m-0 text-muted-foreground text-sm">
                                    Ảnh chỉ được phân tích tạm thời; không tạo tài nguyên hay đăng
                                    ký marker.
                                </p>
                            </div>
                        )}
                        <Alert>
                            <AlertDescription>
                                Đây là điểm ORB để sàng lọc ảnh, không phải kết quả kiểm định MindAR
                                hay camera thực tế.
                            </AlertDescription>
                        </Alert>
                    </aside>
                </div>
                <footer className="flex items-center justify-between gap-4 border-border border-t px-6 py-4">
                    <p className="m-0 text-muted-foreground text-xs">
                        Chưa thay đổi trạng thái hay điểm của marker trong kho.
                    </p>
                    <div className="flex items-center gap-2">
                        {result && (
                            <Button variant="outline" onClick={download}>
                                <Download data-icon="inline-start" />
                                Tải kết quả
                            </Button>
                        )}
                        <Button variant="outline" onClick={close}>
                            {busy ? 'Hủy phân tích' : 'Đóng'}
                        </Button>
                    </div>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
