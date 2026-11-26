import * as THREE from 'three';
import type { SceneObject } from '../contracts/scene.schema';

type AudioObject = Extract<SceneObject, { type: 'audio' }>;
const audioKindLabel = {
    BGM: 'Nhạc nền',
    SFX: 'Hiệu ứng',
    VOICE: 'Thuyết minh',
};
export type AudioPlaybackState = {
    playing: boolean;
    waiting: boolean;
    currentTime: number;
    duration: number;
    error: string | null;
};
export function audioTime(value: number) {
    const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Event-driven playback state; canvas textures update at media event frequency, never per frame. */
export function observeAudio(
    element: HTMLAudioElement,
    changed: (state: AudioPlaybackState) => void,
) {
    let waiting = false;
    const update = (event?: Event) => {
        if (event?.type === 'waiting' || event?.type === 'loadstart') waiting = true;
        if (
            event?.type === 'playing' ||
            event?.type === 'canplay' ||
            event?.type === 'pause' ||
            event?.type === 'ended'
        )
            waiting = false;
        changed({
            playing: !element.paused && !element.ended && !element.error,
            waiting: waiting && !element.paused,
            currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
            duration: Number.isFinite(element.duration) ? element.duration : 0,
            error: element.error ? 'Không phát được âm thanh. Hãy thử lại.' : null,
        });
    };
    const events = [
        'play',
        'playing',
        'pause',
        'ended',
        'waiting',
        'canplay',
        'timeupdate',
        'loadedmetadata',
        'durationchange',
        'error',
        'loadstart',
    ];
    for (const event of events) element.addEventListener(event, update);
    update();
    return () => {
        for (const event of events) element.removeEventListener(event, update);
    };
}

export function createAudioCard(spec: AudioObject, duration = 0) {
    const width = 768,
        height = 208;
    const button = { x: 94, y: height / 2, radius: 56 };
    const contentLeft = 174;
    const contentRight = width - 34;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được thẻ âm thanh.');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
    });
    const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, (0.65 * height) / width),
        material,
    );
    surface.name = 'audio-card';
    surface.renderOrder = 100;
    const group = new THREE.Group();
    group.name = 'audio-card-content';
    group.add(surface);
    let disposed = false,
        key = '';
    let name = spec.name || 'Âm thanh';
    let fittedTitle: string | undefined;
    let kind = spec.audioKind || 'BGM';
    let state: AudioPlaybackState = {
        playing: false,
        waiting: false,
        currentTime: 0,
        duration,
        error: null,
    };
    function draw() {
        if (disposed || !ctx) return;
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.roundRect(2, 2, width - 4, height - 4, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#d4d4d4';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#242424';
        ctx.beginPath();
        ctx.arc(button.x, button.y, button.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        if (state.waiting) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(button.x, button.y, 21, -Math.PI / 2, Math.PI);
            ctx.stroke();
        } else if (state.playing) {
            ctx.fillRect(button.x - 16, button.y - 20, 11, 40);
            ctx.fillRect(button.x + 5, button.y - 20, 11, 40);
        } else {
            ctx.beginPath();
            ctx.moveTo(button.x - 13, button.y - 22);
            ctx.lineTo(button.x + 23, button.y);
            ctx.lineTo(button.x - 13, button.y + 22);
            ctx.closePath();
            ctx.fill();
        }

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#242424';
        ctx.font = '600 44px "Be Vietnam Pro", Arial, sans-serif';
        if (fittedTitle === undefined) {
            fittedTitle = name.normalize('NFC');
            const titleWidth = contentRight - contentLeft;
            if (ctx.measureText(fittedTitle).width > titleWidth) {
                const letters = Array.from(fittedTitle);
                while (letters.length && ctx.measureText(`${letters.join('')}…`).width > titleWidth)
                    letters.pop();
                fittedTitle = `${letters.join('')}…`;
            }
        }
        ctx.fillText(fittedTitle, contentLeft, 59);

        const total = state.duration > 0 ? state.duration : duration;
        ctx.font = '500 34px "Be Vietnam Pro", Arial, sans-serif';
        ctx.fillStyle = state.error ? '#b42318' : '#595959';
        ctx.fillText(
            state.error ? 'Lỗi phát · Thử lại' : state.waiting ? 'Đang tải…' : audioKindLabel[kind],
            contentLeft,
            118,
            300,
        );
        ctx.textAlign = 'right';
        ctx.fillStyle = '#595959';
        ctx.fillText(
            `${audioTime(state.currentTime)} / ${total > 0 ? audioTime(total) : '–:––'}`,
            contentRight,
            118,
            232,
        );

        const ratio = total > 0 ? Math.min(1, Math.max(0, state.currentTime / total)) : 0;
        const trackWidth = contentRight - contentLeft;
        const progressY = 162;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#dadada';
        ctx.beginPath();
        ctx.moveTo(contentLeft, progressY);
        ctx.lineTo(contentRight, progressY);
        ctx.stroke();
        if (ratio > 0) {
            ctx.strokeStyle = '#242424';
            ctx.beginPath();
            ctx.moveTo(contentLeft, progressY);
            ctx.lineTo(contentLeft + trackWidth * ratio, progressY);
            ctx.stroke();
        }
        texture.needsUpdate = true;
    }
    draw();
    if (document.fonts)
        void document.fonts.ready.then(() => {
            fittedTitle = undefined;
            draw();
        });
    return {
        group,
        setKind(next: AudioObject['audioKind']) {
            const value = next || 'BGM';
            if (kind === value) return;
            kind = value;
            draw();
        },
        setTitle(next: string) {
            if (name === next) return;
            name = next;
            fittedTitle = undefined;
            draw();
        },
        isPlayHit(uv: { x: number; y: number }) {
            const x = uv.x * width,
                y = (1 - uv.y) * height;
            return Math.hypot(x - button.x, y - button.y) <= button.radius + 16;
        },
        setPlayback(next: AudioPlaybackState) {
            const nextKey = [
                next.playing,
                next.waiting,
                Math.floor(next.currentTime * 4),
                Math.floor(next.duration),
                next.error,
            ].join('|');
            if (key === nextKey) return;
            key = nextKey;
            state = next;
            draw();
        },
        dispose() {
            disposed = true;
            group.removeFromParent();
            texture.dispose();
            material.dispose();
            surface.geometry.dispose();
        },
    };
}
