import { createContext } from 'react';

/** A route may keep one waiting surface alive across nested loading boundaries. */
export type RouteLoadingOwner = {
    fullScreen: boolean;
    booting: boolean;
    claim: () => () => void;
    parent: RouteLoadingOwner | null;
};
export const RouteLoadingContext = createContext<RouteLoadingOwner | null>(null);
