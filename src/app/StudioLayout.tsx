import { ChartColumn, FolderOpen, LayoutDashboard, Library, Palette, Trash2 } from 'lucide-react';
import { Suspense } from 'react';
import { Link, matchPath, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { StudioStorageUsage } from '@/features/profile/ui/StudioStorageUsage';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from '@/shared/ui/primitives/sidebar';
import { getStudioSection } from './studio-navigation';

const destinations = [
    { to: '/studio', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/books', label: 'Sách của tôi', icon: Library },
    { to: '/assets', label: 'Tài nguyên', icon: FolderOpen },
    { to: '/stats', label: 'Thống kê', icon: ChartColumn },
    { to: '/books/trash', label: 'Thùng rác', icon: Trash2 },
    ...(import.meta.env.DEV ? [{ to: '/style-guide', label: 'Giao diện mẫu', icon: Palette }] : []),
];

const navButtonClass = 'h-10 justify-center px-2 md:justify-start md:gap-3 md:px-3';

export function StudioLayout() {
    const { pathname } = useLocation();
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
        <SidebarProvider
            data-stable-scroll-overlays
            className="studio-shell mx-auto mt-6 w-[calc(100%-16px)] max-w-[1280px] gap-3 [--sidebar-width:3.5rem] sm:w-[calc(100%-48px)] md:mt-9 md:gap-7 md:[--sidebar-width:13rem] xl:[--sidebar-width:14rem]"
        >
            <Sidebar
                collapsible="none"
                className="sticky top-32 h-auto max-h-[calc(100dvh-9rem)] w-14 shrink-0 gap-3 self-start bg-transparent p-1.5 md:w-52 md:gap-4 md:px-1 md:py-0 xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:w-56"
            >
                <SidebarContent>
                    <nav aria-label="Điều hướng Studio">
                        <SidebarMenu className="gap-1 md:gap-1.5">
                            {destinations.map(({ to, label, icon: Icon }) => {
                                const active = activeSection === to;
                                return (
                                    <SidebarMenuItem key={to}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={active}
                                            className={cn(
                                                navButtonClass,
                                                'hover:bg-surface-dark hover:text-on-dark active:bg-surface-dark active:text-on-dark data-[active=true]:bg-surface-dark data-[active=true]:text-on-dark data-[active=true]:hover:bg-surface-dark',
                                            )}
                                        >
                                            <Link
                                                to={to}
                                                aria-current={active ? 'page' : undefined}
                                            >
                                                <Icon aria-hidden="true" />
                                                <span className="sr-only md:not-sr-only">
                                                    {label}
                                                </span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </nav>
                </SidebarContent>
                <SidebarFooter className="hidden shrink-0 p-0 md:flex">
                    <StudioStorageUsage />
                </SidebarFooter>
            </Sidebar>
            <main id="main" tabIndex={-1} className="studio-main min-w-0 flex-1 pb-16 outline-none">
                {!user?.emailVerified && (
                    <Alert tone="info" className="mb-8">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <span>Xác minh email để có thể xuất bản sách.</span>
                            <AuthDialogLink mode="check-email">Xác minh email</AuthDialogLink>
                        </div>
                    </Alert>
                )}
                <Suspense fallback={<LoadingScreen message="Đang mở trang…" />}>
                    <Outlet />
                </Suspense>
            </main>
        </SidebarProvider>
    );
}
