import { deflateSync } from 'node:zlib';

export const makeId = (n, prefix = '11111111-1111-4111-8111') =>
    `${prefix}-${String(n).padStart(12, '0')}`;

export const NOW = '2026-11-25T10:00:00.000Z';
export const CDN_ORIGIN = 'https://mock-cdn.bookaria.test';
export const R2_ORIGIN = 'https://mock.r2.cloudflarestorage.com';

// Valid 1x1 PNG (transparent pixel)
export const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5d8AAAAASUVORK5CYII=',
    'base64',
);

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let b = 0; b < 8; b++) {
            crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

// Valid square RGB PNG >=128px with textured checkerboard pixels (passes createImageBitmap + marker validation)
export function createSquarePng(size = 128) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // RGB
    const rowBytes = 1 + size * 3;
    const raw = Buffer.alloc(rowBytes * size);
    for (let y = 0; y < size; y++) {
        const rowStart = y * rowBytes;
        raw[rowStart] = 0; // filter None
        for (let x = 0; x < size; x++) {
            const p = rowStart + 1 + x * 3;
            const dark = ((x >> 4) + (y >> 4)) % 2 === 0;
            raw[p] = dark ? 40 : 220;
            raw[p + 1] = dark ? 80 : 210;
            raw[p + 2] = dark ? 140 : 190;
        }
    }
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

// Valid 16x16 SVG preview image
export const TINY_SVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="226"><rect width="160" height="226" fill="#f3f4f6"/><rect x="16" y="16" width="128" height="194" fill="#d1d5db"/></svg>',
);

// Valid minimal RIFF/WAVE PCM audio buffer (1 second silence @ 8kHz mono)
export function createTinyWav(seconds = 1) {
    const sampleRate = 8000;
    const dataBytes = sampleRate * 2 * seconds;
    const buf = Buffer.alloc(44 + dataBytes);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataBytes, 4);
    buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(dataBytes, 40);
    return buf;
}

// Valid MPEG-1 Layer III, 96 kbps, 48 kHz mono (288 bytes/frame, matching isNarrationMp3)
export function createTinyNarrationMp3(frames = 4) {
    const frameBytes = 288;
    const buf = Buffer.alloc(frameBytes * frames);
    for (let i = 0; i < frames; i++) {
        const offset = i * frameBytes;
        buf[offset] = 0xff;
        buf[offset + 1] = 0xfa;
        buf[offset + 2] = 0x74;
        buf[offset + 3] = 0xc0;
    }
    return buf;
}

// Valid minimal glTF 2.0 binary (.glb) containing a single empty scene
export function createTinyGlb() {
    const jsonText = JSON.stringify({
        asset: { version: '2.0', generator: 'bookaria-test' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: 'MockModel' }],
    });
    const padLen = (4 - (Buffer.byteLength(jsonText) % 4)) % 4;
    const jsonBuffer = Buffer.from(jsonText + ' '.repeat(padLen), 'utf8');
    const totalLength = 12 + 8 + jsonBuffer.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0); // 'glTF'
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.writeUInt32LE(jsonBuffer.length, 0);
    chunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
    return Buffer.concat([header, chunkHeader, jsonBuffer]);
}

export function createAuthorUser(overrides = {}) {
    return {
        id: makeId(1, 'aaaaaaaa-aaaa-4aaa-8aaa'),
        email: 'author@bookaria.test',
        displayName: 'Tác giả Kiểm thử',
        avatarUrl: null,
        organization: 'Bookaria QA Lab',
        bio: 'Tài khoản tác giả dùng cho kiểm thử Studio.',
        role: 'AUTHOR',
        emailVerified: true,
        storage: { usedBytes: 1024 * 1024, quotaBytes: 500 * 1024 * 1024 },
        createdAt: NOW,
        ...overrides,
    };
}

export function createAdminUser(overrides = {}) {
    return {
        id: makeId(2, 'aaaaaaaa-aaaa-4aaa-8aaa'),
        email: 'admin@bookaria.test',
        displayName: 'Quản trị Hệ thống',
        avatarUrl: null,
        organization: 'Bookaria Admin',
        bio: null,
        role: 'ADMIN',
        emailVerified: true,
        storage: { usedBytes: 2 * 1024 * 1024, quotaBytes: 1024 * 1024 * 1024 },
        createdAt: NOW,
        ...overrides,
    };
}

export function createAsset(id, overrides = {}) {
    return {
        id,
        name: 'Asset mẫu',
        type: 'MODEL',
        status: 'READY',
        sizeBytes: 2048,
        format: 'glb',
        url: `${CDN_ORIGIN}/assets/${id}.glb`,
        thumbnailUrl: `${CDN_ORIGIN}/assets/${id}.png`,
        tags: ['sample'],
        license: null,
        authorName: null,
        sourceUrl: null,
        scope: 'mine',
        categoryId: null,
        meta: {},
        error: null,
        createdAt: NOW,
        ...overrides,
    };
}

export function createPage(bookId, pageId, orderIndex = 0, overrides = {}) {
    const imageAssetId = overrides.imageAssetId || makeId(900 + orderIndex);
    return {
        id: pageId,
        bookId,
        orderIndex,
        title: `Trang ${orderIndex + 1}`,
        thumbnailUrl: `${CDN_ORIGIN}/pages/${pageId}.png`,
        markerMode: 'BOOKARIA_MARKER',
        markerNumber: orderIndex + 1,
        markerScore: 4,
        markerWarnings: [],
        objectCount: 0,
        image: {
            assetId: imageAssetId,
            url: `${CDN_ORIGIN}/pages/${pageId}.png`,
            width: 800,
            height: 1131,
        },
        markerReport: null,
        bookariaMarker: {
            number: orderIndex + 1,
            transform: {
                x: 0.32,
                y: -0.35,
                size: 0.25,
            },
        },
        settings: {},
        scene: {
            schemaVersion: 1,
            objects: [],
            interactions: [],
        },
        revision: 1,
        assets: {},
        updatedAt: NOW,
        ...overrides,
    };
}

export function createBook(bookId, overrides = {}) {
    return {
        id: bookId,
        title: 'Khám phá Vũ trụ 3D',
        coverUrl: `${CDN_ORIGIN}/covers/${bookId}.png`,
        status: 'DRAFT',
        visibility: 'PRIVATE',
        takenDown: false,
        pageCount: 1,
        updatedAt: NOW,
        description: 'Cuốn sách AR tương tác về hệ Mặt Trời.',
        ageMin: 6,
        ageMax: 12,
        language: 'vi',
        topic: 'Khoa học',
        pageFormat: 'A4',
        pageAspect: Math.SQRT2,
        pageWidthMm: 210,
        slug: 'kham-pha-vu-tru-3d',
        currentVersion: null,
        workflowVariables: [],
        ...overrides,
    };
}

export function createSampleMarkerTestResult() {
    return {
        policyVersion: 'mindar-pictarize-v1',
        algorithm: 'ORB',
        score: 4,
        features: 640,
        coverage: 0.72,
        width: 512,
        height: 512,
        image: `data:image/png;base64,${TINY_PNG.toString('base64')}`,
        points: [
            { x: 120, y: 140 },
            { x: 310, y: 260 },
        ],
        cells: Array.from({ length: 16 }, (_, idx) => (idx % 2 === 0 ? 40 : 25)),
        hints: ['Độ tương phản tốt, phân bố điểm đặc trưng đồng đều.'],
    };
}
