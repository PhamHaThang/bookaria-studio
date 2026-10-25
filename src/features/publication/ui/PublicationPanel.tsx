import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { apiClient } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/errors';
import {
    PrintPdfBodySchema,
    type PublishCheck,
} from '../../../shared/contracts/api/publish.schema';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { createPublicationApi } from '../api/publication-api';
import { usePublicationJob } from '../model/usePublicationJob';

const api = createPublicationApi(apiClient);
const date = (value: string) => new Date(value).toLocaleString('vi-VN');
const bytes = (value: number) =>
    `${(value / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} MB`;

export function PublicationPanel({
    book,
    disabled,
    unsaved,
    onBusyChange,
}: {
    book: BookDetail;
    disabled: boolean;
    unsaved: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth();
    const cache = useQueryClient();
    const userId = user?.id || '';
    const key = ['publication', userId, book.id];
    const [check, setCheck] = useState<PublishCheck | null>(null),
        [accepted, setAccepted] = useState(false);
    const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>(
        book.visibility === 'PUBLIC' ? 'PUBLIC' : 'UNLISTED',
    );
    const [requesting, setRequesting] = useState(false),
        [revoked, setRevoked] = useState(false);
    const [confirm, setConfirm] = useState<'publish' | 'unpublish' | 'release' | null>(null);
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState('');
    const [warning, setWarning] = useState<string | null>(null);
    const [failedQr, setFailedQr] = useState<string | null>(null);
    const [print, setPrint] = useState<z.input<typeof PrintPdfBodySchema>>({
        kind: 'PRINT',
        qrMode: 'COVER_ONLY',
        bleedMm: 3,
    });
    const [pdf, setPdf] = useState<{ url: string; kind: string; versionNo: number | null } | null>(
        null,
    );
    const alive = useRef(true),
        sending = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const session = () => alive.current && auth.store.getState().user?.id === userId;
    const refresh = useCallback(() => {
        if (auth.store.getState().user?.id !== userId) return;
        setFailedQr(null);
        void cache.invalidateQueries({ queryKey: bookKeys.all });
        void cache.invalidateQueries({ queryKey: ['publication', userId, book.id] });
    }, [cache, userId, book.id]);
    const job = usePublicationJob(userId, book.id, refresh);
    const busy = requesting || job.busy;
    const locked = disabled || busy;
    const available = Boolean(
        book.currentVersion && book.visibility !== 'PRIVATE' && !book.takenDown && !revoked,
    );
    const versions = useQuery({
        queryKey: [...key, 'versions'],
        queryFn: ({ signal }) => api.versions(book.id, signal),
        retry: false,
    });
    const share = useQuery({
        queryKey: [...key, 'share'],
        queryFn: ({ signal }) => api.share(book.id, signal),
        enabled: available,
        retry: false,
    });
    const publicBook = useQuery({
        queryKey: [...key, 'public', book.slug],
        queryFn: ({ signal }) => api.publicBook(book.slug || '', signal),
        enabled: available && Boolean(book.slug),
        retry: false,
    });
    useEffect(() => {
        onBusyChange(busy);
        return () => onBusyChange(false);
    }, [busy, onBusyChange]);
    // A changed saved draft invalidates the acknowledgement of its previous check.
    const checkedRevision = useRef(book.updatedAt);
    useEffect(() => {
        if (checkedRevision.current === book.updatedAt) return;
        checkedRevision.current = book.updatedAt;
        setCheck(null);
        setAccepted(false);
    }, [book.updatedAt]);
    useEffect(() => {
        if (book.visibility !== 'PRIVATE') setRevoked(false);
    }, [book.visibility]);
    useEffect(() => {
        if (job.outcome?.type === 'EXPORT_PDF') setPdf(job.outcome);
    }, [job.outcome]);
    async function inspect() {
        if (locked || unsaved || sending.current) return;
        sending.current = true;
        setRequesting(true);
        setError(null);
        setAccepted(false);
        setCheck(null);
        setNotice('');
        setWarning(null);
        try {
            const result = await api.check(book.id);
            if (session()) setCheck(result);
        } catch (cause) {
            if (session()) setError(errorMessage(cause));
        } finally {
            sending.current = false;
            if (session()) setRequesting(false);
        }
    }
    async function publish() {
        if (
            locked ||
            unsaved ||
            !check?.canPublish ||
            (check.warnings.length > 0 && !accepted) ||
            sending.current
        )
            return;
        sending.current = true;
        setRequesting(true);
        setError(null);
        try {
            const fresh = await api.check(book.id);
            if (!session()) return;
            if (JSON.stringify(fresh) !== JSON.stringify(check)) {
                setCheck(fresh);
                setAccepted(false);
                setWarning(
                    'Kết quả kiểm tra đã thay đổi. Đọc lại lỗi/cảnh báo trước khi xuất bản.',
                );
                return;
            }
            await job.start('PUBLISH_BOOK', null, () =>
                api.publish(book.id, { visibility, acceptWarnings: accepted }),
            );
            if (session()) {
                setCheck(null);
                setWarning(null);
                setAccepted(false);
            }
        } catch (cause) {
            if (session()) setError(errorMessage(cause));
        } finally {
            sending.current = false;
            if (session()) {
                setRequesting(false);
                setConfirm(null);
            }
        }
    }
    async function unpublish() {
        if (locked || sending.current) return;
        sending.current = true;
        setRequesting(true);
        setError(null);
        try {
            await api.unpublish(book.id);
            if (session()) {
                setRevoked(true);
                setNotice('Đã chuyển sách về riêng tư. Lịch sử phiên bản được giữ lại.');
                refresh();
            }
        } catch (cause) {
            if (session()) {
                setError(`${errorMessage(cause)} Hãy tải lại trạng thái trước khi thử tiếp.`);
                refresh();
            }
        } finally {
            sending.current = false;
            if (session()) {
                setRequesting(false);
                setConfirm(null);
            }
        }
    }
    async function copy(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            if (session()) toast.success('Đã sao chép.');
        } catch {
            if (session())
                setError('Chưa sao chép tự động được. Chọn nội dung trong ô rồi sao chép.');
        }
    }
    const issues = (items: PublishCheck['errors'] | PublishCheck['warnings']) => (
        <ul className="publication-issues pl-6 [&_li_+_li]:mt-3">
            {items.map((item) => (
                <li key={JSON.stringify(item)}>
                    <span>{item.message}</span>
                    {item.pageId && (
                        <>
                            {' '}
                            <Link to={`/books/${book.id}/pages/${item.pageId}`}>
                                Mở trang cần kiểm tra
                            </Link>
                        </>
                    )}
                    {item.otherPageId && (
                        <>
                            {' '}
                            ·{' '}
                            <Link to={`/books/${book.id}/pages/${item.otherPageId}`}>
                                Trang tương tự
                            </Link>
                        </>
                    )}
                    {!item.pageId && item.code === 'EMAIL_NOT_VERIFIED' && (
                        <>
                            {' '}
                            <AuthDialogLink mode="check-email">Xác nhận email</AuthDialogLink>
                        </>
                    )}
                </li>
            ))}
        </ul>
    );
    return (
        <section
            className="publication [&_a]:wrap-anywhere [&_code]:wrap-anywhere mt-10 border-t-[1px] border-t-border pt-8 [border-top-style:solid] [&_fieldset]:min-w-0 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-4 [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [&_p]:max-w-[75ch]"
            aria-labelledby="publication-heading"
        >
            <h2 id="publication-heading">Xuất bản và chia sẻ</h2>
            <p>
                Bản nháp đã lưu được đóng thành một phiên bản khi xuất bản. Sửa tiếp bản nháp không
                thay đổi phiên bản người đọc đang xem.
            </p>
            <Feedback error={error || job.error} success={notice || null} warning={warning} />
            {unsaved && (
                <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                    Bạn còn thông tin sách chưa lưu. Lưu thông tin trước khi kiểm tra và xuất bản.
                </p>
            )}
            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                <Button
                    variant="secondary"
                    disabled={locked || unsaved}
                    onClick={() => {
                        void inspect();
                    }}
                >
                    Kiểm tra trước xuất bản
                </Button>
                <Button variant="outline" disabled={requesting} onClick={refresh}>
                    Tải lại trạng thái xuất bản
                </Button>
            </div>
            {check && (
                <section
                    className="publication-check mt-6 rounded-[var(--radius-md)] bg-muted p-5 [&_h3]:mt-5"
                    aria-label="Kết quả kiểm tra xuất bản"
                >
                    <p>
                        {check.summary.pageCount} trang · {check.summary.arPageCount} trang AR ·{' '}
                        {bytes(check.summary.downloadBytes)} tài nguyên
                    </p>
                    <h3>Lỗi cần sửa ({check.errors.length})</h3>
                    {check.errors.length ? (
                        issues(check.errors)
                    ) : (
                        <p>Không có lỗi chặn xuất bản.</p>
                    )}
                    <h3>Cảnh báo ({check.warnings.length})</h3>
                    {check.warnings.length ? issues(check.warnings) : <p>Không có cảnh báo.</p>}
                    <fieldset disabled={locked || unsaved}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="publication-visibility">
                                Cách chia sẻ
                                <FormSelect
                                    id="publication-visibility"
                                    value={visibility}
                                    onValueChange={(value) =>
                                        setVisibility(value as typeof visibility)
                                    }
                                    options={[
                                        {
                                            value: 'UNLISTED',
                                            label: 'Không niêm yết — xem bằng liên kết',
                                        },
                                        {
                                            value: 'PUBLIC',
                                            label: 'Công khai — xuất hiện trong thư viện',
                                        },
                                    ]}
                                />
                            </FieldLabel>
                        </Field>
                        {check.warnings.length > 0 && (
                            <Field orientation="contents">
                                <FieldLabel className="publication-accept mb-4 flex items-start gap-3 [&_input]:size-[1.25rem] [&_input]:min-h-0 [&_input]:shrink-0">
                                    <Checkbox
                                        checked={accepted}
                                        onCheckedChange={(checked) => setAccepted(checked === true)}
                                    />
                                    Tôi đã đọc và chấp nhận các cảnh báo trên.
                                </FieldLabel>
                            </Field>
                        )}
                        <Button
                            disabled={!check.canPublish || (check.warnings.length > 0 && !accepted)}
                            onClick={() => setConfirm('publish')}
                        >
                            Xuất bản phiên bản mới
                        </Button>
                    </fieldset>
                </section>
            )}
            {job.message && <p role="status">{job.message}</p>}
            {job.task?.jobId && !job.done && (
                <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                    Mã tác vụ: <code>{job.task.jobId}</code>. Có thể tải lại trang để tiếp tục theo
                    dõi trong tab này.
                </p>
            )}
            {job.paused && (
                <Button variant="secondary" onClick={job.resume}>
                    Tiếp tục kiểm tra tác vụ
                </Button>
            )}
            {job.task && !job.task.jobId && !job.posting && (
                <div className="publication-check mt-6 rounded-[var(--radius-md)] bg-muted p-5 [&_h3]:mt-5">
                    <p>
                        Chưa xác định được máy chủ đã nhận yêu cầu hay chưa. Đối chiếu lịch sử phiên
                        bản, trạng thái xuất bản và tác vụ backend trước khi gửi lại; yêu cầu mới có
                        thể tạo thêm phiên bản hoặc tệp PDF.
                    </p>
                    <Button variant="secondary" onClick={() => setConfirm('release')}>
                        Tôi đã đối chiếu kết quả
                    </Button>
                </div>
            )}
            {job.outcome?.type === 'PUBLISH_BOOK' && (
                <p role="status">
                    Đã xuất bản phiên bản {job.outcome.versionNo}. Liên kết chia sẻ và lịch sử được
                    cập nhật bên dưới.
                </p>
            )}
            <div className="publication-section mt-8 border-t-[1px] border-t-border pt-6 [border-top-style:solid]">
                <h3>Liên kết và mã QR</h3>
                {!available ? (
                    <p>
                        Xuất bản sách để tạo liên kết chia sẻ. Sách riêng tư hoặc bị gỡ không mở
                        được bằng liên kết.
                    </p>
                ) : (
                    <>
                        {share.isPending && (
                            <LoadingState>Đang tải thông tin chia sẻ…</LoadingState>
                        )}
                        {share.isError && (
                            <Feedback
                                error={`${errorMessage(share.error)} Bấm Tải lại trạng thái xuất bản để kiểm tra lại.`}
                            />
                        )}
                        {share.data && !share.isError && (
                            <div className="publication-share mb-6 grid grid-cols-[minmax(0,_1fr)_240px] gap-6 max-[700px]:grid-cols-[minmax(0,_1fr)] [&_img]:h-auto [&_img]:max-w-full">
                                <div>
                                    <a
                                        href={share.data.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Mở sách đã xuất bản
                                    </a>
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="share-url">
                                            Liên kết sách
                                            <Input
                                                id="share-url"
                                                readOnly
                                                value={share.data.url}
                                                onFocus={(e) => e.currentTarget.select()}
                                            />
                                        </FieldLabel>
                                    </Field>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            void copy(share.data.url);
                                        }}
                                    >
                                        Sao chép liên kết sách
                                    </Button>
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="share-embed">
                                            Mã nhúng vào website
                                            <Textarea
                                                id="share-embed"
                                                rows={4}
                                                readOnly
                                                value={share.data.embedHtml}
                                                onFocus={(e) => e.currentTarget.select()}
                                            />
                                        </FieldLabel>
                                    </Field>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            void copy(share.data.embedHtml);
                                        }}
                                    >
                                        Sao chép mã nhúng
                                    </Button>
                                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                        Camera trong trang nhúng cần HTTPS và quyền camera của
                                        website chứa iframe. Địa chỉ localhost chỉ dùng trên máy
                                        này.
                                    </p>
                                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                                        <a
                                            href={share.data.qrPngUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Mở QR PNG
                                        </a>
                                        <a
                                            href={share.data.qrSvgUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Mở QR SVG
                                        </a>
                                    </div>
                                </div>
                                {failedQr === share.data.qrPngUrl ? (
                                    <p role="alert">
                                        Chưa tải được ảnh QR. Bạn vẫn có thể sao chép liên kết sách;
                                        bấm Tải lại trạng thái xuất bản để kiểm tra đường dẫn QR.
                                    </p>
                                ) : (
                                    <img
                                        src={share.data.qrPngUrl}
                                        width={240}
                                        height={240}
                                        alt="Mã QR mở sách đã xuất bản"
                                        referrerPolicy="no-referrer"
                                        onError={() => setFailedQr(share.data.qrPngUrl)}
                                    />
                                )}
                            </div>
                        )}
                        <Button
                            variant="destructive"
                            disabled={locked}
                            onClick={() => setConfirm('unpublish')}
                        >
                            Gỡ xuất bản
                        </Button>
                    </>
                )}
            </div>
            <div className="publication-section mt-8 border-t-[1px] border-t-border pt-6 [border-top-style:solid]">
                <h3>PDF để in</h3>
                <p>
                    PDF dùng dữ liệu đã đóng của phiên bản đang xuất bản
                    {book.currentVersion ? ` (phiên bản ${book.currentVersion.versionNo})` : ''}.
                    Nếu vừa sửa bản nháp, xuất bản lại trước để PDF chứa thay đổi mới.
                </p>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!locked && available && !unsaved) {
                            const parsed = PrintPdfBodySchema.safeParse(print);
                            if (!parsed.success) {
                                setError('Chọn cấu hình PDF hợp lệ, chừa xén từ 0 đến 10 mm.');
                                return;
                            }
                            void job.start(
                                'EXPORT_PDF',
                                book.currentVersion?.versionNo || null,
                                () => api.print(book.id, parsed.data),
                            );
                        }
                    }}
                >
                    <FieldGroup className="contents">
                        <fieldset disabled={locked || !available || unsaved}>
                            <div className="form-grid grid grid-cols-[1fr_1fr] gap-[0_var(--space-6)] max-[760px]:grid-cols-[1fr] max-[540px]:[.theme-demo-form_&]:grid-cols-[1fr]">
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="pdf-kind">
                                        Loại tệp
                                        <FormSelect
                                            id="pdf-kind"
                                            value={print.kind}
                                            onValueChange={(value) =>
                                                setPrint({
                                                    ...print,
                                                    kind: value as 'PRINT' | 'MARKER_SHEET',
                                                })
                                            }
                                            options={[
                                                { value: 'PRINT', label: 'Sách để in' },
                                                {
                                                    value: 'MARKER_SHEET',
                                                    label: 'Tờ tem marker Bookaria',
                                                },
                                            ]}
                                        />
                                    </FieldLabel>
                                </Field>
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="pdf-qr">
                                        Vị trí QR
                                        <FormSelect
                                            id="pdf-qr"
                                            value={print.qrMode}
                                            onValueChange={(value) =>
                                                setPrint({
                                                    ...print,
                                                    qrMode: value as 'COVER_ONLY' | 'ALL_AR_PAGES',
                                                })
                                            }
                                            options={[
                                                { value: 'COVER_ONLY', label: 'Chỉ trên bìa' },
                                                {
                                                    value: 'ALL_AR_PAGES',
                                                    label: 'Bìa và mọi trang AR',
                                                },
                                            ]}
                                        />
                                    </FieldLabel>
                                </Field>
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="pdf-bleed">
                                        Chừa xén (mm)
                                        <Input
                                            id="pdf-bleed"
                                            type="number"
                                            min={0}
                                            max={10}
                                            step="any"
                                            required
                                            value={
                                                Number.isFinite(print.bleedMm) ? print.bleedMm : ''
                                            }
                                            onChange={(event) =>
                                                setPrint({
                                                    ...print,
                                                    bleedMm:
                                                        event.currentTarget.value === ''
                                                            ? Number.NaN
                                                            : Number(event.currentTarget.value),
                                                })
                                            }
                                        />
                                    </FieldLabel>
                                </Field>
                            </div>
                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                Chừa xén từ 0 đến 10 mm. Tờ tem chỉ dùng cho trang có marker
                                Bookaria; trang CUSTOM hoặc không có AR không có tem. Sách có marker
                                CUSTOM cần chọn QR chỉ trên bìa để giữ nguyên ảnh nhận diện.
                            </p>
                            <Button type="submit" variant="secondary">
                                Tạo PDF từ bản xuất bản
                            </Button>
                        </fieldset>
                    </FieldGroup>
                </form>
                {pdf && (
                    <p role="status">
                        <a href={pdf.url} target="_blank" rel="noopener noreferrer">
                            Mở PDF vừa tạo — {pdf.kind === 'PRINT' ? 'sách để in' : 'tờ tem marker'}
                            {pdf.versionNo
                                ? ` · yêu cầu khi đang ở phiên bản ${pdf.versionNo}`
                                : ''}
                        </a>
                        <span className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            {' '}
                            Lưu liên kết này trước khi rời trang. Mỗi biến thể có tệp riêng.
                        </span>
                    </p>
                )}
                {available &&
                    publicBook.data?.printPdfUrl &&
                    publicBook.data.version.versionNo === book.currentVersion?.versionNo &&
                    !publicBook.isError && (
                        <p>
                            <a
                                href={publicBook.data.printPdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Mở PDF sách đầu tiên của phiên bản hiện hành
                            </a>
                        </p>
                    )}
                {available && publicBook.isError && (
                    <Feedback
                        error={`Chưa tải được PDF mặc định. ${errorMessage(publicBook.error)}`}
                    />
                )}
            </div>
            <div className="publication-section mt-8 border-t-[1px] border-t-border pt-6 [border-top-style:solid]">
                <h3>Lịch sử phiên bản</h3>
                {versions.isPending && <LoadingState layout="rows">Đang tải lịch sử…</LoadingState>}
                {versions.isError && <Feedback error={errorMessage(versions.error)} />}
                {versions.data?.length === 0 && <p>Chưa có phiên bản đã xuất bản.</p>}
                {versions.data && versions.data.length > 0 && (
                    <ol className="publication-versions list-none p-0 [&_li]:border-b-[1px] [&_li]:border-b-border [&_li]:px-0 [&_li]:py-4 [&_li]:[border-bottom-style:solid] [&_li_p]:mx-0 [&_li_p]:mt-1 [&_li_p]:mb-0 [&_li_p]:text-muted-foreground">
                        {versions.data.map((version) => (
                            <li key={version.id}>
                                <strong>Phiên bản {version.versionNo}</strong> ·{' '}
                                {date(version.publishedAt)}
                                <p>
                                    {version.pageCount} trang · {version.arPageCount} trang AR ·{' '}
                                    {bytes(version.totalBytes)}
                                    {version.publishedBy && ` · ${version.publishedBy.displayName}`}
                                </p>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
            {confirm && (
                <ConfirmationDialog
                    description={
                        confirm === 'publish'
                            ? `Xuất bản bản nháp đã lưu ở chế độ ${visibility === 'PUBLIC' ? 'công khai' : 'không niêm yết'}. Liên kết cũ sẽ mở phiên bản mới sau khi tác vụ thành công.`
                            : confirm === 'unpublish'
                              ? 'Sách chuyển về riêng tư. Người đọc không tải tiếp được bằng liên kết và QR cũ; các tệp đã tải xuống vẫn tồn tại.'
                              : 'Chỉ tiếp tục khi bạn đã xác định kết quả yêu cầu trước. Thao tác này bỏ chặn trên trình duyệt, không hủy tác vụ ở máy chủ.'
                    }
                    title={
                        confirm === 'publish'
                            ? 'Xuất bản phiên bản mới?'
                            : confirm === 'unpublish'
                              ? 'Gỡ xuất bản sách?'
                              : 'Cho phép gửi yêu cầu mới?'
                    }
                    busy={requesting || job.posting}
                    onClose={() => setConfirm(null)}
                >
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant={confirm === 'unpublish' ? 'destructive' : 'default'}
                                aria-busy={requesting || job.posting}
                                onClick={() => {
                                    if (confirm === 'publish') void publish();
                                    else if (confirm === 'unpublish') void unpublish();
                                    else {
                                        job.release();
                                        setConfirm(null);
                                    }
                                }}
                                disabled={requesting || job.posting}
                            >
                                {(requesting || job.posting) && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}{' '}
                                {confirm === 'publish'
                                    ? 'Xác nhận xuất bản'
                                    : confirm === 'unpublish'
                                      ? 'Xác nhận gỡ xuất bản'
                                      : 'Cho phép yêu cầu mới'}
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="outline"
                                disabled={requesting || job.posting}
                                onClick={() => setConfirm(null)}
                            >
                                Hủy
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
