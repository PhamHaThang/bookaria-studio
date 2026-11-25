import { useEffect, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Skeleton } from '../../../shared/ui/primitives/skeleton';
import type { ImportSource } from '../model/import-source';

type PreviewInput =
    | { file: File; pdf?: never }
    | { file?: never; pdf: { source: ImportSource; index: number } };

export function ImportPreviewDialog({
    file,
    pdf,
    opener,
    onClose,
}: {
    opener: HTMLElement | null;
    onClose: () => void;
} & PreviewInput) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const source = pdf?.source,
        index = pdf?.index;
    const title = file?.name || `Trang ${(index ?? 0) + 1} · ${source?.name || 'PDF'}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly retries a failed page/image load.
    useEffect(() => {
        const controller = new AbortController();
        let next: string | null = null;
        setUrl(null);
        setError(null);
        async function load() {
            try {
                let image = file;
                if (!image && source && index !== undefined) {
                    if (source.previewPage)
                        image = await source.previewPage(index, controller.signal);
                    else image = await source.render(index);
                }
                controller.signal.throwIfAborted();
                if (!image) throw new Error('Không tìm thấy ảnh xem trước.');
                next = URL.createObjectURL(image);
                setUrl(next);
            } catch (cause) {
                if (!controller.signal.aborted) setError(errorMessage(cause));
            }
        }
        void load();
        return () => {
            controller.abort();
            if (next) URL.revokeObjectURL(next);
        };
    }, [file, source, index, attempt]);
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="flex h-[min(760px,calc(100dvh-48px))] max-w-[min(960px,calc(100vw-32px))] flex-col gap-4 p-5"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                }}
            >
                <DialogHeader className="pr-10">
                    <DialogTitle className="wrap-anywhere leading-snug">{title}</DialogTitle>
                    <DialogDescription>
                        {source
                            ? 'Xem lớn trang PDF. Đóng để tiếp tục chọn trang.'
                            : 'Ảnh gốc sẽ được đặt trọn trong khổ sách đã chọn.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-muted p-3">
                    {error ? (
                        <div className="flex w-full flex-col items-start gap-3">
                            <Alert tone="danger" className="mb-0">
                                {error}
                            </Alert>
                            <Button
                                variant="outline"
                                onClick={() => setAttempt((value) => value + 1)}
                            >
                                Thử lại
                            </Button>
                        </div>
                    ) : url ? (
                        <img
                            src={url}
                            alt={title}
                            className="max-h-full max-w-full object-contain"
                            onError={() => setError('Chưa tải được ảnh xem trước. Hãy thử lại.')}
                        />
                    ) : (
                        <div className="size-full" role="status">
                            <span className="sr-only">Đang tải ảnh xem trước…</span>
                            <Skeleton className="size-full" />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
