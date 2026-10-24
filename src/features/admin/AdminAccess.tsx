import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import { Feedback } from '@/shared/ui/Feedback';
import { useAuth } from '../auth';
import { adminApi, adminKeys } from './index';
import { AdminReload } from './ui';

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
            <main id="main" className="mx-auto max-w-180 px-8 py-12" role="status">
                Đang kiểm tra quyền quản trị…
            </main>
        );
    if (gate.isError)
        return (
            <main id="main" className="mx-auto max-w-180 px-8 py-12">
                <h1>Chưa mở được khu vực quản trị</h1>
                <Feedback error={errorMessage(gate.error)} />
                <AdminReload retry={() => void gate.refetch()} busy={gate.isFetching} />
                <p>
                    <Link to="/books">Về sách của tôi</Link>
                </p>
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
