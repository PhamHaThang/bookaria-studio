import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { discoveryApi } from '../features/discovery';
import { PublicBooks } from '../features/discovery/PublicBooks';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { Avatar } from '../shared/ui/Avatar';
import { Feedback } from '../shared/ui/Feedback';

export function AuthorPage() {
    const { authorId = '' } = useParams();
    const valid = IdSchema.safeParse(authorId).success;
    const profile = useQuery({
        queryKey: ['discovery', 'author', authorId],
        queryFn: ({ signal }) => discoveryApi.author(authorId, signal),
        enabled: valid,
        staleTime: 0,
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy tác giả</h1>
                <Link to="/explore">Về thư viện</Link>
            </>
        );
    return (
        <>
            <Link to="/explore">Về thư viện</Link>
            {profile.isPending && <p role="status">Đang tải hồ sơ tác giả…</p>}
            {profile.isError && (
                <div className="list-state px-0 py-12">
                    <h1>Chưa mở được hồ sơ tác giả</h1>
                    <Feedback error={errorMessage(profile.error)} />
                    <Button type="button" onClick={() => void profile.refetch()}>
                        Thử tải lại
                    </Button>
                </div>
            )}
            {profile.isSuccess && (
                <>
                    <header className="public-author wrap-anywhere mx-0 mt-8 mb-4 flex items-center gap-4 [&_.account-avatar]:size-16 [&_h1]:m-0 [&_p]:m-0">
                        <Avatar url={profile.data.author.avatarUrl} />
                        <div>
                            <h1>{profile.data.author.displayName}</h1>
                            {profile.data.author.organization && (
                                <p>{profile.data.author.organization}</p>
                            )}
                        </div>
                    </header>
                    {profile.data.author.bio && (
                        <p className="public-bio wrap-anywhere mb-8 max-w-[70ch] [white-space:pre-wrap]">
                            {profile.data.author.bio}
                        </p>
                    )}
                    <h2>Sách công khai của tác giả</h2>
                    {profile.data.books.length ? (
                        <PublicBooks books={profile.data.books} />
                    ) : (
                        <p className="list-state px-0 py-12">Tác giả chưa có sách công khai.</p>
                    )}
                </>
            )}
        </>
    );
}
