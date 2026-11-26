import { useQueryClient } from '@tanstack/react-query';
import { Box, ImagePlus, RefreshCw, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { AssetMediaPreview, useFileUrl } from '@/features/scene/ui/AssetMediaPreview';
import { errorMessage } from '@/shared/api/errors';
import type { ModelGeneration } from '@/shared/contracts/api/assets.schema';
import { cn } from '@/shared/lib/cn';
import { Feedback } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { uploadFile } from '../api/upload-file';
import { assetKeys, assetsApi } from '../model/assets';
import { uploadRequest } from '../model/form';
import { runAssetUpload, type UploadCheckpoint, type UploadStage } from '../model/upload';
import { ModelInputTips } from './ModelInputTips';

export function ModelGenerationDialog() {
    const { search } = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const cache = useQueryClient();
    const userId = user?.id ?? '';
    const input = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [stage, setStage] = useState<UploadStage>('signing');
    const checkpoint = useRef<UploadCheckpoint | null>(null);
    const url = useFileUrl(file);
    function select(selected?: File) {
        if (!selected) return;
        if (busy) return;
        try {
            uploadRequest(selected, 'MODEL_INPUT');
            setFile(selected);
            checkpoint.current = null;
            setError(null);
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }

    async function submit() {
        if (!file || !userId || busy) return;
        setBusy(true);
        setError(null);
        try {
            const job = await runAssetUpload({
                api: {
                    signature: assetsApi.signature,
                    complete: (id, _metadata, signal) => assetsApi.generateModel(id, signal),
                },
                transfer: uploadFile,
                file,
                metadata: { tags: [] },
                signal: AbortSignal.timeout(120_000),
                purpose: 'MODEL_INPUT',
                checkpoint: checkpoint.current,
                onCheckpoint: (value) => {
                    checkpoint.current = value;
                },
                onStage: setStage,
                onProgress: () => {},
            });
            const queryKey = assetKeys.generationJobs(userId);
            await cache.cancelQueries({ queryKey, exact: true });
            cache.setQueryData<ModelGeneration[]>(queryKey, (current = []) => [
                job,
                ...current.filter((item) => item.id !== job.id),
            ]);
            void cache.invalidateQueries({ queryKey, exact: true });
            navigate('/assets?type=MODEL', { replace: true, state: { focusModelJob: job.id } });
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }

    function close() {
        if (busy) return;
        navigate({ pathname: '/assets', search }, { replace: true });
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                onInteractOutside={(event) => event.preventDefault()}
                className="flex max-h-[calc(100dvh-24px)] max-w-[min(1080px,calc(100vw-24px))] flex-col overflow-y-auto p-0"
            >
                <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 bg-popover px-5 pt-5 pb-2 md:px-7 md:pt-7">
                    <DialogHeader className="min-w-0 gap-1">
                        <DialogTitle size="lg">Tạo 3D từ ảnh</DialogTitle>
                        <DialogDescription>
                            Tạo mô hình 3D có màu từ một ảnh. Bạn có thể rời trang sau khi tác vụ
                            bắt đầu.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Đóng tạo 3D"
                            disabled={busy}
                        >
                            <X aria-hidden="true" />
                        </Button>
                    </DialogClose>
                </div>
                <div className="grid gap-4 px-5 pt-2 pb-5 md:grid-cols-[minmax(0,2fr)_minmax(0,2.8fr)] md:grid-rows-[auto_auto] md:gap-x-12 md:gap-y-3 md:px-7 md:pb-7">
                    <form
                        className="contents"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit();
                        }}
                    >
                        <input
                            ref={input}
                            type="file"
                            hidden
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            disabled={busy}
                            onChange={(event) => {
                                select(event.currentTarget.files?.[0]);
                                event.currentTarget.value = '';
                            }}
                        />
                        <section
                            aria-label="Ảnh đầu vào"
                            className={cn(
                                'relative flex h-64 min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover transition-colors duration-200 ease-out motion-reduce:transition-none md:col-start-2 md:row-start-1 md:h-auto md:min-h-[min(420px,calc(100dvh-240px))]',
                                url && '[&_img]:absolute [&_img]:inset-0 [&_img]:p-4',
                                !url &&
                                    !busy &&
                                    'focus-within:border-ring hover:border-foreground/60',
                                dragging && 'border-processing/60 bg-processing/10',
                            )}
                            onDragOver={(event) => {
                                event.preventDefault();
                                if (busy) return;
                                setDragging(true);
                            }}
                            onDragLeave={(event) => {
                                if (
                                    !event.currentTarget.contains(
                                        event.relatedTarget as Node | null,
                                    )
                                )
                                    setDragging(false);
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                setDragging(false);
                                if (busy) return;
                                if (event.dataTransfer.files.length === 1)
                                    select(event.dataTransfer.files[0]);
                                else setError('Chọn một ảnh để tạo mô hình 3D.');
                            }}
                        >
                            {url ? (
                                <AssetMediaPreview type="IMAGE" url={url} />
                            ) : (
                                <Button
                                    variant="plain"
                                    aria-label="Tải ảnh lên"
                                    disabled={busy}
                                    onClick={() => input.current?.click()}
                                    className="group flex flex-1 cursor-pointer flex-col p-6 text-center transition-colors duration-200 ease-out hover:not-disabled:bg-muted focus-visible:bg-muted focus-visible:outline-offset-[-3px] disabled:cursor-not-allowed motion-reduce:transition-none md:p-8"
                                >
                                    <span className="flex flex-1 flex-col items-center justify-center gap-5">
                                        <span className="grid size-16 place-items-center rounded-2xl bg-muted/70 transition-[background-color,transform] duration-200 ease-out group-hover:bg-primary group-focus-visible:bg-primary motion-safe:group-focus-visible:-translate-y-1 motion-safe:group-hover:-translate-y-1 motion-reduce:transition-none">
                                            <ImagePlus
                                                className="size-8 text-muted-foreground transition-colors group-hover:text-primary-foreground group-focus-visible:text-primary-foreground motion-reduce:transition-none"
                                                strokeWidth={1.5}
                                                aria-hidden="true"
                                            />
                                        </span>
                                        <span className="flex flex-col gap-1.5">
                                            <span className="font-semibold text-base">
                                                {dragging
                                                    ? 'Thả ảnh để tải lên'
                                                    : 'Nhấn để tải ảnh lên'}
                                            </span>
                                            <span className="text-muted-foreground text-sm">
                                                hoặc kéo thả ảnh vào đây
                                            </span>
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            JPG hoặc PNG · Tối đa 6 MB
                                        </span>
                                    </span>
                                </Button>
                            )}
                        </section>
                        <div className="order-2 flex min-w-0 flex-col gap-3 md:col-span-2 md:row-start-2">
                            <Feedback error={error} errorMode="toast" />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {file && (
                                    <Button
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => input.current?.click()}
                                    >
                                        <RefreshCw data-icon="inline-start" aria-hidden="true" />{' '}
                                        Đổi ảnh
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    className="disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                                    disabled={!file || !userId || busy}
                                >
                                    <Box data-icon="inline-start" aria-hidden="true" />{' '}
                                    {busy
                                        ? {
                                              signing: 'Đang chuẩn bị…',
                                              uploading: 'Đang tải ảnh…',
                                              completing: 'Đang tạo tác vụ…',
                                          }[stage]
                                        : 'Tạo mô hình 3D'}
                                </Button>
                            </div>
                        </div>
                    </form>
                    <ModelInputTips />
                </div>
            </DialogContent>
        </Dialog>
    );
}
