import { useQuery } from '@tanstack/react-query';
import { BookOpen, LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

export function WorkspacePage() {
    const { user, signingOut } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const profile = useQuery({
        queryKey: ['me', user?.id],
        queryFn: () => auth.profile(),
    });
    async function logout() {
        setError(null);
        try {
            await auth.logout();
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <div className="workspace">
            <header className="workspace-header">
                <Link className="brand" to="/books">
                    <BookOpen size={26} aria-hidden="true" />
                    Bookaria<span>Studio</span>
                </Link>
                <button
                    type="button"
                    className="text-button"
                    disabled={signingOut}
                    onClick={logout}
                >
                    <LogOut size={18} aria-hidden="true" />
                    {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </button>
            </header>
            <main id="main" className="workspace-content">
                <h1>Chào {user?.displayName}</h1>
                <p className="intro">Bạn đã vào không gian làm việc của mình.</p>
                <Feedback error={error || (profile.error ? errorMessage(profile.error) : null)} />
                {!user?.emailVerified && (
                    <div className="verification-note">
                        <p>Xác minh email để có thể xuất bản sách.</p>
                        <Link to="/check-email">Kiểm tra email</Link>
                    </div>
                )}
                <section className="profile-section" aria-labelledby="account-title">
                    <h2 id="account-title">Tài khoản của bạn</h2>
                    <dl>
                        <div>
                            <dt>Email</dt>
                            <dd>{profile.data?.email}</dd>
                        </div>
                        <div>
                            <dt>Vai trò</dt>
                            <dd>{profile.data?.role === 'ADMIN' ? 'Quản trị viên' : 'Tác giả'}</dd>
                        </div>
                        <div>
                            <dt>Email xác minh</dt>
                            <dd>{profile.data?.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</dd>
                        </div>
                    </dl>
                    <button
                        className="text-button"
                        type="button"
                        disabled={profile.isFetching}
                        onClick={() => {
                            void profile.refetch();
                        }}
                    >
                        <RefreshCw size={17} aria-hidden="true" />
                        {profile.isFetching ? 'Đang tải…' : 'Cập nhật thông tin'}
                    </button>
                </section>
                <section className="next-step">
                    <h2>Sách của tôi</h2>
                    <p>Phần danh sách và tạo sách sẽ được triển khai ở bài FE tiếp theo.</p>
                </section>
            </main>
        </div>
    );
}
