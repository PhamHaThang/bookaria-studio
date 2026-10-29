import { Copy, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { IdSchema } from '@/shared/contracts/common.schema';
import { JobResultsSchema } from '@/shared/contracts/dto.schema';
import { ApiErrorSchema } from '@/shared/contracts/error.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { pagesApi } from '../../pages';
import { createPreviewApi } from '../api/preview-api';
import { previewUrl, viewerOrigin } from '../model/preview';

export function PhonePreviewDialog({
    bookId,
    pageId,
    unsaved,
    onClose,
}: {
    bookId: string;
    pageId: string;
    unsaved: boolean;
    onClose: () => void;
}) {
    const [scope, setScope] = useState<'PAGE' | 'BOOK'>('PAGE');
    const [jobId, setJobId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [status, setStatus] = useState('');
    const [link, setLink] = useState(''),
        [qr, setQr] = useState('');
    const [paused, setPaused] = useState(false);
    const alive = useRef(true),
        posting = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    let origin = '',
        configError = '';
    try {
        origin = viewerOrigin(
            import.meta.env.VITE_VIEWER_ORIGIN || 'https://viewer.localhost:5174',
        );
    } catch (e) {
        configError = errorMessage(e);
    }
    useEffect(() => {
        if (!jobId || paused) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const began = Date.now();
        async function poll() {
            try {
                const job = await pagesApi.job(jobId as string, controller.signal);
                if (controller.signal.aborted) return;
                if (
                    job.type !== 'BUILD_PREVIEW' ||
                    job.ref.type !== 'BOOK' ||
                    job.ref.id !== bookId
                )
                    throw Error('Tác vụ không thuộc sách này.');
                setStatus(`Đang chuẩn bị bản xem trước · ${job.progress}%`);
                if (job.status === 'FAILED') {
                    setJobId(null);
                    throw Error(job.error?.message || 'Chưa tạo được bản xem trước. Hãy thử lại.');
                }
                if (job.status === 'SUCCEEDED') {
                    setLink(
                        previewUrl(origin, JobResultsSchema.BUILD_PREVIEW.parse(job.result).token),
                    );
                    setJobId(null);
                    setStatus('Liên kết có hiệu lực 24 giờ, dùng nội dung đã lưu.');
                    return;
                }
                if (Date.now() - began > 120000) {
                    setPaused(true);
                    setStatus('Tác vụ vẫn đang chạy. Tiếp tục kiểm tra để lấy kết quả.');
                    return;
                }
                timer = setTimeout(() => {
                    void poll();
                }, 1500);
            } catch (e) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(e));
                    setPaused(true);
                }
            }
        }
        void poll();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [jobId, origin, bookId, paused]);
    useEffect(() => {
        if (!link) return;
        let cancelled = false;
        void import('qrcode')
            .then((m) => m.toDataURL(link, { width: 220, margin: 2 }))
            .then((data) => {
                if (!cancelled) setQr(data);
            })
            .catch(() => {
                if (!cancelled) setError('Chưa tạo được QR. Bạn vẫn có thể dùng liên kết.');
            });
        return () => {
            cancelled = true;
        };
    }, [link]);
    async function create() {
        if (posting.current || busy || jobId || unsaved) return;
        posting.current = true;
        setBusy(true);
        setError('');
        setPaused(false);
        try {
            const result = await createPreviewApi(apiClient).create(
                bookId,
                scope === 'PAGE' ? { scope, pageId } : { scope },
            );
            if (alive.current) setJobId(result.jobId);
        } catch (e) {
            if (!alive.current) return;
            const response =
                typeof e === 'object' && e !== null && 'response' in e
                    ? (e as { response?: { data?: unknown } }).response
                    : undefined;
            const parsed = ApiErrorSchema.safeParse(response?.data);
            const existing =
                parsed.success && parsed.data.error.code === 'JOB_IN_PROGRESS'
                    ? IdSchema.safeParse(
                          (parsed.data.error.details as Record<string, unknown> | undefined)?.jobId,
                      )
                    : null;
            if (existing?.success) {
                setPaused(false);
                setJobId(existing.data);
                setStatus('Đang kiểm tra tác vụ xem trước đã có.');
            } else setError(errorMessage(e));
        } finally {
            posting.current = false;
            if (alive.current) setBusy(false);
        }
    }
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-48px)] max-w-[min(520px,calc(100vw-32px))] gap-6 overflow-y-auto p-6">
                <DialogHeader className="pr-8">
                    <DialogTitle className="m-0">Xem AR trên điện thoại</DialogTitle>
                    <DialogDescription className="m-0 leading-6">
                        Tạo liên kết hoặc quét QR để mở Viewer trên điện thoại. Điện thoại cần truy
                        cập được địa chỉ HTTPS của Viewer.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-5">
                    {unsaved && (
                        <Alert tone="warning" className="mb-0">
                            Lưu nội dung trang trước khi tạo liên kết. Bản xem nhanh trong Studio
                            vẫn dùng được khi chưa lưu.
                        </Alert>
                    )}
                    <Field>
                        <FieldLabel className="mb-0" htmlFor="phone-preview-scope">
                            Phạm vi
                        </FieldLabel>
                        <FormSelect
                            className="mt-0"
                            id="phone-preview-scope"
                            value={scope}
                            disabled={busy || !!jobId}
                            onValueChange={(v) => setScope(v as 'PAGE' | 'BOOK')}
                            options={[
                                { value: 'PAGE', label: 'Trang hiện tại' },
                                { value: 'BOOK', label: 'Toàn bộ sách' },
                            ]}
                        />
                    </Field>
                    {(configError || error) && (
                        <Alert tone="danger" className="mb-0">
                            {configError || error}
                        </Alert>
                    )}
                    {!link && (
                        <Button
                            disabled={unsaved || busy || !!jobId || !!configError}
                            onClick={() => {
                                void create();
                            }}
                        >
                            {(busy || (!!jobId && !paused)) && <Spinner />}Tạo liên kết xem trước
                        </Button>
                    )}
                    {status && (
                        <p role="status" className="m-0 text-muted-foreground text-sm leading-6">
                            {status}
                        </p>
                    )}
                    {paused && jobId && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setPaused(false);
                                setError('');
                            }}
                        >
                            Tiếp tục kiểm tra
                        </Button>
                    )}
                    {link && (
                        <div className="flex flex-col items-center gap-5">
                            {qr ? (
                                <img
                                    src={qr}
                                    width={220}
                                    height={220}
                                    alt="QR mở Viewer xem trước"
                                />
                            ) : (
                                <Skeleton className="size-55" aria-label="Đang tạo mã QR" />
                            )}
                            <div className="flex w-full flex-wrap gap-3">
                                <Button className="flex-1" variant="outline" asChild>
                                    <a href={link} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink />
                                        Mở Viewer
                                    </a>
                                </Button>
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    onClick={() => {
                                        void navigator.clipboard.writeText(link).then(
                                            () => setStatus('Đã sao chép liên kết.'),
                                            () =>
                                                setError(
                                                    'Không sao chép được. Hãy sao chép địa chỉ bên dưới.',
                                                ),
                                        );
                                    }}
                                >
                                    <Copy />
                                    Sao chép
                                </Button>
                            </div>
                            <p className="m-0 w-full break-all text-muted-foreground text-xs leading-5">
                                {link}
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
