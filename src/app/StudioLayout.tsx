import { ChartColumn, FolderOpen, Library, Palette, Trash2 } from 'lucide-react';
import { Suspense, useRef } from 'react';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { StudioStorageUsage } from '@/features/profile/ui/StudioStorageUsage';
import { Alert } from '@/shared/ui/Alert';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { PublicHeader } from './PublicHeader';
import { getStudioSection } from './studio-navigation';

const destinations = [
    { to: '/books', label: 'Sách của tôi', icon: Library },
    { to: '/assets', label: 'Tài nguyên', icon: FolderOpen },
    { to: '/stats', label: 'Thống kê', icon: ChartColumn },
    { to: '/books/trash', label: 'Thùng rác', icon: Trash2 },
    ...(import.meta.env.DEV ? [{ to: '/style-guide', label: 'Giao diện mẫu', icon: Palette }] : []),
];

export function StudioLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const navigationTarget = useRef(pathname);
    navigationTarget.current = pathname;
    const navigateSection = (to: string) => {
        // Radix can activate through both pointer and focus in the same event.
        // Keep one history entry per section change.
        if (navigationTarget.current === to) return;
        navigationTarget.current = to;
        navigate(to);
    };
    const editing = Boolean(
        matchPath('/books/:bookId/edit', pathname) ||
            matchPath('/books/:bookId/pages/:pageId', pathname),
    );
    const activeSection = pathname === '/style-guide' ? '/style-guide' : getStudioSection(pathname);
    const { user } = useAuth();
    if (editing)
        return (
            <main id="main" className="studio-editor-root min-h-dvh bg-surface">
                <Suspense fallback={<LoadingScreen fullScreen message="Đang mở editor…" />}>
                    <Outlet />
                </Suspense>
            </main>
        );
    return (
        <div className="studio-shell flex min-h-dvh flex-col bg-background">
            <PublicHeader />
            <main
                id="main"
                className="studio-main mx-auto w-full min-w-0 max-w-[1328px] flex-1 px-6 pt-8 pb-16"
            >
                <Tabs
                    value={activeSection || '/books'}
                    onValueChange={navigateSection}
                    className="gap-8"
                >
                    <div
                        data-slot="studio-section-navigation"
                        className="flex items-center justify-between gap-6"
                    >
                        <TabsList aria-label="Điều hướng Studio">
                            {destinations.map(({ to, label, icon: Icon }) => (
                                <TabsTrigger
                                    key={to}
                                    value={to}
                                    onClick={() => {
                                        if (activeSection === to && pathname !== to)
                                            navigateSection(to);
                                    }}
                                >
                                    <Icon aria-hidden="true" />
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <div className="shrink-0 py-3">
                            <StudioStorageUsage />
                        </div>
                    </div>
                    <TabsContent value={activeSection || '/books'}>
                        {!user?.emailVerified && (
                            <Alert tone="info" className="mb-8">
                                <div className="flex items-center justify-between gap-4">
                                    <span>Xác minh email để có thể xuất bản sách.</span>
                                    <AuthDialogLink mode="check-email">
                                        Xác minh email
                                    </AuthDialogLink>
                                </div>
                            </Alert>
                        )}
                        <Suspense fallback={<LoadingScreen message="Đang mở trang…" />}>
                            <Outlet />
                        </Suspense>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
