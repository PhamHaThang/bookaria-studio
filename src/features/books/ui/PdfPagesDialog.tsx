import { useState } from 'react';
import { cn } from '../../../shared/lib/cn';
import { Button } from '../../../shared/ui/Button';
import { Checkbox } from '../../../shared/ui/primitives/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Field, FieldLabel } from '../../../shared/ui/primitives/field';
import { Input } from '../../../shared/ui/primitives/input';
import { Separator } from '../../../shared/ui/primitives/separator';
import { type ImportSource, selectedPages } from '../model/import-source';
import { ImportThumbnail } from './ImportThumbnail';

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
    const [error, setError] = useState<string | null>(null);
    const all = Array.from({ length: source.count }, (_, index) => index);
    const allChecked = selection.size === source.count;
    const someChecked = selection.size > 0 && !allChecked;
    function applyRange() {
        try {
            setSelection(new Set(selectedPages(range, source.count)));
            setError(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Khoảng trang chưa hợp lệ.');
        }
    }
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <DialogContent
                className="flex max-h-[calc(100dvh-64px)] max-w-225 flex-col overflow-hidden p-0"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                }}
            >
                <DialogHeader className="gap-3 px-6 pt-6 pr-14 pb-5">
                    <DialogTitle size="lg">Chọn trang từ PDF</DialogTitle>
                    <DialogDescription className="wrap-anywhere">
                        {source.name} · {source.count} trang. Chọn các trang cần nhập; thứ tự theo
                        tài liệu gốc.
                    </DialogDescription>
                </DialogHeader>
                <Separator className="h-px w-full" />
                <div className="flex flex-wrap items-end justify-between gap-5 px-6 py-5">
                    <Field
                        orientation="horizontal"
                        className="min-h-[var(--control-height)] w-auto gap-3"
                    >
                        <Checkbox
                            id="pdf-select-all"
                            checked={someChecked ? 'indeterminate' : allChecked}
                            onCheckedChange={(checked) => {
                                setSelection(new Set(checked === true ? all : []));
                                setRange('');
                                setError(null);
                            }}
                        />
                        <FieldLabel htmlFor="pdf-select-all" className="mb-0 cursor-pointer">
                            Chọn tất cả
                        </FieldLabel>
                    </Field>
                    <Field className="min-w-0 max-w-104 flex-1" data-invalid={Boolean(error)}>
                        <FieldLabel htmlFor="pdf-page-range" className="mb-0">
                            Chọn theo số trang
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                            <Input
                                id="pdf-page-range"
                                className="mt-0 h-[var(--control-height)]"
                                value={range}
                                onChange={(event) => {
                                    setRange(event.target.value);
                                    setError(null);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        applyRange();
                                    }
                                }}
                                placeholder="Ví dụ: 1-3, 5"
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? 'pdf-range-error' : undefined}
                            />
                            <Button
                                variant="secondary"
                                className="h-[var(--control-height)]"
                                disabled={!range.trim()}
                                onClick={applyRange}
                            >
                                Áp dụng
                            </Button>
                        </div>
                    </Field>
                </div>
                {error && (
                    <p
                        id="pdf-range-error"
                        role="alert"
                        className="m-0 px-6 pb-4 text-destructive text-sm"
                    >
                        {error}
                    </p>
                )}
                <Separator className="h-px w-full" />
                <div className="min-h-0 overflow-y-auto overscroll-contain bg-background p-6">
                    <div className="grid grid-cols-4 gap-4">
                        {all.map((index) => (
                            <Field key={index}>
                                <FieldLabel
                                    htmlFor={`pdf-page-${index}`}
                                    className={cn(
                                        'relative mb-0 flex cursor-pointer flex-col items-stretch gap-3 rounded-xl border border-border bg-surface p-2',
                                        selection.has(index) && 'border-primary bg-selected',
                                    )}
                                >
                                    <ImportThumbnail source={source} index={index} />
                                    <span className="flex items-center justify-between gap-2 px-1 pb-1">
                                        <span>Trang {index + 1}</span>
                                        <Checkbox
                                            id={`pdf-page-${index}`}
                                            checked={selection.has(index)}
                                            aria-label={`Chọn trang ${index + 1}`}
                                            onCheckedChange={(checked) => {
                                                setError(null);
                                                setRange('');
                                                setSelection((previous) => {
                                                    const next = new Set(previous);
                                                    if (checked === true) next.add(index);
                                                    else next.delete(index);
                                                    return next;
                                                });
                                            }}
                                        />
                                    </span>
                                    {source.pageSizesMm?.[index] && (
                                        <span className="px-1 pb-1 font-normal text-muted-foreground text-xs">
                                            {source.pageSizesMm[index].widthMm} ×{' '}
                                            {source.pageSizesMm[index].heightMm} mm
                                        </span>
                                    )}
                                </FieldLabel>
                            </Field>
                        ))}
                    </div>
                </div>
                <Separator className="h-px w-full" />
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                    <span role="status" className="text-muted-foreground text-sm">
                        Đã chọn {selection.size}/{source.count} trang
                    </span>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onCancel}>
                            Hủy
                        </Button>
                        <Button
                            disabled={!selection.size || Boolean(error)}
                            onClick={() => onConfirm([...selection].sort((a, b) => a - b))}
                        >
                            Dùng {selection.size} trang
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
