import { useMotionTokens, useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/shared/ui/primitives/navigation-menu';

export type PublicNavigationLink = {
    to: string;
    label: string;
};

type PublicHeaderNavigationProps = {
    links: readonly PublicNavigationLink[];
    activePath: string | null;
};

const linkClassName =
    'group/public-nav relative inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border-b-2 border-transparent px-4 py-2 text-sm font-medium text-foreground/75 transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[active]:border-transparent data-[active]:text-foreground motion-reduce:transition-none max-sm:px-1.5';
const hoverLine = (
    <span
        aria-hidden="true"
        data-public-nav-hover-underline=""
        className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-foreground/30 opacity-0 group-hover/public-nav:opacity-100 group-focus-visible/public-nav:opacity-100 group-data-[active]/public-nav:opacity-0 max-sm:inset-x-1"
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
            const rect = underline.getBoundingClientRect();
            const next = { x: rect.left - list.getBoundingClientRect().left, width: rect.width };
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
        <NavigationMenu
            viewport={false}
            aria-label="Điều hướng chính"
            className="justify-self-center max-lg:order-3 max-lg:col-span-full max-lg:w-full max-lg:max-w-none max-lg:justify-start max-lg:overflow-x-auto max-lg:pt-1"
        >
            <NavigationMenuList
                ref={listRef}
                className="relative gap-0 max-lg:mx-auto max-lg:flex-none sm:gap-2"
            >
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
