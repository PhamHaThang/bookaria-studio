import type { AvatarLibrary } from '@bible-strong/avatar-core';
export const characters = {
    light: {
        body: {
            primary: { type: 'sphere', width: 224, height: 224, depth: 224, roundness: 1 },
            nodes: [],
        },
        face: {
            eyes: { width: 1, height: 1, gap: 1.08, shiftY: -0.058333333333333334 },
            nose: {
                enabled: false,
                shape: 'inverted-triangle',
                roundness: 50,
                width: 14,
                height: 11,
                x: 0,
                y: 22,
                angle: 0,
            },
            mouth: {
                enabled: false,
                shape: 'curve',
                curve: 45,
                width: 20,
                height: 6,
                x: 0,
                y: 35,
                angle: 0,
            },
            perspective: 0.15,
        },
        name: 'Boki Bookaria Light',
        colors: { body: '#242424', eyes: '#ffffff' },
        style: { outline: { enabled: true, color: '#ffffff', width: 4, opacity: 1 } },
    },
    dark: {
        body: {
            primary: { type: 'sphere', width: 224, height: 224, depth: 224, roundness: 1 },
            nodes: [],
        },
        face: {
            eyes: { width: 1, height: 1, gap: 1.08, shiftY: -0.058333333333333334 },
            nose: {
                enabled: false,
                shape: 'inverted-triangle',
                roundness: 50,
                width: 14,
                height: 11,
                x: 0,
                y: 22,
                angle: 0,
            },
            mouth: {
                enabled: false,
                shape: 'curve',
                curve: 45,
                width: 20,
                height: 6,
                x: 0,
                y: 35,
                angle: 0,
            },
            perspective: 0.15,
        },
        name: 'Boki Bookaria Dark',
        colors: { body: '#ffffff', eyes: '#242424' },
        style: { outline: { enabled: true, color: '#242424', width: 4, opacity: 1 } },
    },
} as const;
export const library: AvatarLibrary = {
    clips: [
        {
            name: 'Boki Breathe',
            duration: 5,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 5, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                position: [
                    { t: 0, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.5, v: [0, 0.025], ease: [0.42, 0, 0.58, 1] },
                    { t: 5, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.5, v: [0, 3, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 5, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Glance',
            duration: 5.6,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 5.6, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [0, -9, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.5, v: [0, -9, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [0, 8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 5.6, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Hello',
            duration: 1.8,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.8, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.4, v: [0, 0, 9], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.9, v: [0, 0, -7], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.35, v: [0, 0, 4], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.8, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                position: [
                    { t: 0, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.45, v: [0, 0.08], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.1, v: [0, 0.03], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.8, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Notice',
            duration: 0.8,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.8, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.35, v: [-5, 0, 5], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.8, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                eyeSize: [
                    { t: 0, v: [1], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.3, v: [1.12], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.8, v: [1], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Press',
            duration: 0.36,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.36, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                squash: [
                    { t: 0, v: [1, 1], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.12, v: [1.06, 0.94], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.36, v: [1, 1], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Read',
            duration: 4.8,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 4.8, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [5, -8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [5, 8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.2, v: [5, 8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.5, v: [5, -8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [5, 8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 4.8, v: [5, -8, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Ponder',
            duration: 4,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [-6, -8, 5], ease: [0.42, 0, 0.58, 1] },
                    { t: 2, v: [-10, 9, -4], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [-6, -8, 5], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Scan',
            duration: 4,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, -16, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.6, v: [0, 16, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 2, v: [0, 16, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 3.6, v: [0, -16, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 4, v: [0, -16, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Busy',
            duration: 2.4,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.4, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                position: [
                    { t: 0, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.2, v: [0, 0.045], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.4, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, -3], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.2, v: [0, 0, 3], ease: [0.42, 0, 0.58, 1] },
                    { t: 2.4, v: [0, 0, -3], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Nod',
            duration: 1.1,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.1, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.35, v: [12, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.7, v: [-4, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.1, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Yay',
            duration: 1.5,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                position: [
                    { t: 0, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.2, v: [0, -0.025], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.5, v: [0, 0.13], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.85, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.1, v: [0, 0.04], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
                squash: [
                    { t: 0, v: [1, 1], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.2, v: [1.05, 0.95], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.5, v: [0.97, 1.03], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.85, v: [1.04, 0.96], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [1, 1], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.5, v: [0, -5, 7], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.5, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Oops',
            duration: 4.8,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 4.8, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                rotation: [
                    { t: 0, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.25, v: [0, -8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.5, v: [0, 8, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 0.75, v: [0, -4, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 1.1, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 4.8, v: [0, 0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
        {
            name: 'Boki Quiet',
            duration: 6,
            squashAnchor: 0,
            tracks: {
                scale: [
                    { t: 0, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                    { t: 6, v: [0.64], ease: [0.42, 0, 0.58, 1] },
                ],
                position: [
                    { t: 0, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                    { t: 3, v: [0, 0.012], ease: [0.42, 0, 0.58, 1] },
                    { t: 6, v: [0, 0], ease: [0.42, 0, 0.58, 1] },
                ],
            },
        },
    ],
    states: [
        {
            name: 'boki-idle',
            clips: ['Boki Breathe', 'Boki Breathe', 'Boki Glance'],
            face: 'neutral',
            compactClips: ['Boki Breathe'],
        },
        { name: 'boki-welcome', clips: ['Boki Hello'], face: 'Boki Wink', next: 'boki-idle' },
        { name: 'boki-hover', clips: ['Boki Notice'], face: 'inspecting' },
        { name: 'boki-pressed', clips: ['Boki Press'], face: 'happy', next: 'boki-idle' },
        { name: 'boki-reading', clips: ['Boki Read'], face: 'neutral' },
        { name: 'boki-thinking', clips: ['Boki Ponder'], face: 'inspecting', morph: 'thinking' },
        { name: 'boki-searching', clips: ['Boki Scan'], face: 'inspecting', morph: 'radar' },
        { name: 'boki-loading', clips: ['Boki Busy'], face: 'neutral', morph: 'progress' },
        { name: 'boki-uploading', clips: ['Boki Busy'], face: 'calm', morph: 'uploading' },
        { name: 'boki-saving', clips: ['Boki Busy'], face: 'calm', morph: 'writing' },
        { name: 'boki-success', clips: ['Boki Yay'], face: 'happy', next: 'boki-idle' },
        { name: 'boki-error', clips: ['Boki Oops'], face: 'sad' },
        { name: 'boki-warning', clips: ['Boki Notice'], face: 'surprised' },
        { name: 'boki-empty', clips: ['Boki Glance'], face: 'calm' },
        { name: 'boki-offline', clips: ['Boki Quiet'], face: 'sad' },
        { name: 'boki-sleeping', clips: ['Boki Quiet'], face: 'sleepy' },
        { name: 'boki-disabled', clips: ['Boki Quiet'], face: 'calm' },
        { name: 'boki-scanning', clips: ['Boki Scan'], face: 'inspecting' },
        { name: 'boki-marker-found', clips: ['Boki Nod'], face: 'happy' },
        { name: 'boki-marker-lost', clips: ['Boki Glance'], face: 'confused' },
    ],
    faces: [
        {
            name: 'Boki Wink',
            blinks: false,
            eyes: {
                left: [{ d: 'M50 27V73', fill: false, stroke: { width: 42, cap: 'round' } }],
                right: [
                    { d: 'M26 57Q50 32 74 57', fill: false, stroke: { width: 13, cap: 'round' } },
                ],
            },
        },
    ],
};
