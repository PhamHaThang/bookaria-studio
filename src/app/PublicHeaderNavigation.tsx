import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { LogIn, type LucideIcon, Menu, PanelsTopLeft, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/session';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/shared/ui/primitives/navigation-menu';
import { HeaderAccountActions } from './HeaderAccountActions';
import { getStudioSection } from './studio-navigation';

export type PublicNavigationLink = {
    to: string;
    label: string;
    icon: LucideIcon;
};

type PublicHeaderNavigationProps = {
    links: readonly PublicNavigationLink[];
    activePath: string | null;
};

const linkClassName =
    'group/public-nav relative inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border-b-2 border-transparent px-3 py-2 text-sm font-medium text-foreground/75 transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[active]:border-transparent data-[active]:text-foreground motion-reduce:transition-none max-sm:px-1.5';
const hoverLine = (
    <span
        aria-hidden="true"
        data-public-nav-hover-underline=""
        className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-0.5 origin-center scale-x-50 rounded-full bg-foreground/30 opacity-0 transition-[opacity,transform] duration-200 group-hover/public-nav:scale-x-100 group-hover/public-nav:opacity-100 group-focus-visible/public-nav:scale-x-100 group-focus-visible/public-nav:opacity-100 group-data-[active]/public-nav:opacity-0 motion-reduce:transition-none max-sm:inset-x-1"
    />
);

export function PublicHeaderNavigation({ links, activePath }: PublicHeaderNavigationProps) {
    const listRef = useRef<HTMLUListElement>(null);
    const [bounds, setBounds] = useState<{ x: number; width: number } | null>(null);
    const { spring } = useMotionTokens();
    const reduceMotion = useShouldReduceMotion();

    useLayoutEffect(() => {
        const list = listRef.current;
        const target =
            list &&
            [...list.querySelectorAll<HTMLElement>('[data-public-nav-path]')].find(
                (link) => link.dataset.publicNavPath === activePath,
            );
        if (!list || !target) {
            setBounds(null);
            return;
        }
        const measure = () => {
            const underline = target.querySelector<HTMLElement>(
                '[data-public-nav-hover-underline]',
            );
            if (!underline) return;
            const rect = target.getBoundingClientRect();
            const next = {
                x: rect.left - list.getBoundingClientRect().left + underline.offsetLeft,
                width: underline.offsetWidth,
            };
            setBounds((previous) =>
                previous?.x === next.x && previous.width === next.width ? previous : next,
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        observer.observe(target);
        return () => observer.disconnect();
    }, [activePath]);

    return (
        <NavigationMenu viewport={false} aria-label="Điều hướng chính" className="hidden lg:flex">
            <NavigationMenuList ref={listRef} className="relative gap-1">
                {links.map(({ to, label }) => (
                    <NavigationMenuItem key={to}>
                        <NavigationMenuLink
                            active={activePath === to}
                            className={linkClassName}
                            asChild
                        >
                            <Link
                                to={to}
                                data-public-nav-path={to}
                                aria-current={activePath === to ? 'page' : undefined}
                            >
                                {label}
                                {hoverLine}
                            </Link>
                        </NavigationMenuLink>
                    </NavigationMenuItem>
                ))}
                {bounds && (
                    <li aria-hidden="true" className="pointer-events-none absolute inset-0">
                        <motion.span
                            data-public-nav-underline=""
                            className="absolute bottom-0 left-0 h-0.5 w-[100px] origin-left rounded-full bg-foreground"
                            initial={false}
                            animate={{ x: bounds.x, scaleX: bounds.width / 100 }}
                            transition={reduceMotion ? { duration: 0 } : spring.selection}
                        />
                    </li>
                )}
            </NavigationMenuList>
        </NavigationMenu>
    );
}

export function PublicMobileNavigation({ links, activePath }: PublicHeaderNavigationProps) {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const navigation = (
        <DropdownMenuGroup className="space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} asChild>
                    <Link to={to} aria-current={activePath === to ? 'page' : undefined}>
                        <Icon aria-hidden="true" />
                        {label}
                    </Link>
                </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
    );
    return (
        <DropdownMenu key={user?.id ?? 'guest'} modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full lg:hidden"
                    aria-label="Mở điều hướng"
                >
                    <Menu className="size-5" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={12}
                collisionPadding={16}
                className="w-72 max-w-[calc(100vw-32px)] space-y-1 p-2 lg:hidden [&_[data-slot=dropdown-menu-item]]:gap-3 [&_[data-slot=dropdown-menu-item]]:rounded-lg [&_[data-slot=dropdown-menu-item]]:px-3"
            >
                {user ? (
                    <HeaderAccountActions variant="menu">
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                asChild
                                className="studio-entry border border-transparent font-medium"
                            >
                                <Link
                                    to="/studio"
                                    aria-current={getStudioSection(pathname) ? 'page' : undefined}
                                >
                                    <PanelsTopLeft className="-ml-px" aria-hidden="true" />
                                    Studio Editor
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        {navigation}
                    </HeaderAccountActions>
                ) : (
                    <>
                        {navigation}
                        <DropdownMenuGroup className="space-y-1">
                            <DropdownMenuItem asChild>
                                <AuthDialogLink mode="login">
                                    <LogIn aria-hidden="true" />
                                    Đăng nhập
                                </AuthDialogLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <AuthDialogLink mode="register">
                                    <UserPlus aria-hidden="true" />
                                    Đăng ký
                                </AuthDialogLink>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
