/** The authored SVG returns to its opening idle pose every 4.8 seconds. */
export const LOADING_CYCLE_MS = 4800;

export function finishLoadingAnimation(host: HTMLElement | null, done: () => void) {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clean = () => {
        clearTimeout(timer);
        media.removeEventListener('change', skip);
        document.removeEventListener('visibilitychange', skip);
        host?.removeAttribute('data-loading-completing');
    };
    const complete = () => {
        clean();
        done();
    };
    const skip = () => {
        if (media.matches || document.hidden) complete();
    };
    const image =
        host &&
        [...host.querySelectorAll<HTMLImageElement>('img')].find(
            (item) =>
                item.src.endsWith('loading-loop.svg') &&
                item.getClientRects().length &&
                getComputedStyle(item).display !== 'none',
        );
    const started = Number(image?.dataset.loadingStarted);
    if (!image || !Number.isFinite(started) || media.matches || document.hidden) {
        done();
        return clean;
    }
    media.addEventListener('change', skip);
    document.addEventListener('visibilitychange', skip);
    const elapsed = Math.max(0, performance.now() - started);
    timer = setTimeout(
        () => {
            host?.setAttribute('data-loading-completing', '');
            timer = setTimeout(complete, 180);
        },
        LOADING_CYCLE_MS - (elapsed % LOADING_CYCLE_MS),
    );
    return clean;
}
