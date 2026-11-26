import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { BookOpen, House, LibraryBig, LifeBuoy } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo, bookariaLogoLinkStyles } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { HeaderAccountActions } from './HeaderAccountActions';
import {
    PublicHeaderNavigation,
    PublicMobileNavigation,
    type PublicNavigationLink,
} from './PublicHeaderNavigation';

const destinations: readonly PublicNavigationLink[] = [
    { to: '/', label: 'Trang chủ', icon: House },
    { to: '/library', label: 'Khám phá sách', icon: BookOpen },
    { to: '/resources', label: 'Thư viện tài nguyên', icon: LibraryBig },
    { to: '/help', label: 'Hướng dẫn', icon: LifeBuoy },
];

export function PublicHeader() {
    const headerRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    const { user, status } = useAuth();
    const { transition } = useMotionTokens();
    const reduceMotion = useShouldReduceMotion();
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
    const signedIn = status === 'authenticated' && user !== null;
    const activePath =
        destinations.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`))?.to ?? null;

    useEffect(() => {
        // Session recovery personalizes the header; public content never waits for it.
        if (auth.store.getState().status === 'loading') void auth.restore();
    }, []);

    useEffect(() => {
        const updateScroll = () => setScrolled(window.scrollY > 24);
        window.addEventListener('scroll', updateScroll, { passive: true });
        updateScroll();
        return () => window.removeEventListener('scroll', updateScroll);
    }, []);

    useEffect(() => {
        const header = headerRef.current;
        const shell = header?.parentElement;
        if (!header || !shell) return;
        const updateHeaderSpace = () => {
            const margin = Number.parseFloat(getComputedStyle(header).marginTop) || 0;
            shell.style.setProperty('--public-header-space', `${header.offsetHeight + margin}px`);
        };
        const observer = new ResizeObserver(updateHeaderSpace);
        observer.observe(header);
        updateHeaderSpace();
        return () => {
            observer.disconnect();
            shell.style.removeProperty('--public-header-space');
        };
    }, []);

    return (
        <motion.header
            ref={headerRef}
            data-scrolled={scrolled}
            initial={reduceMotion ? false : { opacity: 0, y: -8, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={transition.reveal}
            className="site-header sticky top-0 z-20 w-full bg-background"
        >
            <div className="mx-auto flex min-h-18 max-w-[1328px] items-center gap-3 px-4 max-sm:gap-2 sm:px-8 lg:gap-6">
                <div className="flex min-w-0 items-center gap-2 justify-self-start">
                    <Link
                        to="/"
                        aria-label="Bookaria - Trang chủ"
                        className={bookariaLogoLinkStyles(
                            'inline-flex min-h-11 min-w-12 shrink-0 items-center rounded-md',
                        )}
                    >
                        <BookariaLogo className="w-36" />
                    </Link>
                </div>
                <PublicHeaderNavigation links={destinations} activePath={activePath} />
                <div className="ml-auto flex min-w-0 items-center justify-end gap-3 max-sm:gap-2 [&_[data-slot=button]]:whitespace-nowrap">
                    {signedIn ? (
                        <HeaderAccountActions variant="compact" showStudio />
                    ) : (
                        <div className="hidden items-center gap-3 lg:flex">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="hover:not-disabled:bg-foreground/12 active:not-disabled:bg-foreground/18"
                                asChild
                            >
                                <AuthDialogLink mode="login">Đăng nhập</AuthDialogLink>
                            </Button>
                            <Button variant="default" size="sm" asChild>
                                <AuthDialogLink mode="register">Đăng ký</AuthDialogLink>
                            </Button>
                        </div>
                    )}
                    <PublicMobileNavigation links={destinations} activePath={activePath} />
                </div>
            </div>
        </motion.header>
    );
}
