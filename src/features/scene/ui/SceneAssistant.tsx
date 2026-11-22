import { useQuery } from '@tanstack/react-query';
import {
    ArrowUp,
    AtSign,
    Box,
    Check,
    ChevronDown,
    ChevronRight,
    CircleHelp,
    Image,
    Maximize2,
    Minimize2,
    Minus,
    MousePointer2,
    NotepadText,
    Play,
    Plus,
    Search,
    Sparkles,
    Square,
    Tag,
    Trash2,
    Type,
    Video,
    Volume2,
    Workflow,
    X,
} from 'lucide-react';
import {
    type ComponentProps,
    Fragment,
    type Ref,
    useCallback,
    useDeferredValue,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import type {
    InteractionAiPlan,
    InteractionAiResult,
} from '@/shared/contracts/api/interaction-ai.schema';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Asset, BookDetail, Page } from '@/shared/contracts/dto.schema';
import { pageWidthMm } from '@/shared/contracts/marker.schema';
import type {
    InteractionRule,
    Scene,
    SceneObject,
    WorkflowVariable,
} from '@/shared/contracts/scene.schema';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/lib/cn';
import { BookariaLogo } from '@/shared/ui/BookariaLogo';
import { Alert, AlertDescription } from '@/shared/ui/primitives/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/shared/ui/primitives/alert-dialog';
import { Badge } from '@/shared/ui/primitives/badge';
import { Bubble, BubbleContent } from '@/shared/ui/primitives/bubble';
import { Button } from '@/shared/ui/primitives/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupTextarea,
} from '@/shared/ui/primitives/input-group';
import { Kbd } from '@/shared/ui/primitives/kbd';
import { Message, MessageContent, MessageHeader } from '@/shared/ui/primitives/message';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
    useMessageScroller,
} from '@/shared/ui/primitives/message-scroller';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui/primitives/select';
import { Separator } from '@/shared/ui/primitives/separator';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
import { assetsApi, assetTypeLabels } from '../../assets';
import { useAuth } from '../../auth';
import { createSceneApi } from '../api/scene-api';
import {
    type ChatMessage,
    type ChatReference,
    type ChatSession,
    editChatInput,
    readChat,
    replaceChatInput,
    saveChat,
} from '../model/ai-chat';
import { aiPlanState, proposalSnapshot, stageAiPlan } from '../model/ai-proposal';
import { ruleTriggerLabel } from '../model/interaction-scope';
import { actionSummary, objectName } from '../model/interaction-templates';
import { sceneObjectLabel, searchable } from '../model/object-list';
import { InteractionTestPanel } from './InteractionTestPanel';

const api = createSceneApi(apiClient);
const referenceIcons = {
    model: Box,
    image: Image,
    audio: Volume2,
    video: Video,
    text: Type,
    label: Tag,
    hotspot: MousePointer2,
};
const libraryIcons = { MODEL: Box, IMAGE: Image, VIDEO: Video, AUDIO: Volume2 };

function ReferenceHighlights({
    input,
    references,
    mirrorRef,
}: {
    input: string;
    references: ChatReference[];
    mirrorRef: Ref<HTMLDivElement>;
}) {
    let position = 0;
    return (
        <div
            ref={mirrorRef}
            aria-hidden="true"
            className="wrap-break-word pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap px-4 py-2 font-normal text-[length:var(--text-md)] text-transparent leading-[var(--leading-normal)] [scrollbar-gutter:stable]"
        >
            {references
                .toSorted((a, b) => a.start - b.start)
                .map(({ start, end }) => {
                    const preceding = input.slice(position, start);
                    position = end;
                    return (
                        <Fragment key={start}>
                            {preceding}
                            <mark className="rounded-sm bg-selected text-transparent ring-1 ring-selected">
                                {input.slice(start, end)}
                            </mark>
                        </Fragment>
                    );
                })}
            {input.slice(position)}
            {'\u200b'}
        </div>
    );
}

function resultPlan(result?: InteractionAiResult): InteractionAiPlan | undefined {
    if (result?.status === 'edit_plan') return result.plan;
    if (result?.status === 'proposal') return { rules: [{ rule: result.rule }], variables: [] };
}

function RemovedItems({
    plan,
    objects,
    rules,
}: {
    plan: InteractionAiPlan;
    objects: SceneObject[];
    rules: InteractionRule[];
}) {
    return (
        <ul className="mt-1 mb-0 max-h-40 list-disc space-y-1 overflow-y-auto pl-4 text-sm">
            {plan.removeObjectIds?.map((id) => {
                const object = objects.find((item) => item.id === id);
                return (
                    <li key={`object:${id}`}>{object ? objectName(object) : 'Đối tượng đã xóa'}</li>
                );
            })}
            {plan.removeRuleIds?.map((id) => (
                <li key={`rule:${id}`}>
                    {rules.find((item) => item.id === id)?.name || 'Luồng tương tác'}
                </li>
            ))}
        </ul>
    );
}

const settingLabels: Record<string, string> = {
    opacity: 'Độ hiện ảnh',
    autoplay: 'Tự phát',
    loop: 'Lặp',
    muted: 'Tắt tiếng',
    volume: 'Âm lượng',
    audioKind: 'Loại âm thanh',
    size: 'Kích thước',
    showHint: 'Gợi ý vùng chạm',
    target: 'Đầu mũi chỉ',
    controls: 'Điều khiển',
    animation: 'Hoạt cảnh',
    clip: 'Clip',
    enabled: 'Bật',
    speed: 'Tốc độ',
    bounds: 'Giới hạn',
    autoRotate: 'Tự xoay',
    forwardAxis: 'Hướng mặt trước',
    idleClip: 'Clip đứng yên',
    moveClip: 'Clip di chuyển',
    border: 'Viền',
    color: 'Màu viền',
    width: 'Độ dày',
    titleStyle: 'Chữ tiêu đề',
    bodyStyle: 'Chữ nội dung',
    buttonStyle: 'Chữ nút',
    weight: 'Độ đậm',
    align: 'Căn chữ',
    depth: 'Độ nổi',
    imageAssetId: 'Ảnh thẻ',
    buttonLabel: 'Nhãn nút',
    buttonUrl: 'Liên kết nút',
    pointer: 'Hướng đuôi',
    pointerPosition: 'Vị trí đuôi',
    shape: 'Kiểu chú thích',
    connectorSide: 'Cạnh nối',
    labelOffset: 'Độ lệch nhãn',
};

function settingRows(patch: object, prior?: object, group?: string): (string | undefined)[][] {
    const current = prior as Record<string, unknown> | undefined;
    return Object.entries(patch).flatMap(([key, value]) => {
        const label = settingLabels[key];
        if (!label || value === undefined) return [];
        const name = group ? `${group} · ${label}` : label;
        const before = current?.[key];
        if (value && typeof value === 'object' && !Array.isArray(value))
            return settingRows(
                value,
                before && typeof before === 'object' ? before : undefined,
                name,
            );
        const format = (item: unknown) => {
            if (item === undefined) return undefined;
            if (item === null) return 'Bỏ thiết lập';
            if (typeof item === 'boolean') return item ? 'Bật' : 'Tắt';
            if (typeof item === 'number' && (key === 'opacity' || key === 'volume'))
                return `${Math.round(item * 100)}%`;
            if (key === 'imageAssetId') return 'Ảnh đã chọn';
            if (Array.isArray(item)) return item.join(' / ');
            return String(item);
        };
        return [[name, format(before), format(value)]];
    });
}

