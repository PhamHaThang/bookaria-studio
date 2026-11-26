(() => {
    let preference = 'system';
    try {
        preference = localStorage.getItem('bookaria.theme') || 'system';
    } catch {}
    const dark =
        preference === 'dark' ||
        (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.editor = /^\/books\/[^/]+\/(?:edit|pages\/[^/]+)\/?$/.test(
        location.pathname,
    )
        ? 'true'
        : 'false';

    const markStarted = (target) => {
        if (target instanceof HTMLImageElement && target.closest('.app-boot')) {
            target.dataset.loadingStarted = String(performance.now());
        }
    };
    document.addEventListener('load', (event) => markStarted(event.target), true);
    document.addEventListener('DOMContentLoaded', () => {
        for (const img of document.querySelectorAll('.app-boot img')) {
            if (img.complete) markStarted(img);
        }
    });
})();
