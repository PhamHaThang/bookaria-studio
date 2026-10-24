import {
    BookOpen,
    ChartColumn,
    FolderOpen,
    Library,
    Palette,
    Plus,
    Trash2,
    UserRound,
} from 'lucide-react';
import { type CSSProperties, Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
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
import { useAuth } from '../features/auth';
import { AuthDialogLink } from '../features/auth/ui/AuthDialogLink';
import { BookariaLogo } from '../shared/ui/BookariaLogo';
import { HeaderAccountActions } from './HeaderAccountActions';
import { HomeLink } from './HomeLink';

export function StudioLayout() {
    const location = useLocation();
    const editing = /^\/books\/[^/]+\/pages\/[^/]+$/.test(location.pathname);
    const { user } = useAuth();
    if (editing)
        return (
            <main id="main" className="studio-editor-root min-h-[100dvh] bg-surface">
                <Suspense fallback={<LoadingState>Đang mở editor…</LoadingState>}>
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
            <header className="studio-topbar flex min-h-[66px] items-center justify-between gap-5 border-b-[1px] border-b-border bg-surface py-0 pr-7 pl-0 [border-bottom-style:solid] max-[760px]:min-h-18 max-[700px]:min-w-0 max-[700px]:max-w-full max-[700px]:gap-2 max-[760px]:gap-3 max-[760px]:p-5 max-[700px]:py-0 max-[700px]:pr-[10px] max-[700px]:pl-0 [&_.bookaria-logo]:w-32 max-[700px]:[&_.bookaria-logo]:w-30">
                <Link
                    className="brand inline-flex items-center gap-3 font-bold text-[length:var(--text-2xl)] text-[var(--text-brand-strong)] no-underline [&_span]:border-l-[var(--border-width)] [&_span]:border-l-border [&_span]:pl-3 [&_span]:font-normal [&_span]:text-[length:var(--text-sm)] [&_span]:text-muted-foreground [&_span]:[border-left-style:solid] [.studio-topbar_&]:min-h-[66px] [.studio-topbar_&]:min-w-[222px] [.studio-topbar_&]:gap-2 [.studio-topbar_&]:self-stretch [.studio-topbar_&]:border-r-[1px] [.studio-topbar_&]:border-r-border [.studio-topbar_&]:bg-[var(--nav-ground)] [.studio-topbar_&]:px-5 [.studio-topbar_&]:py-4 [.studio-topbar_&]:text-[length:20px] [.studio-topbar_&]:text-foreground [.studio-topbar_&]:[border-right-style:solid] max-[700px]:[.studio-topbar_&]:mr-auto max-[1000px]:[.studio-topbar_&]:min-w-[190px] max-[700px]:[.studio-topbar_&]:min-w-0 max-[700px]:[.studio-topbar_&]:flex-[0_1_auto] max-[1000px]:[.studio-topbar_&]:px-[14px] max-[700px]:[.studio-topbar_&]:px-3 max-[1000px]:[.studio-topbar_&]:text-[length:18px] max-[700px]:[.studio-topbar_&]:text-[length:17px] [.studio-topbar_&_span]:border-[var(--nav-muted)] [.studio-topbar_&_span]:pl-2 [.studio-topbar_&_span]:text-[length:10px] [.studio-topbar_&_span]:text-[var(--nav-ink)] max-[700px]:[.studio-topbar_&_span]:hidden max-[760px]:[.studio-topbar_&_span]:hidden [.studio-topbar_&_svg]:text-primary max-[540px]:[.theme-guide-header_&_span]:hidden"
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                >
                    <BookariaLogo />
                    <span>Studio</span>
                </Link>
                <div className="flex items-center gap-4">
                    <HomeLink />
                    <HeaderAccountActions />
                </div>
            </header>
            <SidebarProvider
                className="studio-body min-h-[calc(100dvh-66px)]"
                style={{ '--sidebar-width': '222px' } as CSSProperties}
            >
                <Sidebar
                    collapsible="none"
                    className="h-auto shrink-0 border-border border-r px-3 py-6"
                >
                    <SidebarContent>
                        <SidebarGroup className="p-0">
                            <Button asChild className="mb-5 w-full">
                                <Link to="/books/new">
                                    <Plus data-icon="inline-start" />
                                    Tạo sách mới
                                </Link>
                            </Button>
                            <SidebarGroupContent>
                                <nav aria-label="Điều hướng Studio">
                                    <SidebarMenu>
                                        {[
                                            {
                                                to: '/library',
                                                label: 'Thư viện công khai',
                                                icon: BookOpen,
                                            },
                                            { to: '/books', label: 'Sách của tôi', icon: Library },
                                            {
                                                to: '/books/trash',
                                                label: 'Thùng rác',
                                                icon: Trash2,
                                            },
                                            {
                                                to: '/assets',
                                                label: 'Tài nguyên',
                                                icon: FolderOpen,
                                            },
                                            { to: '/stats', label: 'Thống kê', icon: ChartColumn },
                                            { to: '/profile', label: 'Hồ sơ', icon: UserRound },
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
                                                        (to !== '/books' &&
                                                            location.pathname.startsWith(`${to}/`))
                                                    }
                                                >
                                                    <NavLink to={to} end={to === '/books'}>
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
                <main
                    id="main"
                    className="studio-main min-w-0 flex-1 border-0 border-[transparent] border-solid px-[clamp(20px,_3vw,_56px)] pt-9 pb-15 max-[760px]:border-l-[0] max-[760px]:border-l-[transparent] max-[1000px]:px-5 max-[1100px]:px-6 max-[700px]:px-[14px] max-[760px]:px-5 max-[1000px]:py-[26px] max-[1100px]:pt-8 max-[700px]:pt-[22px] max-[760px]:pt-8 max-[1100px]:pb-12 max-[700px]:pb-9 max-[760px]:pb-12 max-[760px]:[border-left-style:solid] [.studio-editing_&]:px-5 [.studio-editing_&]:pt-[18px] [.studio-editing_&]:pb-7 max-[700px]:[.studio-editing_&]:px-[14px] max-[700px]:[.studio-editing_&]:pt-[22px] max-[700px]:[.studio-editing_&]:pb-9"
                >
                    {!user?.emailVerified && (
                        <Alert tone="info" className="mb-8">
                            <div className="flex items-center justify-between gap-4">
                                <span>Xác minh email để có thể xuất bản sách.</span>
                                <AuthDialogLink mode="check-email">Xác minh email</AuthDialogLink>
                            </div>
                        </Alert>
                    )}
                    <Suspense fallback={<LoadingState>Đang mở trang…</LoadingState>}>
                        <Outlet />
                    </Suspense>
                </main>
            </SidebarProvider>
        </div>
    );
}
