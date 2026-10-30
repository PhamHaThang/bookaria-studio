import { useCallback, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button } from '../../../shared/ui/Button';
import { draftPagePath, useOptionalBookDraft } from '../../book-draft/ui/BookDraftProvider';

export function NavigationGuard({
    dirty,
    saving,
    title = 'Rời trang đang chỉnh sửa?',
    onSave,
    allowBookNavigation = true,
    dirtyDescription = 'Bạn có thay đổi chưa lưu. Rời trang sẽ bỏ bản đang sửa trên trình duyệt.',
}: {
    onSave?: () => Promise<boolean | string>;
    allowBookNavigation?: boolean;
    dirty: boolean;
    saving: boolean;
    title?: string;
    dirtyDescription?: string;
}) {
    const draft = useOptionalBookDraft();
    const [discarding, setDiscarding] = useState(false);
    const [savingHere, setSavingHere] = useState(false),
        [error, setError] = useState<string | null>(null);
    saving = saving || savingHere || discarding;
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            (dirty || saving) &&
            currentLocation.pathname !== nextLocation.pathname &&
            !(draft && allowBookNavigation && draftPagePath(draft.bookId, nextLocation.pathname)),
    );
    useBeforeUnload(
        useCallback(
            (event) => {
                if (dirty || saving) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            },
            [dirty, saving],
        ),
    );
    if (blocker.state !== 'blocked') return null;
    async function saveAndLeave() {
        setSavingHere(true);
        setError(null);
        try {
            const saved = onSave ? await onSave() : await draft?.save();
            if (typeof saved === 'string') setError(saved);
            else if (saved) blocker.proceed?.();
            else
                setError(
                    draft?.getSnapshot().error || 'Chưa lưu được thay đổi. Bản nháp vẫn được giữ.',
                );
        } finally {
            setSavingHere(false);
        }
    }
    async function discardAndLeave() {
        setDiscarding(true);
        setError(null);
        try {
            await draft?.abandon();
            blocker.proceed?.();
        } catch {
            setError('Chưa hoàn tất thao tác. Bản nháp vẫn được giữ để bạn thử lại.');
        } finally {
            setDiscarding(false);
        }
    }
    return (
        <ConfirmationDialog
            description={
                discarding
                    ? 'Đang hoàn tất thao tác trước khi rời trang…'
                    : saving
                      ? 'Đang lưu nội dung. Hãy đợi máy chủ phản hồi trước khi rời trang.'
                      : draft
                        ? 'Các trang và nội dung đang sửa chưa được lưu lên máy chủ.'
                        : dirtyDescription
            }
            title={draft ? 'Lưu sách trước khi rời?' : title}
            busy={saving}
            onClose={() => blocker.reset()}
        >
            <Feedback error={error} />
            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                <AlertDialogCancel variant="plain" asChild>
                    <Button variant="secondary" disabled={saving} onClick={() => blocker.reset()}>
                        Ở lại chỉnh sửa
                    </Button>
                </AlertDialogCancel>
                <AlertDialogAction
                    variant="plain"
                    asChild
                    onClick={(event) => event.preventDefault()}
                >
                    <Button
                        variant="destructive"
                        disabled={saving}
                        onClick={() => void discardAndLeave()}
                    >
                        {discarding ? 'Đang rời…' : draft ? 'Bỏ thay đổi' : 'Rời trang'}
                    </Button>
                </AlertDialogAction>
                {draft && (
                    <Button disabled={saving} onClick={() => void saveAndLeave()}>
                        {savingHere ? 'Đang lưu…' : 'Lưu và rời'}
                    </Button>
                )}
            </div>
        </ConfirmationDialog>
    );
}
