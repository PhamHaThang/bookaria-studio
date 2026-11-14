import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { BookOpen, Building2, UserRound, UserRoundX } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { discoveryApi } from '@/features/discovery';
import { PublicBooks, PublicBooksSkeleton } from '@/features/discovery/PublicBooks';
import { errorMessage } from '@/shared/api/errors';
import { IdSchema } from '@/shared/contracts/common.schema';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/primitives/avatar';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Skeleton } from '@/shared/ui/primitives/skeleton';

const identityClass = 'flex items-center gap-4 sm:gap-6';
const avatarClass = 'size-18 sm:size-24';
const shelfClass = 'mt-8 sm:mt-10';

export function AuthorPage() {
    const { authorId = '' } = useParams();
    const valid = IdSchema.safeParse(authorId).success;
    const profile = useQuery({
        queryKey: ['discovery', 'author', authorId],
        queryFn: ({ signal }) => discoveryApi.author(authorId, signal),
        enabled: valid,
        staleTime: 0,
    });
    const status = isAxiosError(profile.error) ? profile.error.response?.status : undefined;
    const notFound = !valid || status === 404 || status === 410;
    const { author, books = [] } = profile.data ?? {};
    const organization = author?.organization?.trim();
    const bio = author?.bio?.trim();

    return (
        <>
            {notFound || profile.isError ? (
                <Empty className="min-h-64 rounded-[var(--radius-card)] bg-muted px-5 py-12 sm:min-h-80">
                    <EmptyHeader>
                        <EmptyMedia className="mb-1 size-14 rounded-full bg-surface">
                            {notFound ? (
                                <UserRoundX aria-hidden="true" className="size-6" />
                            ) : (
                                <UserRound aria-hidden="true" className="size-6" />
                            )}
                        </EmptyMedia>
                        <EmptyTitle>
                            <h1 className="m-0 text-inherit">
                                {notFound
                                    ? 'Không tìm thấy tác giả'
                                    : 'Chưa tải được hồ sơ tác giả'}
                            </h1>
                        </EmptyTitle>
                        {notFound && (
                            <EmptyDescription>
                                Hồ sơ này không còn khả dụng. Hãy kiểm tra lại liên kết bạn đã mở.
                            </EmptyDescription>
                        )}
                    </EmptyHeader>
                    {!notFound && (
                        <>
                            <Feedback error={errorMessage(profile.error)} />
                            <EmptyContent>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={profile.isFetching}
                                    aria-busy={profile.isFetching}
                                    onClick={() => void profile.refetch()}
                                >
                                    Thử tải lại
                                </Button>
                            </EmptyContent>
                        </>
                    )}
                </Empty>
            ) : author ? (
                <>
                    <header className="grid gap-6">
                        <div className={identityClass}>
                            <Avatar className={avatarClass} aria-hidden="true">
                                {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
                                <AvatarFallback className="bg-primary font-semibold text-3xl text-primary-foreground sm:text-4xl">
                                    {Array.from(author.displayName.trim())[0]?.toLocaleUpperCase(
                                        'vi',
                                    )}
                                </AvatarFallback>
                            </Avatar>
                            <div className="wrap-anywhere min-w-0">
                                <h1 className="m-0 font-semibold text-3xl leading-tight tracking-tight sm:text-5xl">
                                    {author.displayName}
                                </h1>
                                <p className="m-0 mt-2 flex items-start gap-2 text-muted-foreground text-sm">
                                    <Building2
                                        aria-hidden="true"
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                    <span>{organization || 'Chưa có thông tin tổ chức'}</span>
                                </p>
                            </div>
                        </div>
                        <div>
                            <h2 className="m-0 font-semibold text-base">Giới thiệu</h2>
                            <p className="wrap-anywhere m-0 mt-2 whitespace-pre-wrap text-muted-foreground leading-relaxed">
                                {bio || 'Chưa có giới thiệu.'}
                            </p>
                        </div>
                        <dl className="m-0 flex flex-wrap gap-x-10 gap-y-3 sm:gap-x-16">
                            <div className="flex flex-col-reverse gap-0.5">
                                <dt className="text-muted-foreground text-sm">Sách công khai</dt>
                                <dd className="m-0 font-semibold text-2xl tabular-nums">
                                    {books.length.toLocaleString('vi-VN')}
                                </dd>
                            </div>
                            <div className="flex flex-col-reverse gap-0.5">
                                <dt className="text-muted-foreground text-sm">Trang AR</dt>
                                <dd className="m-0 font-semibold text-2xl tabular-nums">
                                    {books
                                        .reduce((total, book) => total + book.arPageCount, 0)
                                        .toLocaleString('vi-VN')}
                                </dd>
                            </div>
                        </dl>
                    </header>

                    <section aria-labelledby="author-books-title" className={shelfClass}>
                        <h2
                            id="author-books-title"
                            className="m-0 mb-4 font-semibold text-2xl tracking-tight sm:mb-5"
                        >
                            Sách của tác giả
                        </h2>
                        {books.length > 0 ? (
                            <PublicBooks books={books} showAuthor={false} />
                        ) : (
                            <Empty className="min-h-56">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <BookOpen aria-hidden="true" />
                                    </EmptyMedia>
                                    <EmptyTitle className="text-lg">
                                        <h3>Tác giả chưa có sách công khai</h3>
                                    </EmptyTitle>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </section>
                </>
            ) : (
                <>
                    <div className="grid gap-6" role="status">
                        <span className="sr-only">Đang tải hồ sơ tác giả…</span>
                        <div className={identityClass}>
                            <Skeleton className={`${avatarClass} shrink-0 rounded-full`} />
                            <div className="min-w-0 space-y-2">
                                <Skeleton className="h-8 w-48 max-w-full sm:h-10" />
                                <Skeleton className="h-4 w-32 max-w-full" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-5 w-full max-w-96" />
                        </div>
                        <div className="flex gap-10 sm:gap-16">
                            <Skeleton className="h-12 w-28" />
                            <Skeleton className="h-12 w-20" />
                        </div>
                    </div>
                    <div className={shelfClass}>
                        <Skeleton className="mb-4 h-8 w-44 sm:mb-5" />
                        <PublicBooksSkeleton showAuthor={false} />
                    </div>
                </>
            )}
        </>
    );
}
