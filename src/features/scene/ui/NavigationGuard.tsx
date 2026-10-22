import { useCallback } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';

export function NavigationGuard({ dirty, saving }: { dirty: boolean; saving: boolean }) {
    const blocker = useBlocker(dirty || saving);
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
        <ConfirmDialog
            title="Rời trang đang chỉnh sửa?"
            busy={saving}
            onClose={() => blocker.reset()}
        >
            <p>
                {saving
                    ? 'Đang lưu nội dung. Hãy đợi máy chủ phản hồi trước khi rời trang.'
                    : 'Bạn có thay đổi chưa lưu. Rời trang sẽ bỏ bản đang sửa trên trình duyệt.'}
            </p>
            <div className="form-actions">
                <Button variant="secondary" disabled={saving} onClick={() => blocker.reset()}>
                    Ở lại chỉnh sửa
                </Button>
                <Button variant="danger" disabled={saving} onClick={() => blocker.proceed()}>
                    Rời trang
                </Button>
            </div>
        </ConfirmDialog>
    );
}
