import type { SceneObject } from '../contracts/scene.schema';

export type AudioKind = NonNullable<Extract<SceneObject, { type: 'audio' }>['audioKind']>;
export const AUDIO_KIND_OPTIONS = [
    { value: 'BGM', label: 'BGM — Nhạc nền' },
    { value: 'SFX', label: 'SFX — Hiệu ứng âm thanh' },
    { value: 'VOICE', label: 'Voice — Thuyết minh' },
] as const;
export const AUDIO_TAG_OPTIONS = AUDIO_KIND_OPTIONS.map((option) => ({
    ...option,
    value: option.value.toLowerCase(),
}));
export function audioKindFromTags(tags: readonly string[] = []): AudioKind {
    for (const tag of tags) {
        const kind = tag.trim().toUpperCase();
        if (kind === 'BGM' || kind === 'SFX' || kind === 'VOICE') return kind;
    }
    return 'BGM';
}
export function facesCamera(object: { type: string; billboard: boolean }) {
    return object.type === 'audio' || object.billboard;
}
