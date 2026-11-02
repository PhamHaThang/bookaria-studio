import { ChartColumn, FolderOpen, Home, Library, Palette, Trash2 } from 'lucide-react';
import { type CSSProperties, Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { StudioStorageUsage } from '@/features/profile/ui/StudioStorageUsage';
import { Alert } from '@/shared/ui/Alert';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { Separator } from '@/shared/ui/primitives/separator';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from '@/shared/ui/primitives/sidebar';
import { useAuth } from '../features/auth';
import { AuthDialogLink } from '../features/auth/ui/AuthDialogLink';
import { BookariaLogo, bookariaLogoLinkStyles } from '../shared/ui/BookariaLogo';
import { HeaderAccountActions } from './HeaderAccountActions';

export function StudioLayout() {
    const location = useLocation();
    const inTrash =
        location.pathname === '/books/trash' || location.pathname.startsWith('/books/trash/');
    const editing = /^\/books\/[^/]+\/(?:pages\/[^/]+|edit)$/.test(location.pathname);
    const { user } = useAuth();
    if (editing)
        return (
            <main id="main" className="studio-editor-root min-h-[100dvh] bg-surface">
                <Suspense fallback={<LoadingScreen fullScreen message="Đang mở editor…" />}>
                    <Outlet />
                </Suspense>
            </main>
        );
    return (
        <div
            className={
                editing
                    ? 'studio-editing studio-shell min-h-[100dvh] [&_::-webkit-scrollbar-thumb]:rounded-[8px] [&_::-webkit-scrollbar-thumb]:border-[2px] [&_::-webkit-scrollbar-thumb]:border-surface [&_::-webkit-scrollbar-thumb]:border-solid [&_::-webkit-scrollbar-thumb]:bg-input [&_::-webkit-scrollbar-track]:bg-surface [&_::-webkit-scrollbar]:size-2'
                    : 'studio-shell min-h-[100dvh] [&_::-webkit-scrollbar-thumb]:rounded-[8px] [&_::-webkit-scrollbar-thumb]:border-[2px] [&_::-webkit-scrollbar-thumb]:border-surface [&_::-webkit-scrollbar-thumb]:border-solid [&_::-webkit-scrollbar-thumb]:bg-input [&_::-webkit-scrollbar-track]:bg-surface [&_::-webkit-scrollbar]:size-2'
            }
        >
            <header className="studio-topbar sticky top-0 z-20 flex h-16 min-h-16 items-center justify-between gap-6 border-border border-b bg-surface pr-8">
                <Link
                    className={bookariaLogoLinkStyles(
                        'brand inline-flex min-h-16 w-[222px] shrink-0 items-center gap-3 border-border border-r px-6 text-foreground no-underline [&_.bookaria-logo]:w-28 [&_span]:border-border [&_span]:border-l [&_span]:pl-3 [&_span]:text-muted-foreground [&_span]:text-xs',
                    )}
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                >
                    <BookariaLogo />
                    <span>Studio</span>
                </Link>
                <div className="ml-auto flex items-center gap-6">
                    <StudioStorageUsage />
                    <HeaderAccountActions />
                </div>
            </header>
            <SidebarProvider
                className="studio-body min-h-[calc(100dvh-64px)]"
                style={{ '--sidebar-width': '222px' } as CSSProperties}
            >
                <Sidebar
                    collapsible="none"
                    className="sticky top-16 h-[calc(100dvh-64px)] shrink-0 self-start border-border border-r px-3 py-6"
                >
                    <SidebarContent>
                        <SidebarGroup className="p-0">
                            <SidebarGroupContent>
                                <nav aria-label="Điều hướng Studio">
                                    <SidebarMenu>
                                        {[
                                            { to: '/books', label: 'Sách của tôi', icon: Library },
                                            {
                                                to: '/assets',
                                                label: 'Tài nguyên',
                                                icon: FolderOpen,
                                            },
                                            { to: '/stats', label: 'Thống kê', icon: ChartColumn },
                                            {
                                                to: '/books/trash',
                                                label: 'Thùng rác',
                                                icon: Trash2,
                                            },
                                            ...(import.meta.env.DEV
                                                ? [
                                                      {
                                                          to: '/style-guide',
                                                          label: 'Giao diện mẫu',
                                                          icon: Palette,
                                                      },
                                                  ]
                                                : []),
                                        ].map(({ to, label, icon: Icon }) => (
                                            <SidebarMenuItem key={to}>
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={
                                                        location.pathname === to ||
                                                        (location.pathname.startsWith(`${to}/`) &&
                                                            (to !== '/books' || !inTrash))
                                                    }
                                                >
                                                    <NavLink
                                                        to={to}
                                                        end={to === '/books' && inTrash}
                                                    >
                                                        <Icon aria-hidden="true" />
                                                        <span>{label}</span>
                                                    </NavLink>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        ))}
                                    </SidebarMenu>
                                </nav>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter className="mt-auto border-border border-t px-0 pt-4">
                        <nav aria-label="Rời Studio">
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton asChild>
                                        <Link to="/">
                                            <Home aria-hidden="true" />
                                            <span>Về trang chủ</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </nav>
                    </SidebarFooter>
                </Sidebar>
                <main id="main" className="studio-main min-w-0 flex-1 px-10 pt-10 pb-16">
                    {!user?.emailVerified && (
                        <Alert tone="info" className="mb-8">
                            <div className="flex items-center justify-between gap-4">
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
        </div>
    );
}
