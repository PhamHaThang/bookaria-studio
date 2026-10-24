import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, FileUp, LoaderCircle, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContractError } from '../../../shared/api/contract';
import { errorMessage } from '../../../shared/api/errors';
import {
    type CreateBookBody,
    CreateBookBodySchema,
} from '../../../shared/contracts/api/books.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys, assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { runAssetUpload } from '../../assets/model/upload';
import { auth, useAuth } from '../../auth';
import { pageKeys, pagesApi } from '../../pages';
import { blankPageImage } from '../../pages/model/blank-page';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';
import { bookKeys, booksApi } from '../model/books';
import { type CreationCheckpoint, createBookWithPages } from '../model/create-book';
import { type ImportSource, prepareImport, selectedPages } from '../model/import-source';
import './creation.css';

export function BookCreateDialog() {
    const navigate = useNavigate(),
        cache = useQueryClient();
    const { user } = useAuth();
    const actor = useRef(user?.id),
        alive = useRef(true),
        active = useRef(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const sourceRef = useRef<ImportSource | null>(null),
        preparation = useRef<AbortController | null>(null);
    const checkpoint = useRef<CreationCheckpoint>({ pages: [] });
    const submission = useRef<{ body: CreateBookBody; indices: number[] } | null>(null);
    const [mode, setMode] = useState<'blank' | 'import'>('blank');
    const [source, setSource] = useState<ImportSource | null>(null);
    const [title, setTitle] = useState('');
    const [format, setFormat] = useState('A4'),
        [aspect, setAspect] = useState('1.4142');
    const [description, setDescription] = useState(''),
        [topic, setTopic] = useState('');
    const [range, setRange] = useState('');
    const [preparing, setPreparing] = useState(false),
        [busy, setBusy] = useState(false);
    const [stage, setStage] = useState(''),
        [error, setError] = useState<string | null>(null);
    const [target, setTarget] = useState<string | null>(null);
    const [locked, setLocked] = useState(false);
    const checkSession = () => {
        if (!alive.current || auth.store.getState().user?.id !== actor.current)
            throw new Error('Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại để kiểm tra sách.');
    };
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            preparation.current?.abort();
            sourceRef.current?.dispose();
        };
    }, []);
    useEffect(() => {
        if (target && !busy) navigate(target, { replace: true, state: { created: true } });
    }, [target, busy, navigate]);

    function close() {
        if (active.current) return;
        navigate(checkpoint.current.bookId ? `/books/${checkpoint.current.bookId}` : '/books', {
            replace: true,
        });
    }
    async function chooseFiles(files: File[]) {
        if (!files.length || locked || active.current) return;
        preparation.current?.abort();
        sourceRef.current?.dispose();
        sourceRef.current = null;
        const controller = new AbortController();
        preparation.current = controller;
        setSource(null);
        setRange('');
        setPreparing(true);
        setError(null);
        try {
            const result = await prepareImport(files, controller.signal);
            if (controller.signal.aborted || !alive.current) {
                result.dispose();
                return;
            }
            sourceRef.current = result;
            setSource(result);
            setTitle((current) => current || files[0].name.replace(/\.[^.]+$/, ''));
        } catch (cause) {
            if (!controller.signal.aborted && alive.current) setError(errorMessage(cause));
        } finally {
            if (!controller.signal.aborted && alive.current) setPreparing(false);
        }
    }
    let selection: number[] = [],
        rangeError = '';
    if (source) {
        try {
            selection = selectedPages(source.kind === 'pdf' ? range : '', source.count);
        } catch (cause) {
            rangeError = errorMessage(cause);
        }
    }
    const count = mode === 'blank' ? 1 : selection.length;
    const completed = checkpoint.current.pages.filter((page) => page.result).length;
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (active.current || preparing || checkpoint.current.uncertain) return;
        setError(null);
        try {
            if (!locked) {
                if (!title.trim()) throw new Error('Nhập tên sách trước khi tạo.');
                if (mode === 'import' && (!source || rangeError || !selection.length))
                    throw new Error(rangeError || 'Chọn PDF hoặc ảnh để nhập.');
                submission.current = {
                    body: CreateBookBodySchema.parse({
                        title,
                        description: description.trim() || undefined,
                        topic: topic.trim() || undefined,
                        pageFormat: format,
                        pageAspect: format === 'CUSTOM' ? Number(aspect) : undefined,
                        source: { type: 'BLANK' },
                    }),
                    indices: mode === 'blank' ? [0] : selection,
                };
            }
            const frozen = submission.current;
            if (!frozen) return;
            checkSession();
            active.current = true;
            setBusy(true);
            setLocked(true);
            const result = await createBookWithPages({
                ...frozen,
                checkpoint: checkpoint.current,
                create: booksApi.create,
                detail: booksApi.detail,
                add: pagesApi.add,
                render: (index, ratio) =>
                    mode === 'blank'
                        ? blankPageImage(ratio)
                        : (source as ImportSource).render(index, ratio),
                checkSession,
                onStage: setStage,
                onCheckpoint: (value) => {
                    checkpoint.current = value;
                },
                async upload(file, saved, save) {
                    checkSession();
                    const result = await runAssetUpload({
                        api: {
                            signature: (...args) => {
                                checkSession();
                                return assetsApi.signature(...args);
                            },
                            complete: (...args) => {
                                checkSession();
                                return assetsApi.complete(...args);
                            },
                        },
                        transfer: uploadFile,
                        file,
                        purpose: 'PAGE_IMAGE',
                        metadata: { name: file.name, tags: [] },
                        signal: new AbortController().signal,
                        checkpoint: saved || null,
                        onCheckpoint: save,
                        onStage: () => undefined,
                        onProgress: () => undefined,
                    });
                    if (
                        result.processing ||
                        result.asset.type !== 'IMAGE' ||
                        result.asset.status !== 'READY'
                    )
                        throw new ContractError();
                    return result.asset.id;
                },
            });
            checkSession();
            setTarget(`/books/${result.bookId}/pages/${result.pageId}`);
        } catch (cause) {
            if (alive.current) {
                setError(errorMessage(cause));
                if (!checkpoint.current.bookId && !checkpoint.current.uncertain) setLocked(false);
            }
        } finally {
            active.current = false;
            void cache.invalidateQueries({ queryKey: bookKeys.all });
            void cache.invalidateQueries({ queryKey: pageKeys.all });
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            if (alive.current) setBusy(false);
        }
    }
    return (
        <>
            <NavigationGuard dirty={false} saving={busy} />
            <ConfirmDialog
                title="Tạo sách mới"
                className="book-create-dialog"
                busy={busy}
                onClose={close}
            >
                <Button
                    variant="ghost"
                    className="creation-close"
                    aria-label="Đóng tạo sách"
                    disabled={busy}
                    onClick={close}
                >
                    <X size={20} />
                </Button>
                <p className="creation-intro">
                    Bắt đầu từ trang trắng hoặc biến tài liệu có sẵn thành sách AR.
                </p>
                <form onSubmit={(event) => void submit(event)}>
                    <div className="creation-body">
                        <fieldset disabled={busy || locked} className="creation-fields">
                            <label htmlFor="new-book-title">
                                Tên sách <span aria-hidden="true">*</span>
                                <input
                                    id="new-book-title"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    maxLength={200}
                                    required
                                    placeholder="Ví dụ: Khám phá hệ Mặt Trời"
                                />
                            </label>
                            <fieldset className="creation-modes">
                                <legend>Bắt đầu với</legend>
                                <label
                                    className={`creation-mode-option ${mode === 'blank' ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="creation-source"
                                        value="blank"
                                        checked={mode === 'blank'}
                                        onChange={() => setMode('blank')}
                                    />
                                    <BookOpen size={23} aria-hidden="true" />
                                    <span>
                                        <strong>Sách trống</strong>
                                        <small>Một trang trắng để sáng tạo</small>
                                    </span>
                                </label>
                                <label
                                    className={`creation-mode-option ${mode === 'import' ? 'selected' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="creation-source"
                                        value="import"
                                        checked={mode === 'import'}
                                        onChange={() => setMode('import')}
                                    />
                                    <FileUp size={23} aria-hidden="true" />
                                    <span>
                                        <strong>Nhập PDF / ảnh</strong>
                                        <small>Mỗi trang hoặc ảnh là một trang sách</small>
                                    </span>
                                </label>
                            </fieldset>
                            {mode === 'import' && (
                                <div className="creation-import">
                                    <button
                                        className="creation-file"
                                        type="button"
                                        onClick={() => fileInput.current?.click()}
                                        aria-describedby="creation-file-limits"
                                    >
                                        <FileUp size={22} aria-hidden="true" />
                                        <strong>
                                            {source ? 'Chọn file khác' : 'Chọn PDF hoặc ảnh'}
                                        </strong>
                                        <span id="creation-file-limits">
                                            Một PDF ≤ 50 MB hoặc JPG/PNG ≤ 10 MB/ảnh. Tối đa 100
                                            trang.
                                        </span>
                                    </button>
                                    <input
                                        ref={fileInput}
                                        hidden
                                        id="book-source-file"
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        multiple
                                        onChange={(event) => {
                                            const files = Array.from(event.target.files || []);
                                            event.target.value = '';
                                            void chooseFiles(files);
                                        }}
                                    />
                                    {preparing && (
                                        <p role="status">
                                            <LoaderCircle size={17} className="button-spinner" />
                                            Đang đọc tài liệu…
                                        </p>
                                    )}
                                    {source && (
                                        <div className="creation-source-summary">
                                            <img
                                                src={source.preview}
                                                alt="Xem trước trang đầu của tài liệu"
                                            />
                                            <div>
                                                <strong>{source.name}</strong>
                                                <p>
                                                    {source.count} trang
                                                    {source.kind === 'images'
                                                        ? ' · Theo thứ tự tên file (1, 2, 10)'
                                                        : ' · PDF gốc chỉ được đọc trên máy bạn'}
                                                </p>
                                                {source.kind === 'pdf' ? (
                                                    <label htmlFor="pdf-pages">
                                                        Trang cần nhập
                                                        <input
                                                            id="pdf-pages"
                                                            value={range}
                                                            onChange={(event) =>
                                                                setRange(event.target.value)
                                                            }
                                                            placeholder={`Tất cả ${source.count} trang (ví dụ: 1-3, 5)`}
                                                            aria-invalid={Boolean(rangeError)}
                                                            aria-describedby="range-message"
                                                        />
                                                        <span
                                                            id="range-message"
                                                            className={
                                                                rangeError
                                                                    ? 'field-error'
                                                                    : 'field-hint'
                                                            }
                                                        >
                                                            {rangeError ||
                                                                `Sẽ nhập ${selection.length} trang theo thứ tự tài liệu.`}
                                                        </span>
                                                    </label>
                                                ) : (
                                                    <p className="creation-file-order">
                                                        {source.labels.join(' → ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <p className="creation-import-note">
                                        Nội dung được chuyển thành ảnh nền trang. Bạn có thể thêm
                                        chữ, mô hình 3D và tương tác trong editor.
                                    </p>
                                </div>
                            )}
                            <div className="creation-format">
                                <label htmlFor="new-book-format">
                                    Khổ sách
                                    <select
                                        id="new-book-format"
                                        value={format}
                                        onChange={(event) => setFormat(event.target.value)}
                                    >
                                        <option value="A4">A4 · Dọc</option>
                                        <option value="A5">A5 · Dọc</option>
                                        <option value="SQUARE">Vuông · 1:1</option>
                                        <option value="CUSTOM">Tùy chỉnh</option>
                                    </select>
                                </label>
                                {format === 'CUSTOM' && (
                                    <label htmlFor="new-book-aspect">
                                        Tỉ lệ cao / rộng
                                        <input
                                            id="new-book-aspect"
                                            type="number"
                                            min="0.2"
                                            max="5"
                                            step="any"
                                            required
                                            value={aspect}
                                            onChange={(event) => setAspect(event.target.value)}
                                        />
                                    </label>
                                )}
                            </div>
                            {mode === 'import' && (
                                <p className="field-hint">
                                    Ảnh luôn nằm trọn trong khổ sách; phần dư được thêm nền trắng.
                                </p>
                            )}
                            <details className="creation-details">
                                <summary>
                                    Thông tin bổ sung{' '}
                                    <span className="creation-optional">Không bắt buộc</span>
                                </summary>
                                <label htmlFor="new-book-description">
                                    Mô tả
                                    <textarea
                                        id="new-book-description"
                                        rows={3}
                                        maxLength={2000}
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                    />
                                </label>
                                <label htmlFor="new-book-topic">
                                    Chủ đề
                                    <input
                                        id="new-book-topic"
                                        maxLength={50}
                                        value={topic}
                                        onChange={(event) => setTopic(event.target.value)}
                                        placeholder="Ví dụ: Khoa học"
                                    />
                                </label>
                            </details>
                        </fieldset>
                    </div>
                    {(error || busy) && (
                        <div className="creation-result">
                            <Feedback error={error} />
                            {locked && !busy && error && (
                                <p className="creation-recovery">
                                    {checkpoint.current.uncertain
                                        ? 'Yêu cầu có thể đã được lưu. Mở sách để kiểm tra; hệ thống sẽ không tự gửi lại và tạo trùng.'
                                        : `Sách đã tạo, ${completed}/${count} trang đã nhập. Tiếp tục sẽ giữ nguyên các trang đã xong. Giữ tab này để tiếp tục.`}
                                </p>
                            )}
                            {busy && (
                                <div className="creation-progress" role="status">
                                    <LoaderCircle size={20} className="button-spinner" />
                                    <span>
                                        {stage}
                                        <small>Giữ trang này mở đến khi hoàn tất.</small>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="creation-footer">
                        <span>
                            {locked ? 'Sách đang ở chế độ nháp' : `${count} trang · Nháp riêng tư`}
                        </span>
                        <div>
                            <Button variant="secondary" disabled={busy} onClick={close}>
                                {checkpoint.current.bookId
                                    ? 'Mở sách đã tạo'
                                    : checkpoint.current.uncertain
                                      ? 'Kiểm tra sách của tôi'
                                      : 'Hủy'}
                            </Button>
                            {!checkpoint.current.uncertain && (
                                <Button
                                    type="submit"
                                    loading={busy}
                                    disabled={
                                        preparing ||
                                        (mode === 'import' && (!source || Boolean(rangeError)))
                                    }
                                >
                                    {busy
                                        ? 'Đang tạo…'
                                        : locked
                                          ? 'Tiếp tục nhập'
                                          : 'Tạo và mở editor'}
                                    {!busy && <ArrowRight size={17} aria-hidden="true" />}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </ConfirmDialog>
        </>
    );
}
