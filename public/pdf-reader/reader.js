const params = new URLSearchParams(location.hash.slice(1));
const host = document.querySelector('#flipbook');
const controls = document.querySelector('#controls');
const status = document.querySelector('#status');
const pageInput = document.querySelector('#page');
const total = document.querySelector('#total');
const more = document.querySelector('#more');
const parentOrigin = location.origin;
const title = params.get('title') || 'Bookaria';
const initialTheme = params.get('theme') === 'dark' ? 'dark' : 'light';
const compact = matchMedia('(max-width: 640px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const soundKey = 'bookaria:pdf-page-sound';
let soundEnabled = true;
try {
    soundEnabled = localStorage.getItem(soundKey) !== 'off';
} catch {
    // Storage may be unavailable in private or embedded sessions.
}
document.title = title;

const actions = Object.fromEntries(
    Array.from(controls.querySelectorAll('button[data-action]'), (button) => [
        button.dataset.action,
        button,
    ]),
);
actions.fullscreen.hidden = !document.fullscreenEnabled;
actions.sound.setAttribute('aria-pressed', String(soundEnabled));
applyTheme(initialTheme);

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const label = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    actions.theme.setAttribute('aria-label', label);
    actions.theme.title = label;
}

window.addEventListener('message', (event) => {
    if (event.origin !== parentOrigin || event.source !== window.parent) return;
    const theme = event.data?.theme;
    if (event.data?.type === 'pdf-reader-theme' && (theme === 'light' || theme === 'dark')) {
        applyTheme(theme);
    }
});

function send(type) {
    window.parent.postMessage({ source: 'bookaria-pdf', type }, parentOrigin);
}

async function download(book) {
    actions.download.disabled = true;
    status.hidden = true;
    try {
        const bytes = await book.contentProvider.pdfDocument.getData();
        const href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = href;
        link.download = `${title.replace(/[<>:"/\\|?*]/g, '-').trim() || 'bookaria'}.pdf`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 30_000);
    } catch {
        status.textContent = 'Chưa tải được PDF. Vui lòng thử lại.';
        status.hidden = false;
    } finally {
        actions.download.disabled = false;
    }
}

function setup() {
    const pdfUrl = new URL(params.get('pdf') ?? '');
    if (!['http:', 'https:'].includes(pdfUrl.protocol) || pdfUrl.username || pdfUrl.password) {
        throw new Error('Invalid PDF URL');
    }
    const resources = new URL('../vendor/dearflip-lite/dflip/', location.href);
    window.dFlipLocation = resources.href;
    Object.assign(window.DFLIP.defaults, {
        threejsSrc: new URL('js/libs/three.min.js', resources).href,
        mockupjsSrc: new URL('js/libs/mockup.min.js', resources).href,
        pdfjsSrc: new URL('js/libs/pdf.min.js', resources).href,
        pdfjsWorkerSrc: new URL('js/libs/pdf.worker.min.js', resources).href,
        soundFile: new URL('sound/turn2.mp3', resources).href,
    });

    const errors = new MutationObserver(() => {
        const message = host.querySelector('.loading-info')?.textContent ?? '';
        if (/cannot access file|unable to load|valid document/i.test(message)) {
            errors.disconnect();
            send('error');
        }
    });
    errors.observe(host, { childList: true, subtree: true, characterData: true });

    const { PAGE_MODE, PAGE_SIZE, SINGLE_PAGE_MODE } = window.DFLIP;
    window.jQuery(host).flipBook(pdfUrl.href, {
        height: '100%',
        backgroundColor: 'var(--stage)',
        webgl: !reducedMotion,
        duration: reducedMotion ? 1 : 650,
        paddingTop: 12,
        paddingBottom: 16,
        soundEnable: false,
        enableAnnotation: false,
        pageSize: PAGE_SIZE.SINGLE,
        pageMode: compact.matches ? PAGE_MODE.SINGLE : PAGE_MODE.AUTO,
        singlePageMode: SINGLE_PAGE_MODE.BOOKLET,
        allControls: '',
        docParameters: {
            url: pdfUrl.href,
            // The PDF.js version bundled in Lite requires this for untrusted PDFs.
            isEvalSupported: false,
            cMapUrl: new URL('js/libs/cmaps/', resources).href,
            cMapPacked: true,
            disableAutoFetch: true,
            disableStream: true,
            rangeChunkSize: 524288,
        },
        onReady(book) {
            errors.disconnect();
            initControls(book);
            controls.hidden = false;
            host.style.minWidth = '0';
            host.style.minHeight = '0';
            book.resize();
            send('ready');
        },
    });
}

