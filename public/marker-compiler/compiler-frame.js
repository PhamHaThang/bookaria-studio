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
        !['compile', 'analyze'].includes(event.data.type) ||
        running
    )
        return;
    running = true;
    try {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = event.data.url;
        await image.decode();
        const analyzing = event.data.type === 'analyze';
        if (
            analyzing &&
            (image.naturalWidth * image.naturalHeight > 16777216 ||
                Math.min(image.naturalWidth, image.naturalHeight) < 64)
        )
            throw new Error('Image dimensions exceed analysis limits');
        const scale = analyzing
            ? 800 / Math.max(image.naturalWidth, image.naturalHeight)
            : Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.floor(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const compiler = new Compiler();
        await compiler.compileImageTargets([canvas], (percent) => send('progress', { percent }));
        if (analyzing) {
            const target = compiler.data[0];
            const level = target.matchingData[0];
            const gray = target.imageList[0];
            canvas.width = gray.width;
            canvas.height = gray.height;
            const pixels = new Uint8ClampedArray(gray.width * gray.height * 4);
            for (let i = 0; i < gray.data.length; i++) {
                pixels[i * 4] = gray.data[i];
                pixels[i * 4 + 1] = gray.data[i];
                pixels[i * 4 + 2] = gray.data[i];
                pixels[i * 4 + 3] = 255;
            }
            canvas
                .getContext('2d')
                .putImageData(new ImageData(pixels, gray.width, gray.height), 0, 0);
            send('done', {
                level,
                image: canvas.toDataURL('image/png'),
                sourceWidth: image.naturalWidth,
                sourceHeight: image.naturalHeight,
            });
            return;
        }
        const bytes = Uint8Array.from(compiler.exportData()).buffer;
        send('done', { bytes }, [bytes]);
    } catch {
        send('error');
    }
});
send('ready');
