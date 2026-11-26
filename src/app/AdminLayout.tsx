import {
    BookOpen,
    Flag,
    LayoutDashboard,
    LibraryBig,
    ListTodo,
    ScanLine,
    ScrollText,
    Tags,
    UsersRound,
    X,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AdminAccess } from '@/features/admin/AdminAccess';
import { cn } from '@/shared/lib/cn';
import { BookariaLogo, bookariaLogoLinkStyles } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { LoadingBoundary } from '@/shared/ui/LoadingBoundary';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from '@/shared/ui/primitives/sidebar';
import { HeaderAccountActions } from './HeaderAccountActions';

const destinations = [
    { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Người dùng', icon: UsersRound },
    { to: '/admin/moderation', label: 'Báo cáo chờ xử lý', icon: Flag },
    { to: '/admin/books', label: 'Tra cứu sách', icon: BookOpen },
    { to: '/admin/library', label: 'Thư viện dùng chung', icon: LibraryBig },
    { to: '/admin/categories', label: 'Danh mục', icon: Tags },
    { to: '/admin/markers', label: 'Quản lý marker', icon: ScanLine },
    { to: '/admin/jobs', label: 'Tác vụ', icon: ListTodo },
    { to: '/admin/audit-logs', label: 'Nhật ký quản trị', icon: ScrollText },
];

export function AdminLayout() {
    return (
        <SidebarProvider
            data-stable-scroll-overlays
            className="admin-shell min-h-dvh flex-col bg-background [&_[data-slot=sidebar-gap]]:ease-out motion-reduce:[&_[data-slot=sidebar-gap]]:transition-none"
            style={{ '--sidebar-width': '248px', '--sidebar-width-icon': '72px' } as CSSProperties}
        >
            <AdminWorkspace />
        </SidebarProvider>
    );
}

function AdminWorkspace() {
    const { pathname } = useLocation();
    const { open, isMobile, openMobile, setOpenMobile } = useSidebar();
    const sidebarTrigger = useRef<HTMLButtonElement>(null);
    const collapsed = !isMobile && !open;
    const toggleLabel = isMobile
        ? 'Mở menu quản trị'
        : open
          ? 'Thu gọn sidebar'
          : 'Mở rộng sidebar';
    const title =
        destinations.find(
            ({ to }) => pathname === to || (to !== '/admin' && pathname.startsWith(`${to}/`)),
        )?.label || 'Quản trị';
    useEffect(() => {
        const previous = document.title;
        document.title = `${title} | Quản trị Bookaria`;
        return () => {
            document.title = previous;
        };
    }, [title]);

    return (
        <>
            <header className="admin-topbar sticky top-0 z-20 flex h-16 w-full items-center bg-surface">
                <Link
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                    className={bookariaLogoLinkStyles(
                        cn(
                            'relative inline-flex h-16 w-36 shrink-0 items-center overflow-hidden border-border text-foreground no-underline transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none md:w-(--sidebar-width) md:border-r',
                            collapsed && 'md:w-(--sidebar-width-icon)',
                        ),
                    )}
                >
                    <span
                        aria-hidden={collapsed}
                        className={cn(
                            'absolute left-4 transition-opacity duration-150 ease-out motion-reduce:transition-none md:left-6',
                            collapsed && 'opacity-0',
                        )}
                    >
                        <BookariaLogo className="w-28 md:w-36" />
                    </span>
                    <span
                        aria-hidden={!collapsed}
                        className={cn(
                            'absolute left-4.5 opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none',
                            collapsed && 'opacity-100',
                        )}
                    >
                        <BookariaLogo symbol className="w-9" />
                    </span>
                </Link>
                <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 border-border border-b px-3 md:px-4">
                    <SidebarTrigger
                        ref={sidebarTrigger}
                        className="size-10 shrink-0"
                        aria-label={toggleLabel}
                        title={toggleLabel}
                        aria-expanded={isMobile ? openMobile : open}
                        aria-controls="admin-navigation"
                    />
                    <HeaderAccountActions />
                </div>
            </header>
            <AdminAccess>
                <div className="admin-body flex min-h-[calc(100dvh-64px)] w-full flex-1">
                    <Sidebar
                        collapsible="icon"
                        className="top-16 h-[calc(100dvh-64px)] border-border ease-out motion-reduce:transition-none"
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            sidebarTrigger.current?.focus();
                        }}
                    >
                        <SidebarHeader className="h-16 flex-row items-center justify-between px-5 md:hidden">
                            <Link
                                to="/"
                                aria-label="Bookaria - Trang chủ"
                                className={bookariaLogoLinkStyles()}
                            >
                                <BookariaLogo className="w-32" />
                            </Link>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Đóng menu quản trị"
                                onClick={() => setOpenMobile(false)}
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </SidebarHeader>
                        <SidebarContent className="px-3.5 py-4 group-data-[collapsible=icon]:overflow-y-auto">
                            <SidebarGroup className="p-0">
                                <SidebarGroupContent>
                                    <nav id="admin-navigation" aria-label="Điều hướng quản trị">
                                        <SidebarMenu className="gap-1.5">
                                            {destinations.map(({ to, label, icon: Icon }) => (
                                                <SidebarMenuItem key={to}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        tooltip={label}
                                                        className="gap-3 px-3 transition-[width,background-color,color] duration-200 ease-out data-[active=true]:bg-(--surface-dark) data-[active=true]:text-(--text-on-dark) data-[active=true]:active:bg-(--surface-dark) data-[active=true]:active:text-(--text-on-dark) data-[active=true]:hover:bg-(--surface-dark) data-[active=true]:hover:text-(--text-on-dark) group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-3! motion-reduce:transition-none [&_svg]:size-5"
                                                        isActive={
                                                            pathname === to ||
                                                            (to !== '/admin' &&
                                                                pathname.startsWith(`${to}/`))
                                                        }
                                                    >
                                                        <NavLink
                                                            to={to}
                                                            end={to === '/admin'}
                                                            aria-label={label}
                                                            onClick={() => setOpenMobile(false)}
                                                        >
                                                            <Icon aria-hidden="true" />
                                                            <span className="whitespace-nowrap transition-opacity duration-150 ease-out group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                                                                {label}
                                                            </span>
                                                        </NavLink>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </nav>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>
                    <main
                        id="main"
                        className="admin-main min-w-0 flex-1 px-4 pt-8 pb-16 md:px-10 md:pt-10"
                    >
                        <LoadingBoundary>
                            <Suspense
                                fallback={<LoadingScreen message="Đang mở trang quản trị…" />}
                            >
                                <Outlet />
                            </Suspense>
                        </LoadingBoundary>
                    </main>
                </div>
            </AdminAccess>
        </>
    );
}

export function AdminNotFoundPage() {
    return (
        <section className="max-w-180 py-8">
            <h1>Không tìm thấy trang quản trị</h1>
            <p className="text-muted-foreground">
                Liên kết có thể đã thay đổi. Bạn có thể trở về trang tổng quan để tiếp tục.
            </p>
            <Button asChild>
                <Link to="/admin">Về tổng quan</Link>
            </Button>
        </section>
    );
}
