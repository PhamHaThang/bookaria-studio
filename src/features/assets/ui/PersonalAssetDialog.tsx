import { useQuery } from '@tanstack/react-query';
import { Box, Copy, ExternalLink, FileImage, Film, Music2, Save, Trash2, X } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { AssetDeleteDialog } from '@/features/scene/ui/AssetDeleteDialog';
import { NavigationGuard } from '@/features/scene/ui/NavigationGuard';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Badge as TagBadge } from '@/shared/ui/primitives/badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Separator } from '@/shared/ui/primitives/separator';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { assetKeys, assetStatusLabels, assetsApi, assetTypeLabels } from '../model/assets';
import { AssetMetadataEditor } from './AssetMetadataEditor';

import { AssetFilePreview, AssetPreviewState, assetDuration } from './AssetPreviewMedia';

const icons = { MODEL: Box, IMAGE: FileImage, AUDIO: Music2, VIDEO: Film };

export function PersonalAssetDialog({
    asset: initial,
    onClose,
}: {
    asset: Asset;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const opener = useRef(document.activeElement as HTMLElement | null);
    const deleteButton = useRef<HTMLButtonElement>(null);
    const infoTab = useRef<HTMLButtonElement>(null);
    const discardedTo = useRef<'close' | 'info' | null>(null);
    const form = useRef<HTMLFormElement>(null);
    const formId = useId();
    const [editing, setEditing] = useState(false);
    const [writeState, setWriteState] = useState({ dirty: false, saving: false });
    const [leaving, setLeaving] = useState<'close' | 'info' | null>(null);
    const [removing, setRemoving] = useState(false);
    const syncWriteState = useCallback(
        (state: { dirty: boolean; saving: boolean }) => setWriteState(state),
        [],
    );
    function leave(target: 'close' | 'info') {
        if (writeState.saving || removing) return;
        if (writeState.dirty) {
            discardedTo.current = null;
            setLeaving(target);
            return;
        }
        if (target === 'close') onClose();
        else setEditing(false);
    }
    const detail = useQuery({
        queryKey: assetKeys.detail(user?.id || '', initial.id),
        queryFn: ({ signal }) => assetsApi.detail(initial.id, signal),
        initialData: initial,
        staleTime: 0,
        refetchInterval: (query) =>
            !query.state.error && query.state.data?.status === 'PROCESSING' ? 3000 : false,
        retry: false,
    });
    const asset = detail.isFetchedAfterMount ? detail.data : initial;
    const owned = asset.scope === 'mine';
    const canEdit = owned && asset.status === 'READY' && !detail.isError;
    const usages = useQuery({
        queryKey: assetKeys.usages(user?.id || '', asset.id),
        queryFn: ({ signal }) => assetsApi.usages(asset.id, signal),
        enabled: owned && !detail.isError,
        retry: false,
    });
    const Icon = icons[asset.type];
    const available = asset.status === 'READY' && !detail.isError;
    const credit = [asset.authorName, asset.license, asset.sourceUrl].filter(Boolean).join('\n');
    async function copyCredit() {
        try {
            await navigator.clipboard.writeText(credit);
            toast.success('Đã sao chép thông tin ghi nguồn.');
        } catch {
            toast.error('Chưa sao chép được thông tin. Vui lòng thử lại.');
        }
    }
    const facts = [
        { label: 'Định dạng', value: asset.format.toUpperCase() },
        { label: 'Dung lượng', value: formatBytes(asset.sizeBytes) },
        ...(asset.meta.width && asset.meta.height
            ? [
                  {
                      label: 'Kích thước',
                      value: `${asset.meta.width.toLocaleString('vi-VN')} × ${asset.meta.height.toLocaleString('vi-VN')} px`,
                  },
              ]
            : []),
        ...(asset.meta.durationSec !== undefined
            ? [{ label: 'Thời lượng', value: assetDuration(asset.meta.durationSec) }]
            : []),
        ...(asset.type === 'MODEL' && asset.meta.animations?.length
            ? [{ label: 'Hoạt ảnh', value: `${asset.meta.animations.length} chuyển động` }]
            : []),
    ];
    return (
        <>
            <NavigationGuard
                dirty={writeState.dirty}
                saving={writeState.saving}
                title="Bỏ thay đổi thông tin tài nguyên?"
                dirtyDescription="Thông tin tài nguyên chưa được lưu. Rời trang sẽ bỏ các thay đổi đang nhập."
            />
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) leave('close');
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        if (opener.current?.isConnected)
                            opener.current.focus({ preventScroll: true });
                    }}
                    onEscapeKeyDown={(event) => {
                        if (writeState.saving || removing) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                        if (writeState.saving || removing) event.preventDefault();
                    }}
                    className="flex h-[min(760px,calc(100dvh-32px))] max-w-[min(1120px,calc(100vw-32px))] flex-col overflow-hidden p-0"
                >
                    <header className="flex shrink-0 items-center gap-4 border-border border-b px-5 py-4 sm:px-6">
                        <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <DialogHeader className="min-w-0 flex-1 gap-1">
                            <DialogTitle className="m-0 line-clamp-2 break-words">
                                {asset.name}
                            </DialogTitle>
                            <DialogDescription>{assetTypeLabels[asset.type]}</DialogDescription>
                        </DialogHeader>
                        <Badge
                            className="max-sm:hidden"
                            tone={
                                asset.status === 'READY'
                                    ? 'success'
                                    : asset.status === 'FAILED'
                                      ? 'danger'
                                      : 'warning'
                            }
                        >
                            {assetStatusLabels[asset.status]}
                        </Badge>
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Đóng"
                                disabled={writeState.saving}
                            >
                                <X />
                            </Button>
                        </DialogClose>
                    </header>
                    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,1fr)_minmax(0,0.8fr)] md:grid-cols-[minmax(0,1fr)_300px] md:grid-rows-[minmax(0,1fr)]">
                        <section
                            aria-label="Xem trước tài nguyên"
                            className="min-h-0 min-w-0 overflow-hidden bg-background"
                        >
                            {detail.isError ? (
                                <AssetPreviewState
                                    title="Chưa tải được tài nguyên"
                                    description={errorMessage(detail.error)}
                                    retry={() => void detail.refetch()}
                                />
                            ) : asset.status === 'PROCESSING' ? (
                                <AssetPreviewState
                                    title="Tài nguyên đang được xử lý"
                                    description="Phần xem trước sẽ tự cập nhật khi tài nguyên sẵn sàng."
                                    processing
                                />
                            ) : asset.status === 'FAILED' ? (
                                <AssetPreviewState
                                    title="Chưa xử lý được tài nguyên"
                                    description={
                                        asset.error ||
                                        'Tệp này hiện chưa sẵn sàng. Vui lòng chọn tài nguyên khác.'
                                    }
                                />
                            ) : (
                                <AssetFilePreview key={`${asset.id}:${asset.url}`} asset={asset} />
                            )}
                        </section>
                        <aside
                            aria-label="Thông tin tài nguyên"
                            className="flex min-h-0 flex-col gap-5 overflow-y-auto border-border border-t p-5 md:border-t-0 md:border-l md:p-6"
                        >
                            <Tabs
                                value={editing ? 'edit' : 'info'}
                                onValueChange={(value) => {
                                    if (value === 'edit' && canEdit) setEditing(true);
                                    else if (value === 'info') leave('info');
                                }}
                                className="gap-5"
                            >
                                <TabsList variant="line" aria-label="Thông tin tài nguyên cá nhân">
                                    <TabsTrigger ref={infoTab} value="info" className="flex-none">
                                        Thông tin
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="edit"
                                        className="flex-none"
                                        disabled={!canEdit || writeState.saving}
                                    >
                                        Chỉnh sửa
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="info" className="flex flex-col gap-6">
                                    <section className="flex flex-col gap-4">
                                        <h2 className="m-0 font-semibold text-sm">
                                            Thông tin tài nguyên
                                        </h2>
                                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
                                            {facts.map(({ label, value }) => (
                                                <div key={label} className="contents">
                                                    <dt className="text-muted-foreground">
                                                        {label}
                                                    </dt>
                                                    <dd className="break-words text-right tabular-nums">
                                                        {value}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </section>
                                    {credit && (
                                        <>
                                            <Separator />
                                            <section className="flex flex-col gap-4">
                                                <h2 className="m-0 font-semibold text-sm">
                                                    Nguồn và giấy phép
                                                </h2>
                                                <dl className="flex flex-col gap-4 text-sm">
                                                    {asset.authorName && (
                                                        <div className="flex flex-col gap-1">
                                                            <dt className="text-muted-foreground">
                                                                Tác giả
                                                            </dt>
                                                            <dd className="break-words">
                                                                {asset.authorName}
                                                            </dd>
                                                        </div>
                                                    )}
                                                    {asset.license && (
                                                        <div className="flex flex-col gap-1">
                                                            <dt className="text-muted-foreground">
                                                                Giấy phép
                                                            </dt>
                                                            <dd className="break-words">
                                                                {asset.license}
                                                            </dd>
                                                        </div>
                                                    )}
                                                </dl>
                                                {asset.sourceUrl && (
                                                    <Button
                                                        variant="link"
                                                        className="h-auto justify-start p-0"
                                                        asChild
                                                    >
                                                        <a
                                                            href={asset.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Xem nguồn tài nguyên
                                                            <ExternalLink data-icon="inline-end" />
                                                        </a>
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => void copyCredit()}
                                                >
                                                    <Copy data-icon="inline-start" />
                                                    Sao chép ghi nguồn
                                                </Button>
                                            </section>
                                        </>
                                    )}
                                    {asset.tags.length > 0 && (
                                        <section className="flex flex-col gap-3">
                                            <h2 className="m-0 font-semibold text-sm">Nhãn</h2>
                                            <div className="flex flex-wrap gap-2">
                                                {asset.tags.map((tag) => (
                                                    <TagBadge
                                                        key={tag}
                                                        variant="outline"
                                                        className="max-w-full whitespace-normal break-words"
                                                    >
                                                        {tag}
                                                    </TagBadge>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    <Separator />
                                    <section className="flex flex-col gap-3">
                                        <h2 className="m-0 font-semibold text-sm">Đang sử dụng</h2>
                                        {usages.isPending ? (
                                            <p className="text-muted-foreground text-sm">
                                                Đang kiểm tra…
                                            </p>
                                        ) : usages.isError ? (
                                            <Button
                                                variant="link"
                                                className="h-auto justify-start p-0"
                                                onClick={() => void usages.refetch()}
                                            >
                                                Thử tải lại thông tin sử dụng
                                            </Button>
                                        ) : usages.data?.length ? (
                                            <>
                                                <p className="text-muted-foreground text-sm">
                                                    Được dùng trong {usages.data.length} trang sách.
                                                </p>
                                                <ul className="flex list-none flex-col gap-2 p-0 text-sm">
                                                    {usages.data.slice(0, 3).map((usage) => (
                                                        <li
                                                            key={`${usage.bookId}:${usage.pageId}`}
                                                            className="break-words"
                                                        >
                                                            {usage.bookTitle} — Trang{' '}
                                                            {usage.pageNumber}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        ) : (
                                            <p className="text-muted-foreground text-sm">
                                                Chưa được dùng trong sách nào.
                                            </p>
                                        )}
                                    </section>
                                </TabsContent>
                                <TabsContent value="edit">
                                    {editing && canEdit && (
                                        <AssetMetadataEditor
                                            key={asset.id}
                                            asset={asset}
                                            formId={formId}
                                            formRef={form}
                                            onStateChange={syncWriteState}
                                            onSaved={() => {
                                                setWriteState({ dirty: false, saving: false });
                                                setEditing(false);
                                            }}
                                        />
                                    )}
                                </TabsContent>
                            </Tabs>
                        </aside>
                    </div>
                    <footer className="flex shrink-0 items-center justify-between gap-3 border-border border-t px-5 py-4 sm:px-6">
                        <Button
                            ref={deleteButton}
                            variant="destructive-ghost"
                            disabled={
                                !owned ||
                                asset.status === 'PROCESSING' ||
                                detail.isError ||
                                writeState.dirty ||
                                writeState.saving
                            }
                            onClick={() => setRemoving(true)}
                        >
                            <Trash2 data-icon="inline-start" />
                            Xóa tài nguyên
                        </Button>
                        <div className="flex items-center gap-3">
                            {editing ? (
                                <>
                                    <Button
                                        variant="outline"
                                        disabled={writeState.saving}
                                        onClick={() => leave('info')}
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        type="submit"
                                        form={formId}
                                        disabled={
                                            !writeState.dirty || writeState.saving || !canEdit
                                        }
                                    >
                                        {writeState.saving ? (
                                            <Spinner />
                                        ) : (
                                            <Save data-icon="inline-start" />
                                        )}
                                        {writeState.saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <DialogClose asChild>
                                        <Button variant="outline">Đóng</Button>
                                    </DialogClose>
                                    {available ? (
                                        <Button asChild>
                                            <a
                                                href={asset.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <ExternalLink data-icon="inline-start" />
                                                Mở tệp gốc
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button disabled>
                                            <ExternalLink data-icon="inline-start" />
                                            Mở tệp gốc
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
            {leaving && (
                <ConfirmationDialog
                    title="Bỏ thay đổi chưa lưu?"
                    description="Thông tin tài nguyên chưa được lưu. Bạn có thể tiếp tục chỉnh sửa hoặc bỏ các thay đổi vừa nhập."
                    busy={false}
                    onClose={() => setLeaving(null)}
                    returnFocus={() => {
                        if (discardedTo.current === 'close') return opener.current;
                        if (discardedTo.current === 'info') return infoTab.current;
                        return form.current?.querySelector('input') || infoTab.current;
                    }}
                >
                    <div className="mt-6 flex justify-end gap-3">
                        <AlertDialogCancel onClick={() => setLeaving(null)}>
                            Tiếp tục chỉnh sửa
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const target = leaving;
                                discardedTo.current = target;
                                setLeaving(null);
                                setWriteState({ dirty: false, saving: false });
                                if (target === 'close') onClose();
                                else setEditing(false);
                            }}
                        >
                            Bỏ thay đổi
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
            {removing && (
                <AssetDeleteDialog
                    asset={asset}
                    onClose={() => setRemoving(false)}
                    onRemoved={onClose}
                    returnFocus={deleteButton.current}
                />
            )}
        </>
    );
}
