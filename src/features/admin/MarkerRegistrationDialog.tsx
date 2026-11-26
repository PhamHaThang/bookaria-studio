import { useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, ScanLine, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import { LoadingToast } from '@/shared/ui/LoadingToast';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button } from '@/shared/ui/primitives/button';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Progress } from '@/shared/ui/primitives/progress';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Switch } from '@/shared/ui/primitives/switch';
import { uploadFile } from '../assets/api/upload-file';
import { auth, useAuth } from '../auth';
import { compileMarker } from '../pages/api/compile-marker';
import { AdminDialog } from './components/AdminDialog';
import { libraryApi } from './library-ui';
import { type MarkerImportItem, mergeMarkerImages, registerMarkerImage } from './marker-import';

function Thumbnail({ file }: { file?: File }) {
    const [url, setUrl] = useState('');
    useEffect(() => {
        if (!file) return;
        const value = URL.createObjectURL(file);
        setUrl(value);
        return () => URL.revokeObjectURL(value);
    }, [file]);
    return url ? (
        <img
            src={url}
            alt=""
            className="size-16 shrink-0 rounded-md border border-border object-contain p-1"
        />
    ) : (
        <div className="grid size-16 shrink-0 place-items-center rounded-md border border-border border-dashed">
            <ImagePlus className="size-6 text-muted-foreground" />
        </div>
    );
}
export function MarkerRegistrationDialog({ onClose }: { onClose: () => void }) {
    const id = useId(),
        { user } = useAuth(),
        cache = useQueryClient();
    const imageInput = useRef<HTMLInputElement>(null),
        chooseRef = useRef<HTMLButtonElement>(null);
    const request = useRef<AbortController | null>(null),
        alive = useRef(true),
        rowsRef = useRef<MarkerImportItem[]>([]);
    const [rows, setRows] = useState<MarkerImportItem[]>([]),
        [busy, setBusy] = useState(false),
        [active, setActive] = useState(false),
        [over, setOver] = useState(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            request.current?.abort();
        };
    }, []);
    const update = (change: (previous: MarkerImportItem[]) => MarkerImportItem[]) => {
        if (!alive.current) return;
        rowsRef.current = change(rowsRef.current);
        setRows(rowsRef.current);
    };
    function choose(files: File[]) {
        if (busy) return;
        try {
            update((current) => mergeMarkerImages(current, files));
        } catch (error) {
            toast.error(errorMessage(error));
        }
    }
    const ready = rows.filter((row) => row.status !== 'done'),
        done = rows.filter((row) => row.status === 'done').length;
    const progress = rows.length
        ? rows.reduce((sum, row) => sum + row.progress, 0) / rows.length
        : 0;
    async function register() {
        if (request.current || !ready.length) return;
        const controller = new AbortController();
        request.current = controller;
        setBusy(true);
        let added = 0;
        try {
            for (const candidate of ready) {
                if (controller.signal.aborted || auth.store.getState().user?.id !== user?.id) break;
                const patch = (value: Partial<MarkerImportItem>) =>
                    update((current) =>
                        current.map((row) =>
                            row.key === candidate.key ? { ...row, ...value } : row,
                        ),
                    );
                patch({ error: undefined });
                try {
                    const result = await registerMarkerImage(
                        candidate,
                        active,
                        libraryApi,
                        uploadFile,
                        compileMarker,
                        controller.signal,
                        (checkpoint) => patch({ checkpoint }),
                        (p) => patch({ progress: p }),
                        (status) => patch({ status }),
                    );
                    if (auth.store.getState().user?.id !== user?.id) break;
                    patch({ status: 'done', result, progress: 100 });
                    added++;
                } catch (error) {
                    patch({
                        status: 'error',
                        error: controller.signal.aborted
                            ? 'Đã dừng. Bấm đăng ký lại để tiếp tục.'
                            : errorMessage(error),
                    });
                    if (controller.signal.aborted) break;
                }
            }
            if (added) {
                void cache.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === 'admin' &&
                        query.queryKey[1] === user?.id &&
                        query.queryKey[2] === 'markers',
                });
                toast.success(`Đã đăng ký ${added} marker.`);
            }
        } finally {
            request.current = null;
            if (alive.current) setBusy(false);
        }
    }
    const selectButton = (
        <Button ref={chooseRef} onClick={() => imageInput.current?.click()} disabled={busy}>
            <ImagePlus data-icon="inline-start" />
            Chọn ảnh marker
        </Button>
    );
    return (
        <AdminDialog
            open
            busy={busy}
            onClose={onClose}
            title="Đăng ký marker"
            description="Chọn ảnh để tạo dữ liệu nhận diện và cấp số marker."
            className="h-[calc(100dvh-32px)] max-w-[min(1120px,calc(100vw-32px))] sm:h-[min(740px,calc(100dvh-80px))]"
            onOpenAutoFocus={(event) => {
                if (chooseRef.current) {
                    event.preventDefault();
                    chooseRef.current.focus();
                }
            }}
        >
            <input
                ref={imageInput}
                className="sr-only"
                type="file"
                tabIndex={-1}
                multiple
                accept="image/png,image/jpeg,image/webp"
                aria-label="Chọn ảnh marker"
                onChange={(e) => {
                    choose(Array.from(e.currentTarget.files || []));
                    e.currentTarget.value = '';
                }}
            />

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto max-sm:content-start sm:grid-cols-[minmax(0,1fr)_minmax(240px,30%)]">
                <fieldset
                    aria-label="Chọn các tệp marker"
                    className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0 max-sm:data-[empty=true]:min-h-64 sm:min-h-0"
                    data-empty={rows.length === 0}
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (!busy) setOver(true);
                    }}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setOver(false);
                        choose(Array.from(e.dataTransfer.files));
                    }}
                >
                    <div className="flex shrink-0 items-center justify-between gap-4">
                        <p className="m-0 font-medium text-sm">
                            {rows.length ? `${rows.length} marker đã chọn` : 'Tệp marker'}
                        </p>
                        <div className="flex gap-2">
                            {rows.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => imageInput.current?.click()}
                                >
                                    <ImagePlus data-icon="inline-start" />
                                    Thêm ảnh
                                </Button>
                            )}
                        </div>
                    </div>
                    <div
                        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface data-[over=true]:border-primary"
                        data-over={over}
                    >
                        {rows.length ? (
                            <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
                                {rows.map((row) => (
                                    <li
                                        key={row.key}
                                        className="flex min-w-0 items-center gap-4 p-4"
                                    >
                                        <Thumbnail file={row.image} />
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <p
                                                className="m-0 truncate font-medium text-sm"
                                                title={row.name}
                                            >
                                                {row.name}
                                            </p>
                                            <p className="m-0 truncate text-muted-foreground text-xs">
                                                {row.image?.name || 'Chưa có ảnh'}
                                            </p>
                                            <p className="m-0 truncate text-muted-foreground text-xs">
                                                {row.status === 'compiling'
                                                    ? 'Đang tạo nhận diện…'
                                                    : row.status === 'uploading'
                                                      ? 'Đang tải lên và đăng ký…'
                                                      : row.status === 'done'
                                                        ? 'Đã tạo nhận diện'
                                                        : 'Tự động tạo dữ liệu nhận diện'}
                                            </p>
                                            {(row.status === 'uploading' ||
                                                row.status === 'compiling') && (
                                                <Progress
                                                    value={row.progress}
                                                    aria-label={`Tiến độ ${row.name}`}
                                                />
                                            )}
                                            {row.error && (
                                                <p
                                                    className="m-0 text-destructive text-xs"
                                                    role="alert"
                                                >
                                                    {row.error}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {row.status === 'done' ? (
                                                <Badge variant="outline">
                                                    <Check data-icon="inline-start" />
                                                    Số {row.result?.number}
                                                </Badge>
                                            ) : row.status === 'uploading' ||
                                              row.status === 'compiling' ? (
                                                <Spinner />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">
                                                    {row.status === 'error'
                                                        ? 'Chưa đăng ký'
                                                        : 'Sẵn sàng'}
                                                </span>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                disabled={busy || row.status === 'done'}
                                                aria-label={`Xóa ${row.name} khỏi danh sách`}
                                                onClick={() =>
                                                    update((current) =>
                                                        current.filter(
                                                            (item) => item.key !== row.key,
                                                        ),
                                                    )
                                                }
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <Empty className="h-full gap-4 border-0 p-5">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <ScanLine />
                                    </EmptyMedia>
                                    <EmptyTitle>Chọn ảnh để đăng ký</EmptyTitle>
                                    <EmptyDescription>
                                        Kéo thả ảnh vào đây, hoặc chọn từ máy. Có thể đăng ký nhiều
                                        marker trong một lượt.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>{selectButton}</EmptyContent>
                            </Empty>
                        )}
                    </div>
                </fieldset>
                <aside className="flex min-w-0 flex-col gap-4 rounded-lg bg-muted/40 p-4 sm:min-h-0 sm:overflow-y-auto">
                    <FieldGroup className="gap-2">
                        <Field orientation="horizontal">
                            <FieldLabel htmlFor={`${id}-active`} className="flex-1">
                                Bật sau khi đăng ký
                            </FieldLabel>
                            <Switch
                                id={`${id}-active`}
                                checked={active}
                                onCheckedChange={setActive}
                                disabled={busy}
                            />
                        </Field>
                        <FieldDescription>
                            {active
                                ? 'Marker mới sẽ được cấp cho trang mới ngay sau khi đăng ký.'
                                : 'Marker được thêm ở trạng thái tắt. Bạn có thể bật sau khi thử quét bản in.'}
                        </FieldDescription>
                    </FieldGroup>
                    <p className="m-0 text-muted-foreground text-xs">
                        Ảnh vuông PNG, JPG hoặc WebP, từ 128 px, tối đa 10 MB mỗi ảnh. Nên chọn ảnh
                        rõ nét, nhiều chi tiết khác nhau.
                    </p>
                </aside>
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end gap-x-4 border-0 pt-0 sm:justify-between">
                <div
                    className="flex min-w-0 flex-1 basis-full flex-col gap-2 sm:basis-auto"
                    role="status"
                    aria-live="polite"
                >
                    <LoadingToast
                        title={busy ? 'Đang chuẩn bị và đăng ký marker…' : null}
                        description={`${Math.round(progress)}% · ${done}/${rows.length} marker đã đăng ký`}
                    />
                    {!busy && (
                        <p className="m-0 text-muted-foreground text-xs">
                            {done
                                ? `Đã đăng ký ${done}/${rows.length} marker`
                                : `${ready.length} marker sẵn sàng`}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 gap-3">
                    {busy ? (
                        <Button variant="outline" onClick={() => request.current?.abort()}>
                            Dừng
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={onClose}>
                            {done ? 'Đóng' : 'Hủy'}
                        </Button>
                    )}
                    {!busy && ready.length > 0 && (
                        <Button onClick={() => void register()}>
                            <Upload data-icon="inline-start" />
                            Đăng ký {ready.length} marker
                        </Button>
                    )}
                </div>
            </DialogFooter>
        </AdminDialog>
    );
}
