import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/shared/ui/primitives/alert-dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';

type Intent = { label: string; action: () => void };

/** Resume only after successful saves have committed and the editor is clean. */
export function useSaveBeforeAction({
    dirty,
    blocked,
    save,
}: {
    dirty: boolean;
    blocked: boolean;
    save: () => Promise<string | null>;
}) {
    const [intent, setIntent] = useState<Intent | null>(null);
    const [phase, setPhase] = useState<'prompt' | 'saving' | 'ready'>('prompt');
    const [error, setError] = useState<string | null>(null);
    const pending = useRef<Intent | null>(null);
    const saving = useRef(false);
    const continuing = useRef(false);
    const opener = useRef<HTMLElement | null>(null);
    const latest = useRef({ dirty, blocked, save });
    latest.current = { dirty, blocked, save };
    useEffect(
        () => () => {
            pending.current = null;
        },
        [],
    );

    function request(label: string, action: () => void, returnFocus?: HTMLElement | null) {
        if (latest.current.blocked || pending.current) return;
        if (!latest.current.dirty) {
            action();
            return;
        }
        opener.current =
            returnFocus ??
            (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const next = { label, action };
        pending.current = next;
        continuing.current = false;
        setError(null);
        setPhase('prompt');
        setIntent(next);
    }
    function cancel() {
        if (saving.current) return;
        pending.current = null;
        setIntent(null);
    }
    async function confirm() {
        const attempt = pending.current;
        if (!attempt || saving.current || latest.current.blocked) return;
        saving.current = true;
        setPhase('saving');
        setError(null);
        let problem: string | null;
        try {
            problem = await latest.current.save();
        } catch {
            problem = 'Chưa lưu được thay đổi. Vui lòng thử lại.';
        }
        saving.current = false;
        if (pending.current !== attempt) return;
        if (problem) {
            setError(problem);
            setPhase('prompt');
        } else setPhase('ready');
    }
    useEffect(() => {
        if (phase !== 'ready' || blocked || !pending.current) return;
        if (dirty) {
            setError('Trang vẫn còn thay đổi chưa lưu. Vui lòng lưu lại để tiếp tục.');
            setPhase('prompt');
            return;
        }
        const next = pending.current;
        pending.current = null;
        continuing.current = true;
        setIntent(null);
        setPhase('prompt');
        next.action();
    }, [phase, dirty, blocked]);

    const busy = phase !== 'prompt';
    const dialog = intent && (
        <AlertDialog
            open
            onOpenChange={(open) => {
                if (!open) cancel();
            }}
        >
            <AlertDialogContent
                className="gap-5 p-6"
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
                onCloseAutoFocus={(event) => {
                    // Let the resumed dialog or destination take focus.
                    if (continuing.current) event.preventDefault();
                    else if (opener.current?.isConnected) {
                        event.preventDefault();
                        opener.current.focus({ preventScroll: true });
                    }
                }}
            >
                <AlertDialogHeader className="gap-2">
                    <AlertDialogTitle>Lưu thay đổi trước khi tiếp tục?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Trang hiện tại có thay đổi chưa lưu. Lưu trang để tiếp tục thao tác “
                        {intent.label}”.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error && (
                    <p role="alert" className="m-0 text-destructive text-sm">
                        {error}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="outline" disabled={busy} onClick={cancel}>
                        Hủy
                    </Button>
                    <Button
                        disabled={busy || blocked}
                        aria-busy={busy}
                        onClick={() => void confirm()}
                    >
                        {busy && <Spinner aria-hidden="true" data-icon="inline-start" />}
                        {busy ? 'Đang lưu…' : 'Lưu và tiếp tục'}
                    </Button>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
    return { request, dialog };
}
