import { Plus } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { libraryAssetLocation } from '@/features/assets/model/search';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { buttonStyles } from '@/shared/ui/Button';

export function AssetsPage() {
    const [params] = useSearchParams();
    if (params.get('scope') === 'library')
        return <Navigate to={libraryAssetLocation(params)} replace />;
    return (
        <>
            <div className="mb-7 flex items-center justify-between gap-6">
                <div className="min-w-0">
                    <h1 className="font-semibold text-[28px] tracking-tight">Tài nguyên của tôi</h1>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Quản lý hình ảnh, âm thanh, video và mô hình 3D của bạn.
                    </p>
                </div>
                <Link
                    to={{ pathname: '/assets/upload', search: params.toString() }}
                    className={buttonStyles()}
                >
                    <Plus size={18} aria-hidden="true" />
                    Tải tài nguyên
                </Link>
            </div>
            <AssetCatalog scope="mine" />
        </>
    );
}
