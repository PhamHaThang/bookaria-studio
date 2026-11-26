import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { RetryNotice } from '@/shared/ui/RetryNotice';
import { useAuth } from '../auth';
import { adminApi, adminKeys } from './index';

function AdminGate({ actor, children }: { actor: string; children: ReactNode }) {
    const gate = useQuery({
        queryKey: adminKeys.dashboard(actor),
        queryFn: ({ signal }) => adminApi.dashboard(signal),
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
    });
    if (gate.isPending)
        return (
            <main id="main">
                <LoadingScreen fullScreen message="Đang kiểm tra quyền quản trị…" />
            </main>
        );
    if (gate.isError)
        return (
            <main id="main" className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 sm:py-16">
                <h1 className="mt-0 mb-4 font-semibold text-2xl tracking-tight">
                    Chưa mở được khu vực quản trị
                </h1>
                <RetryNotice
                    message={errorMessage(gate.error)}
                    label="Tải lại dữ liệu"
                    busy={gate.isFetching}
                    onRetry={() => void gate.refetch()}
                />
                <Link
                    className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    to="/books"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Về sách của tôi
                </Link>
            </main>
        );
    return children;
}

export function AdminAccess({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    if (user?.role !== 'ADMIN')
        return (
            <main id="main" className="mx-auto max-w-180 px-8 py-12">
                <h1>Bạn không có quyền quản trị</h1>
                <p>Khu vực này dành cho quản trị viên.</p>
                <Link to="/books">Về sách của tôi</Link>
            </main>
        );
    return (
        <AdminGate key={user.id} actor={user.id}>
            {children}
        </AdminGate>
    );
}
