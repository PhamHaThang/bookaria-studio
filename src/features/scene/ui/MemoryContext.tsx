import { createContext, useContext } from 'react';
import type { WorkflowVariable } from '@/shared/contracts/scene.schema';
export const MemoryContext = createContext<{
    definitions: WorkflowVariable[];
    currentValues?: Record<string, boolean | number | string> | null;
    disabled: boolean;
    canCreate?: boolean;
    manage: (select?: (definition: WorkflowVariable) => void) => void;
}>({ definitions: [], disabled: false, manage: () => {} });
export const useMemory = () => useContext(MemoryContext);
