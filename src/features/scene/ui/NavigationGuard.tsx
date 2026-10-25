import { useCallback } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button } from '../../../shared/ui/Button';

export function NavigationGuard({
    dirty,
    saving,
    title = 'Rời trang đang chỉnh sửa?',
    dirtyDescription = 'Bạn có thay đổi chưa lưu. Rời trang sẽ bỏ bản đang sửa trên trình duyệt.',
}: {
    dirty: boolean;
    saving: boolean;
    title?: string;
    dirtyDescription?: string;
}) {
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            (dirty || saving) && currentLocation.pathname !== nextLocation.pathname,
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
    return (
        <ConfirmationDialog
            description={
                saving
                    ? 'Đang lưu nội dung. Hãy đợi máy chủ phản hồi trước khi rời trang.'
                    : dirtyDescription
            }
            title={title}
            busy={saving}
            onClose={() => blocker.reset()}
        >
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
                        onClick={() => blocker.proceed()}
                    >
                        Rời trang
                    </Button>
                </AlertDialogAction>
            </div>
        </ConfirmationDialog>
    );
}