function PlanDetails({
    plan,
    scene,
    variables,
    beforeObjects,
    beforeRules,
    libraryAssets,
    widthMm,
}: {
    plan: InteractionAiPlan;
    scene: Scene;
    variables: WorkflowVariable[];
    beforeObjects?: SceneObject[];
    beforeRules?: InteractionRule[];
    libraryAssets: Map<string, Asset>;
    widthMm: number;
}) {
    const objects = [...scene.objects, ...(plan.objectAdds ?? [])];
    return (
        <div className="flex flex-col gap-3">
            {!!plan.objectAdds?.length && (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="m-0 font-medium">Thêm vào trang</p>
                    <ul className="mt-1 mb-0 list-disc space-y-1 pl-4 text-sm">
                        {plan.objectAdds.map((object) => (
                            <li key={object.id}>
                                {objectName(object)}{' '}
                                <span className="text-muted-foreground">
                                    · {sceneObjectLabel(object)}
                                </span>
                                {'text' in object && (
                                    <div className="space-y-1 text-muted-foreground text-xs">
                                        <p className="wrap-break-word m-0">{object.text}</p>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span
                                                aria-hidden="true"
                                                className="size-3 rounded-sm border border-border"
                                                style={{ backgroundColor: object.style.color }}
                                            />
                                            Màu chữ {object.style.color}
                                        </span>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {!!(plan.removeObjectIds?.length || plan.removeRuleIds?.length) && (
                <div className="rounded-lg border border-border px-3 py-2.5">
                    <p className="m-0 flex items-center gap-2 font-medium">
                        <Trash2 aria-hidden="true" className="size-3.5" /> Xóa khỏi trang
                    </p>
                    <RemovedItems
                        plan={plan}
                        objects={beforeObjects ?? scene.objects}
                        rules={beforeRules ?? scene.interactions}
                    />
                </div>
            )}
            {plan.objectEdits?.map(
                ({
                    objectId,
                    name,
                    visible,
                    text,
                    style,
                    presentation,
                    properties,
                    transform,
                    assetId,
                    billboard,
                    snapToPaper,
                }) => {
                    const before = (beforeObjects ?? scene.objects).find(
                        (item) => item.id === objectId,
                    );
                    const vector = (values?: number[]) =>
                        values?.map((value) => Number(value.toFixed(4))).join(' / ');
                    const visibility = (value?: boolean) =>
                        value === undefined ? undefined : value ? 'Hiện' : 'Ẩn';
                    const currentText = before && 'style' in before ? before : undefined;
                    const appearance = currentText?.presentation;
                    const card = appearance?.kind === 'screen' || appearance?.kind === 'bubble';
                    const size = (value?: number) =>
                        value === undefined
                            ? undefined
                            : `${Number((value * widthMm * (card ? 16 : 1)).toFixed(2))} mm`;
                    const fontLabels = { sans: 'Không chân', serif: 'Có chân', rounded: 'Bo tròn' };
                    const font = (value?: keyof typeof fontLabels) => value && fontLabels[value];
                    const weight = (value?: boolean) =>
                        value === undefined ? undefined : value ? 'Đậm' : 'Thường';
                    const rows = [
                        ['Tên', before?.name, name],
                        ['Hiển thị ban đầu', visibility(before?.visible), visibility(visible)],
                        [
                            'Bám mặt giấy',
                            before?.snapToPaper ? 'Bật' : 'Tắt',
                            snapToPaper === undefined ? undefined : snapToPaper ? 'Bật' : 'Tắt',
                        ],
                        ['Nội dung', before && 'text' in before ? before.text : undefined, text],
                        ['Màu chữ', currentText?.style.color, style?.color],
                        [
                            card ? 'Chiều rộng thẻ' : 'Cỡ chữ',
                            size(currentText?.style.size),
                            size(style?.size),
                        ],
                        ['Kiểu chữ', font(currentText?.style.font), font(style?.font)],
                        ['Độ đậm', weight(currentText?.style.bold), weight(style?.bold)],
                        [
                            'Màu nền',
                            appearance && 'background' in appearance
                                ? appearance.background
                                : undefined,
                            presentation && 'background' in presentation
                                ? presentation.background
                                : undefined,
                        ],
                        [
                            'Tiêu đề',
                            card ? appearance.title : undefined,
                            presentation && 'title' in presentation
                                ? presentation.title
                                : undefined,
                        ],
                        [
                            'Màu nút',
                            appearance?.kind === 'screen'
                                ? (appearance.buttonBackground ?? currentText?.style.color)
                                : undefined,
                            presentation?.kind === 'screen'
                                ? presentation.buttonBackground === null
                                    ? 'Theo màu chữ'
                                    : presentation.buttonBackground
                                : undefined,
                        ],
                        [
                            'Mô tả',
                            appearance?.kind === 'annotation' ? appearance.description : undefined,
                            presentation?.kind === 'annotation'
                                ? presentation.description
                                : undefined,
                        ],
                        [
                            'Màu chữ mô tả',
                            appearance?.kind === 'annotation'
                                ? appearance.descriptionColor
                                : undefined,
                            presentation?.kind === 'annotation'
                                ? presentation.descriptionColor
                                : undefined,
                        ],
                        [
                            'Màu nền mô tả',
                            appearance?.kind === 'annotation'
                                ? appearance.descriptionBackground
                                : undefined,
                            presentation?.kind === 'annotation'
                                ? presentation.descriptionBackground
                                : undefined,
                        ],
                        [
                            'Tài nguyên',
                            before && 'assetId' in before
                                ? libraryAssets.get(before.assetId)?.name
                                : undefined,
                            assetId
                                ? (libraryAssets.get(assetId)?.name ?? 'Tài nguyên đã chọn')
                                : undefined,
                        ],
                        [
                            'Luôn hướng về camera',
                            before?.billboard === undefined
                                ? undefined
                                : before.billboard
                                  ? 'Bật'
                                  : 'Tắt',
                            billboard === undefined ? undefined : billboard ? 'Bật' : 'Tắt',
                        ],
                        [
                            'Vị trí (X/Y/Z)',
                            vector(before?.transform.position),
                            vector(transform?.position),
                        ],
                        [
                            'Góc xoay (°)',
                            vector(before?.transform.rotation),
                            vector(transform?.rotation),
                        ],
                        [
                            'Tỉ lệ (X/Y/Z)',
                            vector(before?.transform.scale),
                            vector(transform?.scale),
                        ],
                        ...(properties ? settingRows(properties, before) : []),
                        ...(presentation ? settingRows(presentation, appearance) : []),
                        ...(presentation === null
                            ? [['Kiểu trình bày', undefined, 'Văn bản thường']]
                            : []),
                    ];
                    return (
                        <div key={objectId} className="rounded-lg bg-muted/50 px-3 py-2.5">
                            <p className="m-0 flex items-center gap-2 font-medium [overflow-wrap:anywhere]">
                                <Box
                                    aria-hidden="true"
                                    className="size-3.5 shrink-0 text-muted-foreground"
                                />
                                {before ? objectName(before) : name || 'Đối tượng'}
                            </p>
                            <dl className="mt-2 mb-0 grid gap-2 text-xs [overflow-wrap:anywhere]">
                                {rows.map(
                                    ([label, from, to]) =>
                                        to !== undefined && (
                                            <div key={label}>
                                                <dt className="text-muted-foreground">{label}</dt>
                                                <dd className="m-0">
                                                    {from && from !== to && (
                                                        <span className="text-muted-foreground">
                                                            <span className="sr-only">Trước: </span>
                                                            {from}
                                                            <span aria-hidden="true"> → </span>
                                                            <span className="sr-only">Sau: </span>
                                                        </span>
                                                    )}
                                                    {label?.startsWith('Màu') && (
                                                        <span
                                                            aria-hidden="true"
                                                            className="me-1 inline-block size-3 rounded-sm border border-border align-middle"
                                                            style={{ backgroundColor: to }}
                                                        />
                                                    )}
                                                    <span className="font-medium">
                                                        {to || 'Trống'}
                                                    </span>
                                                </dd>
                                            </div>
                                        ),
                                )}
                            </dl>
                        </div>
                    );
                },
            )}
            {plan.variables.length > 0 && (
                <p className="m-0 text-muted-foreground text-xs">
                    Thêm ghi nhớ:{' '}
                    {plan.variables
                        .map((variable) => `${variable.name} = ${variable.initialValue}`)
                        .join(', ')}
                </p>
            )}
            {plan.rules.map(({ rule, replaceId }, index) => {
                const layout = rule.editorLayout ?? [];
                const prior = (beforeRules ?? scene.interactions).find(
                    (item) => item.id === replaceId,
                );
                const changed =
                    prior &&
                    [
                        prior.name !== rule.name && 'Tên luồng',
                        JSON.stringify(prior.trigger) !== JSON.stringify(rule.trigger) && 'Sự kiện',
                        JSON.stringify(prior.actions) !== JSON.stringify(rule.actions) &&
                            'Các bước',
                        prior.workflow &&
                            JSON.stringify(prior.workflow) !== JSON.stringify(rule.workflow) &&
                            'Dây nối',
                        JSON.stringify(prior.movementLoop) !== JSON.stringify(rule.movementLoop) &&
                            'Lặp vô hạn',
                        (prior.enabled !== rule.enabled ||
                            prior.onRetrigger !== rule.onRetrigger) &&
                            'Cách kích hoạt',
                    ].filter(Boolean);
                const describe = (item: InteractionRule) =>
                    item.actions.map((action) => actionSummary(action, objects)).join(' → ');
                return (
                    <details
                        key={rule.id}
                        open={index === 0}
                        className="group/flow border-border border-t pt-3"
                    >
                        <summary className="flex min-h-8 cursor-pointer list-none items-start justify-between gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0">
                                <span className="block font-medium">
                                    {rule.name || 'Tương tác'}
                                </span>
                                <span className="block text-muted-foreground text-xs">
                                    {replaceId ? 'Cập nhật luồng' : 'Thêm luồng'}
                                </span>
                            </span>
                            <ChevronDown
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open/flow:rotate-180 motion-reduce:transition-none"
                            />
                        </summary>
                        <p className="mt-2 mb-1 text-muted-foreground text-xs">
                            {ruleTriggerLabel(rule, objects, [...variables, ...plan.variables])}
                        </p>
                        {!!changed?.length && (
                            <p className="my-1 text-xs">Thay đổi · {changed.join(', ')}</p>
                        )}
                        {prior && (
                            <details className="text-muted-foreground text-xs">
                                <summary className="cursor-pointer">Luồng hiện tại</summary>
                                {prior.name && <p className="m-0">{prior.name}</p>}
                                {describe(prior)}
                            </details>
                        )}
                        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 leading-relaxed marker:text-muted-foreground">
                            {rule.actions.map((action, index) => {
                                const links = rule.workflow?.edges.filter(
                                    (edge) => edge.source === layout[index + 1]?.id,
                                );
                                return (
                                    <li key={layout[index + 1]?.id ?? index}>
                                        {actionSummary(action, objects)}
                                        {links?.length && action.type === 'condition' ? (
                                            <span className="block text-muted-foreground text-xs">
                                                {links
                                                    .map(
                                                        (edge) =>
                                                            `${edge.port === 'true' ? 'Đúng' : 'Sai'} → bước ${layout.findIndex((node) => node.id === edge.target)}`,
                                                    )
                                                    .join(' · ')}
                                            </span>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ol>
                    </details>
                );
            })}
        </div>
    );
}
export function SceneAssistant({
    surface,
    active = true,
    open,
    onOpenChange,
    designLauncherHost,
    ...props
}: Omit<ComponentProps<typeof AssistantChat>, 'open' | 'sessionKey' | 'onClose'> & {
    active?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    designLauncherHost?: HTMLElement | null;
}) {
    const launcher = useRef<HTMLButtonElement>(null);
    const { user } = useAuth();
    const sessionKey = `bookaria:workflow-draft:${user?.id || 'local'}:${props.page.id}`;
    const inDesignFooter = surface === 'design' && designLauncherHost !== undefined;
    const button = (
        <Button
            ref={launcher}
            size="icon"
            className={cn(
                'pointer-events-auto rounded-full shadow-md',
                !inDesignFooter && 'absolute right-(--assistant-edge) bottom-(--assistant-bottom)',
                surface === 'interactions' && 'size-12',
            )}
            aria-label={open ? 'Thu gọn trợ lý AI' : 'Trợ lý Bookaria'}
            title={open ? 'Thu gọn trợ lý AI' : 'Trợ lý Bookaria'}
            aria-expanded={open}
            disabled={!open && props.disabled}
            onClick={() => onOpenChange(!open)}
        >
            <Sparkles className="size-4" aria-hidden="true" />
        </Button>
    );

    return (
        <div
            hidden={!active}
            className={cn(
                'pointer-events-none absolute inset-0 z-30 col-start-1 col-end-2 row-start-1 row-end-2 [--assistant-bottom:1rem] [--assistant-edge:1rem] [--assistant-panel-bottom:calc(var(--assistant-bottom)_+_4rem)]',
                surface === 'design' &&
                    'right-[var(--inspector-offset,0px)] [--assistant-bottom:8rem] [--assistant-edge:18px] [--assistant-panel-bottom:var(--scene-assistant-panel-bottom,12rem)]',
            )}
        >
            {inDesignFooter
                ? active && designLauncherHost && createPortal(button, designLauncherHost)
                : button}
            <AssistantChat
                key={sessionKey}
                {...props}
                surface={surface}
                open={active && open}
                sessionKey={sessionKey}
                onClose={() => {
                    onOpenChange(false);
                    requestAnimationFrame(() => launcher.current?.focus());
                }}
            />
        </div>
    );
}

function FollowSentMessage({ messageId }: { messageId: string | undefined }) {
    const { scrollToEnd } = useMessageScroller();
    useEffect(() => {
        if (messageId) scrollToEnd({ behavior: 'auto' });
    }, [messageId, scrollToEnd]);
    return null;
}

function AssistantChat({
    surface,
    scene,
    assets,
    page,
    book,
    variables,
    disabled,
    open,
    sessionKey,
    onClose,
    onApply,
}: {
    surface: 'design' | 'interactions';
    scene: Scene;
    assets: Record<string, AssetRef>;
    page: Page;
    book: BookDetail;
    variables: WorkflowVariable[];
    disabled: boolean;
    open: boolean;
    sessionKey: string;
    onClose: () => void;
    onApply: (scene: Scene, rule: InteractionRule | null, variables: WorkflowVariable[]) => void;
}) {
    const [session, setSession] = useState<ChatSession>(() => readChat(sessionKey));
    const latestSession = useRef(session);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [confirmRemoval, setConfirmRemoval] = useState<string>();
    const [preview, setPreview] = useState<{
        scene: Scene;
        mode: 'layout' | 'page' | 'rule';
        rule?: InteractionRule;
        variables: WorkflowVariable[];
        snapshot: string;
    } | null>(null);
    const request = useRef<AbortController | null>(null);
    const pendingBefore = useRef<ChatSession | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerQuery, setPickerQuery] = useState('');
    const [pickerSource, setPickerSource] = useState<'page' | 'library'>('page');
    const libraryQuery = useDeferredValue(pickerQuery.trim().slice(0, 100));
    const library = useQuery({
        queryKey: ['assistant-library', sessionKey, libraryQuery],
        enabled: open && pickerOpen && pickerSource === 'library',
        queryFn: async ({ signal }) => {
            const pages = await Promise.all(
                (['mine', 'library'] as const).map((scope) =>
                    assetsApi.list({ scope, q: libraryQuery }, signal),
                ),
            );
            return pages.flatMap(({ data }) => data.filter((asset) => asset.status === 'READY'));
        },
    });
    const [pickerPosition, setPickerPosition] = useState({ width: 320, offset: 8 });
    const [activeChoice, setActiveChoice] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const pickerSearch = useRef<HTMLInputElement>(null);
    const pickerList = useRef<HTMLDivElement>(null);
    const pickerListId = useId();
    const accepting = useRef(false);
    const composer = useRef<HTMLTextAreaElement>(null);
    const mirror = useRef<HTMLDivElement>(null);
    const mentionCaret = useRef<number | null>(null);
    const replacingReference = useRef<ChatReference | undefined>(undefined);
    const mobile = useIsMobile();
    const positionPicker = useCallback(() => {
        const bounds = composer.current
            ?.closest('[data-slot="input-group"]')
            ?.getBoundingClientRect();
        if (bounds) setPickerPosition({ width: bounds.width, offset: bounds.height + 16 });
    }, []);
    useLayoutEffect(() => {
        if (!pickerOpen) return;
        positionPicker();
        window.addEventListener('resize', positionPicker);
        return () => window.removeEventListener('resize', positionPicker);
    }, [pickerOpen, positionPicker]);
    const { id: pageId, revision } = page;
    const widthMm = pageWidthMm(book.pageFormat, book.pageWidthMm);
    const { targetRuleId, targetObjectId } = session;
    const signature = useMemo(
        () =>
            proposalSnapshot({ id: pageId, revision }, scene, assets, {
                variables,
                pages: book.pages,
                targetRuleId,
                targetObjectId,
            }),
        [pageId, revision, scene, assets, variables, book.pages, targetRuleId, targetObjectId],
    );
    const currentScene = useRef({ scene, signature });
    currentScene.current = { scene, signature };
    const update = useCallback(
        (next: ChatSession) => {
            latestSession.current = next;
            saveChat(sessionKey, next);
            setSession(next);
        },
        [sessionKey],
    );
    const cancel = useCallback(() => {
        request.current?.abort();
        if (pendingBefore.current) update(pendingBefore.current);
        pendingBefore.current = null;
        request.current = null;
        setPending(false);
    }, [update]);
    function close() {
        cancel();
        setPickerOpen(false);
        setPickerQuery('');
        mentionCaret.current = null;
        replacingReference.current = undefined;
        setPreview(null);
        setConfirmRemoval(undefined);
        onClose();
    }
    useEffect(
        () => () => {
            request.current?.abort();
            if (pendingBefore.current) saveChat(sessionKey, pendingBefore.current);
        },
        [sessionKey],
    );
    useEffect(() => {
        if (open) composer.current?.focus();
        else {
            cancel();
            setPreview(null);
            setConfirmRemoval(undefined);
            setPickerOpen(false);
            setPickerQuery('');
            mentionCaret.current = null;
            replacingReference.current = undefined;
        }
    }, [open, cancel]);
    useEffect(() => {
        if (disabled || preview?.snapshot !== signature) setPreview(null);
    }, [disabled, signature, preview?.snapshot]);
    const last = session.messages.at(-1);
    const proposalMessage = session.messages.findLast((message) => !!resultPlan(message.result));
    const plan = resultPlan(proposalMessage?.result);
    const canUseProposal =
        !!proposalMessage &&
        session.messages
            .slice(session.messages.indexOf(proposalMessage) + 1)
            .every((message) => message.role === 'user' || message.result?.status === 'answer');
    const hasObjectEdits = !!(
        plan?.objectEdits?.length ||
        plan?.objectAdds?.length ||
        plan?.removeObjectIds?.length
    );
    const removalCount = (plan?.removeObjectIds?.length ?? 0) + (plan?.removeRuleIds?.length ?? 0);
    const editingProposal = hasObjectEdits || !!removalCount;
    const objectCount =
        (plan?.objectEdits?.length ?? 0) +
        (plan?.objectAdds?.length ?? 0) +
        (plan?.removeObjectIds?.length ?? 0);
    const ruleCount = (plan?.rules.length ?? 0) + (plan?.removeRuleIds?.length ?? 0);
    const previewModes = preview?.rule
        ? ([
              ['rule', 'Thử riêng luồng'],
              ['page', 'Thử cả trang'],
          ] as const)
        : hasObjectEdits && plan?.rules.length
          ? ([
                ['layout', 'Bố cục ban đầu'],
                ['page', 'Chạy tương tác'],
            ] as const)
          : [];
    const proposal =
        proposalMessage?.result?.status === 'proposal' ? proposalMessage.result.rule : undefined;
    const stale = !!proposalMessage && proposalMessage.snapshot !== signature;
    const appliedEdit = proposalMessage?.application;
    const appliedMessage = !!appliedEdit;
    const applicationState = appliedEdit ? aiPlanState(scene, variables, appliedEdit) : undefined;
    const lastApplied = session.messages.findLast(
        (message) =>
            message.application && aiPlanState(scene, variables, message.application) !== 'undone',
    );
    const legacyTarget =
        proposal && lastApplied?.result?.status === 'proposal'
            ? lastApplied.application?.rules[0]?.after.id
            : undefined;
    useEffect(() => {
        if (applicationState !== 'undone') return;
        const active = latestSession.current;
        if (active.targetRuleId && !scene.interactions.some(({ id }) => id === active.targetRuleId))
            update({ ...active, targetRuleId: undefined });
        else if (
            active.targetObjectId &&
            !scene.objects.some(({ id }) => id === active.targetObjectId)
        )
            update({ ...active, targetObjectId: undefined });
    }, [applicationState, scene, update]);
    const beforeRules = appliedEdit && [
        ...appliedEdit.rules.flatMap(({ before }) => (before ? [before] : [])),
        ...(appliedEdit.removedRules?.map(({ item }) => item) ?? []),
    ];
    const references = session.references ?? [];
    const targetRule = scene.interactions.find((rule) => rule.id === session.targetRuleId);
    const targetObject = scene.objects.find((object) => object.id === session.targetObjectId);
    const missingTarget =
        (session.targetRuleId && !targetRule) || (session.targetObjectId && !targetObject);
    const sameScope =
        proposalMessage?.targetRuleId === session.targetRuleId &&
        proposalMessage?.targetObjectId === session.targetObjectId;
    const names = scene.objects.map(objectName);
    const libraryAssets = new Map(
        [...(session.libraryAssets ?? []), ...(library.data ?? [])].map((asset) => [
            asset.id,
            asset,
        ]),
    );
    const choices = [
        ...scene.objects.map((object, index) => {
            const name = objectName(object);
            const mention =
                names.indexOf(name) === names.lastIndexOf(name) ? name : `${name} · ${index + 1}`;
            return {
                key: `object:${object.id}`,
                label: mention,
                mention,
                id: object.id,
                kind: 'object',
                description: sceneObjectLabel(object),
                icon: referenceIcons[object.type],
                thumbnail: 'assetId' in object ? assets[object.assetId]?.thumbnailUrl : null,
                url: undefined,
            };
        }),
        ...Object.entries(assets)
            .filter(([, asset]) => asset.type === 'AUDIO')
            .map(([id, asset], index) => {
                const label =
                    scene.objects.find((object) => 'assetId' in object && object.assetId === id)
                        ?.name || `Âm thanh ${index + 1}`;
                return {
                    key: `audio:${id}`,
                    label,
                    mention: label,
                    id,
                    kind: 'audio',
                    description: 'Tệp âm thanh',
                    icon: Volume2,
                    thumbnail: null,
                    url: asset.url,
                };
            }),
        ...Array.from(libraryAssets.values(), (asset) => ({
            key: `asset:${asset.id}`,
            label: asset.name,
            mention: asset.name,
            id: asset.id,
            kind: 'asset',
            description: `${assetTypeLabels[asset.type]} · ${asset.scope === 'mine' ? 'Của tôi' : 'Thư viện'}`,
            icon: libraryIcons[asset.type],
            thumbnail: asset.thumbnailUrl,
            url: undefined,
        })),
    ];
    const query = searchable(pickerQuery);
    const sourceChoices = choices.filter(
        ({ kind }) => (kind === 'asset') === (pickerSource === 'library'),
    );
    const filteredChoices = sourceChoices.filter((choice) =>
        searchable(`${choice.label} ${choice.description}`).includes(query),
    );
    const highlightedChoice = filteredChoices[activeChoice] ?? filteredChoices[0];
    function referenceAtCaret() {
        const input = composer.current;
        if (!input || input.selectionStart !== input.selectionEnd) return;
        return references.find(
            ({ start, end }) => start <= input.selectionStart && input.selectionStart <= end,
        );
    }
    function openPicker(reference?: ChatReference, fromLibrary = false) {
        if (pending) return;
        if (!reference && (latestSession.current.references?.length ?? 0) >= 4) {
            setError('Bạn đã thêm 4 tham chiếu. Bấm vào một tham chiếu để thay đổi.');
            return;
        }
        replacingReference.current = reference;
        const source = fromLibrary || reference?.key.startsWith('asset:') ? 'library' : 'page';
        setPickerSource(source);
        setPickerQuery('');
        setActiveChoice(
            Math.max(
                0,
                choices
                    .filter(({ kind }) => (kind === 'asset') === (source === 'library'))
                    .findIndex((choice) => choice.key === reference?.key),
            ),
        );
        setPickerOpen(true);
    }
    function selectReference(key: string) {
        const active = latestSession.current;
        const choice = choices.find((item) => item.key === key);
        const replacing = replacingReference.current;
        if (!choice || (!replacing && (active.references?.length ?? 0) >= 4)) return;
        let start = replacing?.start ?? composer.current?.selectionStart ?? active.input.length;
        const end = replacing?.end ?? composer.current?.selectionEnd ?? start;
        if (start === end && active.input[start - 1] === '@') start--;
        const prefix = start > 0 && /\S/u.test(active.input[start - 1] ?? '') ? ' ' : '';
        const nextCharacter = active.input[end] ?? '';
        const suffix = !nextCharacter || /[^\s.,!?;:)]/u.test(nextCharacter) ? ' ' : '';
        const mention = `@${choice.mention}`;
        const next = replaceChatInput(active, start, end, `${prefix}${mention}${suffix}`);
        if (next.input.length > 1200) {
            setError('Nội dung quá dài. Hãy rút gọn tin nhắn trước khi thêm tham chiếu.');
            return;
        }
        const mentionStart = start + prefix.length;
        const mentionEnd = mentionStart + mention.length;
        const asset = libraryAssets.get(choice.id);
        mentionCaret.current = mentionEnd + (suffix || nextCharacter === ' ' ? 1 : 0);
        update({
            ...next,
            references: [...next.references, { key, start: mentionStart, end: mentionEnd }],
            libraryAssets:
                choice.kind === 'asset' && asset
                    ? [
                          ...(next.libraryAssets ?? []).filter(({ id }) => id !== asset.id),
                          asset,
                      ].slice(-16)
                    : next.libraryAssets,
        });
        setError('');
        setPickerOpen(false);
        setPickerQuery('');
        replacingReference.current = undefined;
    }
    async function send(text = latestSession.current.input) {
        const before = latestSession.current;
        if (request.current || disabled || missingTarget || !text.trim()) return;
        const currentPlan =
            sameScope && (proposal || (!stale && !appliedMessage)) ? plan : undefined;
        const selected = choices.filter(
            (choice) =>
                text === before.input &&
                before.references?.some((reference) => reference.key === choice.key),
        );
        const wireContent = selected.length
            ? `${text.trim()}\nTham chiếu tác giả chọn: ${JSON.stringify(selected.map(({ id, mention, kind }) => ({ id, name: mention, kind })))}`
            : text.trim();
        if (wireContent.length > 2000) {
            setError('Nội dung quá dài. Hãy rút gọn yêu cầu hoặc chọn ít đối tượng hơn.');
            return;
        }
        const controller = new AbortController();
        const retry = text === before.input ? before : { ...before, input: text, references: [] };
        pendingBefore.current = retry;
        request.current = controller;
        setPending(true);
        setError('');
        setPreview(null);
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text.trim(),
            wireContent,
            targetRuleId: before.targetRuleId,
            targetObjectId: before.targetObjectId,
        };
        update({ ...before, messages: [...before.messages, userMessage] });
        try {
            const result = await api.propose(
                page.id,
                {
                    instruction: wireContent,
                    revision: page.revision,
                    scene,
                    audioAssetIds: Object.entries(assets)
                        .filter(([, asset]) => asset.type === 'AUDIO')
                        .map(([id]) => id)
                        .slice(0, 60),
                    history: before.messages.slice(-20).map((message) => ({
                        role: message.role,
                        content: message.wireContent ?? message.content,
                    })),
                    editor: {
                        variables,
                        currentPlan,
                        selectedRuleId: before.targetRuleId,
                        selectedObjectId: before.targetObjectId,
                        assetIds: before.libraryAssets
                            ?.filter(
                                ({ id }) =>
                                    selected.some(
                                        (choice) => choice.kind === 'asset' && choice.id === id,
                                    ) ||
                                    before.messages.some((message) =>
                                        message.wireContent?.includes(id),
                                    ),
                            )
                            .map(({ id }) => id),
                    },
                    ...(proposal && currentPlan
                        ? {
                              currentProposal: {
                                  name: proposal.name || 'Tương tác',
                                  trigger: proposal.trigger,
                                  actions: proposal.actions,
                              },
                          }
                        : {}),
                },
                controller.signal,
            );
            if (controller.signal.aborted) return;
            const content =
                result.status === 'proposal' || result.status === 'edit_plan'
                    ? currentPlan
                        ? 'Đã cập nhật đề xuất. Bạn có thể xem thử trước khi áp dụng.'
                        : 'Bạn có thể xem thử đề xuất hoặc nhắn tiếp để chỉnh lại.'
                    : result.message;
            update({
                ...before,
                input: '',
                references: [],
                messages: [
                    ...before.messages,
                    userMessage,
                    {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content,
                        result,
                        snapshot: signature,
                        targetRuleId: before.targetRuleId,
                        targetObjectId: before.targetObjectId,
                    },
                ],
            });
        } catch (cause) {
            if (!controller.signal.aborted) setError(errorMessage(cause));
            // A failed/cancelled turn remains in the composer and can be retried without duplicating history.
            if (latestSession.current.messages.at(-1)?.id === userMessage.id) update(retry);
        } finally {
            if (
                controller.signal.aborted &&
                latestSession.current.messages.at(-1)?.id === userMessage.id
            )
                update(retry);
            if (request.current === controller) {
                pendingBefore.current = null;
                request.current = null;
                setPending(false);
            }
        }
    }
    function accept(test: boolean, confirmed = false) {
        const active = latestSession.current;
        if (
            !plan ||
            !proposalMessage ||
            disabled ||
            pending ||
            accepting.current ||
            active.messages.find((message) => message.id === proposalMessage.id)?.application ||
            appliedMessage ||
            !canUseProposal
        )
            return;
        try {
            if (proposalMessage.snapshot !== currentScene.current.signature)
                throw new Error('Trang đã thay đổi. Hãy gửi lại yêu cầu trước khi áp dụng.');
            if (!test && removalCount && !confirmed) {
                setConfirmRemoval(proposalMessage.id);
                return;
            }
            const next = stageAiPlan(
                currentScene.current.scene,
                variables,
                proposal && legacyTarget
                    ? { ...plan, rules: [{ rule: proposal, replaceId: legacyTarget }] }
                    : plan,
            );
            const rule = plan.rules.length ? (next.edit.rules[0]?.after ?? null) : null;
            const singleRule = !editingProposal && ruleCount === 1 ? rule : null;
            if (test)
                setPreview({
                    scene: next.scene,
                    mode: hasObjectEdits ? 'layout' : singleRule ? 'rule' : 'page',
                    ...(singleRule ? { rule: singleRule } : {}),
                    variables: next.variables,
                    snapshot: signature,
                });
            else {
                accepting.current = true;
                onApply(next.scene, rule, next.variables);
                update({
                    ...active,
                    targetObjectId: plan.removeObjectIds?.includes(active.targetObjectId ?? '')
                        ? undefined
                        : active.targetObjectId,
                    targetRuleId:
                        !proposal && singleRule
                            ? singleRule.id
                            : plan.removeRuleIds?.includes(active.targetRuleId ?? '')
                              ? undefined
                              : active.targetRuleId,
                    messages: active.messages.map((message) =>
                        message.id === proposalMessage.id
                            ? { ...message, application: next.edit }
                            : message,
                    ),
                });
                setPreview(null);
                setError('');
            }
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            accepting.current = false;
        }
    }
    function fresh() {
        cancel();
        setPreview(null);
        setConfirmRemoval(undefined);
        setError('');
        setPickerOpen(false);
        setPickerQuery('');
        mentionCaret.current = null;
        replacingReference.current = undefined;
        update({ messages: [], input: '' });
        composer.current?.focus();
    }
    const suggestions: { label: string; input: string; library?: boolean }[] = targetRule
        ? [
              {
                  label: 'Thêm bước đợi 2 giây',
                  input: 'Thêm bước đợi 2 giây ở đầu luồng này, giữ nguyên các bước còn lại.',
              },
          ]
        : targetObject
          ? [{ label: 'Thu nhỏ 20%', input: 'Thu nhỏ đối tượng đã chọn 20%, giữ nguyên vị trí.' }]
          : [
                ...(scene.objects.some((object) => !object.locked)
                    ? [{ label: 'Chỉnh bố cục', input: 'Thu nhỏ @ khoảng 20%, giữ nguyên vị trí.' }]
                    : []),
                ...(surface === 'design'
                    ? [
                          {
                              label: 'Thêm từ thư viện',
                              input: 'Thêm @ vào giữa trang.',
                              library: true,
                          },
                          {
                              label: 'Thêm văn bản',
                              input: 'Thêm văn bản “Khám phá thế giới AR” vào giữa trang.',
                          },
                      ]
                    : []),
                ...(surface === 'design' && scene.objects.some((object) => !object.locked)
                    ? [
                          {
                              label: 'Ẩn đối tượng khi mở trang',
                              input: 'Đặt @ ở trạng thái ẩn ban đầu trên trang.',
                          },
                      ]
                    : []),
                ...(surface === 'interactions'
                    ? [
                          {
                              label: 'Chạm để hiện thông tin',
                              input: 'Khi chạm vào đối tượng, hiện thẻ thông tin.',
                          },
                          {
                              label: 'Tạo câu hỏi có điểm',
                              input: 'Khi vào trang, hỏi “Mặt Trời mọc ở hướng nào?” với hai đáp án “Đông” và “Tây”. Đáp án đúng là “Đông”. Nếu trả lời đúng, cộng 1 điểm.',
                          },
                      ]
                    : []),
            ];
    if (
        surface === 'interactions' &&
        !targetRule &&
        !targetObject &&
        choices.some((choice) => choice.kind === 'audio')
    )
        suggestions.push({
            label: 'Phát lời đọc khi vào trang',
            input: 'Khi vào trang, phát lời đọc.',
        });
    suggestions.push(
        targetRule
            ? {
                  label: 'Giải thích luồng này',
                  input: 'Giải thích luồng đang chọn chạy như thế nào. Giữ nguyên trang.',
              }
            : {
                  label: 'Hướng dẫn sử dụng',
                  input: 'Hướng dẫn tôi cách tạo, xem thử, áp dụng và hoàn tác một đề xuất trong Bookaria.',
              },
    );
    if (!open) return null;
    const body = (
        <>
            <header className="flex min-h-14 shrink-0 items-center gap-2.5 px-4 py-2">
                <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary [--logo-filter:var(--logo-on-primary-filter)]"
                >
                    <BookariaLogo symbol className="w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="m-0 font-semibold text-sm">Trợ lý Bookaria</h2>
                    <p className="m-0 text-muted-foreground text-xs">
                        {surface === 'design' ? 'Thiết kế trang' : 'Tương tác'}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Cuộc trao đổi mới"
                    aria-label="Cuộc trao đổi mới"
                    onClick={fresh}
                    disabled={!session.messages.length && !session.input && !references.length}
                >
                    <Plus />
                </Button>
                {!mobile && (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        title={expanded ? 'Thu nhỏ chat' : 'Mở rộng chat'}
                        aria-label={expanded ? 'Thu nhỏ chat' : 'Mở rộng chat'}
                        aria-expanded={expanded}
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <Minimize2 /> : <Maximize2 />}
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Thu gọn chat"
                    aria-label="Thu gọn chat"
                    onClick={close}
                >
                    <Minus />
                </Button>
            </header>
            <Separator />
            <div className="min-h-0 flex-1">
                <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                    <FollowSentMessage messageId={last?.role === 'user' ? last.id : undefined} />
                    <MessageScroller>
                        <MessageScrollerViewport aria-label="Lịch sử trao đổi">
                            <MessageScrollerContent aria-busy={pending} className="gap-5 px-3 py-4">
                                {!session.messages.length && (
                                    <MessageScrollerItem messageId="welcome">
                                        <Empty className="gap-5 px-0 pt-7 pb-2">
                                            <EmptyHeader className="gap-2 px-2">
                                                <EmptyTitle className="text-lg leading-tight">
                                                    <h3>
                                                        {targetRule
                                                            ? 'Cần hỗ trợ gì với luồng này?'
                                                            : targetObject
                                                              ? `Cần hỗ trợ gì với ${objectName(targetObject)}?`
                                                              : surface === 'design'
                                                                ? 'Bạn muốn chỉnh gì trên trang?'
                                                                : 'Bạn muốn tạo tương tác gì?'}
                                                    </h3>
                                                </EmptyTitle>
                                                <EmptyDescription className="text-xs">
                                                    {targetRule
                                                        ? 'Yêu cầu chỉnh sửa hoặc hỏi cách luồng hoạt động.'
                                                        : targetObject
                                                          ? 'Yêu cầu chỉnh sửa hoặc hỏi về thuộc tính của đối tượng.'
                                                          : surface === 'design'
                                                            ? 'Thêm nội dung, chỉnh trang hoặc hỏi cách sử dụng Studio.'
                                                            : 'Tạo, sửa hoặc hỏi cách một tương tác hoạt động.'}
                                                </EmptyDescription>
                                            </EmptyHeader>
                                            <EmptyContent className="max-w-none items-stretch gap-2 text-left">
                                                {suggestions.map(({ label, input, library }) => (
                                                    <Button
                                                        key={label}
                                                        variant="outline"
                                                        className="h-auto min-h-10 justify-start whitespace-normal rounded-md text-left"
                                                        disabled={disabled}
                                                        onClick={() => {
                                                            update({
                                                                ...session,
                                                                input,
                                                                references: [],
                                                            });
                                                            composer.current?.focus();
                                                            if (input.includes('@')) {
                                                                const start = input.indexOf('@');
                                                                openPicker(
                                                                    {
                                                                        key: '',
                                                                        start,
                                                                        end: start + 1,
                                                                    },
                                                                    library,
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <ChevronRight
                                                            data-icon="inline-start"
                                                            className="text-muted-foreground"
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            {label}
                                                        </span>
                                                    </Button>
                                                ))}
                                            </EmptyContent>
                                        </Empty>
                                    </MessageScrollerItem>
                                )}
                                {session.messages.map((message) => {
                                    const archived = resultPlan(message.result);
                                    const isUser = message.role === 'user';
                                    return (
                                        <MessageScrollerItem
                                            key={message.id}
                                            messageId={message.id}
                                        >
                                            <Message align={isUser ? 'end' : 'start'}>
                                                <MessageContent className="gap-2">
                                                    {!isUser && (
                                                        <MessageHeader className="gap-2 px-0">
                                                            <span
                                                                aria-hidden="true"
                                                                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary [--logo-filter:var(--logo-on-primary-filter)]"
                                                            >
                                                                <BookariaLogo
                                                                    symbol
                                                                    className="w-4"
                                                                />
                                                            </span>
                                                            Bookaria
                                                        </MessageHeader>
                                                    )}
                                                    {!archived && (
                                                        <Bubble
                                                            variant={isUser ? 'secondary' : 'ghost'}
                                                        >
                                                            <BubbleContent className="whitespace-pre-wrap">
                                                                {isUser && (
                                                                    <span className="sr-only">
                                                                        Bạn{' '}
                                                                    </span>
                                                                )}
                                                                {message.content}
                                                            </BubbleContent>
                                                        </Bubble>
                                                    )}
                                                    {plan && message.id === proposalMessage?.id && (
                                                        <Card
                                                            size="sm"
                                                            role="region"
                                                            aria-label={
                                                                editingProposal
                                                                    ? 'Đề xuất chỉnh sửa'
                                                                    : 'Đề xuất tương tác'
                                                            }
                                                            className="data-[size=sm]:[--card-spacing:--spacing(4)]"
                                                        >
                                                            <CardHeader>
                                                                <CardTitle className="flex items-center gap-2">
                                                                    {editingProposal
                                                                        ? 'Đề xuất chỉnh sửa'
                                                                        : 'Đề xuất tương tác'}
                                                                </CardTitle>
                                                                <CardDescription>
                                                                    {[
                                                                        objectCount > 0 &&
                                                                            `${objectCount} đối tượng`,
                                                                        ruleCount > 0 &&
                                                                            `${ruleCount} luồng`,
                                                                    ]
                                                                        .filter(Boolean)
                                                                        .join(' · ')}
                                                                </CardDescription>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <details open={!appliedMessage}>
                                                                    <summary
                                                                        hidden={!appliedMessage}
                                                                        className="cursor-pointer text-muted-foreground text-xs"
                                                                    >
                                                                        Xem chi tiết thay đổi
                                                                    </summary>
                                                                    <PlanDetails
                                                                        plan={plan}
                                                                        scene={scene}
                                                                        variables={variables}
                                                                        libraryAssets={
                                                                            libraryAssets
                                                                        }
                                                                        widthMm={widthMm}
                                                                        beforeObjects={
                                                                            appliedEdit
                                                                                ? [
                                                                                      ...(appliedEdit.objects?.flatMap(
                                                                                          ({
                                                                                              before,
                                                                                          }) =>
                                                                                              before
                                                                                                  ? [
                                                                                                        before,
                                                                                                    ]
                                                                                                  : [],
                                                                                      ) ?? []),
                                                                                      ...(appliedEdit.removedObjects?.map(
                                                                                          ({
                                                                                              item,
                                                                                          }) =>
                                                                                              item,
                                                                                      ) ?? []),
                                                                                  ]
                                                                                : undefined
                                                                        }
                                                                        beforeRules={beforeRules}
                                                                    />
                                                                </details>
                                                                {stale && !appliedMessage && (
                                                                    <Alert className="mt-3">
                                                                        <AlertDescription>
                                                                            {!sameScope
                                                                                ? 'Phạm vi đã thay đổi. Gửi yêu cầu tiếp để tạo đề xuất cho phạm vi mới.'
                                                                                : 'Trang hoặc tài nguyên đã thay đổi. Gửi yêu cầu tiếp để kiểm tra lại đề xuất.'}
                                                                        </AlertDescription>
                                                                    </Alert>
                                                                )}
                                                            </CardContent>
                                                            <CardFooter className="flex flex-wrap gap-2 border-border border-t bg-muted/30 px-4 py-3">
                                                                {appliedMessage ? (
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <Badge
                                                                            variant={
                                                                                applicationState ===
                                                                                'undone'
                                                                                    ? 'neutral'
                                                                                    : 'success'
                                                                            }
                                                                        >
                                                                            {applicationState !==
                                                                                'undone' && (
                                                                                <Check />
                                                                            )}
                                                                            {applicationState ===
                                                                            'undone'
                                                                                ? 'Đã hoàn tác'
                                                                                : applicationState ===
                                                                                    'changed'
                                                                                  ? 'Đã áp dụng · Có chỉnh sửa tiếp'
                                                                                  : 'Đã áp dụng vào bản nháp'}
                                                                        </Badge>
                                                                        <p className="m-0 text-muted-foreground text-xs">
                                                                            {applicationState ===
                                                                            'undone'
                                                                                ? 'Dùng Redo để làm lại hoặc nhắn yêu cầu mới.'
                                                                                : 'Dùng Undo trên thanh công cụ để lùi thay đổi gần nhất.'}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                accept(true)
                                                                            }
                                                                            disabled={
                                                                                stale ||
                                                                                disabled ||
                                                                                pending ||
                                                                                !canUseProposal
                                                                            }
                                                                        >
                                                                            <Play data-icon="inline-start" />
                                                                            {hasObjectEdits
                                                                                ? 'Xem thử'
                                                                                : 'Chạy thử'}
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                accept(false)
                                                                            }
                                                                            disabled={
                                                                                stale ||
                                                                                disabled ||
                                                                                pending ||
                                                                                !canUseProposal
                                                                            }
                                                                        >
                                                                            {editingProposal ||
                                                                            plan.rules.length > 1 ||
                                                                            plan.variables.length >
                                                                                0
                                                                                ? 'Áp dụng thay đổi'
                                                                                : plan.rules[0]
                                                                                        ?.replaceId ||
                                                                                    legacyTarget
                                                                                  ? 'Cập nhật luồng'
                                                                                  : 'Thêm vào trang'}
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </CardFooter>
                                                        </Card>
                                                    )}
                                                    {archived &&
                                                        message.id !== proposalMessage?.id && (
                                                            <details className="rounded-lg border border-border px-3 py-2.5">
                                                                <summary className="cursor-pointer text-muted-foreground text-xs">
                                                                    Xem đề xuất trước
                                                                    {message.application &&
                                                                        ` · ${aiPlanState(scene, variables, message.application) === 'undone' ? 'Đã hoàn tác' : 'Đã áp dụng'}`}
                                                                </summary>
                                                                <PlanDetails
                                                                    plan={archived}
                                                                    scene={scene}
                                                                    variables={variables}
                                                                    libraryAssets={libraryAssets}
                                                                    widthMm={widthMm}
                                                                />
                                                            </details>
                                                        )}
                                                    {message.id === last?.id &&
                                                    message.result &&
                                                    message.result.status !== 'proposal' &&
                                                    message.result.status !== 'edit_plan' &&
                                                    'choices' in message.result &&
                                                    message.result.choices?.length ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {message.result.choices.map(
                                                                (choice) => (
                                                                    <Button
                                                                        key={choice}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-auto min-h-8 whitespace-normal text-left"
                                                                        disabled={
                                                                            pending || disabled
                                                                        }
                                                                        onClick={() =>
                                                                            void send(choice)
                                                                        }
                                                                    >
                                                                        {choice}
                                                                    </Button>
                                                                ),
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </MessageContent>
                                            </Message>
                                        </MessageScrollerItem>
                                    );
                                })}
                                {pending && (
                                    <MessageScrollerItem messageId="pending">
                                        <p
                                            role="status"
                                            className="m-0 flex items-center gap-2 py-1 text-muted-foreground text-sm"
                                        >
                                            <Spinner />
                                            Đang xem yêu cầu…
                                        </p>
                                    </MessageScrollerItem>
                                )}
                            </MessageScrollerContent>
                        </MessageScrollerViewport>
                        <MessageScrollerButton aria-label="Đến tin nhắn mới nhất" />
                    </MessageScroller>
                </MessageScrollerProvider>
            </div>
            <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {(error || missingTarget) && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            {error ||
                                'Nội dung đã chọn không còn trên trang. Hãy chọn lại phạm vi.'}
                        </AlertDescription>
                    </Alert>
                )}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void send();
                    }}
                    className="flex flex-col gap-2"
                >
                    <Field>
                        <FieldLabel htmlFor="ai-chat-input" className="sr-only">
                            Yêu cầu cho trợ lý
                        </FieldLabel>
                        <div className="w-full min-w-0">
                            <InputGroup className="has-[textarea:disabled]:bg-muted has-disabled:bg-surface has-[textarea:disabled]:opacity-[var(--opacity-disabled)] has-disabled:opacity-100">
                                <div className="relative min-w-0 flex-1">
                                    <ReferenceHighlights
                                        input={session.input}
                                        references={references}
                                        mirrorRef={mirror}
                                    />
                                    <InputGroupTextarea
                                        ref={composer}
                                        id="ai-chat-input"
                                        rows={2}
                                        maxLength={1200}
                                        value={session.input}
                                        disabled={disabled || pending}
                                        className="relative max-h-40 min-h-20 overflow-y-auto [field-sizing:content] [scrollbar-gutter:stable] placeholder:text-muted-foreground placeholder:opacity-100"
                                        placeholder={
                                            targetRule
                                                ? 'Sửa luồng hoặc hỏi cách hoạt động…'
                                                : targetObject
                                                  ? 'Sửa đối tượng hoặc hỏi thuộc tính…'
                                                  : session.messages.length
                                                    ? 'Chỉnh tiếp hoặc hỏi về đề xuất…'
                                                    : surface === 'design'
                                                      ? 'Yêu cầu chỉnh sửa, hỏi cách làm hoặc gõ @…'
                                                      : 'Mô tả bố cục hoặc tương tác bạn muốn…'
                                        }
                                        aria-describedby="ai-chat-shortcuts"
                                        onScroll={(event) => {
                                            if (mirror.current)
                                                mirror.current.scrollTop =
                                                    event.currentTarget.scrollTop;
                                        }}
                                        onClick={() => {
                                            const reference = referenceAtCaret();
                                            if (reference) openPicker(reference);
                                        }}
                                        onChange={(event) => {
                                            const { value, selectionStart } = event.currentTarget;
                                            const next = editChatInput(
                                                latestSession.current,
                                                value,
                                            );
                                            update(next);
                                            if (
                                                value[selectionStart - 1] === '@' &&
                                                (next.references?.length ?? 0) < 4
                                            )
                                                openPicker();
                                        }}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === 'Enter' &&
                                                !event.shiftKey &&
                                                !event.nativeEvent.isComposing &&
                                                event.keyCode !== 229
                                            ) {
                                                event.preventDefault();
                                                event.currentTarget.form?.requestSubmit();
                                            }
                                        }}
                                    />
                                </div>
                                <InputGroupAddon align="inline-end" className="self-end pb-1.5">
                                    {pending ? (
                                        <InputGroupButton
                                            size="icon-xs"
                                            aria-label="Dừng phản hồi"
                                            onClick={cancel}
                                        >
                                            <Square />
                                        </InputGroupButton>
                                    ) : (
                                        <InputGroupButton
                                            type="submit"
                                            size="icon-xs"
                                            variant="default"
                                            aria-label={error ? 'Thử lại' : 'Gửi tin nhắn'}
                                            disabled={
                                                disabled || missingTarget || !session.input.trim()
                                            }
                                        >
                                            <ArrowUp />
                                        </InputGroupButton>
                                    )}
                                </InputGroupAddon>
                            </InputGroup>
                        </div>
                    </Field>
                    <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                        <Popover
                            open={pickerOpen}
                            onOpenChange={(next) => {
                                if (next) openPicker(referenceAtCaret());
                                else {
                                    setPickerOpen(false);
                                    setPickerQuery('');
                                    replacingReference.current = undefined;
                                }
                            }}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Chọn đối tượng hoặc âm thanh"
                                    title="Tham chiếu đối tượng hoặc tài nguyên thư viện"
                                    disabled={pending}
                                >
                                    <AtSign />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                side="top"
                                align="start"
                                sideOffset={pickerPosition.offset}
                                collisionPadding={12}
                                className="max-h-[min(24rem,var(--radix-popover-content-available-height))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
                                style={{ width: pickerPosition.width }}
                                aria-label="Tham chiếu trên trang"
                                onOpenAutoFocus={(event) => {
                                    event.preventDefault();
                                    pickerSearch.current?.focus();
                                }}
                                onCloseAutoFocus={(event) => {
                                    event.preventDefault();
                                    composer.current?.focus();
                                    if (mentionCaret.current !== null) {
                                        composer.current?.setSelectionRange(
                                            mentionCaret.current,
                                            mentionCaret.current,
                                        );
                                        mentionCaret.current = null;
                                    }
                                }}
                            >
                                <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3 pb-2">
                                    <h3 className="m-0 font-semibold text-sm">
                                        {replacingReference.current
                                            ? 'Đổi tham chiếu'
                                            : 'Thêm tham chiếu'}
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label="Đóng chọn tham chiếu"
                                        onClick={() => setPickerOpen(false)}
                                    >
                                        <X />
                                    </Button>
                                </div>
                                <fieldset className="m-0 flex shrink-0 gap-1 border-0 px-3 pb-2">
                                    <legend className="sr-only">Nguồn tham chiếu</legend>
                                    {(['page', 'library'] as const).map((source) => (
                                        <Button
                                            key={source}
                                            variant={
                                                pickerSource === source ? 'secondary' : 'ghost'
                                            }
                                            size="sm"
                                            aria-pressed={pickerSource === source}
                                            onClick={() => {
                                                setPickerSource(source);
                                                setActiveChoice(0);
                                                pickerSearch.current?.focus();
                                            }}
                                        >
                                            {source === 'page' ? 'Trên trang' : 'Thư viện'}
                                        </Button>
                                    ))}
                                </fieldset>
                                <div className="shrink-0 px-3 pb-2">
                                    <InputGroup>
                                        <InputGroupAddon>
                                            <Search aria-hidden="true" />
                                        </InputGroupAddon>
                                        <InputGroupInput
                                            ref={pickerSearch}
                                            role="combobox"
                                            aria-expanded={pickerOpen}
                                            aria-autocomplete="list"
                                            aria-controls={pickerListId}
                                            aria-activedescendant={
                                                highlightedChoice
                                                    ? `${pickerListId}-${highlightedChoice.key}`
                                                    : undefined
                                            }
                                            aria-label={
                                                pickerSource === 'page'
                                                    ? 'Tìm đối tượng hoặc âm thanh'
                                                    : 'Tìm tài nguyên thư viện'
                                            }
                                            placeholder={
                                                pickerSource === 'page'
                                                    ? 'Tìm đối tượng, âm thanh…'
                                                    : 'Tìm mô hình, ảnh, video, âm thanh…'
                                            }
                                            value={pickerQuery}
                                            onChange={(event) => {
                                                setPickerQuery(event.target.value);
                                                setActiveChoice(0);
                                            }}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.nativeEvent.isComposing ||
                                                    event.keyCode === 229
                                                )
                                                    return;
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    if (highlightedChoice)
                                                        selectReference(highlightedChoice.key);
                                                }
                                                if (
                                                    ['ArrowDown', 'ArrowUp'].includes(event.key) &&
                                                    filteredChoices.length
                                                ) {
                                                    event.preventDefault();
                                                    const offset =
                                                        event.key === 'ArrowDown' ? 1 : -1;
                                                    setActiveChoice(
                                                        (activeChoice +
                                                            offset +
                                                            filteredChoices.length) %
                                                            filteredChoices.length,
                                                    );
                                                    requestAnimationFrame(() =>
                                                        pickerList.current
                                                            ?.querySelector(
                                                                '[aria-selected="true"]',
                                                            )
                                                            ?.scrollIntoView({
                                                                block: 'nearest',
                                                            }),
                                                    );
                                                }
                                            }}
                                        />
                                        {pickerQuery && (
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupButton
                                                    aria-label="Xóa tìm kiếm"
                                                    size="icon-xs"
                                                    onClick={() => {
                                                        setPickerQuery('');
                                                        setActiveChoice(0);
                                                        pickerSearch.current?.focus();
                                                    }}
                                                >
                                                    <X />
                                                </InputGroupButton>
                                            </InputGroupAddon>
                                        )}
                                    </InputGroup>
                                </div>
                                <div
                                    ref={pickerList}
                                    id={pickerListId}
                                    role="listbox"
                                    aria-label={
                                        pickerSource === 'page'
                                            ? 'Đối tượng và âm thanh'
                                            : 'Tài nguyên thư viện'
                                    }
                                    className="min-h-0 overflow-y-auto overscroll-contain px-2 pb-2"
                                >
                                    {filteredChoices.map((choice, index) => {
                                        const Icon = choice.icon;
                                        const current =
                                            replacingReference.current?.key === choice.key;
                                        return (
                                            <Button
                                                key={choice.key}
                                                id={`${pickerListId}-${choice.key}`}
                                                role="option"
                                                tabIndex={-1}
                                                aria-selected={
                                                    highlightedChoice?.key === choice.key
                                                }
                                                variant={
                                                    highlightedChoice?.key === choice.key
                                                        ? 'secondary'
                                                        : 'ghost'
                                                }
                                                className="h-auto min-h-14 w-full justify-start gap-3 text-left"
                                                onPointerMove={() => setActiveChoice(index)}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => selectReference(choice.key)}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface ring-1 ring-border"
                                                >
                                                    {choice.thumbnail ? (
                                                        <img
                                                            src={choice.thumbnail}
                                                            alt=""
                                                            className="size-full object-contain p-1"
                                                        />
                                                    ) : (
                                                        <Icon className="text-muted-foreground" />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate">
                                                        {choice.label}
                                                    </span>
                                                    <span className="block truncate font-normal text-muted-foreground text-xs">
                                                        {choice.description}
                                                    </span>
                                                </span>
                                                {current && (
                                                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                                                        <Check />
                                                        Đang chọn
                                                    </span>
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>
                                {!filteredChoices.length && (
                                    <Empty className="shrink-0 gap-2 px-5 py-6">
                                        <EmptyHeader className="gap-1">
                                            <EmptyTitle className="text-sm">
                                                <p role="status">
                                                    {pickerSource === 'library'
                                                        ? library.isError
                                                            ? 'Chưa tải được thư viện'
                                                            : library.isFetching
                                                              ? 'Đang tìm tài nguyên…'
                                                              : 'Không tìm thấy tài nguyên'
                                                        : sourceChoices.length
                                                          ? 'Không tìm thấy kết quả'
                                                          : 'Trang chưa có đối tượng hoặc âm thanh'}
                                                </p>
                                            </EmptyTitle>
                                            <EmptyDescription className="text-xs">
                                                {pickerSource === 'library'
                                                    ? library.isError && (
                                                          <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => void library.refetch()}
                                                          >
                                                              Thử lại
                                                          </Button>
                                                      )
                                                    : sourceChoices.length
                                                      ? 'Thử tên khác hoặc tìm theo loại đối tượng.'
                                                      : 'Thêm nội dung vào trang để chọn tham chiếu.'}
                                            </EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                )}
                                {highlightedChoice?.url && (
                                    <div className="shrink-0 px-3 pb-2">
                                        {/* biome-ignore lint/a11y/useMediaCaption: Author-provided audio has no transcript in the asset metadata. */}
                                        <audio
                                            key={highlightedChoice.url}
                                            controls
                                            preload="none"
                                            src={highlightedChoice.url}
                                            className="h-8 w-full"
                                            aria-label={`Nghe ${highlightedChoice.label}`}
                                        />
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                        <Select
                            value={
                                session.targetRuleId
                                    ? `rule:${session.targetRuleId}`
                                    : session.targetObjectId
                                      ? `object:${session.targetObjectId}`
                                      : 'page'
                            }
                            disabled={pending}
                            onValueChange={(value) => {
                                update({
                                    ...session,
                                    targetRuleId: value.startsWith('rule:')
                                        ? value.slice(5)
                                        : undefined,
                                    targetObjectId: value.startsWith('object:')
                                        ? value.slice(7)
                                        : undefined,
                                });
                                setPreview(null);
                                setError('');
                            }}
                        >
                            <SelectTrigger
                                size="sm"
                                aria-label="Phạm vi trao đổi"
                                className="m-0 h-7 w-auto min-w-0 max-w-[min(50%,11rem)] gap-1.5 rounded-md border-transparent bg-muted px-2 py-1 text-xs [--control-height-sm:28px]"
                                title={
                                    targetObject
                                        ? objectName(targetObject)
                                        : targetRule?.name || 'Trang hiện tại'
                                }
                            >
                                {targetRule ? (
                                    <Workflow aria-hidden="true" />
                                ) : targetObject ? (
                                    <Box aria-hidden="true" />
                                ) : (
                                    <NotepadText aria-hidden="true" />
                                )}
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top" align="start" sideOffset={8} className="w-72">
                                <SelectGroup>
                                    <SelectItem value="page">Trang hiện tại</SelectItem>
                                </SelectGroup>
                                <SelectGroup>
                                    <SelectLabel>Chỉnh sửa luồng</SelectLabel>
                                    {session.targetRuleId && !targetRule && (
                                        <SelectItem value={`rule:${session.targetRuleId}`} disabled>
                                            Luồng đã bị xóa
                                        </SelectItem>
                                    )}
                                    {scene.interactions.map((rule, index) => (
                                        <SelectItem key={rule.id} value={`rule:${rule.id}`}>
                                            {rule.name || `Luồng ${index + 1}`}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                                {(scene.objects.length > 0 || session.targetObjectId) && (
                                    <SelectGroup>
                                        <SelectLabel>Chỉnh đối tượng</SelectLabel>
                                        {session.targetObjectId && !targetObject && (
                                            <SelectItem
                                                value={`object:${session.targetObjectId}`}
                                                disabled
                                            >
                                                Đối tượng đã bị xóa
                                            </SelectItem>
                                        )}
                                        {scene.objects.map((object, index) => (
                                            <SelectItem
                                                key={object.id}
                                                value={`object:${object.id}`}
                                                disabled={object.locked}
                                            >
                                                {choices[index]?.label ?? objectName(object)}
                                                {object.locked ? ' (đã khóa)' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                )}
                            </SelectContent>
                        </Select>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="ml-auto text-muted-foreground"
                                    aria-label="Hướng dẫn nhập chat"
                                >
                                    <CircleHelp />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="end" sideOffset={8}>
                                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                                    <Kbd>Enter</Kbd>
                                    <span>Gửi tin nhắn</span>
                                    <Kbd>Shift + Enter</Kbd>
                                    <span>Xuống dòng</span>
                                    <Kbd>@</Kbd>
                                    <span>Chọn từ trang hoặc thư viện</span>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                        <span id="ai-chat-shortcuts" className="sr-only">
                            Enter để gửi, Shift và Enter để xuống dòng. Gõ @ để chọn tham chiếu.
                        </span>
                    </div>
                </form>
            </div>
        </>
    );
    return (
        <>
            {mobile ? (
                <Dialog
                    open
                    onOpenChange={(value) => {
                        if (!value) close();
                    }}
                >
                    <DialogContent
                        showCloseButton={false}
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            composer.current?.focus();
                        }}
                        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none p-0"
                    >
                        <DialogTitle className="sr-only">Trợ lý Bookaria</DialogTitle>
                        <DialogDescription className="sr-only">
                            Chỉnh bố cục và tương tác cho trang sách.
                        </DialogDescription>
                        {body}
                    </DialogContent>
                </Dialog>
            ) : (
                <aside
                    aria-label="Trợ lý Bookaria"
                    className={cn(
                        'pointer-events-auto absolute right-(--assistant-edge) bottom-(--assistant-panel-bottom) flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl [--assistant-height:calc(100%_-_var(--assistant-panel-bottom)_-_1rem)]',
                        expanded
                            ? 'h-(--assistant-height) w-[min(680px,calc(100%-2rem))]'
                            : 'h-[min(620px,var(--assistant-height))] w-[min(400px,calc(100%-2rem))]',
                        expanded &&
                            surface === 'design' &&
                            '[--assistant-panel-bottom:var(--scene-assistant-wide-panel-bottom,12rem)]',
                    )}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'Escape' &&
                            !document.querySelector('[role=dialog],[role=listbox]')
                        ) {
                            event.stopPropagation();
                            close();
                        }
                    }}
                >
                    {body}
                </aside>
            )}
            <AlertDialog
                open={!!confirmRemoval && confirmRemoval === proposalMessage?.id && !stale}
                onOpenChange={(value) => {
                    if (!value) setConfirmRemoval(undefined);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa khỏi trang</AlertDialogTitle>
                        <AlertDialogDescription>
                            Các mục dưới đây sẽ bị xóa khi áp dụng đề xuất vào bản nháp. Dùng Undo
                            trên thanh công cụ để hoàn tác thay đổi gần nhất.
                        </AlertDialogDescription>
                        {plan && (
                            <RemovedItems
                                plan={plan}
                                objects={scene.objects}
                                rules={scene.interactions}
                            />
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Quay lại</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={disabled || pending}
                            onClick={() => accept(false, true)}
                        >
                            Xóa và áp dụng
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {preview && (
                <Dialog
                    open
                    onOpenChange={(value) => {
                        if (!value) setPreview(null);
                    }}
                >
                    <DialogContent
                        className="flex h-[85dvh] w-[1000px] max-w-[calc(100vw-24px)] flex-col overflow-hidden p-0"
                        onEscapeKeyDown={(event) => {
                            const question = document.querySelector(
                                'dialog[data-workflow-question][open]',
                            );
                            if (!question) return;
                            event.preventDefault();
                            question.dispatchEvent(new Event('cancel', { cancelable: true }));
                        }}
                    >
                        <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-b bg-surface py-3 pr-14 pl-4 sm:pl-5">
                            <div className="min-w-0">
                                <DialogTitle className="text-base">
                                    {hasObjectEdits ? 'Xem thử đề xuất' : 'Chạy thử đề xuất'}
                                </DialogTitle>
                                {preview.mode === 'rule' && preview.rule?.name && (
                                    <p
                                        className="m-0 mt-0.5 truncate text-muted-foreground text-xs"
                                        title={preview.rule.name}
                                    >
                                        {preview.rule.name}
                                    </p>
                                )}
                            </div>
                            {previewModes.length > 0 && (
                                <fieldset className="m-0 flex min-w-0 flex-wrap gap-0.5 rounded-lg border-0 bg-muted p-0.5">
                                    <legend className="sr-only">Chế độ xem thử</legend>
                                    {previewModes.map(([mode, label]) => (
                                        <Button
                                            key={mode}
                                            size="sm"
                                            variant={preview.mode === mode ? 'outline' : 'ghost'}
                                            aria-pressed={preview.mode === mode}
                                            onClick={() => setPreview({ ...preview, mode })}
                                            className="h-8 min-h-8 px-2.5"
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </fieldset>
                            )}
                        </header>
                        <DialogDescription className="sr-only">
                            Xem các thay đổi được đề xuất trước khi áp dụng vào bản nháp.
                        </DialogDescription>
                        <InteractionTestPanel
                            embedded
                            scene={preview.scene}
                            page={page}
                            book={{ ...book, workflowVariables: preview.variables }}
                            {...(preview.mode === 'rule' && preview.rule
                                ? { mode: 'rule', rule: preview.rule }
                                : { mode: preview.mode === 'layout' ? 'layout' : 'page' })}
                            onStep={() => {}}
                            onRepair={() => {
                                setPreview(null);
                                setError('Hãy bổ sung tài nguyên trên trang rồi gửi yêu cầu tiếp.');
                            }}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
