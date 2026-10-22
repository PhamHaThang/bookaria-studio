import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../shared/api/errors';
import { Pagination } from '../../shared/ui/Pagination';
import { auth } from '../auth';
import { adminKeys } from './model';

export function useAdminAction() {
    const cache = useQueryClient();
    const lock = useRef(false),
        alive = useRef(true);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState<string | null>(null),
        [uncertain, setUncertain] = useState(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    async function run<T>(task: () => Promise<T>, success: (result: T) => void) {
        if (lock.current || uncertain) return;
        lock.current = true;
        setBusy(true);
        setError(null);
        const actor = auth.store.getState().user?.id;
        const active = () => alive.current && actor === auth.store.getState().user?.id;
        try {
            const result = await task();
            if (!active()) return;
            success(result);
            // Refresh the admin permission gate as well as affected lists/details.
            await cache.invalidateQueries({ queryKey: adminKeys.all(actor || '') });
        } catch (cause) {
            if (active()) {
                setError(
                    `${errorMessage(cause)} Tải lại trang để kiểm tra trạng thái trước khi gửi tiếp.`,
                );
                setUncertain(true);
            }
        } finally {
            lock.current = false;
            if (alive.current) setBusy(false);
        }
    }
    return { busy, error, uncertain, run };
}
export function AdminReload({ retry, busy = false }: { retry: () => void; busy?: boolean }) {
    return (
        <button className="button secondary compact" type="button" disabled={busy} onClick={retry}>
            Tải lại dữ liệu
        </button>
    );
}
export function AdminPager({ page, meta }: { page: number; meta: { totalPages: number } }) {
    const [, setParams] = useSearchParams();
    const change = (nextPage: number, replace = false) =>
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.set('page', String(nextPage));
                return next;
            },
            { replace },
        );
    // Only mount this component for a successful response.
    useEffect(() => {
        if (page > Math.max(1, meta.totalPages))
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.set('page', String(Math.max(1, meta.totalPages)));
                    return next;
                },
                { replace: true },
            );
    }, [page, meta.totalPages, setParams]);
    return (
        <Pagination
            page={page}
            totalPages={meta.totalPages}
            label="Phân trang quản trị"
            onPage={change}
        />
    );
}
export function AdminTable({ label, children }: { label: string; children: ReactNode }) {
    return (
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Labelled scroll region needs keyboard access on narrow screens.
        <section className="stats-table-scroll admin-table" aria-label={label} tabIndex={0}>
            {children}
        </section>
    );
}
