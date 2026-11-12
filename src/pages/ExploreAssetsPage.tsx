import { FolderOpen } from 'lucide-react';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { useAuth } from '@/features/auth';
import { AuthDialogLink } from '@/features/auth/ui/AuthDialogLink';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
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
            <div className="mb-7">
                <h1 className="font-semibold text-[28px] tracking-tight">Thư viện tài nguyên</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                    Khám phá hình ảnh, âm thanh, video và mô hình 3D cho sách của bạn.
                </p>
            </div>
            {status === 'loading' ? (
                <LoadingState layout="assets">Đang tải tài nguyên…</LoadingState>
            ) : user ? (
                <AssetCatalog scope="library" />
            ) : (
                <Empty className="py-16">
                    <EmptyHeader>
                        <EmptyMedia>
                            <FolderOpen size={38} aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>Thư viện tài nguyên Bookaria</EmptyTitle>
                        <EmptyDescription>
                            Đăng nhập để xem trước hình ảnh, âm thanh, video và mô hình 3D dùng
                            chung cho sách của bạn.
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
