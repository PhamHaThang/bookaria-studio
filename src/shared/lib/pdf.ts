import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdf(source: { url: string } | { data: Uint8Array }) {
    const base = `${import.meta.env.BASE_URL}vendor/pdfjs/${version}/`;
    return getDocument({
        ...source,
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl: `${base}wasm/`,
        iccUrl: `${base}iccs/`,
        maxImageSize: 40_000_000,
    });
}
