import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { assetsApi } from '../features/assets';
import { uploadFile } from '../features/assets/api/upload-file';
import { auth, useAuth } from '../features/auth';
import { bookDraftApi } from '../features/book-draft/api/book-draft-api';
import { useBookDraft } from '../features/book-draft/ui/BookDraftProvider';
import { bookKeys, booksApi } from '../features/books';
import { pageKeys, pagesApi } from '../features/pages';
import { compileMarker } from '../features/pages/api/compile-marker';
import { type MindCheckpoint, prepareMarkerUpload } from '../features/pages/model/marker-upload';
import { ArMarkerDialog } from '../features/pages/ui/ArMarkerDialog';
import type { ImageAttachmentContext } from '../features/pages/ui/PageImageForm';
import { SceneEditor } from '../features/scene';
import { EmptyBookEditor } from '../features/scene/ui/EmptyBookEditor';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import type { Asset, BookDetail, Page } from '../shared/contracts/dto.schema';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';

function PageEditor({ page, book }: { page: Page; book: BookDetail }) {
    const { store, state: bookDraftState } = useBookDraft();
    const { user } = useAuth(),
        cache = useQueryClient(),
        location = useLocation(),
        navigate = useNavigate();
    const [markerOpen, setMarkerOpen] = useState(false),
        [markerBusy, setMarkerBusy] = useState(false),
        [sceneBusy, setSceneBusy] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const checkpoint = useRef<MindCheckpoint | null>(null);
    useEffect(() => {
        const next = bookDraftState.jobs.find((job) => job.pageId === page.id);
        if (next) setJobId(next.jobId);
    }, [bookDraftState.jobs, page.id]);
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
        void store.readLatest(false);
        void cache.invalidateQueries({ queryKey: pageKeys.all });
        void cache.invalidateQueries({ queryKey: bookKeys.all });
    }, [jobId, job.data, cache, store]);
    async function refresh() {
        if (auth.store.getState().user?.id !== user?.id) return;
        await store.readLatest(false);
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
    async function replaceBackground(source: Asset, context: ImageAttachmentContext) {
        context.onStage('saving');
        const layout = await bookDraftApi.imageLayout(book.id, source.id, book.pageAspect);
        const asset = {
            ...source,
            url: layout.url,
            meta: { ...source.meta, width: layout.width, height: layout.height },
        };
        const markerMindPublicId =
            page.markerMode === 'CUSTOM_MARKER' ? await mind(asset.url, context) : undefined;
        context.signal.throwIfAborted();
        context.onStage('saving');
        store.registerAsset(source, true);
        store.patchPage(
            page.id,
            {
                image: {
                    assetId: asset.id,
                    url: layout.url,
                    width: layout.width,
                    height: layout.height,
                },
                thumbnailUrl: layout.url,
            },
            markerMindPublicId,
        );
        checkpoint.current = null;
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
    const { user } = useAuth(),
        { store, state } = useBookDraft(),
        navigate = useNavigate();
    const page = store.getPage(pageId);
    const summaries = state.working?.pages || [];
    const exists = summaries.some((item) => item.id === pageId);
    const book = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        refetchOnWindowFocus: false,
    });
    const detail = useQuery({
        queryKey: ['book-draft-page', user?.id, bookId, pageId, state.base?.revision],
        queryFn: () => store.loadPage(pageId),
        enabled: exists && !page,
        retry: false,
        refetchOnWindowFocus: false,
    });
    const firstPageId = summaries[0]?.id;
    useEffect(() => {
        store.activate(pageId);
        if (!exists && firstPageId)
            navigate(`/books/${bookId}/pages/${firstPageId}`, { replace: true });
    }, [store, pageId, exists, firstPageId, bookId, navigate]);
    const problem = (!book.data && book.error) || (!page && detail.error);
    if (problem)
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <h1>Chưa mở được editor</h1>
                <Feedback error={errorMessage(problem)} />
                <Button
                    onClick={() => {
                        void detail.refetch();
                        void book.refetch();
                    }}
                >
                    Thử lại
                </Button>
                <Link to="/books">Về Studio</Link>
            </div>
        );
    if (!book.data || (exists && !page))
        return <LoadingScreen fullScreen message="Đang tải trang sách…" />;
    if (!book.data) return null;
    const currentBook = {
        ...book.data,
        pages: summaries,
        pageCount: summaries.length,
        ...state.base?.geometry,
    };
    if (!page) return <EmptyBookEditor book={currentBook} />;
    return <PageEditor key={pageId} page={page} book={currentBook} />;
}
export function PageDetailPage() {
    const { bookId = '', pageId = '' } = useParams();
    if (!IdSchema.safeParse(bookId).success || !IdSchema.safeParse(pageId).success)
        return <Link to="/books">Về Studio</Link>;
    return <PageDetailContent bookId={bookId} pageId={pageId} />;
}
