import { AssetUploadDialog } from '@/features/assets/ui/AssetUploadDialog';
import { ModelGenerationDialog } from '@/features/assets/ui/ModelGenerationDialog';
import { AssetsPage } from './AssetsPage';

export function AssetUploadPage({ generateModel = false }: { generateModel?: boolean }) {
    return (
        <>
            <AssetsPage />
            {generateModel ? <ModelGenerationDialog /> : <AssetUploadDialog />}
        </>
    );
}
