import { type ReactNode, useEffect, useId, useRef } from 'react';

export function ConfirmDialog({
    title,
    children,
    busy,
    onClose,
}: {
    title: string;
    children: ReactNode;
    busy: boolean;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();
    useEffect(() => {
        if (dialog.current && !dialog.current.open) dialog.current.showModal();
    }, []);
    return (
        <dialog
            className="confirm-dialog"
            ref={dialog}
            aria-labelledby={id}
            onCancel={(event) => {
                if (busy) event.preventDefault();
            }}
            onClose={onClose}
        >
            <h2 id={id}>{title}</h2>
            {children}
        </dialog>
    );
}