function initControls(book) {
    const layoutLabel = document.querySelector('#layout-label');
    const fullscreenLabel = document.querySelector('#fullscreen-label');
    const pages = book.contentProvider.pageCount;
    const currentPage = () => Number(book.ui.pageInput.val());
    let lastPage = currentPage();
    book.sound.volume = 0.45;
    // Use the native flip event and handle browsers that decline media playback.
    book.playSound = () => {
        const page = book.target._activePage;
        if (page === lastPage) return;
        lastPage = page;
        if (!soundEnabled) return;
        book.sound.currentTime = 0;
        void book.sound.play().catch(() => {});
    };
    total.textContent = `/ ${pages}`;

    function refresh() {
        const page = currentPage();
        if (document.activeElement !== pageInput) pageInput.value = page;
        actions.previous.disabled = page <= 1;
        actions.next.disabled = page >= pages;
        actions.zoomOut.disabled = book.ui.zoomOut.hasClass('disabled');
        actions.zoomIn.disabled = book.ui.zoomIn.hasClass('disabled');
        actions.pages.setAttribute(
            'aria-pressed',
            String(host.classList.contains('df-sidemenu-open')),
        );
        layoutLabel.textContent =
            book.target.pageMode === window.DFLIP.PAGE_MODE.SINGLE
                ? 'Xem hai trang'
                : 'Xem một trang';
    }
    const changes = new MutationObserver(refresh);
    changes.observe(book.ui.pageLabel[0], { childList: true });
    changes.observe(book.ui.zoomOut[0], { attributes: true, attributeFilter: ['class'] });
    changes.observe(book.ui.zoomIn[0], { attributes: true, attributeFilter: ['class'] });
    changes.observe(host, { attributes: true, attributeFilter: ['class'] });
    refresh();

    const toolbar = document.querySelector('#thumbnail-toolbar');
    const thumbnails = new MutationObserver(() => {
        const panel = host.querySelector('.df-thumb-container');
        if (panel && !panel.querySelector('.thumbnail-toolbar')) {
            panel.prepend(toolbar.content.cloneNode(true));
            book.resize();
        }
        for (const item of host.querySelectorAll('.df-thumb-container .df-vrow:not([role])')) {
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', `Trang ${item.id.replace('df-thumb', '')}`);
            item.tabIndex = 0;
        }
    });
    thumbnails.observe(host, { childList: true, subtree: true });

    function jump() {
        const page = Number.parseInt(pageInput.value, 10);
        if (Number.isFinite(page)) book.gotoPage(Math.max(1, Math.min(page, pages)));
        pageInput.value = currentPage();
    }
    pageInput.addEventListener('change', jump);
    pageInput.addEventListener('keyup', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') jump();
    });

    const handlers = {
        previous: () => book.prev(),
        next: () => book.next(),
        zoomOut: () => book.ui.zoomOut.trigger('click'),
        zoomIn: () => book.ui.zoomIn.trigger('click'),
        pages: () => book.ui.thumbnail.trigger('click'),
        theme: () => send('theme'),
        layout: () => {
            book.setPageMode(book.target.pageMode !== window.DFLIP.PAGE_MODE.SINGLE);
            refresh();
        },
        sound: () => {
            soundEnabled = !soundEnabled;
            if (!soundEnabled) book.sound.pause();
            actions.sound.setAttribute('aria-pressed', String(soundEnabled));
            try {
                localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off');
            } catch {
                // The setting still applies to this reader.
            }
        },
        fullscreen: async () => {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.body.requestFullscreen();
            } catch {
                status.textContent = 'Trình duyệt chưa mở được chế độ toàn màn hình.';
                status.hidden = false;
            }
        },
        share: () => send('share'),
        download: () => download(book),
    };
    for (const [action, button] of Object.entries(actions)) {
        button.addEventListener('click', () => {
            if (more.contains(button)) {
                more.open = false;
                more.querySelector('summary').focus();
            }
            void handlers[action]();
        });
    }

    host.addEventListener('click', (event) => {
        if (compact.matches && event.target.closest('.df-thumb-container .df-vrow')) {
            book.ui.thumbnail.trigger('click');
        }
    });
    host.addEventListener('keydown', (event) => {
        if (
            event.target.matches('.df-thumb-container .df-vrow') &&
            (event.key === 'Enter' || event.key === ' ')
        ) {
            event.preventDefault();
            event.target.click();
            if (compact.matches) actions.pages.focus();
        }
    });
    document.addEventListener('click', (event) => {
        if (!more.contains(event.target)) more.open = false;
    });
    document.addEventListener('fullscreenchange', () => {
        fullscreenLabel.textContent = document.fullscreenElement
            ? 'Thoát toàn màn hình'
            : 'Toàn màn hình';
    });
}

window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.fullscreenElement) return;
    if (more.open) {
        more.open = false;
        more.querySelector('summary').focus();
    } else if (host.classList.contains('df-sidemenu-open')) {
        actions.pages.click();
        actions.pages.focus();
    } else {
        send('close');
    }
});

try {
    setup();
} catch {
    send('error');
}
