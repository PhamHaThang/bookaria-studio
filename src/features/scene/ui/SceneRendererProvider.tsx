import {
    createContext,
    type ReactNode,
    type RefObject,
    useContext,
    useEffect,
    useRef,
} from 'react';
import type { WebGLRenderer } from 'three';

const SceneRendererContext = createContext<RefObject<WebGLRenderer | null> | null>(null);

export function SceneRendererProvider({ children }: { children: ReactNode }) {
    const renderer = useRef<WebGLRenderer | null>(null);
    useEffect(() => {
        return () => {
            renderer.current?.dispose();
            renderer.current?.forceContextLoss();
            renderer.current = null;
        };
    }, []);
    return (
        <SceneRendererContext.Provider value={renderer}>{children}</SceneRendererContext.Provider>
    );
}

export function useBookSceneRenderer() {
    return useContext(SceneRendererContext);
}
