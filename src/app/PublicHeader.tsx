import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/shared/ui/primitives/navigation-menu';

import { HeaderAccountActions } from './HeaderAccountActions';

const destinations = [
    { to: '/', label: 'Trang chủ' },
    { to: '/library', label: 'Khám phá' },
    { to: '/help', label: 'Hướng dẫn' },
];

export function PublicHeader() {
    const { pathname } = useLocation();
    const { user, status } = useAuth();
    const signedIn = status === 'authenticated' && user !== null;

    useEffect(() => {
        // Session recovery personalizes the header; public content never waits for it.
        if (auth.store.getState().status === 'loading') void auth.restore();
    }, []);

    return (
        <header className="site-header sticky top-0 z-20 border-border border-b bg-surface">
            <div className="mx-auto grid min-h-22 max-w-320 grid-cols-[auto_1fr_auto] items-center gap-10 px-8">
                <Link to="/" aria-label="Bookaria - Trang chủ" className="inline-flex rounded-md">
                    <BookariaLogo />
                </Link>
                <NavigationMenu
                    viewport={false}
                    aria-label="Điều hướng chính"
                    className="justify-self-center"
                >
                    <NavigationMenuList>
                        {destinations.map(({ to, label }) => (
                            <NavigationMenuItem key={to}>
                                <NavigationMenuLink
                                    active={pathname === to || pathname.startsWith(`${to}/`)}
                                    asChild
                                >
                                    <NavLink to={to} end={to === '/'}>
                                        {label}
                                    </NavLink>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>
                <div className="flex items-center justify-end gap-3">
                    {signedIn ? (
                        <HeaderAccountActions />
                    ) : (
                        <Button asChild>
                            <AuthDialogLink mode="login">Đăng nhập</AuthDialogLink>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
