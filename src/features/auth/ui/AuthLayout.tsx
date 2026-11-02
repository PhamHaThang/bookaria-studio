import { Link, Outlet } from 'react-router-dom';
import { BookariaLogo, bookariaLogoLinkStyles } from '../../../shared/ui/BookariaLogo';

export function AuthLayout() {
    return (
        <div className="auth-page min-h-[100dvh] px-6 pt-8 pb-6 max-[540px]:px-4 max-[540px]:py-6">
            <header className="brand-row mx-auto mt-0 mb-12 max-w-280 max-[540px]:mb-8">
                <Link
                    className={bookariaLogoLinkStyles(
                        'brand inline-flex items-center gap-3 font-bold text-[length:var(--text-2xl)] text-[var(--text-brand-strong)] no-underline [&_span]:border-border [&_span]:border-l [&_span]:pl-3 [&_span]:font-normal [&_span]:text-muted-foreground [&_span]:text-sm',
                    )}
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
