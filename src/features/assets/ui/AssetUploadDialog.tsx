import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AssetType } from '@/shared/contracts/enums.schema';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { type AssetUploadCompletion, AssetUploadView } from '../../scene/ui/AssetUploadView';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';

const types = [
    { value: 'IMAGE', label: 'Hình ảnh' },
    { value: 'MODEL', label: 'Mô hình 3D' },
    { value: 'AUDIO', label: 'Âm thanh' },
    { value: 'VIDEO', label: 'Video' },
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
    const [uploaded, setUploaded] = useState<AssetUploadCompletion | null>(null);
    const finished = useRef(false);

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
            toast.info('Hãy đợi tệp xử lý xong trước khi đóng.', {
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
                    className="flex h-[min(760px,calc(100dvh-24px))] max-w-[min(1100px,calc(100vw-24px))] flex-col overflow-hidden p-0"
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
                    <div className="flex shrink-0 items-start justify-between gap-3 border-border border-b px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
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
                    <AssetUploadView
                        key={type}
                        type={type}
                        pending={false}
                        onChoose={() => {}}
                        onBack={close}
                        onBusyChange={setBusy}
                        onDirtyChange={setDirty}
                        onUploaded={setUploaded}
                        typeField={
                            <Field>
                                <FieldLabel htmlFor="asset-upload-type">Loại tài nguyên</FieldLabel>
                                <FormSelect
                                    id="asset-upload-type"
                                    value={type}
                                    options={types}
                                    disabled={busy}
                                    onValueChange={(value) => {
                                        const selected = types.find((item) => item.value === value);
                                        if (!selected || busy || selected.value === type) return;
                                        if (dirty) setNextType(selected.value);
                                        else setType(selected.value);
                                    }}
                                />
                            </Field>
                        }
                    />
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
                    returnFocus={() => document.getElementById('asset-upload-type')}
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
