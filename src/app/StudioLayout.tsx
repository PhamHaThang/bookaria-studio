import { ChartColumn, FolderOpen, LayoutDashboard, Library, Trash2 } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
import { getStudioSection } from './studio-navigation';

const destinations = [
    { to: '/studio', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/books', label: 'Sách của tôi', icon: Library },
    { to: '/assets', label: 'Tài nguyên', icon: FolderOpen },
    { to: '/stats', label: 'Thống kê', icon: ChartColumn },
    { to: '/books/trash', label: 'Thùng rác', icon: Trash2 },
];

const activeNavClass =
    'hover:bg-surface-dark hover:text-on-dark active:bg-surface-dark active:text-on-dark data-[active=true]:bg-surface-dark data-[active=true]:text-on-dark data-[active=true]:hover:bg-surface-dark data-[active=true]:hover:text-on-dark';
const navButtonClass = cn(
    'h-11 justify-center px-2 xl:justify-start xl:gap-3 xl:px-3 [&_svg]:size-5',
    activeNavClass,
);
const mobileTabClass =
    'flex size-12 items-center justify-center rounded-xl p-0 text-muted-foreground transition-none hover:bg-muted hover:text-foreground data-[active=true]:bg-surface-dark data-[active=true]:text-on-dark data-[active=true]:hover:bg-surface-dark data-[active=true]:hover:text-on-dark [&_svg]:size-[22px] [&_svg]:stroke-[1.8]';

function StudioMobileNavigation({ activeSection }: { activeSection: string | null }) {
    return (
        <nav
            aria-label="Điều hướng Studio dưới"
            data-slot="studio-bottom-navigation"
            className="fixed inset-x-0 bottom-0 z-30 border-border border-t bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
            <div
                data-slot="studio-bottom-tabs"
                className="mx-auto grid h-16 w-full max-w-[640px] grid-cols-5 place-items-center gap-1 px-2"
            >
                {destinations.map(({ to, label, icon: Icon }) => (
                    <Link
                        key={to}
                        to={to}
                        aria-label={label}
                        aria-current={activeSection === to ? 'page' : undefined}
                        data-active={activeSection === to}
                        className={mobileTabClass}
                    >
                        <Icon aria-hidden="true" />
                    </Link>
                ))}
            </div>
        </nav>
    );
}

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
            className="studio-shell mx-auto mt-6 w-[calc(100%-32px)] max-w-[1280px] gap-6 [--sidebar-width:2.75rem] sm:w-[calc(100%-64px)] xl:mt-9 xl:w-[calc(100%-48px)] xl:gap-7 xl:[--sidebar-width:14rem]"
        >
            <Sidebar
                collapsible="none"
                className="sticky top-[calc(var(--public-header-space,72px)+16px)] hidden h-auto max-h-[calc(100dvh-var(--public-header-space,72px)-32px)] w-11 shrink-0 gap-4 self-start bg-transparent p-0 sm:flex xl:w-56 xl:px-1"
            >
                <SidebarContent>
                    <nav aria-label="Điều hướng Studio">
                        <SidebarMenu className="gap-1.5">
                            {destinations.map(({ to, label, icon: Icon }) => {
                                const active = activeSection === to;
                                return (
                                    <SidebarMenuItem key={to}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={active}
                                                    className={navButtonClass}
                                                >
                                                    <Link
                                                        to={to}
                                                        aria-current={active ? 'page' : undefined}
                                                    >
                                                        <Icon aria-hidden="true" />
                                                        <span className="sr-only xl:not-sr-only">
                                                            {label}
                                                        </span>
                                                    </Link>
                                                </SidebarMenuButton>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side="right"
                                                sideOffset={8}
                                                className="hidden sm:inline-flex xl:hidden"
                                            >
                                                {label}
                                            </TooltipContent>
                                        </Tooltip>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </nav>
                </SidebarContent>
                <SidebarFooter className="hidden shrink-0 p-0 xl:flex">
                    <StudioStorageUsage />
                </SidebarFooter>
            </Sidebar>
            <main
                id="main"
                tabIndex={-1}
                className="studio-main min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none sm:pb-16"
            >
                <div data-slot="studio-storage-summary" className="mb-6 xl:hidden">
                    <StudioStorageUsage />
                </div>
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
            <StudioMobileNavigation activeSection={activeSection} />
        </SidebarProvider>
    );
}
