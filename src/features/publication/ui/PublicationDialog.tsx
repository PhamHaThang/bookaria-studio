import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Check,
    CodeXml,
    Copy,
    Download,
    ExternalLink,
    Globe,
    History,
    Link2,
    Printer,
    RefreshCw,
    Send,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import type { PublishCheck } from '@/shared/contracts/api/publish.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import { MARKER_RULES } from '@/shared/contracts/marker.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Disclosure } from '@/shared/ui/Disclosure';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/shared/ui/primitives/input-group';
import { Progress } from '@/shared/ui/primitives/progress';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { useAuth } from '../../auth';
import { AuthDialogLink } from '../../auth/ui/AuthDialogLink';
import { bookKeys } from '../../books';
import { createPublicationApi } from '../api/publication-api';
import { usePublicationJob } from '../model/usePublicationJob';
import { type PrintLayoutDraft, PrintLayoutEditor } from './PrintLayoutEditor';
import { PublicationHistory } from './PublicationHistory';

const api = createPublicationApi(apiClient);
const bytes = (n: number) =>
    n < 1024 * 1024
        ? `${Math.ceil(n / 1024)} KB`
        : `${(n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;

/** Stays mounted when closed so the header and background job continue updating. */
export function PublicationDialog({
    book,
    open,
    mode,
    onShare,
    onClose,
    prepare,
    onEditInfo,
    onBusyChange,
    onTaskChange,
}: {
    book: BookDetail;
    open: boolean;
    mode: 'publish' | 'share';
    onShare: () => void;
    onClose: () => void;
    prepare: () => Promise<boolean>;
    onEditInfo: () => void;
    onBusyChange: (busy: boolean) => void;
    onTaskChange: (running: boolean) => void;
}) {
    const { user } = useAuth();
    const cache = useQueryClient();
    const userId = user?.id || '';
    const refresh = () => {
        void cache.invalidateQueries({ queryKey: bookKeys.all });
        void cache.invalidateQueries({ queryKey: ['publication', userId, book.id] });
    };
    const job = usePublicationJob(userId, book.id, refresh);
    const [phase, setPhase] = useState<'saving' | 'checking' | 'ready' | 'error'>('saving');
    const [view, setView] = useState<'prepare' | 'share' | 'complete'>('prepare');
    const displayView = mode === 'share' ? 'share' : view === 'share' ? 'prepare' : view;
    const printDraft = useRef<PrintLayoutDraft | null>(null);
    const [shareTab, setShareTab] = useState('links');
    const [check, setCheck] = useState<PublishCheck | null>(null);
    const [accepted, setAccepted] = useState(false);
    const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>(
        book.visibility === 'PUBLIC' ? 'PUBLIC' : 'UNLISTED',
    );
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [confirm, setConfirm] = useState<'unpublish' | 'release' | null>(null);
    const [revoked, setRevoked] = useState(false);
    const [retry, setRetry] = useState(0);
    const [failedQr, setFailedQr] = useState<string | null>(null);
    const [pdf, setPdf] = useState<{ url: string; kind: string; versionNo: number | null } | null>(
        null,
    );
    const latest = useRef({ prepare, job, book });
    latest.current = { prepare, job, book };
    const requestLock = useRef(false);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const available =
        !revoked &&
        !book.takenDown &&
        Boolean(
            (book.currentVersion && book.visibility !== 'PRIVATE') ||
                job.outcome?.type === 'PUBLISH_BOOK',
        );
    const busy = sending || job.busy;
    const preparing = open && mode === 'publish' && (phase === 'saving' || phase === 'checking');
    useEffect(() => {
        onBusyChange(sending || preparing);
        return () => onBusyChange(false);
    }, [sending, preparing, onBusyChange]);
    useEffect(() => {
        onTaskChange(job.busy);
        return () => onTaskChange(false);
    }, [job.busy, onTaskChange]);
    const share = useQuery({
        queryKey: ['publication', userId, book.id, 'share'],
        queryFn: ({ signal }) => api.share(book.id, signal),
        enabled: open && available && mode === 'share',
        retry: false,
    });

    useEffect(() => {
        if (!open || retry < 0) return;
        let alive = true;
        const controller = new AbortController();
        async function initialize() {
            if (mode === 'share') {
                setError(null);
                setPhase('ready');
                setView('share');
                return;
            }
            setView('prepare');
            if (latest.current.job.busy) {
                setPhase('ready');
                return;
            }
            setError(null);
            setCheck(null);
            setAccepted(false);
            setPhase('saving');
            try {
                if (!(await latest.current.prepare()))
                    throw new Error(
                        'Chưa lưu được sách. Kiểm tra thông số hoặc kết nối rồi thử lại.',
                    );
                if (!alive) return;
                setPhase('checking');
                const result = await api.check(book.id, controller.signal);
                if (!alive) return;
                setCheck(result);
                setPhase('ready');
            } catch (cause) {
                if (alive) {
                    setError(errorMessage(cause));
                    setPhase('error');
                }
            }
        }
        void initialize();
        return () => {
            alive = false;
            controller.abort();
        };
    }, [open, book.id, retry, mode]);
    useEffect(() => {
        if (job.outcome?.type === 'PUBLISH_BOOK') {
            setView('complete');
            setShareTab('links');
            setPhase('ready');
            setError(null);
            setCheck(null);
            setRevoked(false);
            toast.success(`Đã xuất bản phiên bản ${job.outcome.versionNo}.`);
        } else if (job.outcome?.type === 'EXPORT_PDF') {
            setPdf(job.outcome);
            setShareTab('print');
            setRetry((n) => n + 1);
        }
    }, [job.outcome]);
    async function publish() {
        if (
            requestLock.current ||
            busy ||
            !check?.canPublish ||
            (check.warnings.length && !accepted)
        )
            return;
        requestLock.current = true;
        setSending(true);
        setError(null);
        try {
            if (!(await latest.current.prepare()))
                throw new Error('Chưa lưu được sách. Hãy thử lại.');
            const fresh = await api.check(book.id);
            if (!mounted.current) return;
            if (JSON.stringify(fresh) !== JSON.stringify(check)) {
                setCheck(fresh);
                setAccepted(false);
                setError('Sách đã thay đổi. Hãy xem lại kết quả kiểm tra trước khi xuất bản.');
                return;
            }
            await job.start('PUBLISH_BOOK', null, () =>
                api.publish(book.id, { visibility, acceptWarnings: accepted }),
            );
        } catch (cause) {
            if (mounted.current) setError(errorMessage(cause));
        } finally {
            requestLock.current = false;
            if (mounted.current) setSending(false);
        }
    }
    async function copy(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Đã sao chép.');
        } catch {
            setError('Chưa sao chép được. Bạn có thể chọn liên kết và sao chép thủ công.');
        }
    }
    async function download(url: string, name: string) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Chưa tải được tệp.');
            const blobUrl = URL.createObjectURL(await response.blob());
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        } catch {
            setError('Chưa tải được tệp. Hãy thử lại hoặc mở liên kết trong tab mới.');
        }
    }
    const renderIssues = (items: PublishCheck['errors'] | PublishCheck['warnings']) => {
        const groups = new Map<string, (typeof items)[number][]>();
        for (const item of items) {
            const key = item.pageId || 'book';
            const group = groups.get(key) || [];
            group.push(item);
            groups.set(key, group);
        }
        return (
            <div className="flex flex-col gap-4">
                {[...groups].map(([id, issues]) => {
                    const pageIndex = book.pages.findIndex((p) => p.id === id);
                    return (
                        <div key={id} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium">
                                    {id === 'book'
                                        ? 'Thông tin sách'
                                        : pageIndex >= 0
                                          ? `Trang ${pageIndex + 1}`
                                          : 'Trang cần kiểm tra'}
                                </span>
                                {id !== 'book' && (
                                    <Link
                                        className="shrink-0 text-xs underline underline-offset-4"
                                        onClick={onClose}
                                        to={`/books/${book.id}/pages/${id}`}
                                    >
                                        Mở trang
                                    </Link>
                                )}
                            </div>
                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {issues.map((item) => {
                                    const message =
                                        item.code === 'PAGE_LOW_SCORE'
                                            ? `Ảnh nhận diện cần đạt ít nhất ${MARKER_RULES.minPublishScore} sao để xuất bản.`
                                            : item.message.replace(/^Trang \d+\s*[:·]?\s*/u, '');
                                    return (
                                        <li
                                            key={JSON.stringify(item)}
                                            className="flex flex-col gap-1 text-sm leading-relaxed"
                                        >
                                            <span>
                                                {message.charAt(0).toLocaleUpperCase('vi-VN') +
                                                    message.slice(1)}
                                            </span>
                                            {item.otherPageId && (
                                                <Link
                                                    className="w-fit underline underline-offset-4"
                                                    onClick={onClose}
                                                    to={`/books/${book.id}/pages/${item.otherPageId}`}
                                                >
                                                    Xem trang tương tự
                                                </Link>
                                            )}
                                            {item.code === 'EMAIL_NOT_VERIFIED' && (
                                                <AuthDialogLink
                                                    mode="check-email"
                                                    onClick={onClose}
                                                >
                                                    Xác nhận email
                                                </AuthDialogLink>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        );
    };

    const visibleError =
        error || (mode === 'publish' || job.task?.type === 'EXPORT_PDF' ? job.error : null);
    const running = job.busy && (mode === 'publish' || job.task?.type === 'EXPORT_PDF');
    const canClose = !sending && !preparing;
    const close = () => {
        if (canClose) onClose();
    };
    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(value) => {
                    if (!value) close();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    aria-describedby="publication-description"
                    className={cn(
                        'flex max-h-[calc(100dvh-64px)] max-w-none flex-col overflow-hidden p-0 [&_[data-slot=alert]]:mb-0 [&_h2]:m-0 [&_h3]:m-0 [&_label]:m-0 [&_p]:m-0',
                        running || displayView === 'complete'
                            ? 'w-[min(640px,calc(100vw-64px))]'
                            : mode === 'share' && shareTab === 'print'
                              ? 'w-[min(1120px,calc(100vw-48px))]'
                              : mode === 'share'
                                ? 'w-[min(760px,calc(100vw-64px))]'
                                : 'w-[min(960px,calc(100vw-64px))]',
                    )}
                >
                    <header className="flex shrink-0 items-center justify-between gap-6 border-border border-b px-6 py-5">
                        <div className="flex flex-col gap-2">
                            <DialogTitle>
                                {running
                                    ? job.task?.type === 'EXPORT_PDF'
                                        ? 'Đang tạo PDF'
                                        : 'Đang xuất bản sách'
                                    : displayView === 'complete'
                                      ? 'Xuất bản thành công'
                                      : displayView === 'share'
                                        ? 'Chia sẻ sách'
                                        : book.currentVersion
                                          ? 'Cập nhật bản xuất bản'
                                          : 'Xuất bản sách'}
                            </DialogTitle>
                            <DialogDescription id="publication-description">
                                {running
                                    ? 'Bạn có thể tiếp tục làm việc trong lúc chờ hoàn tất.'
                                    : displayView === 'complete'
                                      ? 'Phiên bản mới đã sẵn sàng cho người đọc.'
                                      : displayView === 'share'
                                        ? 'Mở sách, chia sẻ liên kết hoặc chuẩn bị bản in.'
                                        : 'Kiểm tra nội dung và chọn ai có thể xem sách của bạn.'}
                            </DialogDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Đóng"
                            disabled={!canClose}
                            onClick={close}
                        >
                            <X />
                        </Button>
                    </header>
                    <div
                        className={cn(
                            'flex min-h-0 flex-1 flex-col gap-5 overscroll-contain p-6',
                            mode === 'share' && available && !running && shareTab === 'versions'
                                ? 'overflow-hidden'
                                : 'overflow-y-auto',
                        )}
                    >
                        {visibleError && <Alert tone="danger">{visibleError}</Alert>}
                        {preparing ? (
                            <div
                                role="status"
                                className="flex min-h-72 flex-col items-center justify-center gap-4"
                            >
                                <Spinner className="size-7" />
                                <p>
                                    {phase === 'saving'
                                        ? 'Đang lưu bản nháp…'
                                        : 'Đang kiểm tra sách…'}
                                </p>
                            </div>
                        ) : running ? (
                            <div className="flex min-h-56 flex-col justify-center gap-6 py-2">
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border">
                                        <BookCoverImage url={book.coverUrl} />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                                        <h3 className="wrap-anywhere font-semibold text-base">
                                            {book.title}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            {job.task?.type === 'EXPORT_PDF'
                                                ? 'Tài liệu từ bản đang phát hành'
                                                : 'Đang chuẩn bị sách cho người đọc'}
                                        </p>
                                    </div>
                                    {job.progress === null ? (
                                        <Spinner className="size-6" aria-label="Đang gửi yêu cầu" />
                                    ) : (
                                        <span
                                            className="shrink-0 font-semibold text-3xl tabular-nums"
                                            aria-hidden="true"
                                        >
                                            {job.progress}%
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-3">
                                    <Progress value={job.progress} aria-label="Tiến trình tác vụ" />
                                    <p role="status" className="text-muted-foreground text-sm">
                                        {job.message}
                                    </p>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {job.task?.type === 'EXPORT_PDF'
                                        ? 'Khi hoàn tất, tệp PDF sẽ xuất hiện trong tab Sách in.'
                                        : 'Bản đang phát hành vẫn được giữ cho đến khi phiên bản mới hoàn tất.'}
                                </p>
                                {job.paused && (
                                    <Button
                                        variant="outline"
                                        className="w-fit"
                                        onClick={job.resume}
                                    >
                                        Tiếp tục kiểm tra tác vụ
                                    </Button>
                                )}
                                {job.task && !job.task.jobId && !job.posting && (
                                    <>
                                        <Alert tone="warning">
                                            Chưa xác định được máy chủ đã nhận yêu cầu hay chưa.
                                            Kiểm tra lịch sử và trạng thái trước khi gửi lại.
                                        </Alert>
                                        <Button
                                            variant="outline"
                                            className="w-fit"
                                            onClick={() => setConfirm('release')}
                                        >
                                            Tôi đã đối chiếu kết quả
                                        </Button>
                                    </>
                                )}
                            </div>
                        ) : phase === 'error' && mode === 'publish' ? (
                            <div className="flex min-h-56 items-center justify-center">
                                <Button onClick={() => setRetry((n) => n + 1)}>
                                    Thử lưu và kiểm tra lại
                                </Button>
                            </div>
                        ) : displayView === 'prepare' ? (
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
                                <div className="flex min-w-0 flex-col gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                                            <BookCoverImage url={book.coverUrl} />
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-2">
                                            <h3 className="wrap-anywhere m-0 font-semibold text-lg">
                                                {book.title}
                                            </h3>
                                            <p className="m-0 line-clamp-3 text-muted-foreground text-sm">
                                                {book.description || 'Chưa có mô tả.'}
                                            </p>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto min-h-0 w-fit justify-start p-0"
                                                onClick={onEditInfo}
                                            >
                                                Chỉnh thông tin sách
                                            </Button>
                                        </div>
                                    </div>
                                    <FieldGroup>
                                        <Field>
                                            <FieldLabel>Ai có thể xem?</FieldLabel>
                                            <RadioGroup
                                                value={visibility}
                                                onValueChange={(v) =>
                                                    setVisibility(v as typeof visibility)
                                                }
                                                aria-label="Quyền xem sách"
                                                className="gap-3"
                                            >
                                                <label
                                                    htmlFor="publication-unlisted"
                                                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary has-[[data-state=checked]]:border-primary"
                                                >
                                                    <RadioGroupItem
                                                        id="publication-unlisted"
                                                        value="UNLISTED"
                                                        className="mt-1"
                                                    />
                                                    <span className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-2 font-medium">
                                                            <Link2 size={16} />
                                                            Qua liên kết
                                                        </span>
                                                        <span className="font-normal text-muted-foreground text-sm">
                                                            Ai có liên kết đều có thể xem. Không
                                                            xuất hiện trong Khám phá.
                                                        </span>
                                                    </span>
                                                </label>
                                                <label
                                                    htmlFor="publication-public"
                                                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary has-[[data-state=checked]]:border-primary"
                                                >
                                                    <RadioGroupItem
                                                        id="publication-public"
                                                        value="PUBLIC"
                                                        className="mt-1"
                                                    />
                                                    <span className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-2 font-medium">
                                                            <Globe size={16} />
                                                            Công khai
                                                        </span>
                                                        <span className="font-normal text-muted-foreground text-sm">
                                                            Xuất hiện trong Khám phá và có thể xem
                                                            bằng liên kết.
                                                        </span>
                                                    </span>
                                                </label>
                                            </RadioGroup>
                                        </Field>
                                    </FieldGroup>
                                    {book.currentVersion && (
                                        <Alert>
                                            Bản đang phát hành không thay đổi cho đến khi cập nhật
                                            thành công. Nếu đổi marker hoặc thứ tự trang, hãy kiểm
                                            tra lại tài liệu đã in.
                                        </Alert>
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-col gap-4 border-border border-l pl-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="font-semibold text-base">Kiểm tra sách</h3>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            title="Kiểm tra lại"
                                            aria-label="Kiểm tra lại"
                                            onClick={() => setRetry((n) => n + 1)}
                                        >
                                            <RefreshCw />
                                        </Button>
                                    </div>
                                    {check && (
                                        <>
                                            <p className="text-muted-foreground text-sm">
                                                {check.summary.pageCount} trang ·{' '}
                                                {check.summary.arPageCount} trang AR ·{' '}
                                                {bytes(check.summary.downloadBytes)}
                                            </p>
                                            {check.hasChanges === false && (
                                                <Alert>
                                                    Bản đang phát hành đã có toàn bộ nội dung hiện
                                                    tại. Bạn có thể đổi quyền xem nếu cần.
                                                </Alert>
                                            )}
                                            {check.errors.length ? (
                                                <Alert tone="danger">
                                                    <div className="flex flex-col gap-3">
                                                        <span className="flex items-center gap-2 font-semibold">
                                                            <TriangleAlert size={16} />
                                                            Cần sửa ({check.errors.length})
                                                        </span>
                                                        {renderIssues(check.errors)}
                                                    </div>
                                                </Alert>
                                            ) : (
                                                <p className="flex items-center gap-2 text-sm">
                                                    <Check size={18} />
                                                    Sách đủ điều kiện xuất bản.
                                                </p>
                                            )}
                                            {check.warnings.length > 0 && (
                                                <Disclosure
                                                    title={`Nên kiểm tra (${check.warnings.length})`}
                                                    variant="panel"
                                                >
                                                    {renderIssues(check.warnings)}
                                                </Disclosure>
                                            )}
                                            {check.warnings.length > 0 && (
                                                <Field orientation="horizontal" className="gap-3">
                                                    <Checkbox
                                                        id="publication-accept"
                                                        checked={accepted}
                                                        onCheckedChange={(v) =>
                                                            setAccepted(v === true)
                                                        }
                                                        className="mt-0.5 shrink-0"
                                                    />
                                                    <FieldLabel
                                                        htmlFor="publication-accept"
                                                        className="font-normal leading-relaxed"
                                                    >
                                                        Tôi đã xem các khuyến nghị và muốn tiếp tục.
                                                    </FieldLabel>
                                                </Field>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : displayView === 'complete' ? (
                            <div className="mx-auto flex min-h-64 w-full max-w-lg flex-col items-center justify-center gap-5 py-4 text-center">
                                <Check className="size-9" aria-hidden="true" />
                                <div className="flex flex-col gap-2">
                                    <h3 className="font-semibold text-lg">{book.title}</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Đã phát hành phiên bản{' '}
                                        {job.outcome?.type === 'PUBLISH_BOOK'
                                            ? job.outcome.versionNo
                                            : book.currentVersion?.versionNo}{' '}
                                        · {visibility === 'PUBLIC' ? 'Công khai' : 'Qua liên kết'}
                                    </p>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    Các chỉnh sửa tiếp theo được giữ trong bản nháp. Mở Chia sẻ để
                                    lấy liên kết, QR hoặc tài liệu in.
                                </p>
                            </div>
                        ) : (
                            <Tabs
                                value={shareTab}
                                onValueChange={setShareTab}
                                className={cn('min-h-0 gap-5', shareTab === 'print' && 'min-h-84')}
                            >
                                {available ? (
                                    <>
                                        <TabsList
                                            variant="line"
                                            className="shrink-0"
                                            aria-label="Chia sẻ và tài liệu sách"
                                        >
                                            <TabsTrigger value="links">
                                                <Link2 />
                                                Chia sẻ
                                            </TabsTrigger>
                                            <TabsTrigger value="print">
                                                <Printer />
                                                Sách in
                                            </TabsTrigger>
                                            <TabsTrigger value="versions">
                                                <History />
                                                Phiên bản
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="links">
                                            {share.isPending ? (
                                                <div
                                                    role="status"
                                                    className="flex min-h-44 items-center justify-center gap-2"
                                                >
                                                    <Spinner /> Đang tải liên kết…
                                                </div>
                                            ) : share.isError ? (
                                                <Alert tone="danger">
                                                    {errorMessage(share.error)}{' '}
                                                    <Button
                                                        variant="link"
                                                        onClick={() => void share.refetch()}
                                                    >
                                                        Thử lại
                                                    </Button>
                                                </Alert>
                                            ) : (
                                                share.data && (
                                                    <div className="grid grid-cols-[minmax(0,1fr)_156px] items-start gap-6">
                                                        <div className="flex min-w-0 flex-col gap-3">
                                                            <div className="flex min-w-0 flex-col gap-1">
                                                                <h3
                                                                    className="line-clamp-2 font-semibold text-base leading-snug"
                                                                    title={book.title}
                                                                >
                                                                    {book.title}
                                                                </h3>
                                                                <p className="text-muted-foreground text-xs">
                                                                    Phiên bản{' '}
                                                                    {job.outcome?.type ===
                                                                    'PUBLISH_BOOK'
                                                                        ? job.outcome.versionNo
                                                                        : book.currentVersion
                                                                              ?.versionNo}
                                                                    {' | '}
                                                                    {book.visibility === 'PUBLIC'
                                                                        ? 'Công khai'
                                                                        : 'Qua liên kết'}
                                                                </p>
                                                            </div>
                                                            <Field className="gap-2">
                                                                <FieldLabel htmlFor="publication-link">
                                                                    Liên kết sách
                                                                </FieldLabel>
                                                                <InputGroup>
                                                                    <InputGroupInput
                                                                        id="publication-link"
                                                                        readOnly
                                                                        value={share.data.url}
                                                                        onFocus={(e) =>
                                                                            e.currentTarget.select()
                                                                        }
                                                                    />
                                                                    <InputGroupAddon align="inline-end">
                                                                        <InputGroupButton
                                                                            size="icon-sm"
                                                                            title="Sao chép liên kết"
                                                                            aria-label="Sao chép liên kết"
                                                                            onClick={() =>
                                                                                void copy(
                                                                                    share.data.url,
                                                                                )
                                                                            }
                                                                        >
                                                                            <Copy />
                                                                        </InputGroupButton>
                                                                    </InputGroupAddon>
                                                                </InputGroup>
                                                            </Field>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        window.open(
                                                                            share.data.url,
                                                                            '_blank',
                                                                        )
                                                                    }
                                                                >
                                                                    <ExternalLink data-icon="inline-start" />{' '}
                                                                    Mở sách
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        void copy(
                                                                            share.data.embedHtml,
                                                                        )
                                                                    }
                                                                >
                                                                    <CodeXml data-icon="inline-start" />{' '}
                                                                    Sao chép mã nhúng
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-stretch gap-2 border-border border-l pl-5">
                                                            <div className="flex min-h-32 items-center justify-center">
                                                                {failedQr ===
                                                                share.data.qrPngUrl ? (
                                                                    <Alert tone="warning">
                                                                        Chưa tải được ảnh QR.
                                                                    </Alert>
                                                                ) : (
                                                                    <img
                                                                        src={share.data.qrPngUrl}
                                                                        alt="Mã QR mở sách"
                                                                        className="size-32 object-contain"
                                                                        onError={() =>
                                                                            setFailedQr(
                                                                                share.data.qrPngUrl,
                                                                            )
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    void download(
                                                                        share.data.qrPngUrl,
                                                                        `${book.slug || 'bookaria'}-qr.png`,
                                                                    )
                                                                }
                                                            >
                                                                <Download data-icon="inline-start" />{' '}
                                                                Tải QR
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </TabsContent>
                                        <TabsContent value="print">
                                            <PrintLayoutEditor
                                                draftRef={printDraft}
                                                bookId={book.id}
                                                qrUrl={share.data?.qrPngUrl}
                                                disabled={busy}
                                                pdf={pdf}
                                                onClose={onClose}
                                                onExport={(body, versionNo) =>
                                                    void job.start('EXPORT_PDF', versionNo, () =>
                                                        api.print(book.id, body),
                                                    )
                                                }
                                            />
                                        </TabsContent>
                                        <TabsContent
                                            value="versions"
                                            className="flex min-h-0 flex-col"
                                        >
                                            <PublicationHistory
                                                key={book.id}
                                                userId={userId}
                                                bookId={book.id}
                                                currentVersionNo={
                                                    job.outcome?.type === 'PUBLISH_BOOK'
                                                        ? job.outcome.versionNo
                                                        : book.currentVersion?.versionNo
                                                }
                                                busy={busy}
                                                onUnpublish={() => setConfirm('unpublish')}
                                            />
                                        </TabsContent>
                                    </>
                                ) : (
                                    <Alert>
                                        Sách hiện không được chia sẻ. Bạn có thể kiểm tra và xuất
                                        bản lại.
                                    </Alert>
                                )}
                            </Tabs>
                        )}
                    </div>
                    <footer className="flex shrink-0 items-center justify-between gap-4 border-border border-t px-6 py-4">
                        <span className="text-muted-foreground text-sm">
                            {running
                                ? 'Bạn có thể đóng cửa sổ này.'
                                : displayView === 'prepare'
                                  ? check?.errors.length
                                      ? `Cần sửa ${check.errors.length} lỗi để xuất bản.`
                                      : 'Bản nháp đã được lưu.'
                                  : displayView === 'complete'
                                    ? 'Phiên bản đã được phát hành.'
                                    : shareTab === 'links'
                                      ? 'QR mở sách. Marker trên trang dùng để nhận diện nội dung AR.'
                                      : 'Đang chia sẻ phiên bản đã phát hành.'}
                        </span>
                        <div className="flex shrink-0 gap-2">
                            <Button variant="outline" disabled={!canClose} onClick={close}>
                                {running
                                    ? 'Tiếp tục chỉnh sửa'
                                    : displayView !== 'prepare'
                                      ? 'Đóng'
                                      : 'Để sau'}
                            </Button>
                            {!preparing &&
                                !running &&
                                phase !== 'error' &&
                                (displayView === 'prepare' ? (
                                    <Button
                                        disabled={
                                            busy ||
                                            !check?.canPublish ||
                                            (check.hasChanges === false &&
                                                visibility === book.visibility) ||
                                            Boolean(check?.warnings.length && !accepted)
                                        }
                                        onClick={() => void publish()}
                                    >
                                        {sending ? (
                                            <Spinner data-icon="inline-start" />
                                        ) : (
                                            <Send data-icon="inline-start" />
                                        )}
                                        {book.currentVersion
                                            ? 'Cập nhật bản xuất bản'
                                            : 'Xuất bản sách'}
                                    </Button>
                                ) : (
                                    displayView === 'complete' && (
                                        <Button onClick={onShare}>
                                            <Link2 data-icon="inline-start" />
                                            Chia sẻ sách
                                        </Button>
                                    )
                                ))}
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
            {confirm && (
                <ConfirmationDialog
                    title={
                        confirm === 'unpublish'
                            ? 'Ngừng chia sẻ sách?'
                            : 'Cho phép gửi yêu cầu mới?'
                    }
                    description={
                        confirm === 'unpublish'
                            ? 'Link và QR sẽ không mở được sách. Tệp người đọc đã tải xuống vẫn tồn tại. Lịch sử phiên bản được giữ lại.'
                            : 'Chỉ tiếp tục sau khi đã đối chiếu lịch sử và tác vụ trên máy chủ. Thao tác này không hủy tác vụ cũ.'
                    }
                    busy={sending}
                    onClose={() => setConfirm(null)}
                >
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            disabled={sending}
                            onClick={() => setConfirm(null)}
                        >
                            Hủy
                        </Button>
                        <Button
                            disabled={sending}
                            variant={confirm === 'unpublish' ? 'destructive' : 'default'}
                            onClick={async () => {
                                if (confirm === 'release') {
                                    job.release();
                                    setConfirm(null);
                                    return;
                                }
                                setSending(true);
                                try {
                                    await api.unpublish(book.id);
                                    setRevoked(true);
                                    refresh();
                                    setConfirm(null);
                                } catch (cause) {
                                    setError(errorMessage(cause));
                                } finally {
                                    setSending(false);
                                }
                            }}
                        >
                            {sending ? <Spinner /> : null}Xác nhận
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
