import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { apiClient } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/errors';
import {
    PrintPdfBodySchema,
    type PublishCheck,
} from '../../../shared/contracts/api/publish.schema';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { createPublicationApi } from '../api/publication-api';
import { usePublicationJob } from '../model/usePublicationJob';
import './publication.css';

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
                setNotice('Kết quả kiểm tra đã thay đổi. Đọc lại lỗi/cảnh báo trước khi xuất bản.');
                return;
            }
            await job.start('PUBLISH_BOOK', null, () =>
                api.publish(book.id, { visibility, acceptWarnings: accepted }),
            );
            if (session()) {
                setCheck(null);
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
            if (session()) setNotice('Đã sao chép.');
        } catch {
            if (session())
                setError('Chưa sao chép tự động được. Chọn nội dung trong ô rồi sao chép.');
        }
    }
    const issues = (items: PublishCheck['errors'] | PublishCheck['warnings']) => (
        <ul className="publication-issues">
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
                            <Link to="/check-email">Xác nhận email</Link>
                        </>
                    )}
                </li>
            ))}
        </ul>
    );
    return (
        <section className="publication" aria-labelledby="publication-heading">
            <h2 id="publication-heading">Xuất bản và chia sẻ</h2>
            <p>
                Bản nháp đã lưu được đóng thành một phiên bản khi xuất bản. Sửa tiếp bản nháp không
                thay đổi phiên bản người đọc đang xem.
            </p>
            <Feedback error={error || job.error} success={notice || null} />
            {unsaved && (
                <p className="field-hint">
                    Bạn còn thông tin sách chưa lưu. Lưu thông tin trước khi kiểm tra và xuất bản.
                </p>
            )}
            <div className="form-actions">
                <Button
                    variant="secondary"
                    disabled={locked || unsaved}
                    onClick={() => {
                        void inspect();
                    }}
                >
                    Kiểm tra trước xuất bản
                </Button>
                <Button variant="ghost" disabled={requesting} onClick={refresh}>
                    Tải lại trạng thái xuất bản
                </Button>
            </div>
            {check && (
                <section className="publication-check" aria-label="Kết quả kiểm tra xuất bản">
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
                        <label htmlFor="publication-visibility">
                            Cách chia sẻ
                            <select
                                id="publication-visibility"
                                value={visibility}
                                onChange={(event) =>
                                    setVisibility(event.currentTarget.value as typeof visibility)
                                }
                            >
                                <option value="UNLISTED">Không niêm yết — xem bằng liên kết</option>
                                <option value="PUBLIC">Công khai — xuất hiện trong thư viện</option>
                            </select>
                        </label>
                        {check.warnings.length > 0 && (
                            <label className="publication-accept">
                                <input
                                    type="checkbox"
                                    checked={accepted}
                                    onChange={(event) => setAccepted(event.currentTarget.checked)}
                                />
                                Tôi đã đọc và chấp nhận các cảnh báo trên.
                            </label>
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
                <p className="field-hint">
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
                <div className="publication-check">
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
            <div className="publication-section">
                <h3>Liên kết và mã QR</h3>
                {!available ? (
                    <p>
                        Xuất bản sách để tạo liên kết chia sẻ. Sách riêng tư hoặc bị gỡ không mở
                        được bằng liên kết.
                    </p>
                ) : (
                    <>
                        {share.isPending && <p role="status">Đang tải thông tin chia sẻ…</p>}
                        {share.isError && (
                            <Feedback
                                error={`${errorMessage(share.error)} Bấm Tải lại trạng thái xuất bản để kiểm tra lại.`}
                            />
                        )}
                        {share.data && !share.isError && (
                            <div className="publication-share">
                                <div>
                                    <a
                                        href={share.data.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Mở sách đã xuất bản
                                    </a>
                                    <label htmlFor="share-url">
                                        Liên kết sách
                                        <input
                                            id="share-url"
                                            readOnly
                                            value={share.data.url}
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                    </label>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            void copy(share.data.url);
                                        }}
                                    >
                                        Sao chép liên kết sách
                                    </Button>
                                    <label htmlFor="share-embed">
                                        Mã nhúng vào website
                                        <textarea
                                            id="share-embed"
                                            rows={4}
                                            readOnly
                                            value={share.data.embedHtml}
                                            onFocus={(e) => e.currentTarget.select()}
                                        />
                                    </label>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            void copy(share.data.embedHtml);
                                        }}
                                    >
                                        Sao chép mã nhúng
                                    </Button>
                                    <p className="field-hint">
                                        Camera trong trang nhúng cần HTTPS và quyền camera của
                                        website chứa iframe. Địa chỉ localhost chỉ dùng trên máy
                                        này.
                                    </p>
                                    <div className="form-actions">
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
                            variant="danger"
                            disabled={locked}
                            onClick={() => setConfirm('unpublish')}
                        >
                            Gỡ xuất bản
                        </Button>
                    </>
                )}
            </div>
            <div className="publication-section">
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
                    <fieldset disabled={locked || !available || unsaved}>
                        <div className="form-grid">
                            <label htmlFor="pdf-kind">
                                Loại tệp
                                <select
                                    id="pdf-kind"
                                    value={print.kind}
                                    onChange={(event) =>
                                        setPrint({
                                            ...print,
                                            kind: event.currentTarget.value as
                                                | 'PRINT'
                                                | 'MARKER_SHEET',
                                        })
                                    }
                                >
                                    <option value="PRINT">Sách để in</option>
                                    <option value="MARKER_SHEET">Tờ tem marker Bookaria</option>
                                </select>
                            </label>
                            <label htmlFor="pdf-qr">
                                Vị trí QR
                                <select
                                    id="pdf-qr"
                                    value={print.qrMode}
                                    onChange={(event) =>
                                        setPrint({
                                            ...print,
                                            qrMode: event.currentTarget.value as
                                                | 'COVER_ONLY'
                                                | 'ALL_AR_PAGES',
                                        })
                                    }
                                >
                                    <option value="COVER_ONLY">Chỉ trên bìa</option>
                                    <option value="ALL_AR_PAGES">Bìa và mọi trang AR</option>
                                </select>
                            </label>
                            <label htmlFor="pdf-bleed">
                                Chừa xén (mm)
                                <input
                                    id="pdf-bleed"
                                    type="number"
                                    min={0}
                                    max={10}
                                    step="any"
                                    required
                                    value={Number.isFinite(print.bleedMm) ? print.bleedMm : ''}
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
                            </label>
                        </div>
                        <p className="field-hint">
                            Chừa xén từ 0 đến 10 mm. Tờ tem chỉ dùng cho trang có marker Bookaria;
                            trang CUSTOM hoặc không có AR không có tem. Sách có marker CUSTOM cần
                            chọn QR chỉ trên bìa để giữ nguyên ảnh nhận diện.
                        </p>
                        <Button type="submit" variant="secondary">
                            Tạo PDF từ bản xuất bản
                        </Button>
                    </fieldset>
                </form>
                {pdf && (
                    <p role="status">
                        <a href={pdf.url} target="_blank" rel="noopener noreferrer">
                            Mở PDF vừa tạo — {pdf.kind === 'PRINT' ? 'sách để in' : 'tờ tem marker'}
                            {pdf.versionNo
                                ? ` · yêu cầu khi đang ở phiên bản ${pdf.versionNo}`
                                : ''}
                        </a>
                        <span className="field-hint">
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
            <div className="publication-section">
                <h3>Lịch sử phiên bản</h3>
                {versions.isPending && <p role="status">Đang tải lịch sử…</p>}
                {versions.isError && <Feedback error={errorMessage(versions.error)} />}
                {versions.data?.length === 0 && <p>Chưa có phiên bản đã xuất bản.</p>}
                {versions.data && versions.data.length > 0 && (
                    <ol className="publication-versions">
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
                <ConfirmDialog
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
                    <p>
                        {confirm === 'publish'
                            ? `Xuất bản bản nháp đã lưu ở chế độ ${visibility === 'PUBLIC' ? 'công khai' : 'không niêm yết'}. Liên kết cũ sẽ mở phiên bản mới sau khi tác vụ thành công.`
                            : confirm === 'unpublish'
                              ? 'Sách chuyển về riêng tư. Người đọc không tải tiếp được bằng liên kết và QR cũ; các tệp đã tải xuống vẫn tồn tại.'
                              : 'Chỉ tiếp tục khi bạn đã xác định kết quả yêu cầu trước. Thao tác này bỏ chặn trên trình duyệt, không hủy tác vụ ở máy chủ.'}
                    </p>
                    <div className="form-actions">
                        <Button
                            variant={confirm === 'unpublish' ? 'danger' : 'primary'}
                            loading={requesting || job.posting}
                            onClick={() => {
                                if (confirm === 'publish') void publish();
                                else if (confirm === 'unpublish') void unpublish();
                                else {
                                    job.release();
                                    setConfirm(null);
                                }
                            }}
                        >
                            {' '}
                            {confirm === 'publish'
                                ? 'Xác nhận xuất bản'
                                : confirm === 'unpublish'
                                  ? 'Xác nhận gỡ xuất bản'
                                  : 'Cho phép yêu cầu mới'}
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={requesting || job.posting}
                            onClick={() => setConfirm(null)}
                        >
                            Hủy
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </section>
    );
}
