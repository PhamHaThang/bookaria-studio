import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BookariaLogo } from '../shared/ui/BookariaLogo';

export function PublicLayout() {
    return (
        <div className="public-shell">
            <header className="studio-topbar public-topbar flex min-h-[66px] items-center justify-between gap-5 border-b-[1px] border-b-border bg-surface py-0 pr-7 pl-0 [border-bottom-style:solid] max-[760px]:min-h-18 max-[700px]:min-w-0 max-[700px]:max-w-full max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-4 max-[700px]:gap-2 max-[760px]:gap-3 max-[760px]:p-5 max-[700px]:py-0 max-[700px]:pr-[10px] max-[700px]:pl-0 [&_.bookaria-logo]:w-32 max-[700px]:[&_.bookaria-logo]:w-30 [&_nav]:flex [&_nav]:flex-wrap [&_nav]:gap-5 max-[640px]:[&_nav]:gap-4">
                <Link
                    className="brand inline-flex items-center gap-3 font-bold text-[length:var(--text-2xl)] text-[var(--text-brand-strong)] no-underline [&_span]:border-l-[var(--border-width)] [&_span]:border-l-border [&_span]:pl-3 [&_span]:font-normal [&_span]:text-[length:var(--text-sm)] [&_span]:text-muted-foreground [&_span]:[border-left-style:solid] [.studio-topbar_&]:min-h-[66px] [.studio-topbar_&]:min-w-[222px] [.studio-topbar_&]:gap-2 [.studio-topbar_&]:self-stretch [.studio-topbar_&]:border-r-[1px] [.studio-topbar_&]:border-r-border [.studio-topbar_&]:bg-[var(--nav-ground)] [.studio-topbar_&]:px-5 [.studio-topbar_&]:py-4 [.studio-topbar_&]:text-[length:20px] [.studio-topbar_&]:text-foreground [.studio-topbar_&]:[border-right-style:solid] max-[700px]:[.studio-topbar_&]:mr-auto max-[1000px]:[.studio-topbar_&]:min-w-[190px] max-[700px]:[.studio-topbar_&]:min-w-0 max-[700px]:[.studio-topbar_&]:flex-[0_1_auto] max-[1000px]:[.studio-topbar_&]:px-[14px] max-[700px]:[.studio-topbar_&]:px-3 max-[1000px]:[.studio-topbar_&]:text-[length:18px] max-[700px]:[.studio-topbar_&]:text-[length:17px] [.studio-topbar_&_span]:border-[var(--nav-muted)] [.studio-topbar_&_span]:pl-2 [.studio-topbar_&_span]:text-[length:10px] [.studio-topbar_&_span]:text-[var(--nav-ink)] max-[700px]:[.studio-topbar_&_span]:hidden max-[760px]:[.studio-topbar_&_span]:hidden [.studio-topbar_&_svg]:text-primary max-[540px]:[.theme-guide-header_&_span]:hidden"
                    to="/explore"
                >
                    <BookariaLogo />
                </Link>
                <nav aria-label="Điều hướng công khai">
                    <NavLink to="/explore">Thư viện</NavLink>
                    <Link to="/books">Studio</Link>
                    <Link to="/login">Đăng nhập</Link>
                </nav>
            </header>
            <main
                id="main"
                className="public-main m-auto w-[min(100%,_1120px)] p-8 max-[640px]:p-5"
            >
                <Suspense fallback={<p role="status">Đang mở trang…</p>}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
