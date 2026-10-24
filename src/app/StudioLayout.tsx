import {
    Bell,
    BookOpen,
    ChartColumn,
    FolderOpen,
    Library,
    LogOut,
    Palette,
    Plus,
    ShieldCheck,
    Trash2,
    UserRound,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { auth, useAuth } from '../features/auth';
import { NotificationLink } from '../features/notifications/NotificationLink';
import { errorMessage } from '../shared/api/errors';
import { Avatar } from '../shared/ui/Avatar';
import { BookariaLogo } from '../shared/ui/BookariaLogo';
import { Feedback } from '../shared/ui/Feedback';

export function StudioLayout() {
    const location = useLocation();
    const editing = /^\/books\/[^/]+\/pages\/[^/]+$/.test(location.pathname);
    const { user, signingOut } = useAuth();
    const [error, setError] = useState<string | null>(null);
    async function logout() {
        setError(null);
        try {
            await auth.logout();
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    if (editing)
        return (
            <main id="main" className="studio-editor-root min-h-[100dvh] bg-surface">
                <Suspense fallback={<p role="status">Đang mở editor…</p>}>
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
                    to="/books"
                >
                    <BookariaLogo />
                    <span>Studio</span>
                </Link>
                <div className="account-actions flex min-w-0 items-center gap-5 text-[length:12px] max-[640px]:flex-wrap max-[640px]:justify-center max-[700px]:gap-[10px] max-[700px]:[.studio-topbar_&]:min-w-0 max-[700px]:[.studio-topbar_&]:flex-[0_0_auto] max-[700px]:[.studio-topbar_&]:gap-2">
                    <NotificationLink userId={user?.id || ''} />
                    <Link
                        className="account-link flex max-w-55 items-center gap-2 truncate text-[inherit] no-underline max-[760px]:hidden max-[700px]:max-w-[130px] [&_>_span:last-child]:overflow-hidden [&_>_span:last-child]:text-ellipsis max-[700px]:[&_>_span:last-child]:hidden max-[700px]:[.account-actions_&]:max-w-8 max-[700px]:[.account-actions_&]:flex-[0_0_32px]"
                        to="/profile"
                    >
                        <Avatar url={user?.avatarUrl || null} />
                        <span>{user?.displayName}</span>
                    </Link>
                    <button
                        className="inline-flex min-h-11 items-center gap-2 border-0 border-[transparent] border-solid bg-[transparent] px-0 py-1 font-semibold text-button text-primary [&:hover:not(:disabled)]:underline [&:hover:not(:disabled)]:underline-offset-1 [.account-actions_&]:text-[length:12px] max-[700px]:[.account-actions_>_&]:min-w-[30px] max-[700px]:[.account-actions_>_&]:flex-[0_0_30px] max-[700px]:[.account-actions_>_&]:gap-0 max-[700px]:[.account-actions_>_&]:p-[5px] max-[700px]:[.account-actions_>_&]:text-[length:0] max-[700px]:[.account-actions_>_&_svg]:w-[18px] [.book-gallery_.book-actions_&]:min-h-7 [.book-gallery_.book-actions_&]:p-[3px]"
                        type="button"
                        disabled={signingOut}
                        onClick={logout}
                    >
                        <LogOut size={17} aria-hidden="true" />
                        {signingOut ? 'Đang thoát…' : 'Đăng xuất'}
                    </button>
                </div>
            </header>
            <div className="studio-body m-auto grid min-h-[calc(100dvh_-_66px)] max-w-none grid-cols-[222px_minmax(0,_1fr)] max-[760px]:block max-[1000px]:grid-cols-[190px_minmax(0,_1fr)] max-[1100px]:grid-cols-[180px_minmax(0,_1fr)] max-[700px]:grid-cols-[minmax(0,_1fr)] [.studio-editing_&]:grid-cols-[66px_minmax(0,_1fr)] max-[700px]:[.studio-editing_&]:grid-cols-[minmax(0,_1fr)]">
                <nav
                    className="studio-nav flex flex-col gap-[5px] border-r-[1px] border-r-border bg-[var(--nav-ground)] px-3 py-6 [border-right-style:solid] max-[700px]:flex max-[700px]:flex-row max-[760px]:flex-row max-[700px]:gap-1 max-[760px]:gap-[2px] max-[700px]:overflow-x-auto max-[760px]:overflow-x-auto max-[760px]:border-b-[1px] max-[760px]:border-b-border max-[700px]:p-[7px] max-[760px]:p-3 max-[1100px]:px-3 max-[1100px]:py-8 max-[760px]:[border-bottom-style:solid] [&_a.active]:bg-[var(--nav-active)] [&_a.active]:font-semibold [&_a.active]:text-primary [&_a:hover]:bg-hover [&_a:hover]:text-foreground [&_a]:flex [&_a]:items-center [&_a]:gap-[11px] [&_a]:rounded-[7px] [&_a]:p-3 [&_a]:text-[length:13px] [&_a]:text-[var(--nav-ink)] [&_a]:no-underline max-[700px]:[&_a]:shrink-0 max-[1000px]:[&_a]:gap-2 max-[760px]:[&_a]:gap-2 max-[700px]:[&_a]:whitespace-nowrap max-[760px]:[&_a]:whitespace-nowrap max-[700px]:[&_a]:p-[10px] max-[1000px]:[&_a]:px-2 max-[760px]:[&_a]:px-3 max-[1000px]:[&_a]:py-3 max-[760px]:[&_a]:py-[11px] max-[1000px]:[&_a]:text-[length:11px] max-[700px]:[&_a]:text-[length:11px] max-[760px]:[&_a]:text-[length:var(--text-sm)] motion-safe:[&_a]:[transition:background-color_150ms_ease-out,_color_150ms_ease-out] max-[760px]:[&_a_svg]:w-[17px] [.studio-editing_&]:px-2 [.studio-editing_&]:py-[18px] max-[700px]:[.studio-editing_&]:flex max-[700px]:[.studio-editing_&]:flex-row max-[700px]:[.studio-editing_&]:gap-1 max-[700px]:[.studio-editing_&]:overflow-x-auto max-[700px]:[.studio-editing_&]:p-[7px] [.studio-editing_&_a]:justify-center [.studio-editing_&_a]:px-2 [.studio-editing_&_a]:py-3 max-[700px]:[.studio-editing_&_a]:shrink-0 max-[700px]:[.studio-editing_&_a]:whitespace-nowrap max-[700px]:[.studio-editing_&_a]:p-[10px] max-[700px]:[.studio-editing_&_a]:text-[length:11px] [.studio-editing_&_a_>_span]:hidden max-[700px]:[.studio-editing_&_a_>_span]:hidden"
                    aria-label="Điều hướng Studio"
                >
                    <Link
                        className="nav-create [.studio-editing_.studio-nav_&]:mb-[10px] max-[700px]:[.studio-editing_.studio-nav_&]:m-0 [.studio-nav_&:hover]:bg-primary-hover [.studio-nav_&]:mb-[22px] [.studio-nav_&]:border-0 [.studio-nav_&]:border-[transparent] [.studio-nav_&]:border-solid [.studio-nav_&]:bg-primary [.studio-nav_&]:text-primary-foreground max-[700px]:[.studio-nav_&]:m-0"
                        to="/books/new"
                        title="Tạo sách mới"
                    >
                        <Plus size={19} />
                        <span>Tạo sách mới</span>
                    </Link>
                    <NavLink title="Thư viện công khai" to="/explore">
                        <BookOpen size={19} aria-hidden="true" />
                        <span>Thư viện công khai</span>
                    </NavLink>
                    <NavLink title="Sách của tôi" to="/books" end>
                        <Library size={19} aria-hidden="true" />
                        <span>Sách của tôi</span>
                    </NavLink>
                    <NavLink title="Thùng rác" to="/books/trash">
                        <Trash2 size={19} aria-hidden="true" />
                        <span>Thùng rác</span>
                    </NavLink>
                    <NavLink title="Tài nguyên" to="/assets">
                        <FolderOpen size={19} aria-hidden="true" />
                        <span>Tài nguyên</span>
                    </NavLink>
                    <NavLink title="Thống kê" to="/stats">
                        <ChartColumn size={19} aria-hidden="true" />
                        <span>Thống kê</span>
                    </NavLink>
                    <NavLink title="Thông báo" to="/notifications">
                        <Bell size={19} aria-hidden="true" />
                        <span>Thông báo</span>
                    </NavLink>
                    <NavLink title="Hồ sơ" to="/profile">
                        <UserRound size={19} aria-hidden="true" />
                        <span>Hồ sơ</span>
                    </NavLink>
                    {user?.role === 'ADMIN' && (
                        <NavLink title="Quản trị" to="/admin">
                            <ShieldCheck size={19} aria-hidden="true" />
                            <span>Quản trị</span>
                        </NavLink>
                    )}
                    {import.meta.env.DEV && (
                        <NavLink title="Giao diện mẫu" to="/style-guide">
                            <Palette size={19} aria-hidden="true" />
                            <span>Giao diện mẫu</span>
                        </NavLink>
                    )}
                </nav>
                <main
                    id="main"
                    className="studio-main min-w-0 border-0 border-[transparent] border-solid px-[clamp(20px,_3vw,_56px)] pt-9 pb-15 max-[760px]:border-l-[0] max-[760px]:border-l-[transparent] max-[1000px]:px-5 max-[1100px]:px-6 max-[700px]:px-[14px] max-[760px]:px-5 max-[1000px]:py-[26px] max-[1100px]:pt-8 max-[700px]:pt-[22px] max-[760px]:pt-8 max-[1100px]:pb-12 max-[700px]:pb-9 max-[760px]:pb-12 max-[760px]:[border-left-style:solid] [.studio-editing_&]:px-5 [.studio-editing_&]:pt-[18px] [.studio-editing_&]:pb-7 max-[700px]:[.studio-editing_&]:px-[14px] max-[700px]:[.studio-editing_&]:pt-[22px] max-[700px]:[.studio-editing_&]:pb-9"
                >
                    <Feedback error={error} />
                    {!user?.emailVerified && (
                        <div className="email-notice mb-8 flex justify-between gap-4 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-[length:var(--text-sm)] max-[760px]:flex-col max-[760px]:gap-2 max-[760px]:text-[length:var(--text-xs)] [&_a]:shrink-0">
                            <span>Xác minh email để có thể xuất bản sách.</span>
                            <Link to="/check-email">Xác minh email</Link>
                        </div>
                    )}
                    <Suspense fallback={<p role="status">Đang mở trang…</p>}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}
