import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PublicBookDialog } from '@/features/discovery/PublicBookDialog';
import { LoadingScreen } from '@/shared/ui/LoadingScreen';
import { PublicHeader } from './PublicHeader';
import { SiteFooter } from './SiteFooter';

export function PublicLayout() {
    const { pathname } = useLocation();
    const titles: Record<string, string> = {
        '/': 'Bookaria - Đọc và tạo sách tương tác',
        '/library': 'Khám phá | Bookaria',
        '/help': 'Hướng dẫn | Bookaria',
        '/profile': 'Hồ sơ | Bookaria',
        '/change-password': 'Đổi mật khẩu | Bookaria',
    };
    const pageTitle =
        titles[pathname] ||
        (pathname.startsWith('/authors/')
            ? 'Tác giả | Bookaria'
            : 'Không tìm thấy trang | Bookaria');
    useEffect(() => {
        const previousTitle = document.title;
        document.title = pageTitle;
        return () => {
            document.title = previousTitle;
        };
    }, [pageTitle]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on page changes while keeping library filters from resetting scroll.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return (
        <div className="public-shell flex min-h-dvh flex-col bg-background">
            <PublicHeader />
            <main
                id="main"
                tabIndex={-1}
                className={
                    pathname === '/'
                        ? 'public-main min-w-0 flex-1'
                        : pathname === '/library'
                          ? 'public-main mx-auto w-full min-w-0 max-w-[1328px] flex-1 px-6 pt-8 pb-16'
                          : 'public-main mx-auto w-full max-w-320 flex-1 px-6 py-12 sm:px-8'
                }
            >
                <Suspense fallback={<LoadingScreen message="Đang mở trang…" />}>
                    <Outlet />
                </Suspense>
            </main>
            <SiteFooter />
            <PublicBookDialog />
        </div>
    );
}
