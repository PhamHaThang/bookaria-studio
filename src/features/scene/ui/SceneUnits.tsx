import { createContext, type ReactNode, useContext } from 'react';
import { REFERENCE_PAGE_WIDTH_MM } from '@/shared/contracts/marker.schema';

const PageWidthMmContext = createContext(REFERENCE_PAGE_WIDTH_MM);

export function SceneUnitsProvider({
    widthMm,
    children,
}: {
    widthMm: number;
    children: ReactNode;
}) {
    return <PageWidthMmContext.Provider value={widthMm}>{children}</PageWidthMmContext.Provider>;
}

export function useSceneWidthMm() {
    return useContext(PageWidthMmContext);
}
