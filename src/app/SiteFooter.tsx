import { ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { BookariaLogo, bookariaLogoLinkStyles } from '@/shared/ui/BookariaLogo';
import { Button } from '@/shared/ui/primitives/button';

export function SiteFooter() {
    const { user } = useAuth();
    return (
        <footer className="border-border border-t bg-surface">
            <div className="mx-auto max-w-[1328px] px-6">
                <div className="grid gap-10 py-16 sm:grid-cols-[2fr_1fr_1fr] sm:gap-16">
                    <div className="max-w-85">
                        <Link
                            to="/"
                            aria-label="Bookaria - Trang chủ"
                            className={bookariaLogoLinkStyles('inline-flex')}
                        >
                            <BookariaLogo className="w-36" />
                        </Link>
                        <p className="mt-5 mb-0 text-muted-foreground text-sm leading-relaxed">
                            Khám phá và sáng tạo sách tương tác AR. Mở một cuốn sách, bắt đầu một
                            trải nghiệm mới.
                        </p>
                    </div>
                    <nav
                        aria-label="Khám phá Bookaria"
                        className="flex flex-col items-start gap-3 text-sm"
                    >
                        <h3 className="m-0 mb-2 font-semibold text-base">Khám phá</h3>
                        <Link
                            to="/"
                            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Trang chủ
                        </Link>
                        <Link
                            to="/library"
                            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Thư viện sách
                        </Link>
                        <Link
                            to="/help"
                            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                            Hướng dẫn
                        </Link>
                    </nav>
                    <nav
                        aria-label="Tài khoản Bookaria"
                        className="flex flex-col items-start gap-3 text-sm"
                    >
                        <h3 className="m-0 mb-2 font-semibold text-base">
                            {user ? 'Không gian của bạn' : 'Tham gia Bookaria'}
                        </h3>
                        {user ? (
                            <>
                                <Link
                                    to="/books"
                                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Sách của tôi
                                </Link>
                                <Link
                                    to="/profile"
                                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Hồ sơ cá nhân
                                </Link>
                            </>
                        ) : (
                            <>
                                <AuthDialogLink
                                    mode="register"
                                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Tạo tài khoản
                                </AuthDialogLink>
                                <AuthDialogLink
                                    mode="login"
                                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                >
                                    Đăng nhập
                                </AuthDialogLink>
                            </>
                        )}
                    </nav>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-border border-t py-5 text-muted-foreground text-sm">
                    <p className="m-0">
                        © {new Date().getFullYear()} Bookaria. All rights reserved.
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            window.scrollTo({
                                top: 0,
                                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                                    .matches
                                    ? 'instant'
                                    : 'smooth',
                            });
                            document
                                .querySelector<HTMLAnchorElement>('header a[href="/"]')
                                ?.focus({ preventScroll: true });
                        }}
                    >
                        Về đầu trang
                        <ArrowUp data-icon="inline-end" />
                    </Button>
                </div>
            </div>
        </footer>
    );
}
