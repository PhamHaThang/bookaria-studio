import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { assetsApi } from '../features/assets';
import { uploadFile } from '../features/assets/api/upload-file';
import { auth, useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { pageKeys, pagesApi } from '../features/pages';
import { compileMarker } from '../features/pages/api/compile-marker';
import { type MindCheckpoint, prepareMarkerUpload } from '../features/pages/model/marker-upload';
import { ArMarkerDialog } from '../features/pages/ui/ArMarkerDialog';
import type { ImageAttachmentContext } from '../features/pages/ui/PageImageForm';
import { SceneEditor } from '../features/scene';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, BookDetail, Page } from '../shared/contracts/dto.schema';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';

function PageEditor({ page, book }: { page: Page; book: BookDetail }) {
    const { user } = useAuth(),
        cache = useQueryClient(),
        location = useLocation(),
        navigate = useNavigate();
    const [markerOpen, setMarkerOpen] = useState(false),
        [markerBusy, setMarkerBusy] = useState(false),
        [sceneBusy, setSceneBusy] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const checkpoint = useRef<MindCheckpoint | null>(null);
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
    const [createdNotice] = useState(location.state?.created ? 'Đã thêm trang sách.' : null);
    const [createdWarning] = useState<string | null>(() =>
        location.state?.created &&
        page.markerMode === 'NONE' &&
        Array.isArray(location.state?.warnings) &&
        location.state.warnings.includes('NO_MARKER_AVAILABLE')
            ? 'Chưa có marker Bookaria khả dụng; bạn có thể dùng ảnh trang để nhận diện.'
            : null,
    );
    useEffect(() => {
        if (!location.state?.created) return;
        const state = { ...location.state };
        delete state.created;
        delete state.warnings;
        navigate(
            { pathname: location.pathname, search: location.search, hash: location.hash },
            { replace: true, state },
        );
    }, [location, navigate]);
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
    async function replaceBackground(asset: Asset, context: ImageAttachmentContext) {
        const markerMindPublicId =
            page.markerMode === 'CUSTOM_MARKER' ? await mind(asset.url, context) : undefined;
        context.signal.throwIfAborted();
        context.onStage('saving');
        const result = await pagesApi.replaceImage(page.id, {
            imageAssetId: asset.id,
            markerMindPublicId,
        });
        context.signal.throwIfAborted();
        if (auth.store.getState().user?.id !== user?.id) return;
        checkpoint.current = null;
        cache.setQueryData<Page>(pageKeys.detail(user?.id || '', page.id), (current) =>
            current
                ? {
                      ...current,
                      ...result.page,
                      image: {
                          url: asset.url,
                          width:
                              typeof asset.meta.width === 'number' && asset.meta.width > 0
                                  ? asset.meta.width
                                  : current.image.width,
                          height:
                              typeof asset.meta.height === 'number' && asset.meta.height > 0
                                  ? asset.meta.height
                                  : current.image.height,
                      },
                  }
                : current,
        );
        if (result.jobId) setJobId(result.jobId);
        await refresh();
    }

    return (
        <div className="page-editor-screen" data-mode="content">
            <Feedback success={createdNotice} warning={createdWarning} />
            <SceneEditor
                page={page}
                book={book}
                disabled={markerBusy || scoring}
                onBusyChange={setSceneBusy}
                onRecognition={() => setMarkerOpen(true)}
                onReplacePageImage={replaceBackground}
            />
            {markerOpen && (
                <ArMarkerDialog
                    page={page}
                    book={book}
                    disabled={sceneBusy}
                    scoring={scoring}
                    job={job.data}
                    jobError={job.error ? errorMessage(job.error) : null}
                    onCheckJob={() => void job.refetch()}
                    onRefresh={() => void refresh()}
                    onJob={setJobId}
                    onBusyChange={setMarkerBusy}
                    onClose={() => setMarkerOpen(false)}
                />
            )}
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
    if (!page.data || !book.data)
        return <LoadingScreen fullScreen message="Đang tải trang sách…" />;
    return (
        <>
            {(page.isError || book.isError) && (
                <div>
                    <Feedback error="Chưa cập nhật được dữ liệu mới nhất. Nội dung đang sửa vẫn được giữ." />
                    <Button
                        variant="outline"
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
