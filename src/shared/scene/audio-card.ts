import * as THREE from 'three';
import type { SceneObject } from '../contracts/scene.schema';

type AudioObject = Extract<SceneObject, { type: 'audio' }>;
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
        height = 360;
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
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(2, 2, width - 4, height - 4, 22);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#252525';
        ctx.fillRect(0, 0, width, 92);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 38px "Be Vietnam Pro", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(kind, width / 2, 46);
        ctx.fillStyle = '#252525';
        ctx.font = '600 36px "Be Vietnam Pro", Arial, sans-serif';
        let title = name.normalize('NFC');
        if (ctx.measureText(title).width > width - 80) {
            while (title.length && ctx.measureText(`${title}…`).width > width - 80)
                title = title.slice(0, -1);
            title += '…';
        }
        ctx.fillText(title, width / 2, 151);
        ctx.beginPath();
        ctx.arc(72, 273, 31, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        if (state.playing) {
            ctx.fillRect(62, 261, 7, 24);
            ctx.fillRect(76, 261, 7, 24);
        } else {
            ctx.beginPath();
            ctx.moveTo(64, 258);
            ctx.lineTo(87, 273);
            ctx.lineTo(64, 288);
            ctx.closePath();
            ctx.fill();
        }
        const total = state.duration > 0 ? state.duration : duration;
        const ratio = total > 0 ? Math.min(1, Math.max(0, state.currentTime / total)) : 0;
        ctx.lineCap = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#dedede';
        ctx.beginPath();
        ctx.moveTo(131, 263);
        ctx.lineTo(476, 263);
        ctx.stroke();
        if (ratio > 0) {
            ctx.strokeStyle = '#252525';
            ctx.beginPath();
            ctx.moveTo(131, 263);
            ctx.lineTo(131 + 345 * ratio, 263);
            ctx.stroke();
        }
        ctx.font = '400 24px "Be Vietnam Pro", Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#525252';
        ctx.fillText(`${audioTime(state.currentTime)} / ${audioTime(total)}`, 725, 273);
        ctx.textAlign = 'left';
        ctx.font = '400 23px "Be Vietnam Pro", Arial, sans-serif';
        ctx.fillStyle = state.error ? '#b42318' : '#525252';
        ctx.fillText(
            state.error
                ? 'Không phát được. Chạm để thử lại.'
                : state.waiting
                  ? 'Đang tải âm thanh…'
                  : state.playing
                    ? 'Đang phát'
                    : state.currentTime > 0
                      ? 'Tạm dừng'
                      : 'Phát âm thanh',
            131,
            307,
        );
        ctx.restore();
        ctx.strokeStyle = '#d4d4d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(2, 2, width - 4, height - 4, 22);
        ctx.stroke();
        texture.needsUpdate = true;
    }
    draw();
    if (document.fonts) void document.fonts.ready.then(draw);
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
            draw();
        },
        isPlayHit(uv: { x: number; y: number }) {
            const x = uv.x * width,
                y = (1 - uv.y) * height;
            return x >= 25 && x <= 119 && y >= 226 && y <= 320;
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
