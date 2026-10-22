import { Compiler } from '../vendor/mindar-1.2.5/mindar-image.prod.js';

const id = location.hash.slice(1);
const send = (type, extra = {}, transfer = []) => {
    parent.postMessage({ id, type, ...extra }, location.origin, transfer);
};
let running = false;
window.addEventListener('message', async (event) => {
    if (
        event.origin !== location.origin ||
        event.source !== parent ||
        event.data?.id !== id ||
        event.data.type !== 'compile' ||
        running
    )
        return;
    running = true;
    try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = event.data.url;
        await image.decode();
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const compiler = new Compiler();
        await compiler.compileImageTargets([canvas], (percent) => send('progress', { percent }));
        const bytes = Uint8Array.from(compiler.exportData()).buffer;
        send('done', { bytes }, [bytes]);
    } catch {
        send('error');
    }
});
send('ready');
