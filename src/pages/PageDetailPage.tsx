import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
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
        <div className="page-editor-screen [&[data-mode=page]]:p-6" data-mode={mode}>
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <Link
                        className="back-link mb-4 inline-block text-[length:var(--text-sm)] [.studio-editing_&]:inline [.studio-editing_&]:text-[length:12px]"
                        to={`/books/${book.id}`}
                    >
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
                <p
                    className="page-warning rounded-[var(--radius-sm)] bg-warning px-4 py-3 text-warning-foreground [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mx-0 [.studio-editing_&]:my-1 [.studio-editing_&]:px-[10px] [.studio-editing_&]:py-[5px] [.studio-editing_&]:text-[length:11px]"
                    key={warning}
                >
                    {markerWarningText(warning)}
                </p>
            ))}
            <fieldset
                className="page-edit-modes mb-6 flex min-w-0 flex-wrap gap-3 border-0 border-[transparent] border-solid p-0 [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-[10px] [.studio-editing_&_.button]:min-h-[34px] [.studio-editing_&_.button]:px-3 [.studio-editing_&_.button]:py-[6px] [.studio-editing_&_.button]:text-[length:12px]"
                aria-label="Phần chỉnh sửa trang"
            >
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
                    onRecognition={() => setMode('page')}
                />
            </div>
            <div hidden={mode !== 'page'}>
                <div className="page-editor-layout grid grid-cols-[minmax(0,_1fr)_minmax(0,_1.2fr)] items-start gap-8 max-[850px]:grid-cols-[1fr]">
                    <section
                        className="page-preview-section min-w-0"
                        aria-label="Xem trước trang sách"
                    >
                        <div
                            className="page-paper relative w-full max-w-115 overflow-hidden border border-border border-solid bg-surface max-[850px]:mx-auto max-[850px]:max-w-90 [&_>_img]:block [&_>_img]:size-full [&_>_img]:object-contain"
                            style={{ aspectRatio: `1 / ${book.pageAspect}` }}
                        >
                            <img
                                src={page.image.url}
                                alt={`Ảnh ${page.title || `trang ${page.orderIndex + 1}`}`}
                            />
                            {page.markerMode === 'BOOKARIA_MARKER' && page.bookariaMarker && (
                                <div
                                    className="marker-placement transform-[translate(-50%,_-50%)] absolute grid border-[2px] border-foreground border-dashed bg-surface font-semibold text-foreground [place-items:center]"
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
                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                Ô số minh họa vị trí marker khi in. Đây không phải mẫu marker để
                                quét.
                            </p>
                        )}
                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Ảnh gốc {page.image.width} × {page.image.height} px. Nội dung AR sẽ được
                            chỉnh ở phần tiếp theo.
                        </p>
                    </section>
                    <div className="page-editor-controls grid min-w-0 gap-6">
                        <form
                            className="page-control-section grid min-w-0 gap-4 rounded-[var(--radius-md)] border border-border border-solid bg-surface p-5 max-[540px]:p-4 [&_.button]:[justify-self:start] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h3]:m-0 [&_input]:w-full [&_input]:min-w-0 [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_p]:m-0"
                            onSubmit={saveTitle}
                        >
                            <FieldGroup className="contents">
                                <h2>Thông tin trang</h2>
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="page-title">
                                        Tên trang
                                        <Input
                                            id="page-title"
                                            name="title"
                                            maxLength={150}
                                            defaultValue={page.title || ''}
                                            disabled={locked}
                                        />
                                    </FieldLabel>
                                </Field>
                                <Button type="submit" disabled={locked}>
                                    Lưu tên trang
                                </Button>
                            </FieldGroup>
                        </form>
                        <section
                            className="page-control-section grid min-w-0 gap-4 rounded-[var(--radius-md)] border border-border border-solid bg-surface p-5 max-[540px]:p-4 [&_.button]:[justify-self:start] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h3]:m-0 [&_input]:w-full [&_input]:min-w-0 [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_p]:m-0"
                            aria-labelledby="marker-heading"
                        >
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
                            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
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
                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
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
                                    className="marker-position-form grid gap-3 border-t-[1px] border-t-border pt-4 [border-top-style:solid]"
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
                                    <FieldGroup className="contents">
                                        <h3>Vị trí trên bản in</h3>
                                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                            Tâm marker tính từ góc trên bên trái. Cạnh tối thiểu 35
                                            mm, cách mép ít nhất 12 mm.
                                        </p>
                                        <fieldset
                                            disabled={locked}
                                            className="marker-measurements m-0 grid min-w-0 grid-cols-[repeat(3,_minmax(0,_1fr))] gap-3 border-0 border-[transparent] border-solid p-0 max-[540px]:grid-cols-[1fr]"
                                        >
                                            <Field orientation="contents">
                                                <FieldLabel htmlFor="marker-x">
                                                    Tâm ngang (mm)
                                                    <Input
                                                        id="marker-x"
                                                        name="centerX"
                                                        type="number"
                                                        step="0.1"
                                                        required
                                                        defaultValue={mm.centerXMm.toFixed(1)}
                                                    />
                                                </FieldLabel>
                                            </Field>
                                            <Field orientation="contents">
                                                <FieldLabel htmlFor="marker-y">
                                                    Tâm dọc (mm)
                                                    <Input
                                                        id="marker-y"
                                                        name="centerY"
                                                        type="number"
                                                        step="0.1"
                                                        required
                                                        defaultValue={mm.centerYMm.toFixed(1)}
                                                    />
                                                </FieldLabel>
                                            </Field>
                                            <Field orientation="contents">
                                                <FieldLabel htmlFor="marker-size">
                                                    Cạnh (mm)
                                                    <Input
                                                        id="marker-size"
                                                        name="size"
                                                        type="number"
                                                        step="0.1"
                                                        min="35"
                                                        required
                                                        defaultValue={mm.sizeMm.toFixed(1)}
                                                    />
                                                </FieldLabel>
                                            </Field>
                                        </fieldset>
                                        <Button type="submit" disabled={locked}>
                                            Lưu vị trí marker
                                        </Button>
                                    </FieldGroup>
                                </form>
                            )}
                            {jobId && (
                                <div className="page-score-status bg-info p-3 text-info-foreground">
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
                                <div className="marker-report grid gap-3 border-t-[1px] border-t-border pt-4 [border-top-style:solid]">
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
                                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
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
                            className="page-control-section grid min-w-0 gap-4 rounded-[var(--radius-md)] border border-border border-solid bg-surface p-5 max-[540px]:p-4 [&_.button]:[justify-self:start] [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h3]:m-0 [&_input]:w-full [&_input]:min-w-0 [&_label]:grid [&_label]:gap-2 [&_label]:font-medium [&_p]:m-0"
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
        </div>
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
                <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
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
