import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { assetKeys, assetsApi } from '../features/assets';
import { uploadFile } from '../features/assets/api/upload-file';
import { auth, useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { markerWarningText, pageKeys, pagesApi } from '../features/pages';
import { compileMarker } from '../features/pages/api/compile-marker';
import { type MindCheckpoint, prepareMarkerUpload } from '../features/pages/model/marker-upload';
import { placementFromForm } from '../features/pages/model/placement';
import { type ImageAttachmentContext, PageImageForm } from '../features/pages/ui/PageImageForm';
import { profileKey } from '../features/profile';
import { SceneEditor } from '../features/scene';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import type { BookDetail, Page } from '../shared/contracts/dto.schema';
import { defaultMarkerTransform, markerToMm } from '../shared/contracts/marker.schema';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import '../features/pages/ui/pages.css';

function PageEditor({ page, book }: { page: Page; book: BookDetail }) {
    const { user } = useAuth(),
        cache = useQueryClient(),
        location = useLocation();
    const [busy, setBusy] = useState(false),
        [imageBusy, setImageBusy] = useState(false);
    const [stage, setStage] = useState<string | null>(null),
        [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(
            location.state?.created
                ? page.markerMode === 'NONE' &&
                  Array.isArray(location.state?.warnings) &&
                  location.state.warnings.includes('NO_MARKER_AVAILABLE')
                    ? 'Đã thêm trang sách. Chưa có marker Bookaria khả dụng; bạn có thể dùng ảnh trang để nhận diện.'
                    : 'Đã thêm trang sách.'
                : null,
        );
    const [mode, setMode] = useState<'content' | 'page'>('content');
    const [sceneBusy, setSceneBusy] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null),
        checkpoint = useRef<MindCheckpoint | null>(null);
    const job = useQuery({
        queryKey: ['page-score-job', user?.id || '', jobId],
        queryFn: ({ signal }) => pagesApi.job(jobId || '', signal),
        enabled: Boolean(jobId),
        retry: false,
        refetchInterval: (query) =>
            query.state.error || ['SUCCEEDED', 'FAILED'].includes(query.state.data?.status || '')
                ? false
                : 1500,
    });
    const scoring = Boolean(jobId) && !['SUCCEEDED', 'FAILED'].includes(job.data?.status || '');
    const locked = busy || imageBusy || scoring || sceneBusy;
    const geometry = { format: book.pageFormat, aspect: book.pageAspect };
    const transform =
        page.bookariaMarker?.transform || defaultMarkerTransform(geometry, page.orderIndex);
    const mm = markerToMm(transform, geometry);
    useEffect(() => () => controller.current?.abort(), []);
    const refreshedJob = useRef<string | null>(null);
    useEffect(() => {
        if (
            !jobId ||
            !job.data ||
            !['SUCCEEDED', 'FAILED'].includes(job.data.status) ||
            refreshedJob.current === jobId
        )
            return;
        refreshedJob.current = jobId;
        void cache.invalidateQueries({ queryKey: pageKeys.all });
        void cache.invalidateQueries({ queryKey: bookKeys.all });
    }, [jobId, job.data, cache]);
    async function refresh() {
        if (auth.store.getState().user?.id !== user?.id) return;
        await Promise.all([
            cache.invalidateQueries({ queryKey: pageKeys.all }),
            cache.invalidateQueries({ queryKey: bookKeys.all }),
        ]);
    }
    async function mind(source: string, context: ImageAttachmentContext) {
        return prepareMarkerUpload({
            source,
            signal: context.signal,
            checkpoint: checkpoint.current,
            onCheckpoint: (value) => {
                checkpoint.current = value;
            },
            compile: compileMarker,
            api: assetsApi,
            transfer: uploadFile,
            onStage: context.onStage,
            onProgress: context.onProgress,
        });
    }
    async function run(action: (signal: AbortSignal) => Promise<void>, message: string) {
        if (locked || controller.current) return;
        const active = new AbortController();
        controller.current = active;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await action(active.signal);
            if (!active.signal.aborted) {
                await refresh();
                setNotice(message);
            }
        } catch (cause) {
            if (!active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (controller.current === active) {
                controller.current = null;
                setBusy(false);
                setStage(null);
            }
        }
    }
    function saveTitle(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run(async () => {
            await pagesApi.update(page.id, {
                title: String(form.get('title') || '').trim() || null,
            });
        }, 'Đã lưu tên trang.');
    }
    return (
        <>
            <div className="page-heading">
                <div>
                    <Link className="back-link" to={`/books/${book.id}`}>
                        {book.title}
                    </Link>
                    <h1>{page.title || `Trang ${page.orderIndex + 1}`}</h1>
                    <p>
                        Trang {page.orderIndex + 1} · {page.objectCount} đối tượng
                    </p>
                </div>
            </div>
            <Feedback error={error} success={notice} />
            {[...new Set(page.markerWarnings)].map((warning) => (
                <p className="page-warning" key={warning}>
                    {markerWarningText(warning)}
                </p>
            ))}
            <fieldset className="page-edit-modes" aria-label="Phần chỉnh sửa trang">
                <Button
                    variant={mode === 'content' ? 'primary' : 'ghost'}
                    aria-pressed={mode === 'content'}
                    disabled={busy || imageBusy || sceneBusy}
                    onClick={() => setMode('content')}
                >
                    Nội dung AR
                </Button>
                <Button
                    variant={mode === 'page' ? 'primary' : 'ghost'}
                    aria-pressed={mode === 'page'}
                    disabled={busy || imageBusy || sceneBusy}
                    onClick={() => setMode('page')}
                >
                    Trang và nhận diện
                </Button>
            </fieldset>
            <div hidden={mode !== 'content'}>
                <SceneEditor
                    page={page}
                    book={book}
                    disabled={busy || imageBusy || scoring}
                    onBusyChange={setSceneBusy}
                />
            </div>
            <div hidden={mode !== 'page'}>
                <div className="page-editor-layout">
                    <section className="page-preview-section" aria-label="Xem trước trang sách">
                        <div
                            className="page-paper"
                            style={{ aspectRatio: `1 / ${book.pageAspect}` }}
                        >
                            <img
                                src={page.image.url}
                                alt={`Ảnh ${page.title || `trang ${page.orderIndex + 1}`}`}
                            />
                            {page.markerMode === 'BOOKARIA_MARKER' && page.bookariaMarker && (
                                <div
                                    className="marker-placement"
                                    style={{
                                        left: `${(transform.x + 0.5) * 100}%`,
                                        top: `${(0.5 - transform.y / book.pageAspect) * 100}%`,
                                        width: `${transform.size * 100}%`,
                                        aspectRatio: '1',
                                    }}
                                >
                                    <span>{page.markerNumber}</span>
                                </div>
                            )}
                        </div>
                        {page.markerMode === 'BOOKARIA_MARKER' && (
                            <p className="field-hint">
                                Ô số minh họa vị trí marker khi in. Đây không phải mẫu marker để
                                quét.
                            </p>
                        )}
                        <p className="field-hint">
                            Ảnh gốc {page.image.width} × {page.image.height} px. Nội dung AR sẽ được
                            chỉnh ở phần tiếp theo.
                        </p>
                    </section>
                    <div className="page-editor-controls">
                        <form className="page-control-section" onSubmit={saveTitle}>
                            <h2>Thông tin trang</h2>
                            <label htmlFor="page-title">
                                Tên trang
                                <input
                                    id="page-title"
                                    name="title"
                                    maxLength={150}
                                    defaultValue={page.title || ''}
                                    disabled={locked}
                                />
                            </label>
                            <Button type="submit" disabled={locked}>
                                Lưu tên trang
                            </Button>
                        </form>
                        <section className="page-control-section" aria-labelledby="marker-heading">
                            <h2 id="marker-heading">Nhận diện AR</h2>
                            <p>
                                Hiện tại:{' '}
                                {page.markerMode === 'NONE'
                                    ? 'Không dùng AR'
                                    : page.markerMode === 'BOOKARIA_MARKER'
                                      ? `Marker Bookaria ${page.markerNumber}`
                                      : 'Dùng ảnh trang để nhận diện'}
                                .
                            </p>
                            <div className="form-actions">
                                <Button
                                    variant="secondary"
                                    disabled={locked || page.markerMode === 'NONE'}
                                    onClick={() => {
                                        void run(async () => {
                                            await pagesApi.update(page.id, { noAr: true });
                                        }, 'Đã tắt AR cho trang.');
                                    }}
                                >
                                    Không dùng AR
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={locked || page.markerMode === 'BOOKARIA_MARKER'}
                                    onClick={() => {
                                        void run(async () => {
                                            await pagesApi.setMarker(page.id, {
                                                mode: 'BOOKARIA_MARKER',
                                            });
                                        }, 'Đã dùng marker Bookaria.');
                                    }}
                                >
                                    Dùng marker Bookaria
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={locked || page.markerMode === 'CUSTOM_MARKER'}
                                    onClick={() => {
                                        void run(async (signal) => {
                                            const markerMindPublicId = await mind(page.image.url, {
                                                signal,
                                                onStage: setStage,
                                                onProgress: setProgress,
                                            });
                                            signal.throwIfAborted();
                                            setStage('saving');
                                            const result = await pagesApi.setMarker(page.id, {
                                                mode: 'CUSTOM_MARKER',
                                                markerMindPublicId,
                                            });
                                            if (result.processing) setJobId(result.jobId);
                                        }, 'Đã lưu chế độ nhận diện. Máy chủ đang đánh giá ảnh.');
                                    }}
                                >
                                    Dùng ảnh trang
                                </Button>
                            </div>
                            <p className="field-hint">
                                Dùng ảnh trang sẽ chuẩn bị dữ liệu nhận diện trên trình duyệt, có
                                thể mất vài phút. Ảnh có nhiều chi tiết thường dễ quét hơn.
                            </p>
                            {stage && (
                                <div>
                                    <p role="status">
                                        {stage === 'saving'
                                            ? 'Đang lưu nhận diện…'
                                            : `${stage === 'compiling' ? 'Đang chuẩn bị nhận diện' : 'Đang tải dữ liệu nhận diện'}… ${progress}%`}
                                    </p>
                                    {stage !== 'saving' && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                controller.current?.abort();
                                            }}
                                        >
                                            Dừng chuẩn bị
                                        </Button>
                                    )}
                                </div>
                            )}
                            {page.markerMode === 'BOOKARIA_MARKER' && (
                                <form
                                    className="marker-position-form"
                                    key={`${page.id}-${JSON.stringify(transform)}`}
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        const form = new FormData(event.currentTarget);
                                        void run(async () => {
                                            await pagesApi.setMarker(page.id, {
                                                mode: 'BOOKARIA_MARKER',
                                                transform: placementFromForm(form, geometry),
                                            });
                                        }, 'Đã lưu vị trí marker.');
                                    }}
                                >
                                    <h3>Vị trí trên bản in</h3>
                                    <p className="field-hint">
                                        Tâm marker tính từ góc trên bên trái. Cạnh tối thiểu 35 mm,
                                        cách mép ít nhất 12 mm.
                                    </p>
                                    <fieldset disabled={locked} className="marker-measurements">
                                        <label htmlFor="marker-x">
                                            Tâm ngang (mm)
                                            <input
                                                id="marker-x"
                                                name="centerX"
                                                type="number"
                                                step="0.1"
                                                required
                                                defaultValue={mm.centerXMm.toFixed(1)}
                                            />
                                        </label>
                                        <label htmlFor="marker-y">
                                            Tâm dọc (mm)
                                            <input
                                                id="marker-y"
                                                name="centerY"
                                                type="number"
                                                step="0.1"
                                                required
                                                defaultValue={mm.centerYMm.toFixed(1)}
                                            />
                                        </label>
                                        <label htmlFor="marker-size">
                                            Cạnh (mm)
                                            <input
                                                id="marker-size"
                                                name="size"
                                                type="number"
                                                step="0.1"
                                                min="35"
                                                required
                                                defaultValue={mm.sizeMm.toFixed(1)}
                                            />
                                        </label>
                                    </fieldset>
                                    <Button type="submit" disabled={locked}>
                                        Lưu vị trí marker
                                    </Button>
                                </form>
                            )}
                            {jobId && (
                                <div className="page-score-status">
                                    {job.isPending && (
                                        <p role="status">Đang kiểm tra tiến độ đánh giá…</p>
                                    )}
                                    {job.isError && (
                                        <>
                                            <Feedback error={errorMessage(job.error)} />
                                            <Button
                                                variant="secondary"
                                                onClick={() => {
                                                    void job.refetch();
                                                }}
                                            >
                                                Kiểm tra lại tiến độ
                                            </Button>
                                        </>
                                    )}
                                    {job.data && (
                                        <p role="status">
                                            {job.data.status === 'SUCCEEDED'
                                                ? 'Đã đánh giá ảnh nhận diện.'
                                                : job.data.status === 'FAILED'
                                                  ? `Đánh giá chưa thành công: ${job.data.error?.message || 'Vui lòng thử lại.'}`
                                                  : `Máy chủ đang đánh giá ảnh… ${job.data.progress}%`}
                                        </p>
                                    )}
                                </div>
                            )}
                            {page.markerMode === 'CUSTOM_MARKER' && (
                                <div className="marker-report">
                                    <h3>Chất lượng ảnh nhận diện</h3>
                                    <p>
                                        {page.markerScore == null
                                            ? 'Chưa có điểm đánh giá.'
                                            : `${page.markerScore}/5 sao · Cần tối thiểu 3 sao để xuất bản.`}
                                    </p>
                                    {page.markerReport && (
                                        <>
                                            <p>
                                                {page.markerReport.features} điểm đặc trưng · Phủ{' '}
                                                {(page.markerReport.coverage * 100).toFixed(0)}%
                                                vùng ảnh.
                                            </p>
                                            {page.markerReport.hints.length > 0 && (
                                                <ul>
                                                    {page.markerReport.hints.map((hint) => (
                                                        <li key={hint}>{hint}</li>
                                                    ))}
                                                </ul>
                                            )}
                                            {page.markerReport.heatmapUrl && (
                                                <a
                                                    href={page.markerReport.heatmapUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    Xem bản đồ phân bố chi tiết
                                                </a>
                                            )}
                                            {page.markerReport.similarPages.length > 0 && (
                                                <p>
                                                    Ảnh gần giống trang khác trong sách. Hãy dùng
                                                    ảnh có bố cục khác để tránh nhận nhầm.
                                                </p>
                                            )}
                                        </>
                                    )}
                                    <div className="form-actions">
                                        <Button
                                            variant="secondary"
                                            disabled={locked}
                                            onClick={() => {
                                                void run(async () => {
                                                    const result = await pagesApi.rescore(page.id);
                                                    setJobId(result.jobId);
                                                }, 'Đã gửi yêu cầu đánh giá lại.');
                                            }}
                                        >
                                            Đánh giá lại
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            disabled={busy || imageBusy}
                                            onClick={() => {
                                                void refresh();
                                            }}
                                        >
                                            Cập nhật kết quả
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </section>
                        <section
                            className="page-control-section"
                            aria-labelledby="replace-image-heading"
                        >
                            <h2 id="replace-image-heading">Thay ảnh trang</h2>
                            <PageImageForm
                                title="Ảnh thay thế"
                                action="Lưu ảnh thay thế"
                                disabled={busy || scoring || sceneBusy}
                                onBusyChange={setImageBusy}
                                onUploaded={() => {
                                    void cache.invalidateQueries({ queryKey: assetKeys.all });
                                    void cache.invalidateQueries({
                                        queryKey: profileKey(user?.id || ''),
                                    });
                                }}
                                onAttach={async (asset, _form, context) => {
                                    const markerMindPublicId =
                                        page.markerMode === 'CUSTOM_MARKER'
                                            ? await mind(asset.url, context)
                                            : undefined;
                                    context.signal.throwIfAborted();
                                    context.onStage('saving');
                                    const result = await pagesApi.replaceImage(page.id, {
                                        imageAssetId: asset.id,
                                        markerMindPublicId,
                                    });
                                    if (result.jobId) setJobId(result.jobId);
                                    await refresh();
                                }}
                            />
                        </section>
                    </div>
                </div>
            </div>
        </>
    );
}

function PageDetailContent({ bookId, pageId }: { bookId: string; pageId: string }) {
    const { user } = useAuth();
    const valid = IdSchema.safeParse(bookId).success && IdSchema.safeParse(pageId).success;
    const page = useQuery({
        queryKey: pageKeys.detail(user?.id || '', pageId),
        queryFn: ({ signal }) => pagesApi.detail(pageId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    const book = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    if (!valid || (page.data && page.data.bookId !== bookId))
        return (
            <>
                <h1>Không tìm thấy trang sách</h1>
                <Link to="/books">Về sách của tôi</Link>
            </>
        );
    if ((page.isError && !page.data) || (book.isError && !book.data))
        return (
            <>
                <h1>Chưa mở được trang sách</h1>
                <Feedback error={errorMessage(page.error || book.error)} />
                <div className="form-actions">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void page.refetch();
                            void book.refetch();
                        }}
                    >
                        Thử lại
                    </Button>
                    <Link to={`/books/${bookId}`}>Về cuốn sách</Link>
                </div>
            </>
        );
    if (!page.data || !book.data) return <p role="status">Đang tải trang sách…</p>;
    return (
        <>
            {(page.isError || book.isError) && (
                <div>
                    <Feedback error="Chưa cập nhật được dữ liệu mới nhất. Nội dung đang sửa vẫn được giữ." />
                    <Button
                        variant="ghost"
                        onClick={() => {
                            void page.refetch();
                            void book.refetch();
                        }}
                    >
                        Thử đọc lại dữ liệu trang
                    </Button>
                </div>
            )}
            <PageEditor key={pageId} page={page.data} book={book.data} />
        </>
    );
}

export function PageDetailPage() {
    const { bookId = '', pageId = '' } = useParams();
    return <PageDetailContent key={`${bookId}-${pageId}`} bookId={bookId} pageId={pageId} />;
}
