import { Box, Plus } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { libraryAssetLocation } from '@/features/assets/model/search';
import { AssetCatalog } from '@/features/assets/ui/AssetCatalog';
import { NarrationGenerator } from '@/features/assets/ui/NarrationGenerator';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { StudioPageHeader } from '@/shared/ui/StudioPageHeader';

export function AssetsPage() {
    const [params, setParams] = useSearchParams();
    const { user } = useAuth();
    if (params.get('scope') === 'library')
        return <Navigate to={libraryAssetLocation(params)} replace />;
    return (
        <>
            <StudioPageHeader
                title="Tài nguyên của tôi"
                description="Quản lý hình ảnh, âm thanh, video và mô hình 3D dùng trong sách."
                actions={
                    <>
                        <NarrationGenerator
                            key={user?.id}
                            onSaved={() => setParams({ type: 'AUDIO' }, { replace: true })}
                        />
                        <Button variant="outline" asChild>
                            <Link
                                to={{ pathname: '/assets/generate-3d', search: params.toString() }}
                                aria-haspopup="dialog"
                            >
                                <Box data-icon="inline-start" aria-hidden="true" />
                                Tạo 3D từ ảnh
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link
                                to={{ pathname: '/assets/upload', search: params.toString() }}
                                aria-haspopup="dialog"
                            >
                                <Plus data-icon="inline-start" aria-hidden="true" />
                                Tải tài nguyên
                            </Link>
                        </Button>
                    </>
                }
            />
            <AssetCatalog scope="mine" />
        </>
    );
}
