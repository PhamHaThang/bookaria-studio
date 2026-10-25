import { Eye, FileUp, Images, Trash2 } from 'lucide-react';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Button as ActionButton } from '../../../shared/ui/primitives/button';
import { Input } from '../../../shared/ui/primitives/input';
import { Progress } from '../../../shared/ui/primitives/progress';
import { Spinner } from '../../../shared/ui/primitives/spinner';
import {
    type ImportSource,
    mergeImageFiles,
    prepareImport,
    validateImportFiles,
} from '../model/import-source';
import { ImportPreviewDialog } from './ImportPreviewDialog';
import { ImportThumbnail } from './ImportThumbnail';
import { PdfPagesDialog } from './PdfPagesDialog';

export interface BookImportValue {
    source: ImportSource;
    indices: number[];
}

export function BookImportField({
    value,
    disabled,
    onChange,
    onBusyChange,
}: {
    value: BookImportValue | null;
    disabled: boolean;
    onChange: (value: BookImportValue | null) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const host = useRef<HTMLDivElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    const intent = useRef<'append' | 'replace'>('replace');
    const controller = useRef<AbortController | null>(null);
    const latest = useRef(value);
    latest.current = value;
    const candidate = useRef<ImportSource | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [reading, setReading] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pdf, setPdf] = useState<{ source: ImportSource; initial: number[] } | null>(null);
    const [preview, setPreview] = useState<{ file: File; opener: HTMLElement } | null>(null);
    useEffect(
        () => () => {
            controller.current?.abort();
            if (candidate.current && candidate.current !== latest.current?.source)
                candidate.current.dispose();
        },
        [],
    );

    function focusInputAction() {
        host.current
            ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
            ?.focus({ preventScroll: true });
    }
    function pick(event: MouseEvent<HTMLElement>, next: 'append' | 'replace') {
        if (disabled || reading) return;
        intent.current = next;
        opener.current = event.currentTarget;
        if (input.current) {
            input.current.accept = next === 'append' ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png';
            input.current.click();
        }
    }
    function cancelReading() {
        controller.current?.abort();
        controller.current = null;
        setReading(false);
        onBusyChange(false);
        setProgress(null);
    }
    async function choose(incoming: File[]) {
        if (!incoming.length || disabled || reading) return;
        const active = new AbortController();
        controller.current = active;
        setError(null);
        setProgress(null);
        setReading(true);
        onBusyChange(true);
        try {
            const batch =
                intent.current === 'append' && value?.source.kind === 'images'
                    ? mergeImageFiles(
                          value.indices.map((index) => files[index]),
                          incoming,
                      )
                    : validateImportFiles(incoming).files;
            const source = await prepareImport(batch, active.signal, (current, total) => {
                if (!active.signal.aborted) setProgress({ current, total });
            });
            if (active.signal.aborted) {
                source.dispose();
                return;
            }
            if (source.kind === 'pdf') {
                candidate.current = source;
                setPdf({
                    source,
                    initial: Array.from({ length: source.count }, (_, index) => index),
                });
            } else {
                setFiles(batch);
                onChange({
                    source,
                    indices: Array.from({ length: source.count }, (_, index) => index),
                });
            }
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (!active.signal.aborted) {
                controller.current = null;
                setReading(false);
                onBusyChange(false);
            }
        }
    }
    function cancelPdf() {
        if (candidate.current) {
            candidate.current.dispose();
            candidate.current = null;
        }
        setPdf(null);
        requestAnimationFrame(focusInputAction);
    }
    function acceptPdf(indices: number[]) {
        if (!pdf) return;
        const source = pdf.source;
        candidate.current = null;
        setFiles([]);
        setPdf(null);
        onChange({ source, indices });
        requestAnimationFrame(focusInputAction);
    }
    const images = value?.source.kind === 'images' ? value : null;
    return (
        <div ref={host} className="mt-4 flex flex-col gap-4">
            {!value ? (
                <ActionButton
                    variant="plain"
                    className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-input border-dashed bg-muted p-5 text-center"
                    disabled={disabled || reading}
                    onClick={(event) => pick(event, 'replace')}
                    aria-label="Chọn PDF hoặc ảnh"
                    aria-describedby="creation-file-limits"
                >
                    <span className="flex items-center gap-2 font-semibold text-sm">
                        <FileUp aria-hidden="true" />
                        Chọn PDF hoặc ảnh
                    </span>
                    <span id="creation-file-limits" className="text-muted-foreground text-xs">
                        Một PDF tối đa 50 MB hoặc nhiều JPG/PNG tối đa 10 MB/ảnh. Tối đa 100 trang.
                    </span>
                </ActionButton>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-sm">
                        <Images aria-hidden="true" />
                        {value.indices.length} {images ? 'ảnh đã chọn' : 'trang PDF đã chọn'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {images && (
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={disabled || reading}
                                onClick={(event) => pick(event, 'append')}
                            >
                                Thêm ảnh
                            </Button>
                        )}
                        <ActionButton
                            variant="ghost"
                            size="sm"
                            disabled={disabled || reading}
                            onClick={(event) => pick(event, 'replace')}
                        >
                            Đổi tài liệu
                        </ActionButton>
                    </div>
                </div>
            )}
            <Input
                ref={input}
                id="book-source-file"
                type="file"
                className="hidden"
                tabIndex={-1}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                disabled={disabled || reading}
                onChange={(event) => {
                    const incoming = Array.from(event.target.files || []);
                    event.target.value = '';
                    void choose(incoming);
                }}
            />
            {reading && (
                <div
                    className="flex flex-col gap-4 rounded-xl bg-muted p-4"
                    role="status"
                    aria-live="polite"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Spinner aria-hidden="true" />
                            <div className="flex flex-col gap-1">
                                <span className="font-medium text-sm">Đang đọc tài liệu…</span>
                                <span className="text-muted-foreground text-xs">
                                    Đang kiểm tra và chuẩn bị ảnh xem trước.
                                </span>
                            </div>
                        </div>
                        <ActionButton variant="ghost" size="sm" onClick={cancelReading}>
                            Hủy đọc
                        </ActionButton>
                    </div>
                    {progress && (
                        <Progress
                            value={progress.current}
                            max={progress.total}
                            aria-label="Tiến độ kiểm tra tài liệu"
                            getValueLabel={() =>
                                `${progress.current}/${progress.total} trang đã kiểm tra`
                            }
                        />
                    )}
                </div>
            )}
            {error && (
                <div className="[&_.feedback]:m-0">
                    <Feedback error={error} />
                </div>
            )}
            {images && (
                <>
                    <p className="m-0 text-muted-foreground text-xs">
                        Ảnh được xếp theo tên file. Bấm vào ảnh để xem lớn; xóa ảnh không muốn nhập.
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                        {images.indices.map((index, position) => (
                            <div
                                key={index}
                                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2"
                            >
                                <ActionButton
                                    variant="plain"
                                    className="cursor-zoom-in rounded-lg"
                                    aria-label={`Xem ảnh ${images.source.labels[index]}`}
                                    disabled={disabled || reading}
                                    onClick={(event) =>
                                        setPreview({
                                            file: files[index],
                                            opener: event.currentTarget,
                                        })
                                    }
                                >
                                    <ImportThumbnail source={images.source} index={index} />
                                </ActionButton>
                                <span
                                    className="truncate text-xs"
                                    title={images.source.labels[index]}
                                >
                                    {images.source.labels[index]}
                                </span>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">
                                        Trang {position + 1}
                                    </span>
                                    <ActionButton
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={`Xóa ảnh ${images.source.labels[index]}`}
                                        disabled={disabled || reading}
                                        onClick={() => {
                                            const indices = images.indices.filter(
                                                (item) => item !== index,
                                            );
                                            onChange(
                                                indices.length
                                                    ? { source: images.source, indices }
                                                    : null,
                                            );
                                            if (!indices.length) setFiles([]);
                                            requestAnimationFrame(focusInputAction);
                                        }}
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </ActionButton>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {value?.source.kind === 'pdf' && (
                <div className="flex items-center gap-4 rounded-xl border border-border p-3">
                    <img
                        src={value.source.preview}
                        alt="Trang đầu tài liệu PDF"
                        className="h-24 w-18 shrink-0 rounded-md bg-muted object-contain"
                    />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                        <strong className="wrap-anywhere text-sm">{value.source.name}</strong>
                        <span className="text-muted-foreground text-xs">
                            Đã chọn {value.indices.length}/{value.source.count} trang theo thứ tự
                            tài liệu.
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={disabled || reading}
                            onClick={(event) => {
                                opener.current = event.currentTarget;
                                setPdf({ source: value.source, initial: value.indices });
                            }}
                        >
                            <Eye data-icon="inline-start" aria-hidden="true" />
                            Chọn lại trang
                        </Button>
                    </div>
                </div>
            )}
            <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                Các trang được chuyển thành ảnh nền. Bạn có thể thêm chữ, mô hình 3D và tương tác
                trong editor.
            </p>
            {pdf && (
                <PdfPagesDialog
                    source={pdf.source}
                    initial={pdf.initial}
                    opener={opener.current}
                    onCancel={cancelPdf}
                    onConfirm={acceptPdf}
                />
            )}
            {preview && (
                <ImportPreviewDialog
                    file={preview.file}
                    opener={preview.opener}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    );
}
