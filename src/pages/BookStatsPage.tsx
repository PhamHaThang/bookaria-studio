import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { rangeLabels, readStatsRange, statsApi, statsKey } from '../features/stats';
import { StatsContent } from '../features/stats/StatsContent';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { Feedback } from '../shared/ui/Feedback';

export function BookStatsPage() {
    const { user } = useAuth();
    const { bookId = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const range = readStatsRange(params),
        valid = IdSchema.safeParse(bookId).success;
    const detail = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    const stats = useQuery({
        queryKey: statsKey(user?.id || '', bookId, range),
        queryFn: ({ signal }) => statsApi.book(bookId, { range }, signal),
        enabled: valid && Boolean(user),
        staleTime: 0,
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy sách</h1>
                <Link to="/stats">Chọn sách khác</Link>
            </>
        );
    const pending = detail.isPending || stats.isPending;
    const failed = detail.isError || stats.isError;
    return (
        <>
            <Link
                className="back-link mb-4 inline-block text-[length:var(--text-sm)] [.studio-editing_&]:inline [.studio-editing_&]:text-[length:12px]"
                to={`/books/${bookId}`}
            >
                Về chi tiết sách
            </Link>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thống kê sách</h1>
                    {detail.isSuccess && (
                        <p className="stats-book-title wrap-anywhere">{detail.data.title}</p>
                    )}
                </div>
                <Link to="/stats">Chọn sách khác</Link>
            </div>
            <div className="stats-toolbar mb-6 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_[data-slot=select-trigger]]:min-w-40 max-[640px]:[&_[data-slot=select-trigger]]:w-full max-[640px]:[&_[data-slot=select-trigger]]:min-w-0 max-[640px]:[&_button]:[align-self:flex-start] [&_label]:m-0 max-[640px]:[&_label]:w-full max-[640px]:[&_label]:min-w-0">
                <Field orientation="contents">
                    <FieldLabel htmlFor="stats-range">
                        Khoảng thời gian
                        <FormSelect
                            id="stats-range"
                            value={range}
                            onValueChange={(value) =>
                                setParams((current) => {
                                    const next = new URLSearchParams(current);
                                    next.set('range', value);
                                    return next;
                                })
                            }
                            options={[
                                ...(Object.entries(rangeLabels).map(([value, label]) => ({
                                    value: value,
                                    label: label,
                                })) ?? []),
                            ]}
                        />
                    </FieldLabel>
                </Field>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={stats.isFetching || detail.isFetching}
                    onClick={() => {
                        void stats.refetch();
                        void detail.refetch();
                    }}
                >
                    Cập nhật số liệu
                </Button>
            </div>
            {pending && <LoadingState layout="stats">Đang tải thống kê…</LoadingState>}
            {failed && (
                <div className="list-state px-0 py-12">
                    <Feedback error={errorMessage(detail.error || stats.error)} />
                    <p>
                        <Link to="/stats">Chọn sách khác</Link>
                    </p>
                </div>
            )}
            {!pending && !failed && stats.data && <StatsContent stats={stats.data} />}
        </>
    );
}
