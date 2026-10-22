import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/errors';
import { AddPageBodySchema } from '../../../shared/contracts/api/pages.schema';
import type { PageSummary } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { profileKey } from '../../profile';
import {
    markerWarningText,
    movedPageIds,
    pageKeys,
    pagesApi,
    uncertainWrite,
} from '../model/pages';
import { PageImageForm } from './PageImageForm';
import './pages.css';

export function BookPages({
    bookId,
    disabled,
    onBusyChange,
}: {
    bookId: string;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth(),
        cache = useQueryClient(),
        navigate = useNavigate();
    const [adding, setAdding] = useState(false),
        [uploadBusy, setUploadBusy] = useState(false),
        [busy, setBusy] = useState(false);
    const guard = useRef(false);
    const [uncertain, setUncertain] = useState(false),
        [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<PageSummary | null>(null);
    const pages = useQuery({
        queryKey: pageKeys.list(user?.id || '', bookId),
        queryFn: ({ signal }) => pagesApi.list(bookId, signal),
        refetchOnWindowFocus: false,
    });
    useEffect(() => {
        onBusyChange(busy || uploadBusy);
        return () => onBusyChange(false);
    }, [busy, uploadBusy, onBusyChange]);
    const locked = disabled || busy || uploadBusy || uncertain;
    async function refresh() {
        await cache.invalidateQueries({ queryKey: bookKeys.all });
        const result = await pages.refetch();
        if (result.isError) throw result.error;
    }
    async function mutate(action: () => Promise<unknown>, message: string, post = false) {
        if (locked || guard.current) return;
        guard.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action();
            await refresh();
            setNotice(message);
            setDeleting(null);
        } catch (cause) {
            if (post && uncertainWrite(cause)) setUncertain(true);
            setError(errorMessage(cause));
        } finally {
            guard.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="book-pages" aria-labelledby="book-pages-title">
            <div className="page-list-heading">
                <div>
                    <h2 id="book-pages-title">Trang sách</h2>
                    <p>{pages.data?.length || 0} trang · Sắp xếp theo thứ tự đọc.</p>
                </div>
                <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() => setAdding((value) => !value)}
                >
                    <Plus size={18} aria-hidden="true" />
                    {adding ? 'Đóng phần thêm trang' : 'Thêm trang'}
                </Button>
            </div>
            <Feedback error={deleting ? null : error} success={notice} />
            {uncertain && (
                <div className="page-sync-notice">
                    <p>
                        Chưa xác nhận được kết quả. Yêu cầu có thể đã được nhận; hãy tải lại danh
                        sách trước khi thao tác tiếp.
                    </p>
                    <Button
                        variant="secondary"
                        loading={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                                await refresh();
                                setUncertain(false);
                                setAdding(false);
                                setDeleting(null);
                                setNotice(
                                    'Đã tải lại danh sách. Hãy kiểm tra trang vừa thao tác trước khi thử tiếp.',
                                );
                            } catch (cause) {
                                setError(errorMessage(cause));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        Tải lại danh sách
                    </Button>
                </div>
            )}
            {pages.isPending && <p role="status">Đang tải danh sách trang…</p>}
            {pages.isError && (
                <>
                    <Feedback error={errorMessage(pages.error)} />
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void pages.refetch();
                        }}
                    >
                        Thử tải lại trang sách
                    </Button>
                </>
            )}
            {pages.data && (
                <>
                    {pages.data.length ? (
                        <ol className="page-list">
                            {pages.data.map((page, index) => (
                                <li className="page-list-row" key={page.id}>
                                    <img
                                        className="page-row-image"
                                        src={page.thumbnailUrl}
                                        alt=""
                                    />
                                    <div className="page-row-content">
                                        <h3>
                                            <Link to={`/books/${bookId}/pages/${page.id}`}>
                                                {page.title || `Trang ${index + 1}`}
                                            </Link>
                                        </h3>
                                        <p>
                                            Trang {index + 1} · {page.objectCount} đối tượng ·{' '}
                                            {page.markerMode === 'NONE'
                                                ? 'Không dùng AR'
                                                : page.markerMode === 'BOOKARIA_MARKER'
                                                  ? `Marker Bookaria ${page.markerNumber || ''}`
                                                  : 'Nhận diện bằng ảnh trang'}
                                        </p>
                                        {[...new Set(page.markerWarnings)].map((warning) => (
                                            <p className="field-hint" key={warning}>
                                                {markerWarningText(warning)}
                                            </p>
                                        ))}
                                    </div>
                                    <div className="page-row-actions">
                                        <Button
                                            variant="ghost"
                                            disabled={locked || index === 0}
                                            aria-label={`Đưa trang ${index + 1} lên`}
                                            onClick={() => {
                                                const ids = movedPageIds(pages.data, page.id, -1);
                                                if (ids)
                                                    void mutate(
                                                        () => pagesApi.reorder(bookId, ids),
                                                        'Đã đổi thứ tự trang.',
                                                    );
                                            }}
                                        >
                                            <ArrowUp size={18} aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            disabled={locked || index === pages.data.length - 1}
                                            aria-label={`Đưa trang ${index + 1} xuống`}
                                            onClick={() => {
                                                const ids = movedPageIds(pages.data, page.id, 1);
                                                if (ids)
                                                    void mutate(
                                                        () => pagesApi.reorder(bookId, ids),
                                                        'Đã đổi thứ tự trang.',
                                                    );
                                            }}
                                        >
                                            <ArrowDown size={18} aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            disabled={locked}
                                            aria-label={`Nhân bản trang ${index + 1}`}
                                            onClick={() => {
                                                void mutate(
                                                    () => pagesApi.duplicate(page.id),
                                                    'Đã nhân bản trang.',
                                                    true,
                                                );
                                            }}
                                        >
                                            <Copy size={18} aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            disabled={locked}
                                            aria-label={`Xóa trang ${index + 1}`}
                                            onClick={() => {
                                                setError(null);
                                                setDeleting(page);
                                            }}
                                        >
                                            <Trash2 size={18} aria-hidden="true" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="page-list-empty">
                            Sách chưa có trang. Tải một ảnh trang để bắt đầu.
                        </p>
                    )}
                    {adding && (
                        <PageImageForm
                            title="Thêm trang sách"
                            action="Thêm trang từ ảnh"
                            disabled={disabled || busy || uncertain}
                            onBusyChange={setUploadBusy}
                            onUploaded={() => {
                                void cache.invalidateQueries({ queryKey: assetKeys.all });
                                void cache.invalidateQueries({
                                    queryKey: profileKey(user?.id || ''),
                                });
                            }}
                            onAttach={async (asset, form, context) => {
                                const position = String(form.get('position') || 'end');
                                const body = AddPageBodySchema.parse({
                                    imageAssetId: asset.id,
                                    title: String(form.get('title') || '').trim() || undefined,
                                    afterPageId:
                                        position === 'end'
                                            ? undefined
                                            : position === 'start'
                                              ? null
                                              : position,
                                });
                                context.onStage('saving');
                                let result: Awaited<ReturnType<typeof pagesApi.add>>;
                                try {
                                    result = await pagesApi.add(bookId, body);
                                } catch (cause) {
                                    if (uncertainWrite(cause)) setUncertain(true);
                                    throw cause;
                                }
                                void cache.invalidateQueries({ queryKey: bookKeys.all });
                                void cache.invalidateQueries({ queryKey: pageKeys.all });
                                if (
                                    !context.signal.aborted &&
                                    auth.store.getState().user?.id === user?.id
                                )
                                    navigate(`/books/${bookId}/pages/${result.page.id}`, {
                                        state: { created: true, warnings: result.warnings },
                                    });
                            }}
                        >
                            <label htmlFor="new-page-title">
                                Tên trang (không bắt buộc)
                                <input id="new-page-title" name="title" maxLength={150} />
                            </label>
                            <label htmlFor="page-position">
                                Vị trí thêm trang
                                <select id="page-position" name="position" defaultValue="end">
                                    <option value="end">Cuối sách</option>
                                    <option value="start">Đầu sách</option>
                                    {pages.data.map((page, index) => (
                                        <option key={page.id} value={page.id}>
                                            Sau trang {index + 1}
                                            {page.title ? ` — ${page.title}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </PageImageForm>
                    )}
                </>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa trang sách?"
                    busy={busy}
                    onClose={() => {
                        if (!busy) setDeleting(null);
                    }}
                >
                    <p>
                        Trang “{deleting.title || `Trang ${deleting.orderIndex + 1}`}” và nội dung
                        của nó sẽ bị xóa khỏi bản nháp. Tệp ảnh vẫn được giữ trong tài nguyên.
                    </p>
                    <Feedback error={error} />
                    <div className="form-actions">
                        <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setDeleting(null)}
                        >
                            Giữ lại
                        </Button>
                        <Button
                            variant="danger"
                            loading={busy}
                            onClick={() => {
                                void mutate(() => pagesApi.remove(deleting.id), 'Đã xóa trang.');
                            }}
                        >
                            Xóa trang
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </section>
    );
}
