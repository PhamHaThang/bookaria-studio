import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, PanelsTopLeft, ShieldCheck, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { NotificationsPopover } from '@/features/notifications/NotificationsPopover';
import { profileApi, profileKey } from '@/features/profile';
import { errorMessage } from '@/shared/api/errors';
import type { AuthUser } from '@/shared/contracts/api/auth.schema';
import type { Me } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { Avatar } from '@/shared/ui/Avatar';
import { AvatarBadge } from '@/shared/ui/primitives/avatar';
import { Button } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { getStudioSection } from './studio-navigation';

type Panel = 'account' | 'notifications' | null;
type AccountVariant = 'full' | 'compact' | 'menu';

function SignedInActions({
    user,
    variant,
    children,
}: {
    user: AuthUser & Partial<Pick<Me, 'avatarUrl'>>;
    variant: AccountVariant;
    children?: ReactNode;
}) {
    const [panel, setPanel] = useState<Panel>(null);
    const [error, setError] = useState<string | null>(null);
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const { signingOut } = useAuth();
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const hover = useRef(false);
    const menu = useRef<HTMLDivElement>(null);

    useEffect(() => () => clearTimeout(timer.current), []);
    useEffect(() => {
        if (variant === 'menu' || params.get('notifications') !== 'open') return;
        setPanel('notifications');
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('notifications');
                return next;
            },
            { replace: true },
        );
    }, [params, setParams, variant]);

    function changePanel(name: Exclude<Panel, null>, open: boolean) {
        clearTimeout(timer.current);
        setPanel((current) => (open ? name : current === name ? null : current));
    }
    function leave() {
        if (!hover.current) return;
        timer.current = setTimeout(
            () => setPanel((current) => (current === 'account' ? null : current)),
            180,
        );
    }
    async function logout() {
        if (auth.store.getState().signingOut) return;
        hover.current = false;
        clearTimeout(timer.current);
        setError(null);
        try {
            await auth.logout();
            navigate('/', { replace: true });
        } catch (cause) {
            if (auth.store.getState().user?.id === user.id) setError(errorMessage(cause));
        }
    }

    const accountMenuItems = (
        <>
            <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2 [&_[data-slot=avatar]]:size-10">
                    <Avatar url={user.avatarUrl || null} name={user.displayName} />
                    <span className="min-w-0">
                        <span className="wrap-anywhere block font-semibold text-foreground text-sm">
                            {user.displayName}
                        </span>
                        <span className="wrap-anywhere mt-1 block font-normal text-muted-foreground text-xs">
                            {user.email}
                        </span>
                    </span>
                </DropdownMenuLabel>
            </DropdownMenuGroup>
            {children}
            <DropdownMenuGroup className="space-y-1">
                <DropdownMenuItem asChild disabled={signingOut}>
                    <NavLink to="/profile" onClick={() => changePanel('account', false)}>
                        <UserRound aria-hidden="true" />
                        Hồ sơ
                    </NavLink>
                </DropdownMenuItem>
                {user.role === 'ADMIN' && (
                    <DropdownMenuItem asChild disabled={signingOut}>
                        <NavLink to="/admin" onClick={() => changePanel('account', false)}>
                            <ShieldCheck aria-hidden="true" />
                            Quản trị
                        </NavLink>
                    </DropdownMenuItem>
                )}
            </DropdownMenuGroup>
            <DropdownMenuGroup>
                {error && (
                    <DropdownMenuLabel>
                        <Alert tone="danger">{error}</Alert>
                    </DropdownMenuLabel>
                )}
                <DropdownMenuItem
                    variant="destructive"
                    disabled={signingOut}
                    onSelect={(event) => {
                        event.preventDefault();
                        void logout();
                    }}
                >
                    {signingOut ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                    {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </DropdownMenuItem>
            </DropdownMenuGroup>
        </>
    );

    if (variant === 'menu') return accountMenuItems;

    return (
        <div className="header-account-actions flex items-center gap-3 max-sm:gap-2">
            <NotificationsPopover
                userId={user.id}
                open={panel === 'notifications'}
                preventCloseFocus={panel === 'account'}
                onOpenChange={(open) => changePanel('notifications', open)}
            />
            <DropdownMenu
                modal={false}
                open={panel === 'account'}
                onOpenChange={(open) => changePanel('account', open)}
            >
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size={variant === 'compact' ? 'icon' : 'default'}
                        className={cn(
                            'group/account',
                            variant === 'full'
                                ? 'h-11 max-w-60 justify-start gap-2.5 rounded-xl px-2 py-0.5 focus-visible:bg-hover focus-visible:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground max-sm:size-11 max-sm:p-0.5 [&_[data-slot=avatar]]:size-9'
                                : 'relative size-10 rounded-full p-0 max-lg:hidden [&_[data-slot=avatar]]:size-10 [&_[data-slot=avatar]]:after:border-0',
                        )}
                        data-account-variant={variant}
                        aria-label={`Tài khoản của ${user.displayName}`}
                        onPointerEnter={(event) => {
                            if (event.pointerType !== 'mouse') return;
                            hover.current = true;
                            changePanel('account', true);
                        }}
                        onPointerLeave={leave}
                        onPointerDown={(event) => {
                            if (hover.current && panel === 'account' && event.button === 0)
                                event.preventDefault();
                            hover.current = false;
                            clearTimeout(timer.current);
                        }}
                        onKeyDown={(event) => {
                            hover.current = false;
                            clearTimeout(timer.current);
                            if (
                                panel === 'account' &&
                                (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                            ) {
                                event.preventDefault();
                                const items = menu.current?.querySelectorAll<HTMLElement>(
                                    '[role="menuitem"]:not([data-disabled])',
                                );
                                (event.key === 'ArrowDown'
                                    ? items?.[0]
                                    : items?.[items.length - 1]
                                )?.focus();
                            }
                        }}
                    >
                        <Avatar url={user.avatarUrl || null} name={user.displayName} />
                        {variant === 'compact' && (
                            <AvatarBadge
                                className="size-2.5 bg-success-solid ring-surface"
                                aria-hidden="true"
                            />
                        )}
                        {variant === 'full' && (
                            <span className="min-w-0 text-left max-sm:hidden" aria-hidden="true">
                                <span className="block truncate font-semibold text-sm leading-tight">
                                    {user.displayName}
                                </span>
                                <span className="mt-0.5 block truncate font-normal text-muted-foreground text-xs transition-colors group-hover/account:text-foreground group-focus-visible/account:text-foreground group-data-[state=open]/account:text-foreground">
                                    {user.email}
                                </span>
                            </span>
                        )}
                        {variant === 'full' && (
                            <ChevronDown
                                className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-[state=open]/account:rotate-180 motion-reduce:transition-none max-sm:hidden"
                                aria-hidden="true"
                            />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    ref={menu}
                    align="end"
                    sideOffset={8}
                    className={cn(
                        'w-72 max-w-[calc(100vw-32px)] space-y-1 p-2 [&_[data-slot=dropdown-menu-item]]:gap-3 [&_[data-slot=dropdown-menu-item]]:rounded-lg [&_[data-slot=dropdown-menu-item]]:px-3',
                        variant === 'compact' && 'max-lg:hidden',
                    )}
                    aria-label="Menu tài khoản"
                    onPointerEnter={() => clearTimeout(timer.current)}
                    onPointerLeave={leave}
                    onKeyDown={() => {
                        hover.current = false;
                        clearTimeout(timer.current);
                    }}
                    onCloseAutoFocus={(event) => {
                        if (hover.current || panel === 'notifications') event.preventDefault();
                    }}
                >
                    {accountMenuItems}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function HeaderAccountActions({
    variant = 'full',
    showStudio = false,
    children,
}: {
    variant?: AccountVariant;
    showStudio?: boolean;
    children?: ReactNode;
}) {
    const { user } = useAuth();
    const { pathname } = useLocation();
    const profile = useQuery({
        queryKey: profileKey(user?.id || ''),
        queryFn: ({ signal }) => profileApi.get(signal),
        enabled: Boolean(user),
        staleTime: 60000,
        refetchOnWindowFocus: false,
    });
    const account = profile.data?.id === user?.id ? profile.data : user;
    if (variant === 'menu')
        return account ? (
            <SignedInActions user={account} variant="menu">
                {children}
            </SignedInActions>
        ) : null;

    return account ? (
        <div className="flex items-center gap-3 max-sm:gap-2">
            {showStudio && (
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="studio-entry min-h-10 shrink-0 rounded-full border-transparent px-4 max-sm:size-10 max-sm:px-0"
                >
                    <Link
                        to="/studio"
                        aria-label="Studio Editor"
                        aria-current={getStudioSection(pathname) ? 'page' : undefined}
                    >
                        <PanelsTopLeft data-icon="inline-start" aria-hidden="true" />
                        <span className="max-sm:sr-only">Studio Editor</span>
                    </Link>
                </Button>
            )}
            <SignedInActions key={`${account.id}:${pathname}`} user={account} variant={variant} />
        </div>
    ) : null;
}
