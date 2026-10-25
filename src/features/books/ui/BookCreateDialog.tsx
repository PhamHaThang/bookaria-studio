import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, FileUp, LoaderCircle, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Disclosure } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Progress } from '@/shared/ui/primitives/progress';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
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

export function BookCreateDialog() {
    const navigate = useNavigate(),
        cache = useQueryClient();
    const location = useLocation();
    const returnSearch = useRef(location.search).current;
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
    const [completed, setCompleted] = useState(0);
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
        navigate(
            {
                pathname: checkpoint.current.bookId
                    ? `/books/${checkpoint.current.bookId}`
                    : '/books',
                search: checkpoint.current.bookId ? '' : returnSearch,
            },
            { replace: true },
        );
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
    const dirty = Boolean(
        title ||
            description ||
            topic ||
            source ||
            preparing ||
            locked ||
            mode !== 'blank' ||
            format !== 'A4' ||
            aspect !== '1.4142',
    );
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
                    setCompleted(value.pages.filter((page) => page.result).length);
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
            <NavigationGuard
                dirty={dirty && !target}
                saving={busy}
                title="Rời luồng tạo sách?"
                dirtyDescription={
                    checkpoint.current.bookId
                        ? `Sách và ${completed} trang đã nhập vẫn được giữ. Rời trang sẽ bỏ phần nhập còn lại; bạn chỉ có thể tiếp tục lần nhập này khi ở lại tab hiện tại.`
                        : checkpoint.current.uncertain
                          ? 'Máy chủ có thể đã tạo sách. Hãy kiểm tra Sách của tôi trước khi tạo lại để tránh trùng. Thông tin trong hộp thoại này sẽ bị bỏ.'
                          : 'Thông tin sách và tài liệu bạn đã chọn chưa được lưu. Rời trang sẽ bỏ phần đang nhập.'
                }
            />
            <ConfirmDialog
                title="Tạo sách mới"
                className="book-create-dialog [&[data-state=open]]:flex [&[data-state=open]]:flex-col [&_>_form]:flex [&_>_form]:min-h-0 [&_>_form]:flex-col [&_>_h2]:mx-0 [&_>_h2]:mt-0 [&_>_h2]:mb-2 [&_>_h2]:pr-17 [&_>_h2]:pl-7 [&_>_h2]:text-[length:var(--text-xl)] max-[600px]:[&_>_h2]:pl-[18px] [.confirm-dialog&]:max-h-[calc(100dvh_-_32px)] [.confirm-dialog&]:w-[min(760px,_calc(100vw_-_32px))] [.confirm-dialog&]:max-w-[calc(100vw_-_32px)] [.confirm-dialog&]:overflow-hidden [.confirm-dialog&]:border-0 [.confirm-dialog&]:border-[transparent] [.confirm-dialog&]:border-solid [.confirm-dialog&]:px-0 [.confirm-dialog&]:pt-7 [.confirm-dialog&]:pb-0 [.confirm-dialog&]:shadow-[var(--shadow-popover)] max-[600px]:[.confirm-dialog&]:max-h-[calc(100dvh_-_16px)] max-[600px]:[.confirm-dialog&]:w-[calc(100vw_-_16px)] max-[600px]:[.confirm-dialog&]:max-w-[calc(100vw_-_16px)] max-[600px]:[.confirm-dialog&]:pt-[22px]"
                busy={busy}
                onClose={close}
            >
                <Button
                    variant="ghost"
                    className="creation-close absolute top-[18px] right-[18px] size-11 p-0"
                    aria-label="Đóng tạo sách"
                    disabled={busy}
                    onClick={close}
                >
                    <X data-icon="inline-start" />
                </Button>
                <p className="creation-intro [.book-create-dialog_&]:mx-0 [.book-create-dialog_&]:mt-0 [.book-create-dialog_&]:mb-6 [.book-create-dialog_&]:pr-17 [.book-create-dialog_&]:pl-7 [.book-create-dialog_&]:text-[length:14px] max-[600px]:[.book-create-dialog_&]:pr-16 max-[600px]:[.book-create-dialog_&]:pl-[18px]">
                    Bắt đầu từ trang trắng hoặc biến tài liệu có sẵn thành sách AR.
                </p>
                <form onSubmit={(event) => void submit(event)}>
                    <FieldGroup className="contents">
                        <div className="creation-body overflow-y-auto px-7 pt-0 pb-6 [overscroll-behavior:contain] [scrollbar-color:var(--border-input)_var(--bg-surface)] [scrollbar-width:thin] max-[600px]:px-[18px]">
                            <fieldset
                                disabled={busy || locked}
                                className="creation-fields m-0 min-w-0 border-0 border-[transparent] border-solid p-0 [&_>_label]:block [&_>_label]:font-semibold [&_>_label]:text-[length:14px] [&_[data-slot=select-trigger]]:mt-2 [&_[data-slot=select-trigger]]:flex [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:w-full [&_input::placeholder]:text-muted-foreground [&_input::placeholder]:opacity-100 [&_input:not([type=radio])]:mt-2 [&_input:not([type=radio])]:block [&_input:not([type=radio])]:min-h-11 [&_input:not([type=radio])]:w-full [&_textarea]:mt-2 [&_textarea]:block [&_textarea]:min-h-11 [&_textarea]:w-full"
                            >
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="new-book-title">
                                        Tên sách <span aria-hidden="true">*</span>
                                        <Input
                                            id="new-book-title"
                                            value={title}
                                            onChange={(event) => setTitle(event.target.value)}
                                            maxLength={200}
                                            required
                                            placeholder="Ví dụ: Khám phá hệ Mặt Trời"
                                        />
                                    </FieldLabel>
                                </Field>
                                <FieldSet className="creation-modes mx-0 mt-6 mb-0 grid min-w-0 grid-cols-[1fr_1fr] gap-3 border-0 border-[transparent] border-solid p-0 max-[600px]:grid-cols-[1fr] max-[600px]:gap-2 [&_input]:size-4 [&_input]:shrink-0 [&_input]:[accent-color:var(--action-primary)] [&_legend]:mb-[10px] [&_legend]:font-semibold [&_legend]:text-[length:14px] [&_small]:mt-1 [&_small]:block [&_small]:text-[length:12px] [&_small]:text-muted-foreground [&_small]:leading-[1.6] [&_strong]:block [&_strong]:font-semibold [&_strong]:text-[length:14px] [&_svg]:shrink-0 [&_svg]:text-primary">
                                    <FieldLegend>Bắt đầu với</FieldLegend>
                                    <RadioGroup
                                        name="creation-source"
                                        value={mode}
                                        onValueChange={(value) => setMode(value as typeof mode)}
                                        className="contents"
                                        aria-label="Bắt đầu với"
                                    >
                                        <Field orientation="contents">
                                            <FieldLabel
                                                className={cn(
                                                    'creation-mode-option m-0 flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border border-solid px-3 py-4 [&.selected]:border-primary [&.selected]:bg-selected [.creation-fields:disabled_&]:[cursor:default]',
                                                    mode === 'blank' ? 'selected' : '',
                                                )}
                                            >
                                                <RadioGroupItem value="blank" />
                                                <BookOpen size={23} aria-hidden="true" />
                                                <span>
                                                    <strong>Sách trống</strong>
                                                    <small>Một trang trắng để sáng tạo</small>
                                                </span>
                                            </FieldLabel>
                                        </Field>
                                        <Field orientation="contents">
                                            <FieldLabel
                                                className={cn(
                                                    'creation-mode-option m-0 flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border border-solid px-3 py-4 [&.selected]:border-primary [&.selected]:bg-selected [.creation-fields:disabled_&]:[cursor:default]',
                                                    mode === 'import' ? 'selected' : '',
                                                )}
                                            >
                                                <RadioGroupItem value="import" />
                                                <FileUp size={23} aria-hidden="true" />
                                                <span>
                                                    <strong>Nhập PDF / ảnh</strong>
                                                    <small>
                                                        Mỗi trang hoặc ảnh là một trang sách
                                                    </small>
                                                </span>
                                            </FieldLabel>
                                        </Field>
                                    </RadioGroup>
                                </FieldSet>
                                {mode === 'import' && (
                                    <div className="creation-import mt-4">
                                        <ActionButton
                                            variant="plain"
                                            className="creation-file flex w-full cursor-pointer flex-wrap items-center justify-center gap-2 rounded-[var(--radius-md)] border border-input border-dashed bg-muted p-4 text-center text-foreground [font:inherit] [&_span]:basis-full [&_span]:font-normal [&_span]:text-[length:12px] [&_span]:text-muted-foreground"
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
                                        </ActionButton>
                                        <Input
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
                                                <LoaderCircle
                                                    size={17}
                                                    className="button-spinner shrink-0 motion-safe:animate-spin"
                                                />
                                                Đang đọc tài liệu…
                                            </p>
                                        )}
                                        {source && (
                                            <div className="creation-source-summary [&_strong]:wrap-anywhere mt-4 grid grid-cols-[88px_minmax(0,_1fr)] items-start gap-4 [&_img]:h-29 [&_img]:w-22 [&_img]:border [&_img]:border-border [&_img]:border-solid [&_img]:bg-background [&_img]:object-contain [&_label]:block [&_label]:text-[length:12px] [&_p]:mx-0 [&_p]:my-2 [&_p]:text-[length:12px] [&_strong]:block [&_strong]:text-[length:14px]">
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
                                                        <Field
                                                            orientation="contents"
                                                            data-invalid={Boolean(rangeError)}
                                                        >
                                                            <FieldLabel htmlFor="pdf-pages">
                                                                Trang cần nhập
                                                                <Input
                                                                    id="pdf-pages"
                                                                    value={range}
                                                                    onChange={(event) =>
                                                                        setRange(event.target.value)
                                                                    }
                                                                    placeholder={`Tất cả ${source.count} trang (ví dụ: 1-3, 5)`}
                                                                    aria-invalid={Boolean(
                                                                        rangeError,
                                                                    )}
                                                                    aria-describedby="range-message"
                                                                />
                                                                <span
                                                                    id="range-message"
                                                                    className={
                                                                        rangeError
                                                                            ? 'field-error mx-0 mt-2 mb-0 text-[length:var(--text-xs)] text-danger-foreground'
                                                                            : 'field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]'
                                                                    }
                                                                >
                                                                    {rangeError ||
                                                                        `Sẽ nhập ${selection.length} trang theo thứ tự tài liệu.`}
                                                                </span>
                                                            </FieldLabel>
                                                        </Field>
                                                    ) : (
                                                        <p className="creation-file-order max-h-16 overflow-y-auto">
                                                            {source.labels.join(' → ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <p className="creation-import-note mx-0 my-2 text-[length:12px]">
                                            Nội dung được chuyển thành ảnh nền trang. Bạn có thể
                                            thêm chữ, mô hình 3D và tương tác trong editor.
                                        </p>
                                    </div>
                                )}
                                <div className="creation-format mt-6 grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 [&_>_label]:block [&_>_label]:font-semibold [&_>_label]:text-[length:14px]">
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="new-book-format">
                                            Khổ sách
                                            <FormSelect
                                                id="new-book-format"
                                                value={format}
                                                onValueChange={(value) => setFormat(value)}
                                                options={[
                                                    { value: 'A4', label: 'A4 · Dọc' },
                                                    { value: 'A5', label: 'A5 · Dọc' },
                                                    { value: 'SQUARE', label: 'Vuông · 1:1' },
                                                    { value: 'CUSTOM', label: 'Tùy chỉnh' },
                                                ]}
                                            />
                                        </FieldLabel>
                                    </Field>
                                    {format === 'CUSTOM' && (
                                        <Field orientation="contents">
                                            <FieldLabel htmlFor="new-book-aspect">
                                                Tỉ lệ cao / rộng
                                                <Input
                                                    id="new-book-aspect"
                                                    type="number"
                                                    min="0.2"
                                                    max="5"
                                                    step="any"
                                                    required
                                                    value={aspect}
                                                    onChange={(event) =>
                                                        setAspect(event.target.value)
                                                    }
                                                />
                                            </FieldLabel>
                                        </Field>
                                    )}
                                </div>
                                {mode === 'import' && (
                                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                        Ảnh luôn nằm trọn trong khổ sách; phần dư được thêm nền
                                        trắng.
                                    </p>
                                )}
                                <Disclosure
                                    title={<>Thông tin bổ sung</>}
                                    className="creation-details mt-6 border-t-[1px] border-t-border pt-[18px] [border-top-style:solid] [&_>_label]:block [&_>_label]:font-semibold [&_>_label]:text-[length:14px] [&_[data-slot=accordion-trigger]]:min-h-[30px] [&_[data-slot=accordion-trigger]]:cursor-pointer [&_[data-slot=accordion-trigger]]:font-semibold [&_[data-slot=accordion-trigger]]:text-[length:14px] [&_label]:mt-[14px]"
                                >
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="new-book-description">
                                            Mô tả
                                            <Textarea
                                                id="new-book-description"
                                                rows={3}
                                                maxLength={2000}
                                                value={description}
                                                onChange={(event) =>
                                                    setDescription(event.target.value)
                                                }
                                            />
                                        </FieldLabel>
                                    </Field>
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="new-book-topic">
                                            Chủ đề
                                            <Input
                                                id="new-book-topic"
                                                maxLength={50}
                                                value={topic}
                                                onChange={(event) => setTopic(event.target.value)}
                                                placeholder="Ví dụ: Khoa học"
                                            />
                                        </FieldLabel>
                                    </Field>
                                </Disclosure>
                            </fieldset>
                        </div>
                        {(error || busy) && (
                            <div className="creation-result max-h-[32dvh] shrink-0 overflow-y-auto px-7 pt-0 pb-4 max-[600px]:px-[18px] [&_>_.feedback]:m-0">
                                <Feedback error={error} />
                                {locked && !busy && error && (
                                    <p className="creation-recovery mx-0 my-2 text-[length:12px]">
                                        {checkpoint.current.uncertain
                                            ? 'Yêu cầu có thể đã được lưu. Mở sách để kiểm tra; hệ thống sẽ không tự gửi lại và tạo trùng.'
                                            : `Sách đã tạo, ${completed}/${count} trang đã nhập. Tiếp tục sẽ giữ nguyên các trang đã xong. Giữ tab này để tiếp tục.`}
                                    </p>
                                )}
                                {busy && (
                                    <div
                                        className="creation-progress mt-0 flex items-center gap-3 text-[length:14px] text-primary [&_small]:mt-[6px] [&_small]:block [&_small]:text-muted-foreground"
                                        role="status"
                                    >
                                        <LoaderCircle
                                            size={20}
                                            className="button-spinner shrink-0 motion-safe:animate-spin"
                                        />
                                        <span>
                                            {stage}
                                            <small>
                                                {completed}/{count} trang đã hoàn tất. Giữ trang này
                                                mở đến khi hoàn tất.
                                            </small>
                                        </span>
                                    </div>
                                )}
                                {locked && (
                                    <Progress
                                        value={completed}
                                        max={count}
                                        className="mt-3"
                                        aria-label="Tiến độ tạo trang sách"
                                        getValueLabel={() =>
                                            `${completed}/${count} trang đã hoàn tất`
                                        }
                                    />
                                )}
                            </div>
                        )}
                        <div className="creation-footer flex shrink-0 items-center justify-between gap-4 border-t-[1px] border-t-border px-7 py-[18px] [border-top-style:solid] max-[600px]:flex-col max-[600px]:items-stretch max-[600px]:gap-[10px] max-[600px]:px-[18px] max-[600px]:py-[14px] max-[600px]:[&_.button]:min-w-0 [&_>_div]:flex [&_>_div]:flex-wrap [&_>_div]:justify-end [&_>_div]:gap-[10px] max-[600px]:[&_>_div]:flex-nowrap [&_>_span]:text-[length:12px] [&_>_span]:text-muted-foreground">
                            <span>
                                {locked
                                    ? 'Sách đang ở chế độ nháp'
                                    : `${count} trang · Nháp riêng tư`}
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
                                        aria-busy={busy}
                                        disabled={
                                            preparing ||
                                            (mode === 'import' &&
                                                (!source || Boolean(rangeError))) ||
                                            busy
                                        }
                                    >
                                        {busy && (
                                            <Spinner data-icon="inline-start" aria-hidden="true" />
                                        )}
                                        {busy
                                            ? 'Đang tạo…'
                                            : locked
                                              ? 'Tiếp tục nhập'
                                              : 'Tạo và mở editor'}
                                        {!busy && (
                                            <ArrowRight
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </FieldGroup>
                </form>
            </ConfirmDialog>
        </>
    );
}
