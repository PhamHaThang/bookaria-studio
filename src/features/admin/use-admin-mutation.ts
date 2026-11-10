import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { ContractError } from '../../shared/api/contract';
import { errorMessage } from '../../shared/api/errors';
import { auth } from '../auth';
import { adminKeys } from './model';

type Options<TData, TVariables> = {
    mutationFn: (variables: TVariables) => Promise<TData>;
    onSuccess?: (data: TData) => void;
    onError?: (error: unknown) => void;
};

/** Keep modal writes single-shot and scoped to the administrator who submitted them. */
export function useAdminMutation<TData, TVariables = void>(options: Options<TData, TVariables>) {
    const cache = useQueryClient();
    const lock = useRef(false);
    const alive = useRef(true);
    const blocked = useRef<{ actor: string; error: Error } | null>(null);
    const [isPending, setPending] = useState(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const mutate = (variables?: TVariables) => {
        if (lock.current) return;
        const actor = auth.store.getState().user?.id;
        if (!actor) return;
        if (blocked.current?.actor === actor) {
            options.onError?.(blocked.current.error);
            return;
        }
        blocked.current = null;
        lock.current = true;
        setPending(true);
        const active = () => alive.current && auth.store.getState().user?.id === actor;
        void (async () => {
            try {
                const result = await options.mutationFn(variables as TVariables);
                if (!active()) return;
                options.onSuccess?.(result);
                await cache.invalidateQueries({ queryKey: adminKeys.all(actor) });
            } catch (cause) {
                if (!active()) return;
                // Local form validation can be corrected. A sent write must be checked before retry.
                if (isAxiosError(cause) || cause instanceof ContractError) {
                    const error = new Error(
                        `${errorMessage(cause)} Tải lại trang để kiểm tra trạng thái trước khi gửi tiếp.`,
                    );
                    blocked.current = { actor, error };
                    options.onError?.(error);
                } else options.onError?.(cause);
            } finally {
                lock.current = false;
                if (alive.current) setPending(false);
            }
        })();
    };
    return { isPending, mutate };
}
