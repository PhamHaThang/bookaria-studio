import { memo, type ReactNode } from 'react';

/** Keep the last panel contents during exit; the surrounding aside is inert while closed. */
export const SceneInspectorContent = memo(
    function SceneInspectorContent({ children }: { active: boolean; children: ReactNode }) {
        return children;
    },
    (_previous, next) => !next.active,
);
