import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/shared/api/errors';

export type AuthRequestProps = { locked: boolean; onPending: (delta: number) => void };

export function useAuthRequest({ locked, onPending }: AuthRequestProps) {
    const mounted = useRef(true);
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    async function run(task: () => Promise<unknown>, success: () => void) {
        if (pending.current || locked) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        onPending(1);
        try {
            await task();
            if (mounted.current) success();
        } catch (cause) {
            if (mounted.current) setError(errorMessage(cause));
        } finally {
            pending.current = false;
            onPending(-1);
            if (mounted.current) setBusy(false);
        }
    }
    return { run, error, setError, busy, disabled: busy || locked };
}
