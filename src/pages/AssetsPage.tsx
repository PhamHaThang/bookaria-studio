import { Plus } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { libraryAssetLocation } from '@/features/assets/model/search';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { Button } from '@/shared/ui/Button';

export function AssetsPage() {
    const [params] = useSearchParams();
    if (params.get('scope') === 'library')
        return <Navigate to={libraryAssetLocation(params)} replace />;
    return (
        <>
            <header className="mb-7 flex flex-wrap items-center justify-between gap-4 sm:mb-9">
                <div className="min-w-0">
                    <h1 className="m-0 font-semibold text-3xl sm:text-4xl">Tài nguyên của tôi</h1>
                    <p className="m-0 mt-2 text-muted-foreground text-sm">
                        Quản lý hình ảnh, âm thanh, video và mô hình 3D dùng trong sách.
                    </p>
                </div>
                <Button asChild>
                    <Link
                        to={{ pathname: '/assets/upload', search: params.toString() }}
                        aria-haspopup="dialog"
                    >
                        <Plus data-icon="inline-start" aria-hidden="true" />
                        Tải tài nguyên
                    </Link>
                </Button>
            </header>
            <AssetCatalog scope="mine" />
        </>
    );
}
