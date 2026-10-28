import { X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../shared/ui/Button';
import { Button as IconButton } from '../../../shared/ui/primitives/button';
import { Checkbox } from '../../../shared/ui/primitives/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '../../../shared/ui/primitives/field';
import { Input } from '../../../shared/ui/primitives/input';
import { Separator } from '../../../shared/ui/primitives/separator';
import { type ImportSource, selectedPages } from '../model/import-source';
import { ImportPageCard } from './ImportPageCard';
import { ImportPreviewDialog } from './ImportPreviewDialog';

export function PdfPagesDialog({
    source,
    initial,
    opener,
    onCancel,
    onConfirm,
}: {
    source: ImportSource;
    initial: number[];
    opener: HTMLElement | null;
    onCancel: () => void;
    onConfirm: (indices: number[]) => void;
}) {
    const [selection, setSelection] = useState(() => new Set(initial));
    const [range, setRange] = useState('');
    const [pendingRange, setPendingRange] = useState(false);
    const errorToastId = useId();
    useEffect(
        () => () => {
            toast.dismiss(errorToastId);
        },
        [errorToastId],
    );
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<{ index: number; opener: HTMLElement } | null>(null);
    const all = Array.from({ length: source.count }, (_, index) => index);
    const allChecked = selection.size === source.count;
    const someChecked = selection.size > 0 && !allChecked;
    function toggle(index: number, checked: boolean) {
        setError(null);
        toast.dismiss(errorToastId);
        setRange('');
        setPendingRange(false);
        setSelection((previous) => {
            const next = new Set(previous);
            if (checked) next.add(index);
            else next.delete(index);
            return next;
        });
    }
    function readRange() {
        try {
            const indices = selectedPages(range, source.count);
            setError(null);
            toast.dismiss(errorToastId);
            return indices;
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Khoảng trang chưa hợp lệ.';
            setError(message);
            toast.error(message, { id: errorToastId });
            return null;
        }
    }
    function applyRange() {
        const indices = readRange();
        if (!indices) return;
        setSelection(new Set(indices));
        setPendingRange(false);
    }
    function confirm() {
        const indices = pendingRange ? readRange() : [...selection].sort((a, b) => a - b);
        if (indices?.length) onConfirm(indices);
    }
    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) onCancel();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex h-[min(820px,calc(100dvh-48px))] max-w-[min(1160px,calc(100vw-48px))] flex-col overflow-hidden p-0"
                    onInteractOutside={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        if (opener?.isConnected) opener.focus({ preventScroll: true });
                    }}
                >
                    <DialogHeader className="relative shrink-0 gap-2 border-border border-b px-6 py-5 pr-16">
                        <DialogTitle size="lg" className="m-0">
                            Chọn trang từ PDF
                        </DialogTitle>
                        <DialogDescription className="m-0 truncate" title={source.name}>
                            {source.name} · {source.count} trang
                        </DialogDescription>
                        <IconButton
                            variant="ghost"
                            size="icon-sm"
                            className="absolute top-5 right-5"
                            aria-label="Đóng chọn trang PDF"
                            onClick={onCancel}
                        >
                            <X />
                        </IconButton>
                    </DialogHeader>
                    <div className="flex min-h-0 flex-1 overflow-hidden">
                        <section
                            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-6"
                            aria-label="Các trang PDF"
                        >
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,148px),1fr))] gap-3">
                                {all.map((index) => (
                                    <ImportPageCard
                                        key={index}
                                        source={source}
                                        index={index}
                                        title={`Trang ${index + 1}`}
                                        description={
                                            source.pageSizesMm?.[index]
                                                ? `${source.pageSizesMm[index].widthMm} × ${source.pageSizesMm[index].heightMm} mm`
                                                : 'Trang PDF'
                                        }
                                        previewLabel={`Xem trước trang ${index + 1}`}
                                        onPreview={(event) =>
                                            setPreview({ index, opener: event.currentTarget })
                                        }
                                        selected={selection.has(index)}
                                        actions={
                                            <Checkbox
                                                id={`pdf-page-${index}`}
                                                checked={selection.has(index)}
                                                aria-label={`Chọn trang ${index + 1}`}
                                                onCheckedChange={(checked) =>
                                                    toggle(index, checked === true)
                                                }
                                            />
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                        <aside
                            aria-label="Chọn trang PDF"
                            className="relative min-h-0 w-72 shrink-0 overflow-y-auto overscroll-contain border-border border-l p-6"
                        >
                            <FieldGroup className="gap-5 [container-type:normal]">
                                <Field orientation="horizontal" className="min-h-6 gap-3">
                                    <Checkbox
                                        id="pdf-select-all"
                                        checked={someChecked ? 'indeterminate' : allChecked}
                                        onCheckedChange={(checked) => {
                                            setSelection(new Set(checked === true ? all : []));
                                            setRange('');
                                            setPendingRange(false);
                                            setError(null);
                                            toast.dismiss(errorToastId);
                                        }}
                                    />
                                    <FieldLabel
                                        htmlFor="pdf-select-all"
                                        className="mb-0 cursor-pointer"
                                    >
                                        Chọn tất cả
                                    </FieldLabel>
                                </Field>
                                <Separator />
                                <Field className="min-w-0 gap-2" data-invalid={Boolean(error)}>
                                    <FieldLabel htmlFor="pdf-page-range" className="mb-0">
                                        Chọn theo số trang
                                    </FieldLabel>
                                    <div className="flex min-w-0 flex-col gap-3">
                                        <Input
                                            id="pdf-page-range"
                                            className="mt-0"
                                            value={range}
                                            onChange={(event) => {
                                                setRange(event.currentTarget.value);
                                                setPendingRange(
                                                    Boolean(event.currentTarget.value.trim()),
                                                );
                                                setError(null);
                                                toast.dismiss(errorToastId);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    applyRange();
                                                }
                                            }}
                                            placeholder="1-3, 5, 8-12"
                                            aria-invalid={Boolean(error)}
                                            aria-describedby="pdf-range-hint"
                                        />
                                        <Button
                                            variant="outline"
                                            fullWidth
                                            disabled={!range.trim()}
                                            onClick={applyRange}
                                        >
                                            Áp dụng
                                        </Button>
                                    </div>
                                    <FieldDescription
                                        id="pdf-range-hint"
                                        className="m-0 text-xs leading-relaxed"
                                    >
                                        Dùng dấu phẩy để tách các trang, dấu gạch nối để chọn một
                                        khoảng.
                                    </FieldDescription>
                                    {error && (
                                        <span role="alert" className="sr-only">
                                            {error}
                                        </span>
                                    )}
                                </Field>
                            </FieldGroup>
                        </aside>
                    </div>
                    <footer className="flex shrink-0 items-center justify-between gap-4 border-border border-t px-6 py-4">
                        <div className="flex min-w-0 flex-col gap-1" role="status">
                            <span className="font-medium text-sm">
                                Đã chọn {selection.size}/{source.count} trang
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {pendingRange
                                    ? 'Khoảng trang sẽ được áp dụng khi tiếp tục.'
                                    : 'Các trang giữ thứ tự trong tài liệu gốc.'}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <Button variant="secondary" onClick={onCancel}>
                                Hủy
                            </Button>
                            <Button
                                disabled={(!selection.size && !pendingRange) || Boolean(error)}
                                onClick={confirm}
                            >
                                {pendingRange
                                    ? 'Dùng khoảng trang'
                                    : `Dùng ${selection.size} trang`}
                            </Button>
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
            {preview && (
                <ImportPreviewDialog
                    pdf={{ source, index: preview.index }}
                    opener={preview.opener}
                    onClose={() => setPreview(null)}
                />
            )}
        </>
    );
}
