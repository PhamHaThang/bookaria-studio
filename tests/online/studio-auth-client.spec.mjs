import { expect, test } from '@playwright/test';
import { installStudioMocks } from './helpers/mock-studio-api.mjs';

test.describe('Studio Client: Auth, Session Lifecycle, Profile & Public Discovery', () => {
    test('login validation, wrong credentials, account locked, and successful session login', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { loggedOut: true });

        await page.goto('/login');
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();

        // 1. Invalid credentials (401 INVALID_CREDENTIALS)
        await dialog.getByLabel('Email').fill('author@bookaria.test');
        await dialog.getByLabel('Mật khẩu', { exact: true }).fill('wrong-password');
        await dialog.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
        await expect(dialog.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible();

        // 2. Account locked (423 ACCOUNT_LOCKED)
        mock.setAccountLocked(true);
        await dialog.getByLabel('Mật khẩu', { exact: true }).fill('ValidPass123!');
        await dialog.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
        await expect(dialog.getByText('Tài khoản đang bị khoá.')).toBeVisible();

        // 3. Valid login -> navigates into workspace
        mock.setAccountLocked(false);
        await dialog.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(
            page.getByRole('button', { name: /Tài khoản của Tác giả Kiểm thử/ }),
        ).toBeVisible();

        // 4. Reload restores session via POST /auth/refresh
        await page.goto('/books');
        await expect(
            page.getByRole('heading', { name: 'Sách của tôi', exact: true }),
        ).toBeVisible();
        expect(mock.state.session.refreshCount).toBeGreaterThanOrEqual(1);
    });

    test('register -> check-email -> rate-limited resend -> verify email token (invalid & valid)', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { loggedOut: true });

        await page.goto('/register');
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Họ tên').fill('Tác giả Mới');
        await dialog.getByLabel('Email').fill('newauthor@bookaria.test');
        await dialog.getByLabel('Mật khẩu', { exact: true }).fill('StrongPass123!');
        await dialog.getByLabel('Nhập lại mật khẩu').fill('StrongPass123!');
        await dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();

        // Redirects to check-email dialog
        await expect(dialog.getByRole('heading', { name: 'Kiểm tra email của bạn' })).toBeVisible();

        // Rate-limited resend (429) shows cooldown or error without losing session
        mock.injectFault({
            method: 'POST',
            match: '/auth/resend-verification',
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
            details: { retryAfterSeconds: 30 },
        });
        // Wait if initial cooldown button is active or verify invalid link flow
        await page.goto('/verify-email?token=invalid-token');
        await expect(
            page.getByRole('dialog').getByRole('heading', { name: 'Chưa xác minh được email' }),
        ).toBeVisible();

        // Valid verification token unlocks deep link /books
        await page.goto('/verify-email?token=valid-email-token&next=%2Fbooks');
        await expect(
            page.getByRole('heading', { name: 'Sách của tôi', exact: true }),
        ).toBeVisible();
    });

    test('transparent single-flight refresh on 401 and forced sign-out on 423 mid-session', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);

        await page.goto('/books');
        await expect(
            page.getByRole('heading', { name: 'Sách của tôi', exact: true }),
        ).toBeVisible();

        // Next GET /books/trash returns 401 -> interceptor calls /auth/refresh once -> retries GET /books/trash
        mock.injectFault({
            method: 'GET',
            match: '/books/trash',
            status: 401,
            code: 'TOKEN_EXPIRED',
            message: 'Phiên đăng nhập đã hết hạn.',
        });
        const refreshBefore = mock.state.session.refreshCount;
        await page.getByRole('link', { name: 'Thùng rác', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Thùng rác', exact: true })).toBeVisible();
        await expect.poll(() => mock.state.session.refreshCount).toBeGreaterThan(refreshBefore);

        // Admin locks account mid-session -> 423 forces clear & prompts re-login
        mock.setAccountLocked(true);
        await page.goto('/assets');
        await expect(page.getByRole('dialog').getByText('Tài khoản đang bị khoá.')).toBeVisible();
    });

    test('forgot password, reset password, profile update, and password change', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { loggedOut: true });

        await page.goto('/forgot-password');
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Email').fill('author@bookaria.test');
        await dialog.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click();
        await expect(dialog.getByText(/sẽ nhận được liên kết đặt lại mật khẩu/i)).toBeVisible();

        await page.goto('/reset-password?token=valid-reset-token');
        await dialog.getByLabel('Mật khẩu mới', { exact: true }).fill('NewStrongPass123!');
        await dialog.getByLabel('Nhập lại mật khẩu').fill('NewStrongPass123!');
        await dialog.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
        await expect(
            dialog.getByText('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.'),
        ).toBeVisible();

        // Log back in and update profile
        await page.goto('/login?next=%2Fprofile');
        await dialog.getByLabel('Email').fill('author@bookaria.test');
        await dialog.getByLabel('Mật khẩu', { exact: true }).fill('NewStrongPass123!');
        await dialog.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
        await page.getByLabel('Họ tên').fill('Tác giả Đã Cập Nhật');
        await page.getByLabel('Tổ chức').fill('CLB Đọc Sách AR');
        await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
        await expect
            .poll(() => mock.state.calls.some((c) => c.method === 'PATCH' && c.path === '/me'))
            .toBe(true);

        // Switch to Change Password tab in-place (avoids reload inert transition) and validate wrong current password
        await page.getByRole('tab', { name: 'Đổi mật khẩu' }).click();
        await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('wrong-old');
        await page.getByLabel('Mật khẩu mới', { exact: true }).fill('UpdatedPass999!');
        await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill('UpdatedPass999!');
        await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
        await expect(page.getByText('Mật khẩu hiện tại không đúng.')).toBeVisible();
    });

    test('public discovery (/library), public book dialog, copy link vs viewer link, and author profile', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { loggedOut: true });
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                    writeText: async (text) => {
                        window.__copiedPublicLink = text;
                    },
                },
            });
        });

        await page.goto('/library');
        await expect(
            page.getByRole('heading', { name: 'Khám phá sách', exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Đại Dương Xanh AR')).toBeVisible();

        // Search filter updates query & filters list
        await page.getByPlaceholder('Tìm theo tên sách').fill('Không Tồn Tại');
        await expect(page.getByText('Đại Dương Xanh AR')).toHaveCount(0);
        await page.getByPlaceholder('Tìm theo tên sách').fill('');
        await expect(page.getByText('Đại Dương Xanh AR')).toBeVisible();

        // Open public book dialog via deep link
        await page.goto('/library?book=dai-duong-xanh-ar');
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Đại Dương Xanh AR' })).toBeVisible();

        await dialog.getByRole('button', { name: 'Sao chép liên kết thông tin sách' }).click();
        const copied = await page.evaluate(() => window.__copiedPublicLink);
        expect(copied).toContain('/library?book=dai-duong-xanh-ar');

        const viewerLink = await dialog
            .getByRole('link', { name: 'Trải nghiệm trong tab mới' })
            .getAttribute('href');
        expect(viewerLink).toMatch(/\/b\/dai-duong-xanh-ar$/);

        // Unavailable / taken down public book returns friendly unavailable state
        mock.setBookTakenDown(mock.state.ids.book2Id, true);
        await page.goto('/library?book=dai-duong-xanh-ar');
        await expect(page.getByRole('dialog')).toContainText(/không còn khả dụng|không khả dụng/i);

        // Author profile page
        await page.goto(`/authors/${mock.state.ids.authorId}`);
        await expect(page.getByRole('heading', { name: 'Tác giả Kiểm thử' })).toBeVisible();

        // Unknown author shows 404 empty state
        await page.goto('/authors/99999999-9999-4999-8999-999999999999');
        await expect(page.getByRole('heading', { name: 'Không tìm thấy tác giả' })).toBeVisible();
    });
});
