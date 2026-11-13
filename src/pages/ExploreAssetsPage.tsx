import { LogIn } from 'lucide-react';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { LibraryAssetGridSkeleton } from '@/features/assets/ui/LibraryAssetGrid';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';

export function ExploreAssetsPage() {
    const { user, status } = useAuth();
    return (
        <>
            <header data-stable-scroll-overlays className="pt-3 pb-7 sm:pt-7 sm:pb-9">
                <h1 className="m-0 font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
                    Thư viện tài nguyên
                </h1>
                <p className="mt-3 mb-0 max-w-[58ch] text-muted-foreground text-sm leading-relaxed sm:text-base">
                    Khám phá những tài nguyên dùng chung được chia sẻ của Bookaria.
                </p>
            </header>
            {status === 'loading' ? (
                <LibraryAssetGridSkeleton />
            ) : user ? (
                <AssetCatalog scope="library" />
            ) : (
                <Empty className="gap-5 px-4 py-9 sm:py-12">
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className="mb-2 size-12 rounded-xl">
                            <LogIn className="size-6" aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>
                            <h2>Đăng nhập để xem thư viện</h2>
                        </EmptyTitle>
                        <EmptyDescription>
                            Dùng tài khoản Bookaria để tìm và xem trước tài nguyên dùng chung.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button asChild>
                            <AuthDialogLink mode="login">Đăng nhập</AuthDialogLink>
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </>
    );
}
