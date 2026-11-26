import { FileText, X } from 'lucide-react';
import { lazy, Suspense, useRef } from 'react';
import { Button, type ButtonProps } from '@/shared/ui/Button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui/primitives/dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';

const PdfFlipReader = lazy(() => import('./PdfFlipReader'));

export function PdfReaderButton({
    url,
    title,
    defaultOpen,
    onOpenChange,
    ...buttonProps
}: Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
    url: string;
    title: string;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const closeButton = useRef<HTMLButtonElement>(null);

    return (
        <Dialog defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" {...buttonProps}>
                    <FileText data-icon="inline-start" />
                    Xem PDF
                </Button>
            </DialogTrigger>
            <DialogContent
                showCloseButton={false}
                data-pdf-reader
                onOpenAutoFocus={(event) => {
                    if (event.target instanceof HTMLElement) {
                        event.preventDefault();
                        event.target.focus();
                    }
                }}
                className="translate-none inset-0 flex h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[var(--editor-ground)] p-0 text-foreground"
            >
                <header className="flex min-w-0 shrink-0 items-center gap-3 border-border border-b bg-surface px-3 py-2 sm:px-5">
                    <img
                        className="h-5 w-9 shrink-0 object-contain [filter:var(--logo-filter)]"
                        src={`${import.meta.env.BASE_URL}brand/bookaria-symbol.svg`}
                        alt=""
                    />
                    <DialogTitle
                        className="min-w-0 flex-1 truncate text-sm leading-5"
                        title={title}
                    >
                        {title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Trình xem bản in PDF. Dùng phím mũi tên để lật trang.
                    </DialogDescription>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            ref={closeButton}
                            className="size-10 shrink-0 rounded-lg text-foreground"
                            aria-label="Đóng PDF"
                            title="Đóng PDF"
                        >
                            <X className="size-5" />
                        </Button>
                    </DialogClose>
                </header>
                <Suspense
                    fallback={
                        <div
                            role="status"
                            className="flex flex-1 items-center justify-center gap-2"
                        >
                            <Spinner /> Đang mở PDF…
                        </div>
                    }
                >
                    <PdfFlipReader
                        key={url}
                        url={url}
                        title={title}
                        onClose={() => closeButton.current?.click()}
                    />
                </Suspense>
            </DialogContent>
        </Dialog>
    );
}
