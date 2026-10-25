import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { assetKeys } from '../../assets';
import { bookKeys } from '../../books';
import { BookInfoDialog } from '../../books/ui/BookInfoDialog';
import { AddPagesDialog } from '../../pages/ui/AddPagesDialog';
import { NavigationGuard } from './NavigationGuard';

export function EmptyBookEditor({ book }: { book: BookDetail }) {
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
        if (target && !busy && !infoBusy)
            navigate(target, { state: { created: true }, replace: true });
    }, [target, busy, infoBusy, navigate]);
    async function refresh() {
        await cache.invalidateQueries({ queryKey: bookKeys.all });
        void cache.invalidateQueries({ queryKey: assetKeys.all });
    }
    return (
        <section className="flex min-h-screen flex-col bg-canvas">
            <NavigationGuard
                dirty={(dirty || infoDirty) && !target}
                saving={busy || infoBusy}
                dirtyDescription="Tài liệu hoặc thông tin bạn đang chọn chưa được lưu. Trang đã thêm vẫn được giữ trong sách."
            />
            <header className="flex min-h-19 items-center justify-between gap-5 border-border border-b bg-surface px-6 py-4">
                <Button variant="ghost" asChild>
                    <Link to="/books">
                        <ArrowLeft data-icon="inline-start" />
                        Sách của tôi
                    </Link>
                </Button>
                <Button
                    variant="ghost"
                    ref={infoAnchor}
                    aria-label="Thông tin sách"
                    disabled={busy || infoBusy || Boolean(target)}
                    onClick={() => setInfo(true)}
                    className="max-w-[60%] truncate"
                >
                    {book.title}
                </Button>
            </header>
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
