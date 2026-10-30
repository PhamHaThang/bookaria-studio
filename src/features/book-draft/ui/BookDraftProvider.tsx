import { useQueryClient } from '@tanstack/react-query';
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
    useSyncExternalStore,
} from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import { IdSchema } from '@/shared/contracts/common.schema';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { runAssetUpload } from '../../assets/model/upload';
import { auth, useAuth } from '../../auth';
import { pagesApi } from '../../pages';
import { blankPageImage } from '../../pages/model/blank-page';
import { uncertainWrite } from '../../pages/model/operations';
import { isSceneConflict } from '../../scene/model/save-state';
import { bookDraftApi } from '../api/book-draft-api';
import { startBookAutosave } from '../model/autosave';
import { BookDraftStore, type DraftState } from '../model/book-draft-store';
import { draftStorage } from '../model/draft-storage';
import { rememberBookDraftSave } from '../model/save-cache';

const Context = createContext<BookDraftStore | null>(null);
export function useOptionalBookDraft() {
    return useContext(Context);
}
export function useBookDraft() {
    const store = useContext(Context);
    if (!store) throw new Error('Thiếu bản nháp sách.');
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    return { store, state };
}
export function draftPagePath(bookId: string, pathname: string) {
    return new RegExp(`^/books/${bookId}/(?:pages/[0-9a-f-]+|edit)/?$`, 'i').test(pathname);
}
export function BookDraftProvider({ bookId, children }: { bookId: string; children: ReactNode }) {
    const { user } = useAuth(),
        cache = useQueryClient();
    const store = useMemo(
        () =>
            new BookDraftStore(user?.id || '', bookId, {
                ...bookDraftApi,
                blankPageUrl: new URL(
                    `${import.meta.env.BASE_URL}brand/blank-page.png`,
                    window.location.origin,
                ).href,
                async prepareBlankImage(aspect, checkpoint, onCheckpoint, signal) {
                    const checkSession = () => {
                        signal.throwIfAborted();
                        if (!user?.id || auth.store.getState().user?.id !== user.id)
                            throw new Error('Phiên đăng nhập đã thay đổi.');
                    };
                    checkSession();
                    const file = await blankPageImage(aspect);
                    const result = await runAssetUpload({
                        api: {
                            signature(body, uploadSignal) {
                                checkSession();
                                return assetsApi.signature(body, uploadSignal);
                            },
                            complete(id, body, uploadSignal) {
                                checkSession();
                                return assetsApi.complete(id, body, uploadSignal);
                            },
                        },
                        transfer: uploadFile,
                        file,
                        purpose: 'PAGE_IMAGE',
                        metadata: { name: file.name, tags: [] },
                        signal,
                        checkpoint,
                        onCheckpoint,
                        onStage: () => undefined,
                        onProgress: () => undefined,
                    });
                    signal.throwIfAborted();
                    if (auth.store.getState().user?.id !== user?.id)
                        throw new Error('Phiên đăng nhập đã thay đổi.');
                    if (
                        result.processing ||
                        result.asset.type !== 'IMAGE' ||
                        result.asset.status !== 'READY'
                    )
                        throw new Error('Ảnh trang trắng chưa sẵn sàng. Hãy thử lưu lại.');
                    return result.asset;
                },
                page: pagesApi.detail,
                storage: draftStorage,
                message: errorMessage,
                conflict: isSceneConflict,
                uncertain: uncertainWrite,
                async removeAsset(id) {
                    if (auth.store.getState().user?.id === user?.id) await assetsApi.remove(id);
                },
                async save(id, body) {
                    if (!user?.id || auth.store.getState().user?.id !== user.id)
                        throw new Error('Phiên đăng nhập đã thay đổi.');
                    const result = await bookDraftApi.save(id, body);
                    if (auth.store.getState().user?.id === user?.id) {
                        rememberBookDraftSave(cache, user?.id || '', id, result);
                    }
                    return result;
                },
            }),
        [bookId, user?.id, cache],
    );
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    useEffect(() => {
        void store.initialize();
        let composing = false;
        const autosave = startBookAutosave(store, {
            isBlocked: () =>
                composing ||
                document.visibilityState === 'hidden' ||
                !navigator.onLine ||
                Boolean(
                    document.querySelector(
                        '[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="select-content"][data-state="open"]',
                    ),
                ),
        });
        const compositionStart = () => {
            composing = true;
        };
        const compositionEnd = () => {
            composing = false;
            autosave.wake();
        };
        document.addEventListener('compositionstart', compositionStart);
        document.addEventListener('compositionend', compositionEnd);
        window.addEventListener('online', autosave.wake);
        const checkpoint = () => {
            if (document.visibilityState === 'hidden') void store.flush();
            else autosave.wake();
        };
        const pagehide = () => {
            void store.flush();
        };
        document.addEventListener('visibilitychange', checkpoint);
        window.addEventListener('pagehide', pagehide);
        return () => {
            autosave.stop();
            document.removeEventListener('compositionstart', compositionStart);
            document.removeEventListener('compositionend', compositionEnd);
            window.removeEventListener('online', autosave.wake);
            document.removeEventListener('visibilitychange', checkpoint);
            window.removeEventListener('pagehide', pagehide);
            store.dispose();
        };
    }, [store]);
    useEffect(() => {
        if (state.storageWarning)
            toast.warning(state.storageWarning, { id: 'book-draft-storage', duration: 7000 });
    }, [state.storageWarning]);
    return (
        <Context.Provider value={store}>
            {state.loading || state.recovery ? (
                <LoadingScreen fullScreen message="Đang mở bản nháp sách…" />
            ) : state.base ? (
                children
            ) : (
                <DraftLoadError state={state} retry={() => void store.initialize()} />
            )}
            {state.recovery && (
                <ConfirmationDialog
                    title="Tiếp tục bản nháp trên máy?"
                    description="Có thay đổi chưa lưu từ lần chỉnh sửa trước. Khôi phục để tiếp tục hoặc dùng bản đã lưu trên máy chủ."
                    busy={false}
                    onClose={() => store.restore()}
                >
                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => void store.dismissRecovery()}>
                            Bỏ bản nháp
                        </Button>
                        <Button data-initial-focus onClick={() => store.restore()}>
                            Khôi phục bản nháp
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </Context.Provider>
    );
}
function DraftLoadError({ state, retry }: { state: DraftState; retry: () => void }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <h1 className="text-xl">Chưa mở được bản nháp</h1>
            <p className="text-muted-foreground">{state.error}</p>
            <div className="flex gap-3">
                <Button onClick={retry}>Thử lại</Button>
                <Button variant="outline" asChild>
                    <Link to="/books">Về Studio</Link>
                </Button>
            </div>
        </div>
    );
}

export function BookDraftRoute() {
    const { bookId = '' } = useParams(),
        { user } = useAuth();
    if (!IdSchema.safeParse(bookId).success)
        return <div className="p-8">Đường dẫn sách không hợp lệ.</div>;
    return (
        <BookDraftProvider key={`${user?.id}-${bookId}`} bookId={bookId}>
            <Outlet />
        </BookDraftProvider>
    );
}
