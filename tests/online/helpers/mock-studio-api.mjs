import {
    CDN_ORIGIN,
    createAdminUser,
    createAsset,
    createAuthorUser,
    createBook,
    createPage,
    createSampleMarkerTestResult,
    createTinyGlb,
    createTinyNarrationMp3,
    createTinyWav,
    makeId,
    NOW,
    R2_ORIGIN,
    TINY_PNG,
    TINY_SVG,
} from './fixtures.mjs';

const TINY_WAV = createTinyWav(1);
const TINY_MP3 = createTinyNarrationMp3(4);
const TINY_GLB = createTinyGlb();

const DEFAULT_VOICES = [
    { id: 'mai-chi', name: 'Mai Chi' },
    { id: 'minh-hoang', name: 'Minh Hoàng' },
];

export function createStudioMockState(options = {}) {
    const author = createAuthorUser(options.author);
    const admin = createAdminUser(options.admin);
    const activeRole = options.role || 'AUTHOR';
    const loggedOut = options.loggedOut === true;

    const book1Id = makeId(101, 'bbbbbbbb-bbbb-4bbb-8bbb');
    const book2Id = makeId(102, 'bbbbbbbb-bbbb-4bbb-8bbb');
    const page1Id = makeId(201, 'cccccccc-cccc-4ccc-8ccc');
    const page2Id = makeId(202, 'cccccccc-cccc-4ccc-8ccc');
    const trashBookId = makeId(199, 'bbbbbbbb-bbbb-4bbb-8bbb');

    const modelAssetId = makeId(301, 'dddddddd-dddd-4ddd-8ddd');
    const audioAssetId = makeId(302, 'dddddddd-dddd-4ddd-8ddd');
    const imageAssetId = makeId(303, 'dddddddd-dddd-4ddd-8ddd');
    const libraryAssetId = makeId(304, 'dddddddd-dddd-4ddd-8ddd');
    const categoryId1 = makeId(401, 'eeeeeeee-eeee-4eee-8eee');
    const categoryId2 = makeId(402, 'eeeeeeee-eeee-4eee-8eee');
    const marker1Id = makeId(501, 'ffffffff-ffff-4fff-8fff');
    const marker2Id = makeId(502, 'ffffffff-ffff-4fff-8fff');
    const failedJobId = makeId(601, '99999999-9999-4999-8999');

    const pagesMap = new Map([
        [page1Id, createPage(book1Id, page1Id, 0, { title: 'Trang bìa trong' })],
        [page2Id, createPage(book2Id, page2Id, 0, { title: 'Trang công khai 1' })],
    ]);

    const booksMap = new Map([
        [
            book1Id,
            createBook(book1Id, {
                title: 'Sách Nháp Khám Phá',
                slug: 'sach-nhap-kham-pha',
                status: 'DRAFT',
                visibility: 'PRIVATE',
                pageIds: [page1Id],
            }),
        ],
        [
            book2Id,
            createBook(book2Id, {
                title: 'Đại Dương Xanh AR',
                slug: 'dai-duong-xanh-ar',
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
                currentVersion: { versionNo: 1, publishedAt: NOW },
                pageIds: [page2Id],
            }),
        ],
    ]);

    const trashMap = new Map([
        [
            trashBookId,
            {
                ...createBook(trashBookId, {
                    title: 'Sách Trong Thùng Rác',
                    slug: 'sach-trong-thung-rac',
                }),
                deletedAt: NOW,
                pageIds: [],
            },
        ],
    ]);

    const assetsMap = new Map([
        [
            modelAssetId,
            createAsset(modelAssetId, {
                name: 'Tàu vũ trụ 3D',
                type: 'MODEL',
                format: 'glb',
                url: `${CDN_ORIGIN}/assets/${modelAssetId}.glb`,
                tags: ['space', 'ship'],
            }),
        ],
        [
            audioAssetId,
            createAsset(audioAssetId, {
                name: 'Nhạc nền Vũ trụ',
                type: 'AUDIO',
                format: 'mp3',
                url: `${CDN_ORIGIN}/assets/${audioAssetId}.wav`,
                tags: ['bgm'],
            }),
        ],
        [
            imageAssetId,
            createAsset(imageAssetId, {
                name: 'Ảnh minh họa sao Hỏa',
                type: 'IMAGE',
                format: 'png',
                url: `${CDN_ORIGIN}/assets/${imageAssetId}.png`,
                tags: ['mars'],
            }),
        ],
        [
            libraryAssetId,
            createAsset(libraryAssetId, {
                name: 'Hành tinh Trái Đất (Thư viện)',
                type: 'MODEL',
                format: 'glb',
                scope: 'library',
                categoryId: categoryId1,
                license: 'CC-BY-4.0',
                authorName: 'Bookaria Studio',
                sourceUrl: 'https://bookaria.test/assets/earth',
                url: `${CDN_ORIGIN}/assets/${libraryAssetId}.glb`,
                tags: ['earth', 'planet'],
            }),
        ],
    ]);

    const categories = [
        { id: categoryId1, name: 'Khoa học & Vũ trụ', parentId: null, sortOrder: 1 },
        { id: categoryId2, name: 'Hành tinh', parentId: categoryId1, sortOrder: 2 },
    ];

    const markers = [
        {
            id: marker1Id,
            number: 1,
            imageUrl: `${CDN_ORIGIN}/markers/marker-1.png`,
            markerScore: 5,
            isActive: true,
            validatedAt: NOW,
        },
        {
            id: marker2Id,
            number: 2,
            imageUrl: `${CDN_ORIGIN}/markers/marker-2.png`,
            markerScore: 4,
            isActive: false,
            validatedAt: null,
        },
    ];

    const adminUsers = [
        {
            ...admin,
            status: 'ACTIVE',
            bookCount: 0,
            lastLoginAt: NOW,
            updatedAt: NOW,
        },
        {
            ...author,
            status: 'ACTIVE',
            bookCount: 2,
            lastLoginAt: NOW,
            updatedAt: NOW,
        },
    ];

    const notifications = [
        {
            id: makeId(701, '77777777-7777-4777-8777'),
            type: 'JOB_SUCCEEDED',
            title: 'Xuất bản hoàn tất',
            body: 'Đại Dương Xanh AR đã sẵn sàng cho người đọc.',
            link: `/books/${book2Id}`,
            readAt: null,
            createdAt: NOW,
        },
        {
            id: makeId(702, '77777777-7777-4777-8777'),
            type: 'JOB_FAILED',
            title: 'Tạo mô hình 3D thất bại',
            body: 'Ảnh đầu vào thiếu độ tương phản.',
            link: '/assets',
            readAt: NOW,
            createdAt: NOW,
        },
    ];

    const reportsByBook = new Map([
        [
            book2Id,
            [
                {
                    id: makeId(801, '88888888-8888-4888-8888'),
                    reason: 'COPYRIGHT',
                    note: 'Cần xác minh quyền sử dụng hình minh họa trang 1.',
                    status: 'OPEN',
                    createdAt: NOW,
                    handledAt: null,
                },
            ],
        ],
    ]);

    const jobsMap = new Map([
        [
            failedJobId,
            {
                id: failedJobId,
                type: 'PUBLISH_BOOK',
                status: 'FAILED',
                progress: 40,
                ref: { type: 'BOOK', id: book1Id },
                result: null,
                error: { code: 'INTERNAL_ERROR', message: 'Worker tạm thời mất kết nối R2.' },
                createdAt: NOW,
                finishedAt: NOW,
                attempts: 3,
                createdBy: { id: author.id, displayName: author.displayName },
            },
        ],
    ]);

    const auditLogs = [
        {
            id: 101,
            actor: { id: admin.id, displayName: admin.displayName },
            action: 'CREATE_USER',
            target: { type: 'USER', id: author.id },
            detail: { role: 'AUTHOR', email: author.email },
            createdAt: NOW,
        },
    ];

    return {
        ids: {
            authorId: author.id,
            adminId: admin.id,
            book1Id,
            book2Id,
            trashBookId,
            page1Id,
            page2Id,
            modelAssetId,
            audioAssetId,
            imageAssetId,
            libraryAssetId,
            categoryId1,
            categoryId2,
            marker1Id,
            marker2Id,
            failedJobId,
        },
        session: {
            authenticated: !loggedOut,
            currentUserId: activeRole === 'ADMIN' ? admin.id : author.id,
            accessToken: loggedOut ? null : 'mock-access-token-1',
            refreshCount: 0,
            tokenEpoch: 1,
            locked: false,
        },
        users: adminUsers,
        books: booksMap,
        trash: trashMap,
        pages: pagesMap,
        assets: assetsMap,
        categories,
        markers,
        notifications,
        reportsByBook,
        jobs: jobsMap,
        modelGenerations: [],
        versionsByBook: new Map([
            [
                book2Id,
                [
                    {
                        id: makeId(950, '95959595-9595-4959-8959'),
                        versionNo: 1,
                        pageCount: 1,
                        arPageCount: 1,
                        totalBytes: 20480,
                        publishedAt: NOW,
                        publishedBy: { id: author.id, displayName: author.displayName },
                    },
                ],
            ],
        ]),
        auditLogs,
        nextSeq: 1000,
        faults: [],
        calls: [],
    };
}

