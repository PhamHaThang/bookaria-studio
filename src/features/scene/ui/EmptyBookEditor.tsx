import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Feedback } from '@/shared/ui/Feedback';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { assetKeys } from '../../assets';
import { useBookDraft } from '../../book-draft/ui/BookDraftProvider';
import { bookKeys } from '../../books';
import { BookInfoDialog } from '../../books/ui/BookInfoDialog';
import { AddPagesDialog } from '../../pages/ui/AddPagesDialog';
import { NavigationGuard } from './NavigationGuard';
import { useSaveBeforeAction } from './use-save-before-action';

export function EmptyBookEditor({ book }: { book: BookDetail }) {
    const { store, state } = useBookDraft();
    const beforeInfo = useSaveBeforeAction({
        dirty: state.dirty,
        blocked: state.saving,
        save: async () =>
            (await store.save()) ? null : store.getSnapshot().error || 'Chưa lưu được sách.',
    });
    const cache = useQueryClient(),
        navigate = useNavigate();
    const [adding, setAdding] = useState(false),
        [info, setInfo] = useState(false);
    const [busy, setBusy] = useState(false),
        [dirty, setDirty] = useState(false);
    const [infoBusy, setInfoBusy] = useState(false),
        [infoDirty, setInfoDirty] = useState(false);
    const [target, setTarget] = useState<string | null>(null);
    const addAnchor = useRef<HTMLButtonElement | null>(null),
        infoAnchor = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        store.setAutosavePaused('empty-editor', busy || infoBusy || dirty || infoDirty);
        return () => store.setAutosavePaused('empty-editor', false);
    }, [store, busy, infoBusy, dirty, infoDirty]);
    useEffect(() => {
        if (target && !busy && !infoBusy)
            navigate(target, { state: { created: true }, replace: true });
    }, [target, busy, infoBusy, navigate]);
    useEffect(() => {
        const save = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!busy && !infoBusy && !dirty && !infoDirty) void store.save();
            }
        };
        document.addEventListener('keydown', save);
        return () => document.removeEventListener('keydown', save);
    }, [store, busy, infoBusy, dirty, infoDirty]);
    async function refresh() {
        await cache.invalidateQueries({ queryKey: bookKeys.all, refetchType: 'none' });
        void cache.invalidateQueries({ queryKey: assetKeys.all, refetchType: 'none' });
    }
    return (
        <section className="flex min-h-screen flex-col bg-canvas">
            <NavigationGuard
                dirty={(dirty || infoDirty || state.dirty || state.uncertain) && !target}
                allowBookNavigation={!dirty && !infoDirty && !busy && !infoBusy && !state.saving}
                onSave={async () => {
                    if (dirty || infoDirty)
                        return 'Hãy hoàn tất hoặc đóng hộp thoại đang chỉnh sửa trước khi lưu sách.';
                    return store.save();
                }}
                saving={busy || infoBusy || state.saving}
                dirtyDescription="Tài liệu hoặc thông tin bạn đang chọn chưa được lưu. Trang đã thêm vẫn được giữ trong sách."
            />
            <header className="flex min-h-19 items-center justify-between gap-5 border-border border-b bg-surface px-6 py-4">
                <Button variant="outline" asChild>
                    <Link to="/books">
                        <ArrowLeft data-icon="inline-start" />
                        Sách của tôi
                    </Link>
                </Button>
                <Button
                    variant="outline"
                    ref={infoAnchor}
                    aria-label="Thông tin sách"
                    disabled={busy || infoBusy || Boolean(target)}
                    onClick={() => beforeInfo.request('Sửa thông tin sách', () => setInfo(true))}
                    className="max-w-[60%] truncate"
                >
                    {book.title}
                </Button>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        disabled={!state.canUndo || (state.saving && !state.autosaving)}
                        onClick={() => {
                            const id = store.undo();
                            if (id) navigate(`/books/${book.id}/pages/${id}`);
                        }}
                    >
                        Hoàn tác
                    </Button>
                    <Button
                        disabled={!state.dirty || state.saving || state.conflict || state.uncertain}
                        onClick={() => void store.save()}
                    >
                        {state.autosaving
                            ? 'Đang tự lưu…'
                            : state.saving
                              ? 'Đang lưu…'
                              : 'Lưu sách'}
                    </Button>
                </div>
            </header>
            <Feedback error={state.error} success={state.notice} />
            {beforeInfo.dialog}
            <div className="m-auto flex max-w-140 flex-col items-center gap-5 px-8 py-20 text-center">
                <BookOpen className="size-14 text-muted-foreground" aria-hidden="true" />
                <h1 className="m-0 text-2xl">
                    {book.pages.length ? 'Chọn trang để tiếp tục' : 'Sách chưa có trang'}
                </h1>
                <p className="m-0 text-muted-foreground">
                    {book.pages.length
                        ? 'Các trang đã thêm vẫn được giữ. Mở một trang để tiếp tục chỉnh sửa.'
                        : 'Bắt đầu bằng trang trắng hoặc nhập các trang từ PDF và ảnh.'}
                </p>
                {book.pages.map((page) => (
                    <Button key={page.id} variant="secondary" asChild>
                        <Link to={`/books/${book.id}/pages/${page.id}`}>
                            {page.title || `Trang ${page.orderIndex + 1}`}
                        </Link>
                    </Button>
                ))}
                <Button
                    ref={addAnchor}
                    disabled={busy || infoBusy || Boolean(target)}
                    onClick={() => setAdding(true)}
                >
                    <Plus data-icon="inline-start" />
                    Thêm trang
                </Button>
            </div>
            {adding && (
                <AddPagesDialog
                    book={book}
                    disabled={infoBusy}
                    opener={addAnchor.current}
                    onBusyChange={setBusy}
                    onDraftChange={setDirty}
                    onClose={() => {
                        setAdding(false);
                        void refresh();
                    }}
                    onComplete={async (id) => {
                        await refresh();
                        setAdding(false);
                        setTarget(`/books/${book.id}/pages/${id}`);
                    }}
                    onInspect={async () => {
                        await refresh();
                        setAdding(false);
                    }}
                />
            )}
            {info && (
                <BookInfoDialog
                    bookId={book.id}
                    guardNavigation={false}
                    opener={infoAnchor.current}
                    onClose={() => setInfo(false)}
                    onBusyChange={setInfoBusy}
                    onDirtyChange={setInfoDirty}
                />
            )}
        </section>
    );
}
