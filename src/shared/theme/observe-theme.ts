/** Observe only the resolved theme, without rebuilding a WebGL scene or its camera. */
export function observeTheme(update: () => void) {
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
}
