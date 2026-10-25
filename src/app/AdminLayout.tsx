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
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AdminAccess } from '@/features/admin/AdminAccess';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
} from '@/shared/ui/primitives/sidebar';
import { HeaderAccountActions } from './HeaderAccountActions';
import { HomeLink } from './HomeLink';

const destinations = [
    { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Người dùng', icon: UsersRound },
    { to: '/admin/moderation', label: 'Báo cáo chờ xử lý', icon: Flag },
    { to: '/admin/books', label: 'Tra cứu sách', icon: BookOpen },
    { to: '/admin/library', label: 'Thư viện dùng chung', icon: LibraryBig },
    { to: '/admin/categories', label: 'Danh mục', icon: Tags },
    { to: '/admin/markers', label: 'Bộ marker', icon: ScanLine },
    { to: '/admin/jobs', label: 'Tác vụ', icon: ListTodo },
    { to: '/admin/audit-logs', label: 'Nhật ký quản trị', icon: ScrollText },
];

export function AdminLayout() {
    const { pathname } = useLocation();
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
        <div className="admin-shell min-h-dvh bg-background">
            <header className="admin-topbar sticky top-0 z-20 flex min-h-18 items-center justify-between gap-8 border-border border-b bg-surface px-8">
                <Link
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                    className="inline-flex items-center gap-4 rounded-md text-foreground no-underline [&_.bookaria-logo]:w-32"
                >
                    <BookariaLogo />
                    <span className="border-border border-l pl-4 text-muted-foreground text-sm">
                        Quản trị
                    </span>
                </Link>
                <div className="flex items-center gap-4">
                    <HomeLink />
                    <HeaderAccountActions />
                </div>
            </header>
            <AdminAccess>
                <SidebarProvider
                    className="admin-body min-h-[calc(100dvh-72px)]"
                    style={{ '--sidebar-width': '248px' } as CSSProperties}
                >
                    <Sidebar
                        collapsible="none"
                        className="h-auto shrink-0 border-border border-r px-3 py-6"
                    >
                        <SidebarContent>
                            <SidebarGroup className="p-0">
                                <SidebarGroupContent>
                                    <nav aria-label="Điều hướng quản trị">
                                        <SidebarMenu>
                                            {destinations.map(({ to, label, icon: Icon }) => (
                                                <SidebarMenuItem key={to}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={
                                                            pathname === to ||
                                                            (to !== '/admin' &&
                                                                pathname.startsWith(`${to}/`))
                                                        }
                                                    >
                                                        <NavLink to={to} end={to === '/admin'}>
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
                    </Sidebar>
                    <main id="main" className="admin-main min-w-0 flex-1 px-8 pt-9 pb-15">
                        <Suspense fallback={<LoadingScreen message="Đang mở trang quản trị…" />}>
                            <Outlet />
                        </Suspense>
                    </main>
                </SidebarProvider>
            </AdminAccess>
        </div>
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
