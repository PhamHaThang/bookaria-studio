import { useQuery } from '@tanstack/react-query';
import { Library, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { auth, useAuth } from '@/features/auth/model/session';
import { NotificationsPopover } from '@/features/notifications/NotificationsPopover';
import { profileApi, profileKey } from '@/features/profile';
import { errorMessage } from '@/shared/api/errors';
import type { AuthUser } from '@/shared/contracts/api/auth.schema';
import type { Me } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Alert } from '@/shared/ui/Alert';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Spinner } from '@/shared/ui/primitives/spinner';

type Panel = 'account' | 'notifications' | null;
type AccountVariant = 'full' | 'compact';

function SignedInActions({
    user,
    variant,
}: {
    user: AuthUser & Partial<Pick<Me, 'avatarUrl'>>;
    variant: AccountVariant;
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
        if (params.get('notifications') !== 'open') return;
        setPanel('notifications');
        setParams(
            (current) => {
                const next = new URLSearchParams(current);
                next.delete('notifications');
                return next;
            },
            { replace: true },
        );
    }, [params, setParams]);

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

    return (
        <div className="header-account-actions flex items-center gap-3">
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
                            variant === 'full' && 'max-w-68 justify-start gap-3 px-2 py-1.5',
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
                        <Avatar url={user.avatarUrl || null} />
                        {variant === 'full' && (
                            <span className="min-w-0 text-left" aria-hidden="true">
                                <span className="block truncate font-semibold text-sm">
                                    {user.displayName}
                                </span>
                                <span className="mt-0.5 block truncate font-normal text-muted-foreground text-xs">
                                    {user.email}
                                </span>
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    ref={menu}
                    align="end"
                    sideOffset={8}
                    className="w-64 max-w-[calc(100vw-32px)]"
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
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            <span className="wrap-anywhere block font-semibold">
                                {user.displayName}
                            </span>
                            <span className="wrap-anywhere mt-1 block font-normal text-muted-foreground">
                                {user.email}
                            </span>
                        </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild disabled={signingOut}>
                            <Link to="/books" onClick={() => changePanel('account', false)}>
                                <Library aria-hidden="true" />
                                Sách của tôi
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild disabled={signingOut}>
                            <Link to="/profile" onClick={() => changePanel('account', false)}>
                                <UserRound aria-hidden="true" />
                                Hồ sơ
                            </Link>
                        </DropdownMenuItem>
                        {user.role === 'ADMIN' && (
                            <DropdownMenuItem asChild disabled={signingOut}>
                                <Link to="/admin" onClick={() => changePanel('account', false)}>
                                    <ShieldCheck aria-hidden="true" />
                                    Quản trị
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
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
                            {signingOut ? (
                                <Spinner aria-hidden="true" />
                            ) : (
                                <LogOut aria-hidden="true" />
                            )}
                            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function HeaderAccountActions({ variant = 'full' }: { variant?: AccountVariant }) {
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
    return account ? (
        <SignedInActions key={`${account.id}:${pathname}`} user={account} variant={variant} />
    ) : null;
}
