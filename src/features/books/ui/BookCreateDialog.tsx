import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpen, FileUp, LoaderCircle, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { FormSelect } from '@/shared/ui/FormSelect';
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
import type { Asset } from '../../../shared/contracts/dto.schema';
import type { PageFormat } from '../../../shared/contracts/enums.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Button as IconButton } from '../../../shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { assetKeys, assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { saveUploadedImage } from '../../assets/model/image';
import { runAssetUpload, type UploadCheckpoint } from '../../assets/model/upload';
import { auth, useAuth } from '../../auth';
import { pageKeys, pagesApi } from '../../pages';
import { blankPageImage } from '../../pages/model/blank-page';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';
import { bookKeys, booksApi } from '../model/books';
import { type CreationCheckpoint, createBookWithPages } from '../model/create-book';
import type { ImportSource } from '../model/import-source';
import { customBookSize } from '../model/page-size';
import { BookCoverField } from './BookCoverField';
import { BookImportField, type BookImportValue } from './BookImportField';
import { BookSizeFields } from './BookSizeFields';
import { BookTopicField } from './BookTopicField';

export function BookCreateDialog() {
    const navigate = useNavigate(),
        cache = useQueryClient();
    const location = useLocation();
    const returnSearch = useRef(location.search).current;
    const { user } = useAuth();
    const actor = useRef(user?.id),
        alive = useRef(true),
        active = useRef(false);
    const sourceRef = useRef<ImportSource | null>(null);
    const checkpoint = useRef<CreationCheckpoint>({ pages: [] });
    const submission = useRef<{
        body: CreateBookBody;
        indices: number[];
        cover: File | null;
    } | null>(null);
    const [cover, setCover] = useState<File | null>(null);
    const coverCheckpoint = useRef<UploadCheckpoint | null>(null);
    const readyCover = useRef<Asset | null>(null);
    const [mode, setMode] = useState<'blank' | 'import'>('blank');
    const [source, setSource] = useState<ImportSource | null>(null);
    const [title, setTitle] = useState('');
    const [format, setFormat] = useState<PageFormat>('A4');
    const [width, setWidth] = useState('210'),
        [height, setHeight] = useState('297');
    const [detectedPage, setDetectedPage] = useState<number | null>(null);
    const [description, setDescription] = useState(''),
        [topic, setTopic] = useState('');
    const [selection, setSelection] = useState<number[]>([]);
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
    function changeImport(value: BookImportValue | null) {
        const previousSource = sourceRef.current;
        const size = value?.source.pageSizesMm?.[value.indices[0]];
        if (
            value?.source.kind === 'pdf' &&
            size &&
            (value.source !== previousSource || value.indices[0] !== selection[0])
        ) {
            setFormat('CUSTOM');
            setWidth(String(size.widthMm));
            setHeight(String(size.heightMm));
            setDetectedPage(value.indices[0] + 1);
        }
        if (value?.source.kind !== 'pdf') setDetectedPage(null);
        if (sourceRef.current !== value?.source) sourceRef.current?.dispose();
        sourceRef.current = value?.source || null;
        setSource(value?.source || null);
        setSelection(value?.indices || []);
        if (value)
            setTitle(
                (current) =>
                    current ||
                    (value.source.kind === 'pdf'
                        ? value.source.name
                        : value.source.labels[0]
                    ).replace(/\.[^.]+$/, ''),
            );
        setError(null);
    }
    const count = mode === 'blank' ? 1 : selection.length;
    const firstSize = source?.pageSizesMm?.[selection[0]];
    const mixedPageSizes =
        firstSize &&
        selection.some((index) => {
            const size = source?.pageSizesMm?.[index];
            return (
                size && (size.widthMm !== firstSize.widthMm || size.heightMm !== firstSize.heightMm)
            );
        });
    const dirty = Boolean(
        title ||
            cover ||
            description ||
            topic ||
            source ||
            preparing ||
            locked ||
            mode !== 'blank' ||
            format !== 'A4' ||
            width !== '210' ||
            height !== '297',
    );
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (active.current || preparing || checkpoint.current.uncertain) return;
        setError(null);
        try {
            if (!locked) {
                if (!title.trim()) throw new Error('Nhập tên sách trước khi tạo.');
                if (mode === 'import' && (!source || !selection.length))
                    throw new Error('Chọn PDF hoặc ảnh và ít nhất một trang để nhập.');
                submission.current = {
                    body: CreateBookBodySchema.parse({
                        title,
                        description: description.trim() || undefined,
                        topic: topic.trim() || undefined,
                        pageFormat: format,
                        ...(format === 'CUSTOM' ? customBookSize(width, height) : {}),
                        source: { type: 'BLANK' },
                    }),
                    indices: mode === 'blank' ? [0] : selection,
                    cover,
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
                saveCover: frozen.cover
                    ? async (bookId) => {
                          checkSession();
                          await saveUploadedImage({
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
                              file: frozen.cover as File,
                              purpose: 'ASSET',
                              metadata: { name: frozen.cover?.name || 'Ảnh bìa', tags: [] },
                              signal: new AbortController().signal,
                              checkpoint: coverCheckpoint.current,
                              readyAsset: readyCover.current,
                              onCheckpoint: (value) => {
                                  coverCheckpoint.current = value;
                              },
                              onReady: (value) => {
                                  checkSession();
                                  readyCover.current = value;
                              },
                              onStage: (value) =>
                                  setStage(
                                      {
                                          signing: 'Đang chuẩn bị ảnh bìa…',
                                          uploading: 'Đang tải ảnh bìa…',
                                          completing: 'Đang xác nhận ảnh bìa…',
                                      }[value],
                                  ),
                              onProgress: (percent) => setStage(`Đang tải ảnh bìa… ${percent}%`),
                              onSaving: () => setStage('Đang lưu ảnh bìa…'),
                              save: async (coverAssetId) => {
                                  checkSession();
                                  await booksApi.update(bookId, { coverAssetId });
                                  checkSession();
                              },
                          });
                      }
                    : undefined,
                detail: booksApi.detail,
                add: pagesApi.add,
                render: (index, ratio) =>
                    mode === 'blank'
                        ? blankPageImage(ratio)
                        : (source as ImportSource).render(index),
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
                        ? `Sách và ${completed} trang đã nhập vẫn được giữ. Đóng cửa sổ sẽ bỏ phần nhập còn lại; bạn chỉ có thể tiếp tục lần nhập này khi ở lại tab hiện tại.`
                        : checkpoint.current.uncertain
                          ? 'Máy chủ có thể đã tạo sách. Hãy kiểm tra Sách của tôi trước khi tạo lại để tránh trùng. Thông tin trong hộp thoại này sẽ bị bỏ.'
                          : 'Thông tin sách và tài liệu bạn đã chọn chưa được lưu. Đóng cửa sổ sẽ bỏ phần đang nhập.'
                }
            />
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex h-[min(820px,calc(100dvh-48px))] max-w-[min(1160px,calc(100vw-48px))] flex-col overflow-hidden p-0"
                    onEscapeKeyDown={(event) => {
                        if (busy) event.preventDefault();
                    }}
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader className="relative shrink-0 gap-2 border-border border-b px-6 py-5 pr-16">
                        <DialogTitle size="lg" className="m-0">
                            Tạo sách mới
                        </DialogTitle>
                        <DialogDescription className="m-0">
                            Điền thông tin sách, sau đó bắt đầu với trang trắng hoặc tài liệu của
                            bạn.
                        </DialogDescription>
                        <IconButton
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="absolute top-5 right-5"
                            aria-label="Đóng tạo sách"
                            disabled={busy}
                            onClick={close}
                        >
                            <X />
                        </IconButton>
                    </DialogHeader>
                    <form
                        className="flex min-h-0 flex-1 flex-col [&_[data-slot=select-trigger]]:mt-0 [&_input]:mt-0 [&_textarea]:mt-0"
                        onSubmit={(event) => void submit(event)}
                    >
                        <FieldGroup className="contents">
                            <div className="m-0 grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] overflow-hidden border-0 p-0 max-[960px]:grid-cols-1 max-[960px]:overflow-y-auto">
                                <fieldset disabled={busy || locked} className="contents">
                                    <div className="relative min-h-0 min-w-0 overflow-y-auto overscroll-contain border-border border-r p-6 max-[960px]:overflow-visible max-[960px]:border-r-0 max-[960px]:border-b">
                                        <FieldGroup className="gap-5 [container-type:normal]">
                                            <Field className="gap-2">
                                                <FieldLabel
                                                    htmlFor="new-book-title"
                                                    className="mb-0"
                                                >
                                                    Tên sách <span aria-hidden="true">*</span>
                                                </FieldLabel>
                                                <Input
                                                    id="new-book-title"
                                                    value={title}
                                                    onChange={(event) =>
                                                        setTitle(event.target.value)
                                                    }
                                                    maxLength={200}
                                                    required
                                                    placeholder="Ví dụ: Khám phá hệ Mặt Trời"
                                                />
                                            </Field>
                                            <BookCoverField
                                                file={cover}
                                                disabled={busy || locked}
                                                onChange={(value) => {
                                                    setCover(value);
                                                    coverCheckpoint.current = null;
                                                    readyCover.current = null;
                                                    setError(null);
                                                }}
                                            />
                                            <Field className="gap-2">
                                                <FieldLabel
                                                    htmlFor="new-book-description"
                                                    className="mb-0"
                                                >
                                                    Mô tả
                                                </FieldLabel>
                                                <Textarea
                                                    id="new-book-description"
                                                    rows={3}
                                                    maxLength={2000}
                                                    value={description}
                                                    placeholder="Giới thiệu ngắn về nội dung cuốn sách"
                                                    onChange={(event) =>
                                                        setDescription(event.currentTarget.value)
                                                    }
                                                />
                                            </Field>
                                            <BookTopicField
                                                id="new-book-topic"
                                                value={topic}
                                                disabled={busy || locked}
                                                onChange={setTopic}
                                            />
                                        </FieldGroup>
                                    </div>
                                    <div className="relative min-h-0 min-w-0 overflow-y-auto overscroll-contain p-6 max-[960px]:overflow-visible">
                                        <div className="mb-4">
                                            <div className="creation-format grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,1fr))] items-start gap-4 max-[600px]:grid-cols-2 [&_>_label]:block [&_>_label]:font-semibold [&_>_label]:text-[length:14px] [&_[data-slot=field]]:gap-2 [&_[data-slot=select-trigger]]:mt-0! [&_input]:mt-0!">
                                                <Field className="min-w-0 max-[600px]:col-span-full">
                                                    <FieldLabel
                                                        htmlFor="new-book-format"
                                                        className="mb-0"
                                                    >
                                                        Khổ sách
                                                    </FieldLabel>
                                                    <FormSelect
                                                        id="new-book-format"
                                                        value={format}
                                                        onValueChange={(value) => {
                                                            setFormat(value as PageFormat);
                                                            setDetectedPage(null);
                                                        }}
                                                        options={[
                                                            { value: 'A4', label: 'A4 - Dọc' },
                                                            { value: 'A5', label: 'A5 - Dọc' },
                                                            { value: 'SQUARE', label: 'Vuông' },
                                                            { value: 'CUSTOM', label: 'Tùy chỉnh' },
                                                        ]}
                                                    />
                                                </Field>
                                                <BookSizeFields
                                                    format={format}
                                                    className="contents"
                                                    idPrefix="new-book"
                                                    width={width}
                                                    height={height}
                                                    onWidthChange={(value) => {
                                                        setWidth(value);
                                                        setDetectedPage(null);
                                                    }}
                                                    onHeightChange={(value) => {
                                                        setHeight(value);
                                                        setDetectedPage(null);
                                                    }}
                                                />
                                            </div>
                                            {(mode === 'import' || format === 'CUSTOM') && (
                                                <p className="mt-2 mb-0 text-muted-foreground text-xs leading-relaxed">
                                                    {mode === 'import'
                                                        ? detectedPage !== null
                                                            ? `Theo trang PDF ${detectedPage}.${mixedPageSizes ? ' Các trang khác được đặt vừa khổ này.' : ' Có thể chỉnh lại kích thước.'}`
                                                            : 'Ảnh vừa trang, phần dư nền trắng.'
                                                        : 'Nhập kích thước trang bằng milimét.'}
                                                </p>
                                            )}
                                        </div>
                                        <FieldSet className="m-0 min-w-0 gap-3 border-0 p-0">
                                            <FieldLegend
                                                variant="label"
                                                className="m-0 mb-2 font-semibold"
                                            >
                                                Nội dung ban đầu
                                            </FieldLegend>
                                            <RadioGroup
                                                name="creation-source"
                                                disabled={preparing}
                                                value={mode}
                                                onValueChange={(value) =>
                                                    setMode(value as typeof mode)
                                                }
                                                className="grid grid-cols-2 gap-3"
                                                aria-label="Bắt đầu với"
                                            >
                                                <Field orientation="contents">
                                                    <FieldLabel
                                                        className={cn(
                                                            'creation-mode-option relative m-0 flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-primary border-solid bg-surface px-4 py-4 text-primary transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-3 [&.selected]:bg-primary [&.selected]:text-primary-foreground [.creation-fields:disabled_&]:cursor-default',
                                                            mode === 'blank' ? 'selected' : '',
                                                        )}
                                                    >
                                                        <RadioGroupItem
                                                            value="blank"
                                                            className="sr-only absolute"
                                                        />
                                                        <BookOpen size={23} aria-hidden="true" />
                                                        <span>
                                                            <strong className="block font-semibold text-sm">
                                                                Sách trống
                                                            </strong>
                                                            <small className="mt-1 block text-xs leading-relaxed">
                                                                Một trang trắng để sáng tạo
                                                            </small>
                                                        </span>
                                                    </FieldLabel>
                                                </Field>
                                                <Field orientation="contents">
                                                    <FieldLabel
                                                        className={cn(
                                                            'creation-mode-option relative m-0 flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-primary border-solid bg-surface px-4 py-4 text-primary transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-3 [&.selected]:bg-primary [&.selected]:text-primary-foreground [.creation-fields:disabled_&]:cursor-default',
                                                            mode === 'import' ? 'selected' : '',
                                                        )}
                                                    >
                                                        <RadioGroupItem
                                                            value="import"
                                                            className="sr-only absolute"
                                                        />
                                                        <FileUp size={23} aria-hidden="true" />
                                                        <span>
                                                            <strong className="block font-semibold text-sm">
                                                                Nhập PDF / ảnh
                                                            </strong>
                                                            <small className="mt-1 block text-xs leading-relaxed">
                                                                Mỗi trang hoặc ảnh là một trang sách
                                                            </small>
                                                        </span>
                                                    </FieldLabel>
                                                </Field>
                                            </RadioGroup>
                                        </FieldSet>
                                        <div className={mode === 'import' ? undefined : 'hidden'}>
                                            <BookImportField
                                                value={
                                                    source ? { source, indices: selection } : null
                                                }
                                                disabled={busy || locked}
                                                onChange={changeImport}
                                                onBusyChange={setPreparing}
                                            />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                            {(error || busy) && (
                                <div className="creation-result max-h-[28dvh] shrink-0 overflow-y-auto px-6 pt-3 pb-4 [&_>_.feedback]:m-0">
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
                                            className="creation-progress mt-0 flex items-center gap-3 text-[length:14px] text-primary [&_small]:mt-[6px] [&_small]:block [&_small]:text-current"
                                            role="status"
                                        >
                                            <LoaderCircle
                                                size={20}
                                                className="button-spinner shrink-0 motion-safe:animate-spin"
                                            />
                                            <span>
                                                {stage}
                                                <small>
                                                    {completed}/{count} trang đã hoàn tất. Giữ trang
                                                    này mở đến khi hoàn tất.
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
                            <footer className="flex shrink-0 items-center justify-between gap-4 border-border border-t px-6 py-4 [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&>span]:text-muted-foreground [&>span]:text-xs">
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
                                                    (!source || !selection.length)) ||
                                                busy
                                            }
                                        >
                                            {busy && (
                                                <Spinner
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />
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
                            </footer>
                        </FieldGroup>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
