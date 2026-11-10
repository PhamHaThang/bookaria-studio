import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo, bookariaLogoLinkStyles } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/shared/ui/primitives/navigation-menu';

import { HeaderAccountActions } from './HeaderAccountActions';
import { getStudioSection } from './studio-navigation';

const destinations = [
    { to: '/', label: 'Trang chủ' },
    { to: '/library', label: 'Khám phá' },
    { to: '/help', label: 'Hướng dẫn' },
];

export function PublicHeader() {
    const { pathname } = useLocation();
    const { user, status } = useAuth();
    const signedIn = status === 'authenticated' && user !== null;
    const links = signedIn
        ? [...destinations.slice(0, 2), { to: '/books', label: 'Studio' }, ...destinations.slice(2)]
        : destinations;

    useEffect(() => {
        // Session recovery personalizes the header; public content never waits for it.
        if (auth.store.getState().status === 'loading') void auth.restore();
    }, []);

    return (
        <header className="site-header sticky top-3 z-20 mx-auto mt-3 w-[calc(100%-48px)] max-w-[1280px] rounded-[var(--radius-nav)] bg-surface shadow-[var(--shadow-header)] supports-[backdrop-filter]:bg-[var(--bg-header-glass)] supports-[backdrop-filter]:backdrop-blur-[12px] max-sm:top-2 max-sm:mt-2 max-sm:w-[calc(100%-16px)]">
            <div className="mx-auto grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-6 px-6 max-sm:grid-cols-[1fr_auto] max-sm:gap-x-4 max-sm:gap-y-0 max-sm:px-3 max-sm:py-3 sm:px-6">
                <Link
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                    className={bookariaLogoLinkStyles('inline-flex rounded-md')}
                >
                    <BookariaLogo className="w-36 max-sm:w-24 max-[360px]:w-20" />
                </Link>
                <NavigationMenu
                    viewport={false}
                    aria-label="Điều hướng chính"
                    className="justify-self-start max-sm:order-3 max-sm:col-span-full max-sm:w-full max-sm:pt-2"
                >
                    <NavigationMenuList>
                        {links.map(({ to, label }) => {
                            const active =
                                to === '/books'
                                    ? getStudioSection(pathname) !== null
                                    : pathname === to || pathname.startsWith(`${to}/`);
                            return (
                                <NavigationMenuItem key={to}>
                                    <NavigationMenuLink
                                        active={active}
                                        className="max-sm:px-2"
                                        asChild
                                    >
                                        <Link to={to} aria-current={active ? 'page' : undefined}>
                                            {label}
                                        </Link>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            );
                        })}
                    </NavigationMenuList>
                </NavigationMenu>
                <div className="flex items-center justify-end gap-3 max-sm:gap-1 [&_[data-slot=button]]:whitespace-nowrap">
                    {signedIn ? (
                        <HeaderAccountActions />
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" asChild>
                                <AuthDialogLink mode="login">Đăng nhập</AuthDialogLink>
                            </Button>
                            <Button variant="default" size="sm" asChild>
                                <AuthDialogLink mode="register">Đăng ký</AuthDialogLink>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
