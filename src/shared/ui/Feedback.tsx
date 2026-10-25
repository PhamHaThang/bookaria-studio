import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';
import { Alert } from './Alert';

export function Feedback({
    error,
    success,
    warning,
    successMode = 'toast',
}: {
    error?: string | null;
    success?: string | null;
    warning?: string | null;
    successMode?: 'toast' | 'inline';
}) {
    const id = useId();
    const shown = useRef<string | null>(null);
    useEffect(() => {
        if (error) toast.dismiss(id);
        if (!success) {
            shown.current = null;
            return;
        }
        if (shown.current === success) return;
        shown.current = success;
        if (successMode === 'toast' && !error) toast.success(success, { id, duration: 4000 });
    }, [success, error, successMode, id]);
    return (
        <>
            {error && <Alert tone="danger">{error}</Alert>}
            {warning && <Alert tone="warning">{warning}</Alert>}
            {success && successMode === 'inline' && <Alert tone="success">{success}</Alert>}
        </>
    );
}
