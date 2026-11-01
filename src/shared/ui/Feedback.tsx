import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';
import { Alert } from './Alert';

export function Feedback({
    error,
    success,
    warning,
    successMode = 'toast',
    errorMode = 'inline',
    warningMode = 'inline',
    className,
}: {
    error?: string | null;
    success?: string | null;
    warning?: string | null;
    successMode?: 'toast' | 'inline';
    errorMode?: 'toast' | 'inline';
    warningMode?: 'toast' | 'inline';
    className?: string;
}) {
    const id = useId();
    const shown = useRef<string | null>(null);
    useEffect(() => {
        const toastId = `${id}-error`;
        if (errorMode !== 'toast' || !error) return;
        toast.error(error, { id: toastId, duration: 6000 });
        return () => {
            toast.dismiss(toastId);
        };
    }, [error, errorMode, id]);
    useEffect(() => {
        const toastId = `${id}-warning`;
        if (warningMode !== 'toast' || !warning) return;
        toast.warning(warning, { id: toastId, duration: 6000 });
        return () => {
            toast.dismiss(toastId);
        };
    }, [warning, warningMode, id]);
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
            {error && errorMode === 'inline' && (
                <Alert tone="danger" className={className}>
                    {error}
                </Alert>
            )}
            {warning && warningMode === 'inline' && (
                <Alert tone="warning" className={className}>
                    {warning}
                </Alert>
            )}
            {success && successMode === 'inline' && (
                <Alert tone="success" className={className}>
                    {success}
                </Alert>
            )}
        </>
    );
}
