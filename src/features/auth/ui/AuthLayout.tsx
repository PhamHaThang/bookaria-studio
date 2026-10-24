import { Link, Outlet } from 'react-router-dom';
import { BookariaLogo } from '../../../shared/ui/BookariaLogo';

export function AuthLayout() {
    return (
        <div className="auth-page min-h-[100dvh] px-6 pt-8 pb-6 max-[540px]:px-4 max-[540px]:py-6">
            <header className="brand-row mx-auto mt-0 mb-12 max-w-280 max-[540px]:mb-8">
                <Link
                    className="brand inline-flex items-center gap-3 font-bold text-[length:var(--text-2xl)] text-[var(--text-brand-strong)] no-underline [&_span]:border-l-[var(--border-width)] [&_span]:border-l-border [&_span]:pl-3 [&_span]:font-normal [&_span]:text-[length:var(--text-sm)] [&_span]:text-muted-foreground [&_span]:[border-left-style:solid] [.studio-topbar_&]:min-h-[66px] [.studio-topbar_&]:min-w-[222px] [.studio-topbar_&]:gap-2 [.studio-topbar_&]:self-stretch [.studio-topbar_&]:border-r-[1px] [.studio-topbar_&]:border-r-border [.studio-topbar_&]:bg-[var(--nav-ground)] [.studio-topbar_&]:px-5 [.studio-topbar_&]:py-4 [.studio-topbar_&]:text-[length:20px] [.studio-topbar_&]:text-foreground [.studio-topbar_&]:[border-right-style:solid] max-[700px]:[.studio-topbar_&]:mr-auto max-[1000px]:[.studio-topbar_&]:min-w-[190px] max-[700px]:[.studio-topbar_&]:min-w-0 max-[700px]:[.studio-topbar_&]:flex-[0_1_auto] max-[1000px]:[.studio-topbar_&]:px-[14px] max-[700px]:[.studio-topbar_&]:px-3 max-[1000px]:[.studio-topbar_&]:text-[length:18px] max-[700px]:[.studio-topbar_&]:text-[length:17px] [.studio-topbar_&_span]:border-[var(--nav-muted)] [.studio-topbar_&_span]:pl-2 [.studio-topbar_&_span]:text-[length:10px] [.studio-topbar_&_span]:text-[var(--nav-ink)] max-[700px]:[.studio-topbar_&_span]:hidden max-[760px]:[.studio-topbar_&_span]:hidden [.studio-topbar_&_svg]:text-primary max-[540px]:[.theme-guide-header_&_span]:hidden"
                    to="/login"
                >
                    <BookariaLogo />
                    <span>Studio</span>
                </Link>
            </header>
            <main
                id="main"
                className="auth-panel mx-auto my-0 max-w-115 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[540px]:px-5 max-[540px]:py-6"
            >
                <Outlet />
            </main>
        </div>
    );
}
