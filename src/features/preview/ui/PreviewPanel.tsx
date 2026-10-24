import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { apiClient } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/errors';
import { IdSchema } from '../../../shared/contracts/common.schema';
import { type BookDetail, JobResultsSchema, type Page } from '../../../shared/contracts/dto.schema';
import { ApiErrorSchema } from '../../../shared/contracts/error.schema';
import type { Scene } from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetsApi } from '../../assets';
import { auth, useAuth } from '../../auth';
import { pagesApi } from '../../pages';
import { createPreviewApi } from '../api/preview-api';
import {
    makePreviewPayload,
    type PreviewPayload,
    previewUrl,
    viewerOrigin,
} from '../model/preview';

const api = createPreviewApi(apiClient);
const messageSchema = z.object({
    type: z.enum(['BOOKARIA_READY', 'BOOKARIA_STATUS']),
    nonce: z.string().uuid(),
    status: z.string().optional(),
    requestId: z.int().positive().optional(),
});
export function PreviewPanel({
    page,
    book,
    scene,
    disabled,
    unsaved,
}: {
    page: Page;
    book: BookDetail;
    scene: Scene;
    disabled: boolean;
    unsaved: boolean;
}) {
    const { user } = useAuth();
    const frame = useRef<HTMLIFrameElement>(null);
    const [embed, setEmbed] = useState<{ nonce: string; payload: PreviewPayload } | null>(null);
    const [loading, setLoading] = useState(false),
        [error, setError] = useState<string | null>(null);
    const [frameState, setFrameState] = useState(''),
        [jobState, setJobState] = useState('');
    const [scope, setScope] = useState<'PAGE' | 'BOOK'>('PAGE');
    const [jobId, setJobId] = useState<string | null>(null),
        [pollError, setPollError] = useState(false);
    const [link, setLink] = useState<string | null>(null),
        [qr, setQr] = useState<string | null>(null);
    const request = useRef<AbortController | null>(null),
        posting = useRef(false),
        alive = useRef(true);
    const requestId = useRef(0);
    let origin = '',
        configError = '';
    try {
        origin = viewerOrigin(
            import.meta.env.VITE_VIEWER_ORIGIN || 'https://viewer.localhost:5174',
        );
    } catch (cause) {
        configError = errorMessage(cause);
    }
    const session = useCallback(
        () => alive.current && auth.store.getState().user?.id === user?.id,
        [user?.id],
    );
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            request.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (!embed) return;
        const receive = (event: MessageEvent) => {
            if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
            const message = messageSchema.safeParse(event.data);
            if (!message.success || message.data.nonce !== embed.nonce) return;
            if (message.data.type === 'BOOKARIA_READY') {
                const id = ++requestId.current;
                frame.current?.contentWindow?.postMessage(
                    {
                        type: 'BOOKARIA_PREVIEW',
                        nonce: embed.nonce,
                        requestId: id,
                        payload: embed.payload,
                    },
                    origin,
                );
            } else if (message.data.status === 'loaded' || message.data.status === 'started')
                setFrameState(
                    message.data.status === 'loaded'
                        ? 'Bản đang sửa đã sẵn sàng trong Viewer. Bấm Bắt đầu xem 3D bên dưới.'
                        : 'Viewer đang chạy bản xem trước.',
                );
            else if (message.data.status === 'error')
                setFrameState(
                    'Viewer chưa mở được nội dung. Xem thông báo trong khung hoặc đóng và thử lại.',
                );
        };
        window.addEventListener('message', receive);
        const timer = setTimeout(
            () =>
                setFrameState(
                    (current) =>
                        current ||
                        'Chưa kết nối được Viewer. Kiểm tra Viewer đang chạy ở cổng 5174, cấu hình origin, rồi đóng và mở lại.',
                ),
            15_000,
        );
        return () => {
            window.removeEventListener('message', receive);
            clearTimeout(timer);
        };
    }, [embed, origin]);
    useEffect(() => {
        if (!jobId || pollError) return;
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const began = Date.now();
        async function poll() {
            try {
                const job = await pagesApi.job(jobId || '', abort.signal);
                if (abort.signal.aborted || !session()) return;
                if (
                    job.type !== 'BUILD_PREVIEW' ||
                    job.ref.type !== 'BOOK' ||
                    job.ref.id !== book.id
                )
                    throw new Error('Tác vụ không thuộc bản xem trước của sách này.');
                setJobState(`Tạo bản xem trước: ${job.progress}% · ${job.status}`);
                if (job.status === 'FAILED') {
                    setJobId(null);
                    setError(
                        job.error?.message ||
                            'Tạo bản xem trước thất bại. Hãy kiểm tra trang và thử lại.',
                    );
                    return;
                }
                if (job.status === 'SUCCEEDED') {
                    const result = JobResultsSchema.BUILD_PREVIEW.parse(job.result);
                    const url = previewUrl(origin, result.token);
                    setLink(url);
                    setJobId(null);
                    setJobState(
                        'Đã tạo liên kết xem trước tạm thời (24 giờ). Đây là ảnh chụp dữ liệu đã lưu, không tự cập nhật khi bạn sửa tiếp.',
                    );
                    return;
                }
                if (Date.now() - began > 120_000) {
                    setPollError(true);
                    setError(
                        'Tác vụ vẫn đang chạy. Bấm Tiếp tục kiểm tra; không cần tạo tác vụ khác.',
                    );
                    return;
                }
                timer = setTimeout(() => {
                    void poll();
                }, 1500);
            } catch (cause) {
                if (!abort.signal.aborted && session()) {
                    setPollError(true);
                    setError(errorMessage(cause));
                }
            }
        }
        void poll();
        return () => {
            abort.abort();
            clearTimeout(timer);
        };
    }, [jobId, pollError, book.id, origin, session]);
    useEffect(() => {
        if (!link) return;
        let cancelled = false;
        import('qrcode')
            .then(async ({ toDataURL }) => {
                const image = await toDataURL(link, { width: 240, margin: 2 });
                if (!cancelled && session()) setQr(image);
            })
            .catch(() => {
                if (!cancelled && session())
                    setError(
                        'Đã có liên kết nhưng chưa tạo được QR. Bạn vẫn có thể mở hoặc sao chép liên kết.',
                    );
            });
        return () => {
            cancelled = true;
        };
    }, [link, session]);
    async function local() {
        if (disabled || request.current) return;
        const abort = new AbortController();
        request.current = abort;
        setLoading(true);
        setError(null);
        try {
            const payload = await makePreviewPayload(
                page,
                book,
                scene,
                assetsApi.detail,
                abort.signal,
            );
            if (!session() || abort.signal.aborted) return;
            setFrameState('');
            setEmbed({ nonce: crypto.randomUUID(), payload });
        } catch (cause) {
            if (!abort.signal.aborted && session()) setError(errorMessage(cause));
        } finally {
            if (request.current === abort) {
                request.current = null;
                if (session()) setLoading(false);
            }
        }
    }
    async function create() {
        if (posting.current || disabled || unsaved || jobId) return;
        posting.current = true;
        setLoading(true);
        setError(null);
        setLink(null);
        setQr(null);
        setJobState('Đang gửi yêu cầu tạo bản xem trước…');
        try {
            const result = await api.create(
                book.id,
                scope === 'PAGE' ? { scope, pageId: page.id } : { scope },
            );
            if (session()) {
                setPollError(false);
                setJobId(result.jobId);
            }
        } catch (cause) {
            if (!session()) return;
            const response =
                typeof cause === 'object' && cause !== null && 'response' in cause
                    ? (cause as { response?: { data?: unknown } }).response
                    : undefined;
            const parsed = ApiErrorSchema.safeParse(response?.data);
            const existing =
                parsed.success && parsed.data.error.code === 'JOB_IN_PROGRESS'
                    ? IdSchema.safeParse(
                          (parsed.data.error.details as Record<string, unknown> | undefined)?.jobId,
                      )
                    : null;
            if (existing?.success) {
                setPollError(false);
                setJobId(existing.data);
                setJobState('Đang kiểm tra tác vụ preview đã có của sách.');
            } else {
                setJobState('');
                setError(errorMessage(cause));
            }
        } finally {
            posting.current = false;
            if (session()) setLoading(false);
        }
    }
    return (
        <section
            className="scene-preview mt-6 border-t-[1px] border-t-border pt-5 [border-top-style:solid] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [&_p]:max-w-[75ch] [.workbench-panel_&]:m-0 [.workbench-panel_&]:border-0 [.workbench-panel_&]:border-[transparent] [.workbench-panel_&]:border-solid [.workbench-panel_&]:p-0"
            aria-labelledby="preview-heading"
        >
            <h3 id="preview-heading">Xem trước</h3>
            <p>
                Bản trên máy dùng nội dung AR đang sửa và cài đặt trang đã lưu. Sau khi sửa tiếp,
                bấm cập nhật để gửi bản mới sang Viewer.
            </p>
            <Feedback error={configError || error} />
            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                <Button
                    variant="secondary"
                    aria-busy={loading}
                    disabled={disabled || Boolean(configError) || loading}
                    onClick={() => {
                        void local();
                    }}
                >
                    {loading && <Spinner data-icon="inline-start" aria-hidden="true" />}
                    {embed ? 'Cập nhật bản xem trên máy' : 'Xem bản đang sửa trên máy'}
                </Button>
                {embed && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setEmbed(null);
                            setFrameState('');
                        }}
                    >
                        Đóng bản xem trên máy
                    </Button>
                )}
            </div>
            {embed && (
                <>
                    <p role="status">{frameState || 'Đang kết nối Viewer…'}</p>
                    <iframe
                        key={embed.nonce}
                        ref={frame}
                        title="Viewer xem trước nội dung AR"
                        className="scene-preview-frame mt-3 h-200 max-h-[85dvh] w-full rounded-[var(--radius-md)] border border-border border-solid bg-surface [.workbench-panel_&]:h-135 [.workbench-panel_&]:max-h-[65dvh]"
                        src={`${origin}/embed#${new URLSearchParams({ parent: location.origin, nonce: embed.nonce })}`}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        referrerPolicy="no-referrer"
                    />
                </>
            )}
            <div className="scene-preview-link mt-6 [&_>_label]:mb-4 [&_>_label]:grid [&_>_label]:max-w-80 [&_>_label]:gap-2 [&_h4]:mx-0 [&_h4]:mt-0 [&_h4]:mb-3">
                <h4>Xem trên điện thoại</h4>
                <p>
                    Liên kết dùng bản đã lưu, khả dụng trong 24 giờ. Người có liên kết có thể xem;
                    hãy chỉ chia sẻ cho người thử.
                </p>
                {origin &&
                    /^(localhost|.*\.localhost|127\.0\.0\.1)$/.test(new URL(origin).hostname) && (
                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Địa chỉ local hiện chỉ mở trên máy này. Để thử bằng điện thoại, dùng địa
                            chỉ HTTPS truy cập được từ điện thoại theo hướng dẫn FE09.
                        </p>
                    )}
                {unsaved && (
                    <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                        Lưu nội dung AR và cài đặt trang trước khi tạo liên kết.
                    </p>
                )}
                <Field orientation="contents">
                    <FieldLabel htmlFor="preview-scope">
                        Phạm vi
                        <NativeSelect
                            id="preview-scope"
                            value={scope}
                            disabled={Boolean(jobId) || loading}
                            onChange={(event) =>
                                setScope(event.currentTarget.value as 'PAGE' | 'BOOK')
                            }
                        >
                            <option value="PAGE">Trang hiện tại</option>
                            <option value="BOOK">Toàn bộ sách</option>
                        </NativeSelect>
                    </FieldLabel>
                </Field>
                <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                    <Button
                        variant="secondary"
                        aria-busy={loading}
                        disabled={
                            disabled || unsaved || Boolean(jobId) || Boolean(configError) || loading
                        }
                        onClick={() => {
                            void create();
                        }}
                    >
                        {loading && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        Tạo liên kết xem trước 24 giờ
                    </Button>
                    {pollError && jobId && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setError(null);
                                setPollError(false);
                            }}
                        >
                            Tiếp tục kiểm tra
                        </Button>
                    )}
                </div>
                {jobState && <p role="status">{jobState}</p>}
                {link && (
                    <div className="scene-preview-share [&_>_div]:wrap-anywhere mt-4 flex flex-wrap items-center gap-5 [&_>_div]:min-w-0 [&_>_div]:flex-[1_1_240px] [&_img]:h-auto [&_img]:max-w-full">
                        <div>
                            <a href={link} target="_blank" rel="noopener noreferrer">
                                Mở bản xem trước
                            </a>
                            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                {link}
                            </p>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    void navigator.clipboard.writeText(link).then(
                                        () => setJobState('Đã sao chép liên kết.'),
                                        () =>
                                            setError(
                                                'Không sao chép tự động được. Chọn và sao chép liên kết phía trên.',
                                            ),
                                    );
                                }}
                            >
                                Sao chép liên kết
                            </Button>
                        </div>
                        {qr && (
                            <img
                                src={qr}
                                alt="Mã QR mở bản xem trước trên điện thoại"
                                width={240}
                                height={240}
                            />
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
