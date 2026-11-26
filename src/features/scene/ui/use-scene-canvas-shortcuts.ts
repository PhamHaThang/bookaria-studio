import { type Dispatch, type RefObject, type SetStateAction, useEffect } from 'react';
import type { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { Scene } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import type { AnnotationObject } from '../model/annotation-placement';

type ShortcutProps = {
    disabled: boolean;
    annotationToPlace?: AnnotationObject;
    selectedIds: string[];
    scene: Scene;
};

type ShortcutCommands = {
    shift: (active: boolean) => void;
    pan: (active: boolean) => void;
    cancel: () => boolean;
    isDragging: () => boolean;
    getMode: () => TransformControls['mode'];
    focus: () => void;
};

export function useSceneCanvasShortcuts(
    host: RefObject<HTMLDivElement | null>,
    latest: RefObject<ShortcutProps>,
    api: RefObject<ShortcutCommands | null>,
    setMode: Dispatch<SetStateAction<TransformControls['mode']>>,
    setSnap: Dispatch<SetStateAction<boolean>>,
    setSpace: Dispatch<SetStateAction<TransformControls['space']>>,
) {
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (
                event.defaultPrevented ||
                document.querySelector(
                    '[role=dialog], [role=alertdialog], [role=menu], [data-slot=select-content][data-state=open]',
                )
            )
                return;
            if (
                (event.target as HTMLElement)?.closest(
                    'input,textarea,select,[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"],[data-slot="accordion-trigger"],[contenteditable="true"]',
                ) ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            )
                return;
            if (document.getElementById('scene-heading')?.closest('[hidden]')) return;
            const value = event.key.toLowerCase();
            if (value === 'shift') api.current?.shift(true);
            if (event.code === 'Space' && event.target === host.current?.querySelector('canvas')) {
                event.preventDefault();
                api.current?.pan(true);
                return;
            }
            if (value === 'escape' && api.current?.cancel()) {
                event.preventDefault();
                return;
            }
            if (
                latest.current.disabled ||
                latest.current.annotationToPlace ||
                api.current?.isDragging()
            )
                return;
            if (
                value === 'l' &&
                latest.current.selectedIds.length <= 1 &&
                api.current?.getMode() !== 'scale'
            )
                setSpace((current) => (current === 'world' ? 'local' : 'world'));
            if (value === 'n') setSnap((current) => !current);
            if (value === 'w') setMode('translate');
            if (
                value === 'e' &&
                !latest.current.scene.objects.some(
                    (object) =>
                        facesCamera(object) && latest.current.selectedIds.includes(object.id),
                )
            )
                setMode('rotate');
            if (value === 'r') setMode('scale');
            if (value === 'f') api.current?.focus();
        };
        const release = (event: KeyboardEvent) => {
            if (event.key === 'Shift') api.current?.shift(false);
            if (event.code === 'Space') api.current?.pan(false);
        };
        window.addEventListener('keydown', key);
        window.addEventListener('keyup', release);
        return () => {
            window.removeEventListener('keydown', key);
            window.removeEventListener('keyup', release);
        };
    }, [api, host, latest, setMode, setSnap, setSpace]);
}
