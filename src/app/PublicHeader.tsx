import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo, bookariaLogoLinkStyles } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/Button';
import { HeaderAccountActions } from './HeaderAccountActions';
import { PublicHeaderNavigation } from './PublicHeaderNavigation';
import { getStudioSection } from './studio-navigation';

const destinations = [
    { to: '/', label: 'Trang chủ' },
    { to: '/library', label: 'Khám phá' },
    { to: '/help', label: 'Hướng dẫn' },
];

export function PublicHeader() {
    const headerRef = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    const { user, status } = useAuth();
    const { transition } = useMotionTokens();
    const reduceMotion = useShouldReduceMotion();
    const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
    const signedIn = status === 'authenticated' && user !== null;
    const links = signedIn
        ? [...destinations.slice(0, 2), { to: '/books', label: 'Studio' }, ...destinations.slice(2)]
        : destinations;
    const activePath =
        links.find(({ to }) =>
            to === '/books'
                ? getStudioSection(pathname) !== null
                : pathname === to || pathname.startsWith(`${to}/`),
        )?.to ?? null;

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
            initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.reveal}
            className="site-header sticky top-3 z-20 mx-auto mt-3 w-[calc(100%-48px)] max-w-[1280px] rounded-[var(--radius-nav)] bg-surface shadow-[var(--shadow-header)] transition-[background-color,box-shadow] duration-200 data-[scrolled=true]:shadow-[var(--shadow-header-scrolled)] supports-[backdrop-filter]:bg-[var(--bg-header-glass)] supports-[backdrop-filter]:backdrop-blur-[24px] supports-[backdrop-filter]:backdrop-saturate-150 motion-reduce:transition-none max-sm:top-2 max-sm:mt-2 max-sm:w-[calc(100%-16px)]"
        >
            <div className="mx-auto grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-5 px-6 max-sm:px-3 max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:gap-x-4 max-lg:gap-y-0 max-lg:py-2">
                <Link
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                    className={bookariaLogoLinkStyles('inline-flex justify-self-start rounded-md')}
                >
                    <BookariaLogo className="w-36 max-sm:w-24 max-[360px]:w-20" />
                </Link>
                <PublicHeaderNavigation links={links} activePath={activePath} />
                <div className="flex min-w-0 items-center justify-end gap-3 max-sm:gap-1 [&_[data-account-variant=full]]:max-w-[180px] xl:[&_[data-account-variant=full]]:max-w-[220px] [&_[data-slot=button]]:whitespace-nowrap">
                    {signedIn ? (
                        <HeaderAccountActions />
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            </div>
        </motion.header>
    );
}
