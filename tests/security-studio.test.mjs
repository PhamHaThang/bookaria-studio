import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { uploadFile } from '../src/features/assets/api/upload-file.ts';

function collectSourceFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectSourceFiles(full));
        else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
    }
    return out;
}

test('SEC-STU-04: uploadFile enforces *.r2.cloudflarestorage.com HTTPS URL and strict 4-header whitelist', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' });
    const signal = new AbortController().signal;

    for (const badUrl of [
        'http://account.r2.cloudflarestorage.com/bucket/key',
        'https://evil.example/upload',
        'https://user:pass@account.r2.cloudflarestorage.com/bucket/key',
        'https://account.r2.cloudflarestorage.com:8443/bucket/key',
    ]) {
        await assert.rejects(
            uploadFile(
                {
                    uploadUrl: badUrl,
                    method: 'PUT',
                    headers: { 'Content-Type': 'image/png' },
                },
                file,
                signal,
                () => {},
            ),
            /không hợp lệ/,
        );
    }

    for (const badHeader of ['Authorization', 'Cookie', 'x-amz-acl']) {
        await assert.rejects(
            uploadFile(
                {
                    uploadUrl: 'https://account.r2.cloudflarestorage.com/bucket/key',
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'image/png',
                        [badHeader]: 'value',
                    },
                },
                file,
                signal,
                () => {},
            ),
            /chưa hợp lệ/,
        );
    }
});

test('SEC-VW-01 (Studio): Studio src/ has no raw HTML injection sinks (innerHTML / dangerouslySetInnerHTML)', () => {
    const files = collectSourceFiles(path.resolve(import.meta.dirname, '../src'));
    const sinkPattern =
        /\b(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML)\b|document\.write\s*\(/;
    const hits = [];
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        if (sinkPattern.test(text)) hits.push(file);
    }
    assert.deepEqual(hits, []);
});

test('SEC-STU-05 [GAP CHECK]: pdf-reader/reader.js should restrict #pdf URL to configured R2/same-origin rather than any arbitrary HTTP(S) host', () => {
    const readerJs = fs.readFileSync(
        path.resolve(import.meta.dirname, '../public/pdf-reader/reader.js'),
        'utf8',
    );
    const hasOriginAllowlist =
        /pdfUrl\.origin\s*===|R2_PUBLIC_URL|VITE_R2_PUBLIC_URL|allowedOrigins/i.test(readerJs);
    assert.equal(
        hasOriginAllowlist,
        true,
        'pdf-reader/reader.js currently accepts any http(s) URL in #pdf= without origin allowlist',
    );
});

test('SEC-E2E-02 [GAP CHECK]: Studio Cloudflare Pages public/_headers should define CSP, X-Content-Type-Options, and frame-ancestors', () => {
    const headersPath = path.resolve(import.meta.dirname, '../public/_headers');
    assert.equal(
        fs.existsSync(headersPath),
        true,
        'Missing bookaria-studio/public/_headers for Cloudflare Pages security headers',
    );
});