function corsHeaders(request) {
    const origin = request.headers().origin;
    const headers = {
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'Authorization,Content-Type,X-Request-Id',
        'access-control-allow-credentials': 'true',
    };
    if (origin) {
        headers['access-control-allow-origin'] = origin;
        headers.vary = 'Origin';
    } else {
        headers['access-control-allow-origin'] = '*';
    }
    return headers;
}

export async function installStudioMocks(page, options = {}) {
    const state = createStudioMockState(options);
    const { authorId, book1Id, book2Id, page1Id, modelAssetId } = state.ids;
    const author = state.users.find((u) => u.id === authorId);
    const pendingUploads = new Map();
    const nextUuid = (prefix = '12121212-1212-4121-8121') => makeId(++state.nextSeq, prefix);

    const currentUser = () =>
        state.session.authenticated
            ? state.users.find((u) => u.id === state.session.currentUserId) || null
            : null;

    const toBookSummary = (book) => ({
        id: book.id,
        title: book.title,
        coverUrl: book.coverUrl,
        status: book.status,
        visibility: book.visibility,
        takenDown: book.takenDown,
        pageCount: book.pageIds.length,
        updatedAt: book.updatedAt,
    });

    const toBookDetail = (book) => ({
        ...toBookSummary(book),
        description: book.description,
        ageMin: book.ageMin,
        ageMax: book.ageMax,
        language: book.language,
        topic: book.topic,
        pageFormat: book.pageFormat,
        pageAspect: book.pageAspect,
        pageWidthMm: book.pageWidthMm,
        slug: book.slug,
        currentVersion: book.currentVersion,
        workflowVariables: book.workflowVariables || [],
        pages: book.pageIds
            .map((pid) => state.pages.get(pid))
            .filter(Boolean)
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((p) => ({
                id: p.id,
                orderIndex: p.orderIndex,
                title: p.title,
                thumbnailUrl: p.thumbnailUrl,
                markerMode: p.markerMode,
                markerNumber: p.markerNumber,
                markerScore: p.markerScore,
                markerWarnings: p.markerWarnings,
                objectCount: p.scene.objects.length,
            })),
    });

    const addAudit = (action, targetType, targetId, detail = null) => {
        const actor = currentUser();
        state.auditLogs.unshift({
            id: ++state.nextSeq,
            actor: actor
                ? { id: actor.id, displayName: actor.displayName }
                : { id: state.ids.adminId, displayName: 'System' },
            action,
            target: { type: targetType, id: targetId },
            detail,
            createdAt: new Date().toISOString(),
        });
    };

    // Mock R2 presigned uploads
    await page.route(`${R2_ORIGIN}/**`, async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: corsHeaders(request) });
        }
        state.calls.push({ method: request.method(), url: request.url() });
        return route.fulfill({
            status: 200,
            headers: {
                ...corsHeaders(request),
                etag: '"mock-r2-etag"',
            },
        });
    });

    // Mock CDN asset fetches
    await page.route(`${CDN_ORIGIN}/**`, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = { 'access-control-allow-origin': '*' };
        if (url.pathname.endsWith('.glb')) {
            return route.fulfill({
                status: 200,
                contentType: 'model/gltf-binary',
                body: TINY_GLB,
                headers,
            });
        }
        if (url.pathname.endsWith('.wav') || url.pathname.endsWith('.mp3')) {
            return route.fulfill({
                status: 200,
                contentType: 'audio/wav',
                body: TINY_WAV,
                headers,
            });
        }
        if (url.pathname.endsWith('.svg')) {
            return route.fulfill({
                status: 200,
                contentType: 'image/svg+xml',
                body: TINY_SVG,
                headers,
            });
        }
        return route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: TINY_PNG,
            headers,
        });
    });

    // Mock hidden MindAR marker compiler iframe cleanly on same origin
    if (options.mockMarkerCompiler !== false) {
        await page.route('**/marker-compiler/index.html*', async (route) => {
            const html = `<!doctype html><html><body><script>
const id = location.hash.slice(1);
window.addEventListener('message', (event) => {
    if (!event.data || event.data.id !== id) return;
    if (event.data.type === 'compile') {
        parent.postMessage({ type: 'progress', id, percent: 50 }, event.origin);
        parent.postMessage({ type: 'done', id, bytes: new Uint8Array([1, 2, 3, 4]).buffer }, event.origin);
    } else if (event.data.type === 'analyze') {
        parent.postMessage({
            type: 'done',
            id,
            sourceWidth: 1024,
            sourceHeight: 1024,
            image: 'data:image/png;base64,${TINY_PNG.toString('base64')}',
            level: {
                width: 256,
                height: 256,
                maximaPoints: [{ x: 40, y: 50, scale: 1, descriptors: Array(21).fill(1) }],
                minimaPoints: [{ x: 140, y: 150, scale: 1, descriptors: Array(21).fill(2) }]
            }
        }, event.origin);
    }
});
parent.postMessage({ type: 'ready', id }, location.origin);
</script></body></html>`;
            return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        });
    }

    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const method = request.method();
        const headers = corsHeaders(request);

        if (method === 'OPTIONS') {
            return route.fulfill({ status: 204, headers });
        }

        const url = new URL(request.url());
        const idx = url.pathname.indexOf('/api/v1');
        const path = idx >= 0 ? url.pathname.slice(idx + '/api/v1'.length) : url.pathname;
        const bodyJson = (() => {
            try {
                return request.postDataJSON();
            } catch {
                return null;
            }
        })();

        state.calls.push({
            method,
            path,
            query: Object.fromEntries(url.searchParams.entries()),
            body: bodyJson,
            hasAuthHeader: Boolean(request.headers().authorization),
        });

        const reply = (data, status = 200) =>
            route.fulfill({
                status,
                headers,
                json: { data },
            });

        const replyPage = (items, pageNum = 1, limit = 12) => {
            const total = items.length;
            const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
            const slice = items.slice((pageNum - 1) * limit, pageNum * limit);
            return route.fulfill({
                status: 200,
                headers,
                json: {
                    data: slice,
                    meta: { page: pageNum, limit, total, totalPages },
                },
            });
        };

        const replyError = (code, status, message, details) =>
            route.fulfill({
                status,
                headers,
                json: {
                    error: {
                        code,
                        message,
                        ...(details !== undefined ? { details } : {}),
                        requestId: `mock-req-${state.nextSeq++}`,
                    },
                },
            });

        // Check injected faults first
        const faultIdx = state.faults.findIndex(
            (f) =>
                (!f.method || f.method === method) &&
                (typeof f.match === 'string' ? path === f.match : f.match.test(path)),
        );
        if (faultIdx >= 0) {
            const fault = state.faults[faultIdx];
            if (fault.once !== false) state.faults.splice(faultIdx, 1);
            if (fault.delayMs) await new Promise((r) => setTimeout(r, fault.delayMs));
            if (fault.abort) return route.abort('failed');
            return replyError(
                fault.code || 'INTERNAL_ERROR',
                fault.status || 500,
                fault.message || 'Lỗi giả lập từ mock.',
                fault.details,
            );
        }

        const user = currentUser();

        // --- Public & Health ---
        if (method === 'GET' && path === '/health') {
            return reply({
                status: 'OK',
                environment: 'mock',
                timestamp: new Date().toISOString(),
            });
        }

        // --- Auth ---
        if (method === 'POST' && path === '/auth/refresh') {
            state.session.refreshCount++;
            if (!state.session.authenticated || !user) {
                return replyError('UNAUTHENTICATED', 401, 'Phiên đăng nhập đã hết hạn.');
            }
            if (user.status === 'LOCKED' || state.session.locked) {
                return replyError('ACCOUNT_LOCKED', 423, 'Tài khoản đang bị khoá.');
            }
            state.session.accessToken = `mock-access-token-${++state.session.tokenEpoch}`;
            return reply({ accessToken: state.session.accessToken, expiresIn: 900 });
        }

        if (method === 'POST' && path === '/auth/login') {
            const email = String(bodyJson?.email || '').toLowerCase();
            const found = state.users.find((u) => u.email.toLowerCase() === email);
            if (!found || bodyJson?.password === 'wrong-password') {
                return replyError('INVALID_CREDENTIALS', 401, 'Email hoặc mật khẩu không đúng.');
            }
            if (found.status === 'LOCKED' || (state.session.locked && found.id === authorId)) {
                return replyError('ACCOUNT_LOCKED', 423, 'Tài khoản đang bị khoá.');
            }
            state.session.authenticated = true;
            state.session.currentUserId = found.id;
            state.session.accessToken = `mock-access-token-${++state.session.tokenEpoch}`;
            return reply({ accessToken: state.session.accessToken, expiresIn: 900, user: found });
        }

        if (method === 'POST' && path === '/auth/register') {
            const email = String(bodyJson?.email || '').toLowerCase();
            if (state.users.some((u) => u.email.toLowerCase() === email)) {
                return replyError('EMAIL_TAKEN', 409, 'Email này đã được đăng ký.');
            }
            const created = {
                ...createAuthorUser({
                    id: nextUuid('aaaaaaaa-aaaa-4aaa-8aaa'),
                    email,
                    displayName: bodyJson?.displayName || 'Người dùng mới',
                    emailVerified: false,
                }),
                status: 'ACTIVE',
                bookCount: 0,
                lastLoginAt: NOW,
                updatedAt: NOW,
            };
            state.users.push(created);
            state.session.authenticated = true;
            state.session.currentUserId = created.id;
            state.session.accessToken = `mock-access-token-${++state.session.tokenEpoch}`;
            return reply(
                {
                    accessToken: state.session.accessToken,
                    expiresIn: 900,
                    user: created,
                    verificationEmailSent: true,
                },
                201,
            );
        }

        if (method === 'POST' && path === '/auth/verify-email') {
            if (bodyJson?.token === 'invalid-token') {
                return replyError('TOKEN_INVALID', 400, 'Liên kết xác minh không hợp lệ.');
            }
            if (user) user.emailVerified = true;
            return reply({ emailVerified: true });
        }

        if (method === 'POST' && path === '/auth/resend-verification') {
            if (!user) return replyError('UNAUTHENTICATED', 401, 'Bạn cần đăng nhập.');
            return route.fulfill({ status: 204, headers });
        }

        if (method === 'POST' && path === '/auth/forgot-password') {
            return reply({ sent: true });
        }

        if (method === 'POST' && path === '/auth/reset-password') {
            if (bodyJson?.token === 'expired-reset') {
                return replyError('TOKEN_INVALID', 400, 'Mã đặt lại mật khẩu đã hết hạn.');
            }
            state.session.authenticated = false;
            state.session.accessToken = null;
            return route.fulfill({ status: 204, headers });
        }

        if (method === 'POST' && path === '/auth/logout') {
            state.session.authenticated = false;
            state.session.accessToken = null;
            return route.fulfill({ status: 204, headers });
        }

        // --- Public discovery routes ---
        if (method === 'GET' && path === '/public/books') {
            const q = (url.searchParams.get('q') || '').toLowerCase();
            const items = [...state.books.values()]
                .filter((b) => b.visibility === 'PUBLIC' && !b.takenDown)
                .filter((b) => !q || b.title.toLowerCase().includes(q))
                .map((b) => ({
                    slug: b.slug,
                    title: b.title,
                    coverUrl: b.coverUrl,
                    author: { id: author.id, displayName: author.displayName },
                    language: b.language,
                    ageMin: b.ageMin,
                    ageMax: b.ageMax,
                    arPageCount: b.pageIds.length,
                }));
            return replyPage(items, Number(url.searchParams.get('page') || 1));
        }

        if (method === 'GET' && path.startsWith('/public/books/')) {
            const slug = decodeURIComponent(path.split('/').at(-1));
            const book = [...state.books.values()].find((b) => b.slug === slug);
            if (!book || book.visibility === 'PRIVATE' || book.takenDown) {
                return replyError('BOOK_UNAVAILABLE', 410, 'Sách này hiện không khả dụng.');
            }
            return reply({
                slug: book.slug,
                title: book.title,
                description: book.description,
                author: { id: author.id, displayName: author.displayName },
                coverUrl: book.coverUrl,
                language: book.language,
                ageMin: book.ageMin,
                ageMax: book.ageMax,
                version: {
                    id: makeId(950, '95959595-9595-4959-8959'),
                    versionNo: book.currentVersion?.versionNo || 1,
                    publishedAt: NOW,
                },
                manifestUrl: `${CDN_ORIGIN}/manifests/${book.slug}.json`,
                pageCount: book.pageIds.length,
                arPageCount: book.pageIds.length,
                downloadBytes: 20480,
                printPdfUrl: `${CDN_ORIGIN}/prints/${book.slug}.pdf`,
            });
        }

        if (method === 'GET' && path.startsWith('/public/authors/')) {
            const aid = path.split('/').at(-1);
            const found = state.users.find((u) => u.id === aid);
            if (!found) return replyError('NOT_FOUND', 404, 'Không tìm thấy tác giả.');
            const books = [...state.books.values()]
                .filter((b) => b.visibility === 'PUBLIC' && !b.takenDown)
                .map((b) => ({
                    slug: b.slug,
                    title: b.title,
                    coverUrl: b.coverUrl,
                    author: { id: found.id, displayName: found.displayName },
                    language: b.language,
                    ageMin: b.ageMin,
                    ageMax: b.ageMax,
                    arPageCount: b.pageIds.length,
                }));
            return reply({
                author: {
                    id: found.id,
                    displayName: found.displayName,
                    organization: found.organization,
                    bio: found.bio,
                    avatarUrl: found.avatarUrl,
                },
                books,
            });
        }

        // --- Protected routes require session ---
        if (!user) {
            return replyError('UNAUTHENTICATED', 401, 'Bạn cần đăng nhập để tiếp tục.');
        }
        if (user.status === 'LOCKED' || state.session.locked) {
            return replyError('ACCOUNT_LOCKED', 423, 'Tài khoản đang bị khoá.');
        }

        // --- Me & Notifications ---
        if (method === 'GET' && path === '/me') return reply(user);
        if (method === 'PATCH' && path === '/me') {
            if (bodyJson?.displayName !== undefined) user.displayName = bodyJson.displayName;
            if (bodyJson?.organization !== undefined) user.organization = bodyJson.organization;
            if (bodyJson?.bio !== undefined) user.bio = bodyJson.bio;
            if (bodyJson?.avatarAssetId !== undefined) {
                user.avatarUrl = bodyJson.avatarAssetId
                    ? `${CDN_ORIGIN}/avatars/${bodyJson.avatarAssetId}.png`
                    : null;
            }
            return reply(user);
        }
        if (method === 'PUT' && path === '/me/password') {
            if (bodyJson?.currentPassword === 'wrong-old') {
                return replyError('VALIDATION_ERROR', 400, 'Mật khẩu hiện tại không đúng.');
            }
            return route.fulfill({ status: 204, headers });
        }
        if (method === 'GET' && path === '/me/notifications') {
            const unreadOnly = url.searchParams.get('unread') === 'true';
            const list = unreadOnly
                ? state.notifications.filter((n) => !n.readAt)
                : state.notifications;
            return replyPage(list, Number(url.searchParams.get('page') || 1));
        }
        if (method === 'POST' && path === '/me/notifications/read') {
            const ids = bodyJson?.ids;
            for (const n of state.notifications) {
                if (!ids || ids.includes(n.id)) n.readAt = new Date().toISOString();
            }
            return route.fulfill({ status: 204, headers });
        }

        // --- Verified author checks ---
        const isAdminRoute = path.startsWith('/admin');
        if (!isAdminRoute && !user.emailVerified && path !== '/templates') {
            return replyError('EMAIL_NOT_VERIFIED', 403, 'Bạn cần xác minh email.');
        }

        // --- Admin RBAC & Endpoints ---
        if (isAdminRoute) {
            if (user.role !== 'ADMIN') {
                return replyError('FORBIDDEN', 403, 'Bạn không có quyền quản trị.');
            }
            if (method === 'GET' && path === '/admin/dashboard') {
                return reply({
                    users: state.users.length,
                    publishedBooks: [...state.books.values()].filter(
                        (b) => b.status === 'PUBLISHED',
                    ).length,
                    storageUsedBytes: 15 * 1024 * 1024,
                    libraryStorageUsedBytes: 5 * 1024 * 1024,
                    failedJobs24h: [...state.jobs.values()].filter((j) => j.status === 'FAILED')
                        .length,
                    openReports: [...state.reportsByBook.values()]
                        .flat()
                        .filter((r) => r.status === 'OPEN').length,
                    publishedPerDay: Array.from({ length: 7 }, (_, i) => ({
                        date: `2026-11-${String(19 + i).padStart(2, '0')}`,
                        count: i === 6 ? 2 : i % 2,
                    })),
                    auditActionsToday: [{ action: 'CREATE_USER', count: 1 }],
                });
            }
            if (method === 'GET' && path === '/admin/users') {
                const q = (url.searchParams.get('q') || '').toLowerCase();
                const role = url.searchParams.get('role');
                const status = url.searchParams.get('status');
                const items = state.users.filter(
                    (u) =>
                        (!q ||
                            u.displayName.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q)) &&
                        (!role || u.role === role) &&
                        (!status || u.status === status),
                );
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'POST' && path === '/admin/users') {
                if (
                    state.users.some((u) => u.email.toLowerCase() === bodyJson.email.toLowerCase())
                ) {
                    return replyError('EMAIL_TAKEN', 409, 'Email này đã được đăng ký.');
                }
                const created = {
                    ...createAuthorUser({
                        id: nextUuid('aaaaaaaa-aaaa-4aaa-8aaa'),
                        email: bodyJson.email,
                        displayName: bodyJson.displayName,
                        role: bodyJson.role || 'AUTHOR',
                        storage: {
                            usedBytes: 0,
                            quotaBytes: bodyJson.storageQuotaBytes || 500 * 1024 * 1024,
                        },
                    }),
                    status: 'ACTIVE',
                    bookCount: 0,
                    lastLoginAt: null,
                    updatedAt: new Date().toISOString(),
                };
                state.users.push(created);
                addAudit('CREATE_USER', 'USER', created.id, { email: created.email });
                return reply(created, 201);
            }
            if (method === 'GET' && path.startsWith('/admin/users/')) {
                const uid = path.split('/').at(-1);
                const found = state.users.find((u) => u.id === uid);
                if (!found) return replyError('NOT_FOUND', 404, 'Không tìm thấy người dùng.');
                return reply({
                    ...found,
                    books: [...state.books.values()].map(toBookSummary),
                });
            }
            if (method === 'PATCH' && path.startsWith('/admin/users/')) {
                const uid = path.split('/').at(-1);
                const found = state.users.find((u) => u.id === uid);
                if (!found) return replyError('NOT_FOUND', 404, 'Không tìm thấy người dùng.');
                if (
                    uid === user.id &&
                    (bodyJson.status === 'LOCKED' || bodyJson.role === 'AUTHOR')
                ) {
                    return replyError('SELF_ACTION', 422, 'Bạn không thể tự khoá hoặc hạ quyền.');
                }
                if (bodyJson.status) found.status = bodyJson.status;
                if (bodyJson.role) found.role = bodyJson.role;
                if (bodyJson.storageQuotaBytes) {
                    found.storage.quotaBytes = bodyJson.storageQuotaBytes;
                }
                addAudit(
                    bodyJson.status === 'LOCKED'
                        ? 'LOCK_USER'
                        : bodyJson.status === 'ACTIVE'
                          ? 'UNLOCK_USER'
                          : 'CHANGE_ROLE',
                    'USER',
                    uid,
                    bodyJson,
                );
                return reply({
                    user: {
                        id: found.id,
                        status: found.status,
                        role: found.role,
                        storageQuotaBytes: found.storage.quotaBytes,
                    },
                });
            }
            if (method === 'GET' && path === '/admin/moderation') {
                const items = [...state.reportsByBook.entries()]
                    .map(([bid, reports]) => {
                        const open = reports.filter((r) => r.status === 'OPEN');
                        const book = state.books.get(bid);
                        if (!book || !open.length) return null;
                        return {
                            book: {
                                id: book.id,
                                title: book.title,
                                author: { id: author.id, displayName: author.displayName },
                            },
                            reportCount: open.length,
                            reasons: [...new Set(open.map((r) => r.reason))],
                            lastReportedAt: open[0].createdAt,
                        };
                    })
                    .filter(Boolean);
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'GET' && path === '/admin/books') {
                const visibility = url.searchParams.get('visibility') || 'PUBLIC';
                const q = (url.searchParams.get('q') || '').toLowerCase();
                const items = [...state.books.values()]
                    .filter((b) => b.visibility === visibility)
                    .filter((b) => !q || b.title.toLowerCase().includes(q))
                    .map((b) => ({
                        ...toBookSummary(b),
                        author: { id: author.id, displayName: author.displayName },
                        reportCount: (state.reportsByBook.get(b.id) || []).filter(
                            (r) => r.status === 'OPEN',
                        ).length,
                    }));
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'GET' && /^\/admin\/books\/[^/]+$/.test(path)) {
                const bid = path.split('/').at(-1);
                const book = state.books.get(bid);
                if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
                return reply({
                    book: {
                        ...toBookSummary(book),
                        author: { id: author.id, displayName: author.displayName },
                        description: book.description,
                        takenDownReason: book.takenDownReason || null,
                        pages: toBookDetail(book).pages,
                    },
                    reports: state.reportsByBook.get(bid) || [],
                });
            }
            if (method === 'POST' && path.endsWith('/takedown')) {
                const bid = path.split('/')[3];
                const book = state.books.get(bid);
                if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
                book.takenDown = true;
                book.takenDownReason = bodyJson.reason;
                book.visibility = 'PRIVATE';
                const reports = state.reportsByBook.get(bid) || [];
                let resolved = 0;
                for (const r of reports) {
                    if (r.status === 'OPEN') {
                        r.status = 'ACTIONED';
                        r.handledAt = new Date().toISOString();
                        resolved++;
                    }
                }
                addAudit('TAKE_DOWN_BOOK', 'BOOK', bid, { reason: bodyJson.reason });
                return reply({
                    book: { id: book.id, visibility: book.visibility, takenDown: true },
                    resolvedReports: resolved,
                });
            }
            if (method === 'POST' && path.endsWith('/reinstate')) {
                const bid = path.split('/')[3];
                const book = state.books.get(bid);
                if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
                book.takenDown = false;
                book.takenDownReason = null;
                addAudit('REINSTATE_BOOK', 'BOOK', bid, bodyJson);
                return reply({ book: toBookSummary(book) });
            }
            if (method === 'POST' && path.endsWith('/reports/dismiss')) {
                const bid = path.split('/')[3];
                const reports = state.reportsByBook.get(bid) || [];
                let dismissed = 0;
                for (const r of reports) {
                    if (r.status === 'OPEN') {
                        r.status = 'DISMISSED';
                        r.handledAt = new Date().toISOString();
                        dismissed++;
                    }
                }
                addAudit('DISMISS_REPORT', 'BOOK', bid, bodyJson);
                return reply({ dismissedReports: dismissed });
            }
            if (method === 'GET' && path === '/admin/library/assets') {
                const q = (url.searchParams.get('q') || '').toLowerCase();
                const items = [...state.assets.values()].filter(
                    (a) => a.scope === 'library' && (!q || a.name.toLowerCase().includes(q)),
                );
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'POST' && path === '/admin/library/assets') {
                const asset = state.assets.get(bodyJson.assetId);
                if (!asset) return replyError('NOT_FOUND', 404, 'Không tìm thấy tài nguyên.');
                Object.assign(asset, {
                    scope: 'library',
                    name: bodyJson.name,
                    categoryId: bodyJson.categoryId ?? null,
                    license: bodyJson.license,
                    authorName: bodyJson.authorName,
                    sourceUrl: bodyJson.sourceUrl ?? null,
                    tags: bodyJson.tags || [],
                });
                addAudit('CREATE_LIBRARY_ASSET', 'ASSET', asset.id, bodyJson);
                return reply(asset, 201);
            }
            if (method === 'PATCH' && path.startsWith('/admin/library/assets/')) {
                const aid = path.split('/').at(-1);
                const asset = state.assets.get(aid);
                if (!asset) return replyError('NOT_FOUND', 404, 'Không tìm thấy tài nguyên.');
                Object.assign(asset, bodyJson);
                addAudit('UPDATE_LIBRARY_ASSET', 'ASSET', aid, bodyJson);
                return reply(asset);
            }
            if (method === 'DELETE' && path.startsWith('/admin/library/assets/')) {
                const aid = path.split('/').at(-1);
                if (aid === libraryAssetId && options.libraryAssetInUse) {
                    return replyError('ASSET_IN_USE', 409, 'Tài nguyên đang được sử dụng.');
                }
                state.assets.delete(aid);
                addAudit('DELETE_ASSET', 'ASSET', aid, null);
                return route.fulfill({ status: 204, headers });
            }
            if (method === 'POST' && path === '/admin/asset-categories') {
                const created = {
                    id: nextUuid('eeeeeeee-eeee-4eee-8eee'),
                    name: bodyJson.name,
                    parentId: bodyJson.parentId ?? null,
                    sortOrder: state.categories.length + 1,
                };
                state.categories.push(created);
                addAudit('MANAGE_CATEGORY', 'CATEGORY', created.id, bodyJson);
                return reply(created, 201);
            }
            if (method === 'PATCH' && path.startsWith('/admin/asset-categories/')) {
                const cid = path.split('/').at(-1);
                const cat = state.categories.find((c) => c.id === cid);
                if (!cat) return replyError('NOT_FOUND', 404, 'Không tìm thấy danh mục.');
                if (bodyJson.parentId === cid) {
                    return replyError('CATEGORY_CYCLE', 422, 'Danh mục cha tạo vòng lặp.');
                }
                Object.assign(cat, bodyJson);
                addAudit('MANAGE_CATEGORY', 'CATEGORY', cid, bodyJson);
                return reply(cat);
            }
            if (method === 'DELETE' && path.startsWith('/admin/asset-categories/')) {
                const cid = path.split('/').at(-1);
                if (state.categories.some((c) => c.parentId === cid)) {
                    return replyError('CATEGORY_NOT_EMPTY', 409, 'Danh mục vẫn còn danh mục con.');
                }
                const idxCat = state.categories.findIndex((c) => c.id === cid);
                if (idxCat >= 0) state.categories.splice(idxCat, 1);
                return route.fulfill({ status: 204, headers });
            }
            if (method === 'GET' && path === '/admin/bookaria-markers') {
                return replyPage(state.markers, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'POST' && path === '/admin/bookaria-markers/test') {
                return reply(createSampleMarkerTestResult());
            }
            if (method === 'POST' && path === '/admin/bookaria-markers/upload-signature') {
                const seq = ++state.nextSeq;
                return reply({
                    imagePublicId: `bookaria/markers/img-${seq}`,
                    mindPublicId: `bookaria/markers/mind-${seq}`,
                    image: {
                        uploadUrl: `${R2_ORIGIN}/markers/img-${seq}.png`,
                        method: 'PUT',
                        objectKey: `markers/img-${seq}.png`,
                        headers: { 'Content-Type': 'image/png' },
                        expiresAt: new Date(Date.now() + 600_000).toISOString(),
                    },
                    mind: {
                        uploadUrl: `${R2_ORIGIN}/markers/mind-${seq}.mind`,
                        method: 'PUT',
                        objectKey: `markers/mind-${seq}.mind`,
                        headers: { 'Content-Type': 'application/octet-stream' },
                        expiresAt: new Date(Date.now() + 600_000).toISOString(),
                    },
                });
            }
            if (method === 'POST' && path === '/admin/bookaria-markers/register') {
                const marker = {
                    id: nextUuid('ffffffff-ffff-4fff-8fff'),
                    number: state.markers.length + 1,
                    imageUrl: `${CDN_ORIGIN}/markers/marker-${state.markers.length + 1}.png`,
                    markerScore: 4,
                    isActive: Boolean(bodyJson?.isActive),
                    validatedAt: NOW,
                };
                state.markers.push(marker);
                addAudit('MANAGE_MARKER', 'MARKER', marker.id, bodyJson);
                return reply(marker, 201);
            }
            if (method === 'PATCH' && path.startsWith('/admin/bookaria-markers/')) {
                const mid = path.split('/').at(-1);
                const marker = state.markers.find((m) => m.id === mid);
                if (!marker) return replyError('NOT_FOUND', 404, 'Không tìm thấy marker.');
                marker.isActive = Boolean(bodyJson.isActive);
                addAudit('MANAGE_MARKER', 'MARKER', mid, bodyJson);
                return reply(marker);
            }
            if (method === 'GET' && path === '/admin/jobs') {
                const status = url.searchParams.get('status');
                const type = url.searchParams.get('type');
                const items = [...state.jobs.values()].filter(
                    (j) => (!status || j.status === status) && (!type || j.type === type),
                );
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'POST' && path.endsWith('/retry')) {
                const jid = path.split('/')[3];
                const oldJob = state.jobs.get(jid);
                if (!oldJob) return replyError('NOT_FOUND', 404, 'Không tìm thấy tác vụ.');
                const newId = nextUuid('99999999-9999-4999-8999');
                state.jobs.set(newId, {
                    ...oldJob,
                    id: newId,
                    status: 'QUEUED',
                    progress: 0,
                    error: null,
                    attempts: 0,
                    createdAt: new Date().toISOString(),
                    finishedAt: null,
                });
                addAudit('RETRY_JOB', 'JOB', jid, { newJobId: newId });
                return reply({ jobId: newId }, 202);
            }
            if (method === 'GET' && path === '/admin/audit-logs') {
                const action = url.searchParams.get('action');
                const targetType = url.searchParams.get('targetType');
                const items = state.auditLogs.filter(
                    (l) =>
                        (!action || l.action === action) &&
                        (!targetType || l.target.type === targetType),
                );
                return replyPage(items, Number(url.searchParams.get('page') || 1));
            }
            if (method === 'GET' && path.startsWith('/admin/audit-logs/')) {
                const logId = Number(path.split('/').at(-1));
                const log = state.auditLogs.find((l) => l.id === logId);
                if (!log) return replyError('NOT_FOUND', 404, 'Không tìm thấy nhật ký.');
                return reply(log);
            }
        }

        // --- Studio Stats & Templates ---
        if (method === 'GET' && path === '/templates') return reply([]);
        if (method === 'GET' && path === '/studio/reading-stats') {
            return reply({
                opensLast7Days: 18,
                opensPrevious7Days: 12,
                opensByDay: Array.from({ length: 14 }, (_, i) => ({
                    date: `2026-11-${String(12 + i).padStart(2, '0')}`,
                    opens: i === 13 ? 5 : 1,
                })),
                topBooks: [
                    {
                        id: book2Id,
                        title: state.books.get(book2Id)?.title || 'Đại Dương Xanh AR',
                        coverUrl: `${CDN_ORIGIN}/covers/${book2Id}.png`,
                        opens: 18,
                    },
                ],
            });
        }

        // --- Books & Trash ---
        if (method === 'GET' && path === '/books') {
            const q = (url.searchParams.get('q') || '').toLowerCase();
            const status = url.searchParams.get('status');
            const items = [...state.books.values()]
                .filter(
                    (b) =>
                        (!q || b.title.toLowerCase().includes(q)) &&
                        (!status || b.status === status),
                )
                .map(toBookSummary);
            return replyPage(items, Number(url.searchParams.get('page') || 1));
        }
        if (method === 'POST' && path === '/books') {
            const bid = nextUuid('bbbbbbbb-bbbb-4bbb-8bbb');
            const created = createBook(bid, {
                title: bodyJson.title,
                description: bodyJson.description || null,
                ageMin: bodyJson.ageMin ?? null,
                ageMax: bodyJson.ageMax ?? null,
                language: bodyJson.language || 'vi',
                topic: bodyJson.topic || null,
                pageFormat: bodyJson.pageFormat || 'A4',
                pageAspect: bodyJson.pageAspect || Math.SQRT2,
                pageWidthMm: bodyJson.pageWidthMm || 210,
                slug: `book-${state.nextSeq}`,
                pageIds: [],
            });
            state.books.set(bid, created);
            return reply(
                {
                    book: {
                        id: created.id,
                        title: created.title,
                        visibility: created.visibility,
                        status: created.status,
                        pageCount: 0,
                    },
                },
                201,
            );
        }
        if (method === 'GET' && path === '/books/trash') {
            return replyPage(
                [...state.trash.values()].map((b) => ({
                    ...toBookSummary(b),
                    deletedAt: b.deletedAt,
                })),
                Number(url.searchParams.get('page') || 1),
            );
        }
        if (method === 'GET' && /^\/books\/[^/]+\/draft$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const pages = book.pageIds
                .map((pid) => state.pages.get(pid))
                .filter(Boolean)
                .sort((a, b) => a.orderIndex - b.orderIndex);
            const pageRevisions = Object.fromEntries(pages.map((p) => [p.id, p.revision]));
            const draftRevision = String(book.draftRevisionSeq || 1)
                .padStart(64, 'a')
                .slice(-64);
            return reply({
                bookId: book.id,
                workflowVariables: book.workflowVariables || [],
                revision: draftRevision,
                geometry: {
                    pageFormat: book.pageFormat,
                    pageAspect: book.pageAspect,
                    pageWidthMm: book.pageWidthMm || 210,
                },
                pages: pages.map((p) => ({
                    id: p.id,
                    orderIndex: p.orderIndex,
                    title: p.title,
                    thumbnailUrl: p.thumbnailUrl,
                    markerMode: p.markerMode,
                    markerNumber: p.markerNumber,
                    markerScore: p.markerScore,
                    markerWarnings: p.markerWarnings,
                    objectCount: p.scene.objects.length,
                })),
                pageRevisions,
            });
        }
        if (method === 'PUT' && /^\/books\/[^/]+\/draft$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const expectedSnapshotRev = String(book.draftRevisionSeq || 1)
                .padStart(64, 'a')
                .slice(-64);
            if (bodyJson.revision && bodyJson.revision !== expectedSnapshotRev) {
                return replyError('REVISION_CONFLICT', 409, 'Trang đã được sửa ở nơi khác.', {
                    currentRevision: 1,
                });
            }
            for (const entry of bodyJson.changes || []) {
                const pageObj = state.pages.get(entry.id);
                if (!pageObj) continue;
                if (entry.scene) pageObj.scene = entry.scene;
                if (entry.settings) pageObj.settings = entry.settings;
                if (entry.title !== undefined) pageObj.title = entry.title;
                pageObj.revision++;
                pageObj.updatedAt = new Date().toISOString();
            }
            if (Array.isArray(bodyJson.order)) {
                book.pageIds = bodyJson.order;
                bodyJson.order.forEach((pid, index) => {
                    const p = state.pages.get(pid);
                    if (p) p.orderIndex = index;
                });
            }
            if (bodyJson.workflowVariables) book.workflowVariables = bodyJson.workflowVariables;
            if (book.status === 'PUBLISHED') book.status = 'CHANGED';
            book.draftRevisionSeq = (book.draftRevisionSeq || 1) + 1;
            const nextSnapshotRev = String(book.draftRevisionSeq).padStart(64, 'a').slice(-64);
            const pages = book.pageIds
                .map((pid) => state.pages.get(pid))
                .filter(Boolean)
                .sort((a, b) => a.orderIndex - b.orderIndex);
            return reply({
                snapshot: {
                    bookId: book.id,
                    workflowVariables: book.workflowVariables || [],
                    revision: nextSnapshotRev,
                    geometry: {
                        pageFormat: book.pageFormat,
                        pageAspect: book.pageAspect,
                        pageWidthMm: book.pageWidthMm || 210,
                    },
                    pages: pages.map((p) => ({
                        id: p.id,
                        orderIndex: p.orderIndex,
                        title: p.title,
                        thumbnailUrl: p.thumbnailUrl,
                        markerMode: p.markerMode,
                        markerNumber: p.markerNumber,
                        markerScore: p.markerScore,
                        markerWarnings: p.markerWarnings,
                        objectCount: p.scene.objects.length,
                    })),
                    pageRevisions: Object.fromEntries(pages.map((p) => [p.id, p.revision])),
                },
                pages,
                warnings: [],
                jobs: [],
            });
        }
        if (method === 'POST' && /^\/books\/[^/]+\/draft\/image-layout$/.test(path)) {
            const aid = bodyJson?.imageAssetId || makeId(900);
            return reply({
                assetId: aid,
                url: `${CDN_ORIGIN}/assets/${aid}.png`,
                width: 800,
                height: 1131,
            });
        }
        if (method === 'GET' && /^\/books\/[^/]+$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            return reply(toBookDetail(book));
        }
        if (method === 'PATCH' && /^\/books\/[^/]+$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            Object.assign(book, bodyJson);
            book.updatedAt = new Date().toISOString();
            return reply(toBookSummary(book));
        }
        if (method === 'DELETE' && /^\/books\/[^/]+$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            state.books.delete(bid);
            state.trash.set(bid, { ...book, deletedAt: new Date().toISOString() });
            return route.fulfill({ status: 204, headers });
        }
        if (method === 'POST' && /^\/books\/[^/]+\/restore$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.trash.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            state.trash.delete(bid);
            delete book.deletedAt;
            state.books.set(bid, book);
            return reply(toBookSummary(book));
        }
        if (method === 'POST' && /^\/books\/[^/]+\/duplicate$/.test(path)) {
            const bid = path.split('/')[2];
            const src = state.books.get(bid);
            if (!src) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const copyId = nextUuid('bbbbbbbb-bbbb-4bbb-8bbb');
            const copy = createBook(copyId, {
                ...src,
                id: copyId,
                title: `${src.title} (Bản sao)`,
                slug: `${src.slug}-copy-${state.nextSeq}`,
                status: 'DRAFT',
                visibility: 'PRIVATE',
                currentVersion: null,
                pageIds: [],
            });
            state.books.set(copyId, copy);
            return reply(toBookSummary(copy), 201);
        }
        if (method === 'GET' && /^\/books\/[^/]+\/stats$/.test(path)) {
            const range = url.searchParams.get('range') || '30d';
            return reply({
                range,
                totals: { opens: 24, sessions: 19, taps: 42, scanTimeouts: 2 },
                opensByDay: Array.from({ length: 7 }, (_, i) => ({
                    date: `2026-11-${String(19 + i).padStart(2, '0')}`,
                    opens: i + 1,
                })),
                byPage: [
                    {
                        pageId: page1Id,
                        pageNumber: 1,
                        title: 'Trang 1',
                        found: 18,
                        taps: 30,
                        scanTimeouts: 1,
                    },
                ],
                byDevice: [{ type: 'mobile', os: 'iOS', count: 14 }],
            });
        }

        // --- Pages & Scenes & Markers & AI ---
        if (method === 'GET' && /^\/books\/[^/]+\/pages$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            return reply(toBookDetail(book).pages);
        }
        if (method === 'POST' && /^\/books\/[^/]+\/pages$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const pid = nextUuid('cccccccc-cccc-4ccc-8ccc');
            const newPage = createPage(bid, pid, book.pageIds.length, {
                title: bodyJson?.title || `Trang ${book.pageIds.length + 1}`,
                imageAssetId: bodyJson?.imageAssetId,
            });
            state.pages.set(pid, newPage);
            book.pageIds.push(pid);
            return reply({ page: newPage, warnings: [] }, 201);
        }
        if (method === 'GET' && /^\/pages\/[^/]+$/.test(path)) {
            const pid = path.split('/')[2];
            const pageObj = state.pages.get(pid);
            if (!pageObj) return replyError('NOT_FOUND', 404, 'Không tìm thấy trang.');
            return reply(pageObj);
        }
        if (method === 'PATCH' && /^\/pages\/[^/]+$/.test(path)) {
            const pid = path.split('/')[2];
            const pageObj = state.pages.get(pid);
            if (!pageObj) return replyError('NOT_FOUND', 404, 'Không tìm thấy trang.');
            if (bodyJson.noAr) {
                pageObj.markerMode = 'NONE';
                pageObj.markerNumber = null;
                pageObj.bookariaMarker = null;
            }
            if (bodyJson.title !== undefined) pageObj.title = bodyJson.title;
            if (bodyJson.settings) pageObj.settings = bodyJson.settings;
            return reply(pageObj);
        }
        if (method === 'PATCH' && /^\/pages\/[^/]+\/scene$/.test(path)) {
            const pid = path.split('/')[2];
            const pageObj = state.pages.get(pid);
            if (!pageObj) return replyError('NOT_FOUND', 404, 'Không tìm thấy trang.');
            if (bodyJson.revision !== pageObj.revision) {
                return replyError('REVISION_CONFLICT', 409, 'Trang đã được sửa ở nơi khác.', {
                    currentRevision: pageObj.revision,
                    scene: pageObj.scene,
                });
            }
            pageObj.scene = bodyJson.scene;
            pageObj.revision++;
            pageObj.updatedAt = new Date().toISOString();
            return reply({
                revision: pageObj.revision,
                updatedAt: pageObj.updatedAt,
                warnings: [],
            });
        }
        if (method === 'POST' && /^\/pages\/[^/]+\/interaction-proposals$/.test(path)) {
            const pid = path.split('/')[2];
            const pageObj = state.pages.get(pid);
            if (!pageObj) return replyError('NOT_FOUND', 404, 'Không tìm thấy trang.');
            const targetObj = pageObj.scene.objects[0];
            return reply({
                status: 'proposal',
                rule: {
                    id: `rule-${state.nextSeq++}`,
                    name: 'Chạm tương tác AI',
                    enabled: true,
                    trigger: targetObj
                        ? { type: 'onTap', objectId: targetObj.id }
                        : { type: 'onPageEnter' },
                    actions: [
                        {
                            type: 'wait',
                            delayMs: 0,
                            durationMs: 300,
                        },
                    ],
                },
                revision: pageObj.revision,
                usage: {
                    model: 'mock-gpt',
                    promptVersion: 'bookaria-editor-v11',
                    attempts: 1,
                    latencyMs: 120,
                    inputTokens: 150,
                    outputTokens: 80,
                },
            });
        }
        if (method === 'PUT' && /^\/pages\/[^/]+\/marker$/.test(path)) {
            const pid = path.split('/')[2];
            const pageObj = state.pages.get(pid);
            if (!pageObj) return replyError('NOT_FOUND', 404, 'Không tìm thấy trang.');
            if (bodyJson.mode === 'BOOKARIA_MARKER') {
                pageObj.markerMode = 'BOOKARIA_MARKER';
                pageObj.markerNumber = pageObj.orderIndex + 1;
                pageObj.bookariaMarker = {
                    number: pageObj.markerNumber,
                    transform: bodyJson.transform || { x: 0.3, y: -0.35, size: 0.25 },
                };
                return reply({
                    markerMode: 'BOOKARIA_MARKER',
                    markerNumber: pageObj.markerNumber,
                    transform: pageObj.bookariaMarker.transform,
                });
            }
            const jid = nextUuid('99999999-9999-4999-8999');
            pageObj.markerMode = 'CUSTOM_MARKER';
            pageObj.markerNumber = null;
            pageObj.bookariaMarker = null;
            state.jobs.set(jid, {
                id: jid,
                type: 'SCORE_MARKER',
                status: 'SUCCEEDED',
                progress: 100,
                ref: { type: 'PAGE', id: pid },
                result: { pageId: pid, score: 4 },
                error: null,
                createdAt: NOW,
                finishedAt: NOW,
                attempts: 1,
                createdBy: { id: user.id, displayName: user.displayName },
            });
            pageObj.markerScore = 4;
            pageObj.markerWarnings = [];
            return reply(
                {
                    markerMode: 'CUSTOM_MARKER',
                    markerNumber: null,
                    markerScore: null,
                    jobId: jid,
                },
                202,
            );
        }

        // --- Previews, Publish, Share, Print ---
        if (method === 'POST' && /^\/books\/[^/]+\/previews$/.test(path)) {
            const bid = path.split('/')[2];
            const jid = nextUuid('99999999-9999-4999-8999');
            const token = 'p'.repeat(32);
            state.jobs.set(jid, {
                id: jid,
                type: 'BUILD_PREVIEW',
                status: 'SUCCEEDED',
                progress: 100,
                ref: { type: 'BOOK', id: bid },
                result: { token, url: `https://viewer.bookaria.test/preview/${token}` },
                error: null,
                createdAt: NOW,
                finishedAt: NOW,
                attempts: 1,
                createdBy: { id: user.id, displayName: user.displayName },
            });
            return reply({ jobId: jid }, 202);
        }
        if (method === 'GET' && /^\/books\/[^/]+\/publish-check$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const checkOverride = options.publishCheck?.(book, state);
            if (checkOverride) return reply(checkOverride);
            return reply({
                canPublish: !book.takenDown,
                hasChanges: true,
                summary: {
                    pageCount: book.pageIds.length,
                    arPageCount: book.pageIds.length,
                    downloadBytes: 120 * 1024,
                },
                errors: book.takenDown
                    ? [{ code: 'BOOK_TAKEN_DOWN', message: 'Sách đã bị gỡ bởi quản trị viên.' }]
                    : [],
                warnings: [],
            });
        }
        if (method === 'POST' && /^\/books\/[^/]+\/publish$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            if (book.takenDown) {
                return replyError('BOOK_TAKEN_DOWN', 403, 'Sách đã bị gỡ nên không thể xuất bản.');
            }
            const jid = nextUuid('99999999-9999-4999-8999');
            const nextVer = (book.currentVersion?.versionNo || 0) + 1;
            book.status = 'PUBLISHED';
            book.visibility = bodyJson.visibility || 'PUBLIC';
            book.currentVersion = { versionNo: nextVer, publishedAt: new Date().toISOString() };
            const versions = state.versionsByBook.get(bid) || [];
            versions.unshift({
                id: nextUuid('95959595-9595-4959-8959'),
                versionNo: nextVer,
                pageCount: book.pageIds.length,
                arPageCount: book.pageIds.length,
                totalBytes: 20480,
                publishedAt: book.currentVersion.publishedAt,
                publishedBy: { id: user.id, displayName: user.displayName },
            });
            state.versionsByBook.set(bid, versions);
            state.jobs.set(jid, {
                id: jid,
                type: 'PUBLISH_BOOK',
                status: 'SUCCEEDED',
                progress: 100,
                ref: { type: 'BOOK', id: bid },
                result: {
                    versionNo: nextVer,
                    slug: book.slug,
                    url: `https://viewer.bookaria.test/b/${book.slug}`,
                },
                error: null,
                createdAt: NOW,
                finishedAt: NOW,
                attempts: 1,
                createdBy: { id: user.id, displayName: user.displayName },
            });
            return reply({ jobId: jid }, 202);
        }
        if (method === 'GET' && /^\/books\/[^/]+\/versions$/.test(path)) {
            const bid = path.split('/')[2];
            return reply({ items: state.versionsByBook.get(bid) || [], nextCursor: null });
        }
        if (method === 'POST' && /^\/books\/[^/]+\/versions\/\d+\/restore-draft$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            book.status = 'CHANGED';
            return reply(toBookSummary(book));
        }
        if (method === 'POST' && /^\/books\/[^/]+\/unpublish$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            book.visibility = 'PRIVATE';
            return reply(toBookSummary(book));
        }
        if (method === 'GET' && /^\/books\/[^/]+\/share$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            const shareUrl = `https://viewer.bookaria.test/b/${book.slug}`;
            return reply({
                url: shareUrl,
                qrPngUrl: `${CDN_ORIGIN}/qr/${book.slug}.png`,
                qrSvgUrl: `${CDN_ORIGIN}/qr/${book.slug}.svg`,
                embedHtml: `<iframe src="${shareUrl}" width="640" height="480" allow="camera"></iframe>`,
            });
        }
        if (method === 'GET' && /^\/books\/[^/]+\/print-layout$/.test(path)) {
            const bid = path.split('/')[2];
            const book = state.books.get(bid);
            if (!book) return replyError('NOT_FOUND', 404, 'Không tìm thấy sách.');
            return reply({
                coverUrl: book.coverUrl,
                versionId: makeId(950, '95959595-9595-4959-8959'),
                versionNo: book.currentVersion?.versionNo || 1,
                title: book.title,
                widthMm: 210,
                heightMm: 297,
                pages: book.pageIds.map((pid) => ({
                    pageId: pid,
                    title: state.pages.get(pid)?.title || 'Trang 1',
                    imageUrl: `${CDN_ORIGIN}/pages/${pid}.png`,
                    markerMode: 'BOOKARIA_MARKER',
                    marker: {
                        number: 1,
                        imageUrl: `${CDN_ORIGIN}/markers/marker-1.png`,
                        xMm: 140,
                        yMm: 220,
                        sizeMm: 45,
                    },
                    defaultQr: null,
                })),
                coverQr: { pageId: null, xMm: 15, yMm: 230, sizeMm: 35 },
            });
        }
        if (method === 'POST' && /^\/books\/[^/]+\/print-pdf$/.test(path)) {
            const bid = path.split('/')[2];
            const jid = nextUuid('99999999-9999-4999-8999');
            state.jobs.set(jid, {
                id: jid,
                type: 'EXPORT_PDF',
                status: 'SUCCEEDED',
                progress: 100,
                ref: { type: 'BOOK', id: bid },
                result: {
                    url: `${CDN_ORIGIN}/prints/${bid}.pdf`,
                    kind: bodyJson?.kind || 'PRINT',
                },
                error: null,
                createdAt: NOW,
                finishedAt: NOW,
                attempts: 1,
                createdBy: { id: user.id, displayName: user.displayName },
            });
            return reply({ jobId: jid }, 202);
        }

        // --- Assets, Narration, 3D Generation, Categories ---
        if (method === 'GET' && path === '/asset-categories') {
            return reply(state.categories);
        }
        if (method === 'GET' && path === '/assets/narration/voices') {
            return reply(DEFAULT_VOICES);
        }
        if (method === 'POST' && path === '/assets/narration/generate') {
            return route.fulfill({
                status: 200,
                headers: { ...headers, 'content-type': 'audio/mpeg' },
                body: TINY_MP3,
            });
        }
        if (method === 'GET' && path === '/assets/model-generations') {
            return reply(state.modelGenerations);
        }
        if (method === 'POST' && path === '/assets/model-generations') {
            const assetId = nextUuid('dddddddd-dddd-4ddd-8ddd');
            const jid = nextUuid('99999999-9999-4999-8999');
            const genAsset = createAsset(assetId, {
                name: 'Mô hình 3D AI mới',
                type: 'MODEL',
                format: 'glb',
            });
            state.assets.set(assetId, genAsset);
            const genJob = {
                id: jid,
                type: 'GENERATE_MODEL',
                name: 'Mô hình 3D AI mới',
                status: 'SUCCEEDED',
                progress: 100,
                ref: { type: 'ASSET', id: bodyJson.inputId },
                result: { assetId },
                error: null,
                createdAt: NOW,
                finishedAt: NOW,
            };
            state.modelGenerations.unshift(genJob);
            state.jobs.set(jid, {
                ...genJob,
                attempts: 1,
                createdBy: { id: user.id, displayName: user.displayName },
            });
            return reply(genJob, 202);
        }
        if (method === 'POST' && path === '/assets/upload-signature') {
            const aid = nextUuid('dddddddd-dddd-4ddd-8ddd');
            pendingUploads.set(aid, bodyJson || {});
            const objectKey =
                bodyJson?.purpose === 'MARKER_MIND' ? `markers/${aid}.mind` : `uploads/${aid}`;
            return reply({
                assetId: aid,
                uploadUrl: `${R2_ORIGIN}/${objectKey}`,
                method: 'PUT',
                objectKey,
                headers: { 'Content-Type': bodyJson.mimeType || 'application/octet-stream' },
                expiresAt: new Date(Date.now() + 900_000).toISOString(),
                _meta: bodyJson,
            });
        }
        if (method === 'POST' && /^\/assets\/[^/]+\/complete$/.test(path)) {
            const aid = path.split('/')[2];
            const uploadMeta = pendingUploads.get(aid) || {};
            pendingUploads.delete(aid);
            const name = bodyJson?.name || uploadMeta.fileName || 'Tài nguyên mới';
            const mime = String(uploadMeta.mimeType || '').toLowerCase();
            const lower = name.toLowerCase();
            const tags = bodyJson?.tags || [];
            const isModel =
                mime.includes('gltf') ||
                mime.includes('glb') ||
                lower.endsWith('.glb') ||
                lower.includes('3d');
            const isAudio =
                mime.startsWith('audio/') ||
                tags.includes('voice') ||
                tags.includes('bgm') ||
                tags.includes('sfx') ||
                lower.endsWith('.mp3') ||
                lower.endsWith('.wav') ||
                lower.includes('âm thanh');
            const isVideo = mime.startsWith('video/') || lower.endsWith('.mp4');
            const type = isModel ? 'MODEL' : isAudio ? 'AUDIO' : isVideo ? 'VIDEO' : 'IMAGE';
            const asset = createAsset(aid, {
                name,
                type,
                format:
                    type === 'MODEL'
                        ? 'glb'
                        : type === 'AUDIO'
                          ? 'mp3'
                          : type === 'VIDEO'
                            ? 'mp4'
                            : 'png',
                status: 'READY',
                tags,
            });
            state.assets.set(aid, asset);
            if (type === 'MODEL') {
                const jid = nextUuid('99999999-9999-4999-8999');
                state.jobs.set(jid, {
                    id: jid,
                    type: 'OPTIMIZE_ASSET',
                    status: 'SUCCEEDED',
                    progress: 100,
                    ref: { type: 'ASSET', id: aid },
                    result: { assetId: aid, meta: {} },
                    error: null,
                    createdAt: NOW,
                    finishedAt: NOW,
                    attempts: 1,
                    createdBy: { id: user.id, displayName: user.displayName },
                });
                return reply(
                    {
                        asset: {
                            id: asset.id,
                            type: asset.type,
                            status: 'READY',
                            sizeBytes: asset.sizeBytes,
                        },
                        jobId: jid,
                    },
                    202,
                );
            }
            return reply({ asset });
        }
        if (method === 'GET' && path === '/assets') {
            const scope = url.searchParams.get('scope') || 'mine';
            const type = url.searchParams.get('type');
            const q = (url.searchParams.get('q') || '').toLowerCase();
            const items = [...state.assets.values()].filter(
                (a) =>
                    a.scope === scope &&
                    (!type || a.type === type) &&
                    (!q || a.name.toLowerCase().includes(q)),
            );
            return replyPage(items, Number(url.searchParams.get('page') || 1));
        }
        if (method === 'GET' && /^\/assets\/[^/]+$/.test(path)) {
            const aid = path.split('/')[2];
            const asset = state.assets.get(aid);
            if (!asset) return replyError('NOT_FOUND', 404, 'Không tìm thấy tài nguyên.');
            return reply(asset);
        }
        if (method === 'PATCH' && /^\/assets\/[^/]+$/.test(path)) {
            const aid = path.split('/')[2];
            const asset = state.assets.get(aid);
            if (!asset) return replyError('NOT_FOUND', 404, 'Không tìm thấy tài nguyên.');
            Object.assign(asset, bodyJson);
            return reply(asset);
        }
        if (method === 'DELETE' && /^\/assets\/[^/]+$/.test(path)) {
            const aid = path.split('/')[2];
            if (aid === modelAssetId && options.assetInUse) {
                return replyError('ASSET_IN_USE', 409, 'Tài nguyên đang được dùng trong sách.', {
                    usages: [
                        {
                            bookId: book1Id,
                            bookTitle: 'Sách Nháp Khám Phá',
                            pageId: page1Id,
                            pageNumber: 1,
                        },
                    ],
                });
            }
            state.assets.delete(aid);
            return route.fulfill({ status: 204, headers });
        }
        if (method === 'GET' && /^\/assets\/[^/]+\/usages$/.test(path)) {
            return reply([]);
        }

        // --- Jobs ---
        if (method === 'GET' && path.startsWith('/jobs/')) {
            const jid = path.split('/').at(-1);
            const job = state.jobs.get(jid);
            if (!job) return replyError('NOT_FOUND', 404, 'Không tìm thấy tác vụ.');
            return reply(job);
        }

        return replyError('NOT_FOUND', 404, `Mock chưa định nghĩa: ${method} ${path}`);
    });

    return {
        state,
        injectFault(fault) {
            state.faults.push(fault);
        },
        clearFaults() {
            state.faults.length = 0;
        },
        setEmailVerified(verified) {
            const user = currentUser();
            if (user) user.emailVerified = verified;
        },
        setAccountLocked(locked) {
            state.session.locked = locked;
            const user = state.users.find((u) => u.id === state.session.currentUserId);
            if (user) user.status = locked ? 'LOCKED' : 'ACTIVE';
        },
        setBookTakenDown(bookId, takenDown, reason = 'Vi phạm bản quyền') {
            const book = state.books.get(bookId);
            if (book) {
                book.takenDown = takenDown;
                book.takenDownReason = takenDown ? reason : null;
                if (takenDown) book.visibility = 'PRIVATE';
            }
        },
        bumpPageRevision(pageId) {
            const pageObj = state.pages.get(pageId);
            if (pageObj) pageObj.revision += 5;
        },
    };
}
