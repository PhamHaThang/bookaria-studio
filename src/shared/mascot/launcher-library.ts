import type { AvatarLibrary } from '@bible-strong/avatar-core';
import { library } from './data';

// Launcher gestures stay quieter and longer than task/status expressions elsewhere.
export const launcherLibrary: AvatarLibrary = {
    ...library,
    clips: [
        ...(library.clips ?? []),
        {
            name: 'Boki Gentle Success',
            duration: 1.8,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64] },
                    { t: 1.8, v: [0.64] },
                ],
                position: [
                    { t: 0, v: [0, 0] },
                    { t: 0.7, v: [0, 0.05], ease: [0.22, 1, 0.36, 1] },
                    { t: 1.8, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0] },
                    { t: 0.7, v: [0, 0, 4] },
                    { t: 1.8, v: [0, 0, 0] },
                ],
            },
        },
        {
            name: 'Boki Attend',
            duration: 1.2,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64] },
                    { t: 1.2, v: [0.64] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0] },
                    { t: 0.6, v: [-3, 0, 3], ease: [0.22, 1, 0.36, 1] },
                    { t: 1.2, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                eyeSize: [
                    { t: 0, v: [1] },
                    { t: 0.55, v: [1.05] },
                    { t: 1.2, v: [1] },
                ],
            },
        },
        {
            name: 'Boki Gentle Press',
            duration: 0.72,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64] },
                    { t: 0.72, v: [0.64] },
                ],
                squash: [
                    { t: 0, v: [1, 1] },
                    { t: 0.24, v: [1.04, 0.96], ease: [0.22, 1, 0.36, 1] },
                    { t: 0.72, v: [1, 1], ease: [0.22, 1, 0.36, 1] },
                ],
            },
        },
        {
            name: 'Boki Gentle Error',
            duration: 2.2,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64] },
                    { t: 2.2, v: [0.64] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0] },
                    { t: 0.55, v: [0, -4, -2] },
                    { t: 1.1, v: [0, 4, 2] },
                    { t: 1.65, v: [0, -2, 0] },
                    { t: 2.2, v: [0, 0, 0] },
                ],
            },
        },
    ],
    states: library.states?.map((state) => {
        if (state.name === 'boki-hover')
            return { ...state, clips: ['Boki Attend'], face: 'inspecting' };
        if (state.name === 'boki-pressed')
            return { ...state, clips: ['Boki Gentle Press'], face: 'happy' };
        if (state.name === 'boki-error')
            return { ...state, clips: ['Boki Gentle Error'], next: 'boki-idle' };
        if (state.name === 'boki-success') return { ...state, clips: ['Boki Gentle Success'] };
        return state;
    }),
};
