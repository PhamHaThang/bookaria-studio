import { Box, Image as ImageIcon, Music2, Video, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AssetType } from '@/shared/contracts/enums.schema';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { AssetUploadView } from '../../scene/ui/AssetUploadView';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';

const types = [
    { value: 'IMAGE', label: 'Hình ảnh', icon: ImageIcon },
    { value: 'MODEL', label: 'Mô hình 3D', icon: Box },
    { value: 'AUDIO', label: 'Âm thanh', icon: Music2 },
    { value: 'VIDEO', label: 'Video', icon: Video },
] as const;

export function AssetUploadDialog({ backTo = '/assets' }: { backTo?: '/assets' | '/studio' }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const returnSearch = useRef(search).current;
    const [type, setType] = useState<AssetType>(() => {
        const selected = new URLSearchParams(search).get('type');
        return types.find((item) => item.value === selected)?.value || 'IMAGE';
    });
    const [busy, setBusy] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [nextType, setNextType] = useState<AssetType | null>(null);
    const [uploaded, setUploaded] = useState<{ processing: boolean } | null>(null);
    const finished = useRef(false);
    const complete = useCallback((processing: boolean) => {
        setUploaded({ processing });
    }, []);

    useEffect(() => {
        if (!uploaded || busy || finished.current) return;
        finished.current = true;
        toast.success(
            uploaded.processing
                ? 'Đã tải lên. Tài nguyên đang được xử lý.'
                : 'Đã thêm tài nguyên của bạn.',
        );
        // Show the new personal asset rather than returning to filters that hide it.
        navigate('/assets', { replace: true });
    }, [uploaded, busy, navigate]);

    function close() {
        if (busy) {
            toast.info('Hãy đợi tải xong hoặc bấm Dừng tải trước khi đóng.', {
                id: 'asset-upload-busy',
            });
            return;
        }
        navigate(
            { pathname: backTo, search: backTo === '/assets' ? returnSearch : '' },
            { replace: true },
        );
    }

    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex h-[min(760px,calc(100dvh-48px))] max-w-[min(1100px,calc(100vw-48px))] flex-col overflow-hidden p-0"
                    onInteractOutside={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        requestAnimationFrame(() => {
                            document
                                .querySelector<HTMLAnchorElement>(`a[href^="${pathname}"]`)
                                ?.focus({ preventScroll: true });
                        });
                    }}
                >
                    <div className="flex shrink-0 items-start justify-between gap-6 border-border border-b px-6 py-5">
                        <DialogHeader>
                            <DialogTitle size="lg" className="m-0">
                                Tải tài nguyên
                            </DialogTitle>
                            <DialogDescription className="m-0">
                                Chọn loại tệp, xem trước và thêm vào tài nguyên của bạn.
                            </DialogDescription>
                        </DialogHeader>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Đóng tải tài nguyên"
                            onClick={close}
                        >
                            <X />
                        </Button>
                    </div>
                    <Tabs
                        activationMode="manual"
                        value={type}
                        onValueChange={(value) => {
                            if (busy || value === type) return;
                            if (dirty) setNextType(value as AssetType);
                            else setType(value as AssetType);
                        }}
                        className="min-h-0 flex-1 gap-0"
                    >
                        <div className="shrink-0 px-6 pt-4">
                            <TabsList aria-label="Loại tài nguyên tải lên">
                                {types.map(({ value, label, icon: Icon }) => (
                                    <TabsTrigger key={value} value={value} disabled={busy}>
                                        <Icon aria-hidden="true" />
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value={type} className="flex min-h-0 flex-1 flex-col">
                            <AssetUploadView
                                key={type}
                                type={type}
                                pending={false}
                                onChoose={() => {}}
                                onBack={close}
                                onBusyChange={setBusy}
                                onDirtyChange={setDirty}
                                onUploaded={complete}
                            />
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            <NavigationGuard
                dirty={dirty && !uploaded}
                saving={busy && !uploaded}
                allowBookNavigation={false}
                title="Đóng tải tài nguyên?"
                dirtyDescription="Tệp đang chọn chưa được thêm vào tài nguyên. Đóng cửa sổ sẽ bỏ lựa chọn này."
            />
            {nextType && (
                <ConfirmationDialog
                    title="Đổi loại tài nguyên?"
                    description="Tệp đang chọn chưa được tải lên. Đổi loại sẽ bỏ lựa chọn hiện tại."
                    busy={false}
                    onClose={() => setNextType(null)}
                >
                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setNextType(null)}>
                            Giữ tệp hiện tại
                        </Button>
                        <Button
                            onClick={() => {
                                setType(nextType);
                                setNextType(null);
                                setDirty(false);
                            }}
                        >
                            Đổi loại
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
