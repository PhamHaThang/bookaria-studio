import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ImagePlus,
    MessageCircle,
    MessageSquare,
    PanelTop,
    RotateCcw,
    Trash2,
    Type,
    X,
} from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import {
    ANNOTATION_DESCRIPTION_DEFAULTS,
    SCENE_LIMITS,
    SCREEN_BORDER_DEFAULTS,
    type SceneObject,
    SceneObjectSchema,
    type TextPresentation,
    TextPresentationSchema,
} from '@/shared/contracts/scene.schema';
import { isHexColor as colorValid } from '@/shared/lib/color-change-session';
import { annotationConnectorSide } from '@/shared/scene/annotation-connector';
import { ColorInput } from '@/shared/ui/ColorInput';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/primitives/dialog';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Slider } from '@/shared/ui/primitives/slider';
import { Switch } from '@/shared/ui/primitives/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { newObject } from '../model/objects';
import { AssetPicker } from './AssetPicker';
import { ScreenTextStyle } from './ScreenTextStyle';
import { TextVisualPreview, type TextVisualPreviewHandle } from './TextVisualPreview';

export type TextualObject = Extract<SceneObject, { type: 'text' | 'label' }>;
export type TextMode = 'text' | 'screen' | 'bubble' | 'annotation';
const modes = [
    { value: 'text', label: 'Văn bản', icon: Type },
    { value: 'screen', label: 'Thẻ thông tin', icon: PanelTop },
    { value: 'bubble', label: 'Bong bóng', icon: MessageCircle },
    { value: 'annotation', label: 'Chú thích', icon: MessageSquare },
] as const;
const connectorSides = [
    { value: 'left', icon: ArrowLeft, label: 'Trái' },
    { value: 'right', icon: ArrowRight, label: 'Phải' },
    { value: 'top', icon: ArrowUp, label: 'Trên' },
    { value: 'bottom', icon: ArrowDown, label: 'Dưới' },
] as const;
function initialDraft(mode: TextMode): TextualObject {
    const object = newObject(mode === 'annotation' ? 'label' : 'text', crypto.randomUUID());
    if (object.type !== 'text' && object.type !== 'label')
        throw new Error('Loại chữ không hợp lệ.');
    return {
        ...object,
        text: {
            screen: 'Thêm nội dung giới thiệu hoặc hướng dẫn cho người đọc tại đây.',
            bubble: 'Xin chào! Cùng khám phá trang sách này nhé.\nChạm mũi tên để xem nội dung tiếp theo.',
            text: 'Văn bản',
            annotation: 'Chi tiết 1',
        }[mode],
        name: modes.find((m) => m.value === mode)?.label,
        billboard: mode === 'bubble' || mode === 'screen' || mode === 'annotation',
        style: { ...object.style, color: '#252525', bold: mode === 'text' },
        presentation:
            mode === 'text'
                ? undefined
                : TextPresentationSchema.parse(
                      mode === 'screen'
                          ? {
                                kind: mode,
                                title: 'Tiêu đề thẻ thông tin',
                                buttonLabel: 'Tìm hiểu thêm',
                                buttonUrl: 'https://bookaria.com',
                            }
                          : mode === 'bubble'
                            ? { kind: mode, title: 'Bạn hướng dẫn' }
                            : mode === 'annotation'
                              ? {
                                    kind: mode,
                                    connectorSide: 'left',
                                    description:
                                        'Chạm vào đây để tìm hiểu thêm về chi tiết được đánh dấu.',
                                }
                              : { kind: mode },
                  ),
        ...(object.type === 'label' ? { target: [-0.3, 0, 0] as [number, number, number] } : {}),
    };
}
function ColorField({
    id,
    label,
    value,
    onChange,
    onPreview,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    onPreview: (value: string) => void;
}) {
    return (
        <Field data-invalid={!colorValid(value)}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <ColorInput
                id={id}
                label={label}
                value={value}
                onValueChange={onChange}
                onPreview={onPreview}
            />
        </Field>
    );
}
export function TextComposer({
    initial,
    start = 'text',
    assets,
    disabled,
    onClose,
    onCommit,
}: {
    initial?: TextualObject;
    start?: TextMode;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onClose: () => void;
    onCommit: (object: TextualObject, assets: Record<string, Asset>) => void;
}) {
    const id = useId();
    const initialKind = initial?.presentation?.kind;
    const initialMode: TextMode = initial
        ? initialKind === 'extruded'
            ? 'text'
            : initialKind || (initial.type === 'label' ? 'annotation' : 'text')
        : start;
    const [mode, setMode] = useState<TextMode>(initialMode);
    const [drafts, setDrafts] = useState<Record<TextMode, TextualObject>>(() => {
        const all = Object.fromEntries(
            modes.map((item) => [item.value, initialDraft(item.value)]),
        ) as Record<TextMode, TextualObject>;
        if (initial) {
            for (const draft of Object.values(all))
                draft.transform = structuredClone(initial.transform);
            all[initialMode] = structuredClone(initial);
        }
        return all;
    });
    const [extrusionDepth, setExtrusionDepth] = useState(
        initial?.presentation?.kind === 'extruded' ? initial.presentation.depth : 0.025,
    );
    const [flatFont, setFlatFont] = useState<TextualObject['style']['font']>(
        initial?.style.font ?? 'sans',
    );
    const annotationTexts = useRef({
        preview: null as TextVisualPreviewHandle | null,
        line:
            initial?.presentation?.kind === 'annotation' && initial.presentation.shape === 'line'
                ? initial.text
                : 'Chi tiết 1',
        circle:
            initial?.presentation?.kind === 'annotation' && initial.presentation.shape === 'circle'
                ? initial.text
                : '1',
    });
    const [chosen, setChosen] = useState<Record<string, Asset>>({});
    const [choosingImage, setChoosingImage] = useState(false),
        [previewReady, setPreviewReady] = useState(false),
        [textPage, setTextPage] = useState(0),
        [submitted, setSubmitted] = useState(false);
    const draft = drafts[mode],
        presentation = draft.presentation;
    const patch = (value: Partial<TextualObject>) =>
        setDrafts((current) => ({
            ...current,
            [mode]: { ...current[mode], ...value } as TextualObject,
        }));
    const appearance = (value: Record<string, unknown>) =>
        patch({
            presentation: {
                ...(presentation || TextPresentationSchema.parse({ kind: mode })),
                ...value,
            } as TextPresentation,
        });
    const style = (value: Partial<TextualObject['style']>) =>
        patch({ style: { ...draft.style, ...value } });
    const validation = SceneObjectSchema.safeParse(draft);
    const needsUrl =
        presentation?.kind === 'screen' &&
        Boolean(presentation.buttonLabel.trim()) &&
        !presentation.buttonUrl?.trim();
    const invalidUrl =
        !validation.success &&
        validation.error.issues.some((issue) => issue.path.at(-1) === 'buttonUrl');
    const textError =
        !validation.success && validation.error.issues.some((issue) => issue.path[0] === 'text');
    const urlError = needsUrl
        ? 'Vui lòng nhập liên kết cho nút, hoặc xóa nhãn nếu không cần nút.'
        : invalidUrl
          ? 'Vui lòng nhập liên kết hợp lệ bắt đầu bằng http:// hoặc https://.'
          : undefined;
    const textMessage =
        mode === 'annotation'
            ? 'Vui lòng nhập nhãn cho chú thích.'
            : 'Vui lòng nhập nội dung văn bản.';
    const errors = [
        ...(textError
            ? [
                  draft.text.trim()
                      ? `Nội dung không được vượt quá ${SCENE_LIMITS.maxTextChars} ký tự.`
                      : textMessage,
              ]
            : []),
        ...(urlError ? [urlError] : []),
        ...(!validation.success
            ? validation.error.issues
                  .filter((issue) => issue.path[0] !== 'text' && issue.path.at(-1) !== 'buttonUrl')
                  .map((issue) => {
                      const field = String(issue.path.at(-1));
                      const labels: Record<string, string> = {
                          color: 'Màu chữ',
                          background: 'Màu nền',
                          descriptionColor: 'Màu chữ mô tả',
                          descriptionBackground: 'Màu nền mô tả',
                          title: 'Tiêu đề',
                          description: 'Mô tả',
                          buttonLabel: 'Nhãn nút',
                          buttonBackground: 'Màu nút',
                          width: 'Độ dày viền',
                      };
                      return `${labels[field] ?? 'Thông tin văn bản'} chưa hợp lệ. Vui lòng kiểm tra lại.`;
                  })
            : []),
    ];
    const ready = previewReady && !disabled;
    const border =
        (presentation && 'border' in presentation ? presentation.border : undefined) ??
        SCREEN_BORDER_DEFAULTS;
    const imageId = presentation?.kind === 'screen' ? presentation.imageAssetId : undefined;
    const image = imageId ? chosen[imageId] || assets[imageId] : undefined;
    const preview = useMemo(
        () =>
            ({
                ...draft,
                text: mode === 'annotation' ? draft.text : draft.text.trim() || 'Nội dung của bạn',
                style: {
                    ...draft.style,
                    color: colorValid(draft.style.color) ? draft.style.color : '#252525',
                },
                ...(draft.presentation && 'background' in draft.presentation
                    ? {
                          presentation: {
                              ...draft.presentation,
                              ...(draft.presentation.kind === 'annotation'
                                  ? {
                                        descriptionColor: colorValid(
                                            draft.presentation.descriptionColor ??
                                                ANNOTATION_DESCRIPTION_DEFAULTS.color,
                                        )
                                            ? draft.presentation.descriptionColor
                                            : ANNOTATION_DESCRIPTION_DEFAULTS.color,
                                        descriptionBackground: colorValid(
                                            draft.presentation.descriptionBackground ??
                                                ANNOTATION_DESCRIPTION_DEFAULTS.background,
                                        )
                                            ? draft.presentation.descriptionBackground
                                            : ANNOTATION_DESCRIPTION_DEFAULTS.background,
                                    }
                                  : {}),
                              ...('border' in draft.presentation && draft.presentation.border
                                  ? {
                                        border: {
                                            ...draft.presentation.border,
                                            color: colorValid(draft.presentation.border.color)
                                                ? draft.presentation.border.color
                                                : SCREEN_BORDER_DEFAULTS.color,
                                        },
                                    }
                                  : {}),
                              background: colorValid(draft.presentation.background)
                                  ? draft.presentation.background
                                  : '#ffffff',
                          },
                      }
                    : {}),
            }) as TextualObject,
        [draft, mode],
    );
    const colorControls = (
        <FieldGroup
            data-has-background={Boolean(presentation && 'background' in presentation)}
            className="grid grid-cols-1 gap-3 data-[has-background=true]:grid-cols-2"
        >
            <ColorField
                id={`${id}-color`}
                onPreview={(color) =>
                    annotationTexts.current.preview?.previewColors({ color }, draft.id)
                }
                label="Màu chữ"
                value={draft.style.color}
                onChange={(value) => style({ color: value })}
            />
            {presentation && 'background' in presentation && (
                <ColorField
                    id={`${id}-background`}
                    onPreview={(color) =>
                        annotationTexts.current.preview?.previewColors(
                            { background: color },
                            draft.id,
                        )
                    }
                    label="Màu nền"
                    value={presentation.background}
                    onChange={(value) => appearance({ background: value })}
                />
            )}
        </FieldGroup>
    );
    const titleControl = (
        <Input
            id={`${id}-title`}
            value={presentation && 'title' in presentation ? presentation.title : ''}
            maxLength={100}
            placeholder={
                mode === 'bubble' ? 'Ví dụ: Bạn hướng dẫn' : 'Ví dụ: Khám phá thế giới động vật'
            }
            onChange={(event) => appearance({ title: event.target.value })}
        />
    );
    const bodyControl = (
        <>
            {mode === 'annotation' &&
            presentation?.kind === 'annotation' &&
            presentation.shape === 'circle' ? (
                <Input
                    id={`${id}-text`}
                    aria-invalid={submitted && textError}
                    aria-describedby={submitted && textError ? `${id}-text-error` : undefined}
                    value={draft.text}
                    maxLength={SCENE_LIMITS.maxTextChars}
                    placeholder="Ví dụ: 1"
                    onChange={(event) => patch({ text: event.target.value })}
                />
            ) : (
                <Textarea
                    id={`${id}-text`}
                    aria-invalid={submitted && textError}
                    aria-describedby={submitted && textError ? `${id}-text-error` : undefined}
                    rows={mode === 'annotation' ? 2 : 4}
                    value={draft.text}
                    maxLength={SCENE_LIMITS.maxTextChars}
                    placeholder="Nhập nội dung của bạn…"
                    onChange={(event) => {
                        patch({ text: event.target.value });
                        setTextPage(0);
                    }}
                />
            )}
            <FieldDescription>
                {draft.text.length}/{SCENE_LIMITS.maxTextChars} ký tự
                {mode === 'bubble' ? ' · Mỗi dòng là một lượt hội thoại.' : ''}
            </FieldDescription>
            {submitted && textError && <FieldError id={`${id}-text-error`}>{errors[0]}</FieldError>}
        </>
    );
    const count = draft.text.split(/\r?\n/).filter((line) => line.trim()).length || 1;
    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) onClose();
                }}
            >
                <DialogContent
                    onEscapeKeyDown={(event) => {
                        if (annotationTexts.current.preview?.cancelAnnotationDrag())
                            event.preventDefault();
                    }}
                    showCloseButton={false}
                    aria-describedby={undefined}
                    className="grid h-[min(960px,calc(100dvh-40px))] w-[min(1440px,calc(100vw-48px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 text-sm [--control-height:40px] [--text-md:0.875rem] [&_[data-slot=field-label]]:mb-0 [&_[data-slot=input]]:mt-0 [&_[data-slot=textarea]]:mt-0"
                >
                    <Tabs
                        value={mode}
                        onValueChange={(value) => {
                            setMode(value as TextMode);
                            setSubmitted(false);
                            setTextPage(0);
                            setPreviewReady(false);
                        }}
                        className="contents"
                    >
                        <header className="flex items-center gap-5 border-border border-b px-6 py-5">
                            <DialogTitle>
                                {initial ? 'Chỉnh sửa văn bản' : 'Thêm văn bản'}
                            </DialogTitle>
                            <TabsList className="mx-auto" aria-label="Loại văn bản">
                                {modes.map((item) => (
                                    <TabsTrigger value={item.value} key={item.value}>
                                        <item.icon />
                                        {item.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Đóng phần văn bản"
                                onClick={onClose}
                            >
                                <X />
                            </Button>
                        </header>
                        <div className="grid min-h-0 grid-cols-[400px_minmax(0,1fr)]">
                            <TabsContent
                                value={mode}
                                className="m-0 min-h-0 overflow-y-auto border-border border-r p-6"
                            >
                                <FieldGroup>
                                    {presentation?.kind === 'annotation' && (
                                        <Field>
                                            <FieldLabel>Kiểu chú thích</FieldLabel>
                                            <ToggleGroup
                                                type="single"
                                                variant="outline"
                                                value={presentation.shape}
                                                aria-label="Kiểu chú thích"
                                                onValueChange={(value) => {
                                                    if (value === 'line' || value === 'circle') {
                                                        annotationTexts.current[
                                                            presentation.shape
                                                        ] = draft.text;
                                                        patch({
                                                            text: annotationTexts.current[value],
                                                            presentation: {
                                                                ...presentation,
                                                                shape: value,
                                                            },
                                                        });
                                                    }
                                                }}
                                            >
                                                <ToggleGroupItem value="line">
                                                    Đường nối
                                                </ToggleGroupItem>
                                                <ToggleGroupItem value="circle">
                                                    Vòng tròn
                                                </ToggleGroupItem>
                                            </ToggleGroup>
                                        </Field>
                                    )}
                                    {presentation?.kind === 'screen' && (
                                        <Field>
                                            <FieldLabel>Ảnh minh họa</FieldLabel>
                                            {image ? (
                                                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                                                    <img
                                                        src={image.url}
                                                        alt={image.name}
                                                        className="size-16 rounded-md object-contain"
                                                    />
                                                    <span className="min-w-0 flex-1 truncate text-sm">
                                                        {image.name}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Đổi ảnh minh họa"
                                                        onClick={() => setChoosingImage(true)}
                                                    >
                                                        <ImagePlus />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Bỏ ảnh minh họa"
                                                        onClick={() =>
                                                            appearance({ imageAssetId: undefined })
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    className="h-28 flex-col gap-2 border-dashed"
                                                    onClick={() => setChoosingImage(true)}
                                                >
                                                    <ImagePlus />
                                                    Chọn hoặc tải ảnh
                                                </Button>
                                            )}
                                        </Field>
                                    )}
                                    {presentation?.kind === 'screen' ? (
                                        <ScreenTextStyle
                                            label="Tiêu đề"
                                            controlId={`${id}-title`}
                                            value={presentation.titleStyle}
                                            fallback={{ size: 17, weight: 600 }}
                                            onChange={(titleStyle) => appearance({ titleStyle })}
                                        >
                                            {titleControl}
                                        </ScreenTextStyle>
                                    ) : presentation?.kind === 'bubble' ? (
                                        <Field>
                                            <FieldLabel htmlFor={`${id}-title`}>Tiêu đề</FieldLabel>
                                            {titleControl}
                                        </Field>
                                    ) : null}
                                    {presentation?.kind === 'screen' ? (
                                        <ScreenTextStyle
                                            label="Nội dung"
                                            controlId={`${id}-text`}
                                            value={presentation.bodyStyle}
                                            fallback={{
                                                size: 14,
                                                weight: draft.style.bold ? 700 : 400,
                                            }}
                                            onChange={(bodyStyle) => appearance({ bodyStyle })}
                                        >
                                            {bodyControl}
                                        </ScreenTextStyle>
                                    ) : (
                                        <Field>
                                            <FieldLabel htmlFor={`${id}-text`}>
                                                {mode === 'annotation' ? 'Nhãn' : 'Nội dung'}
                                            </FieldLabel>
                                            {bodyControl}
                                        </Field>
                                    )}
                                    {presentation?.kind === 'annotation' && (
                                        <FieldSet className="gap-3">
                                            <FieldLegend className="sr-only">Màu nhãn</FieldLegend>
                                            {colorControls}
                                        </FieldSet>
                                    )}
                                    {presentation?.kind === 'screen' && (
                                        <FieldSet className="gap-3">
                                            <FieldLegend>Nút liên kết</FieldLegend>
                                            <ScreenTextStyle
                                                label="Nhãn nút (không bắt buộc)"
                                                controlId={`${id}-button`}
                                                value={presentation.buttonStyle}
                                                fallback={{ size: 14, weight: 600 }}
                                                onChange={(buttonStyle) =>
                                                    appearance({ buttonStyle })
                                                }
                                            >
                                                <Input
                                                    id={`${id}-button`}
                                                    value={presentation.buttonLabel}
                                                    maxLength={60}
                                                    placeholder="Ví dụ: Tìm hiểu thêm"
                                                    onChange={(event) =>
                                                        appearance({
                                                            buttonLabel: event.target.value,
                                                        })
                                                    }
                                                />
                                                {!presentation.buttonLabel && (
                                                    <FieldDescription>
                                                        Nhập nhãn để hiển thị nút trong thẻ.
                                                    </FieldDescription>
                                                )}
                                            </ScreenTextStyle>
                                            {presentation.buttonLabel && (
                                                <>
                                                    <Field
                                                        data-invalid={
                                                            submitted && Boolean(urlError)
                                                        }
                                                    >
                                                        <FieldLabel htmlFor={`${id}-url`}>
                                                            Liên kết của nút
                                                        </FieldLabel>
                                                        <Input
                                                            id={`${id}-url`}
                                                            type="url"
                                                            value={presentation.buttonUrl ?? ''}
                                                            placeholder="https://…"
                                                            aria-invalid={
                                                                submitted && Boolean(urlError)
                                                            }
                                                            aria-describedby={
                                                                urlError && submitted
                                                                    ? `${id}-url-error`
                                                                    : undefined
                                                            }
                                                            onChange={(event) =>
                                                                appearance({
                                                                    buttonUrl:
                                                                        event.target.value ||
                                                                        undefined,
                                                                })
                                                            }
                                                        />
                                                        {submitted && urlError ? (
                                                            <FieldError id={`${id}-url-error`}>
                                                                {urlError}
                                                            </FieldError>
                                                        ) : (
                                                            <FieldDescription>
                                                                Người đọc chạm thẻ để mở liên kết.
                                                            </FieldDescription>
                                                        )}
                                                    </Field>
                                                    <ColorField
                                                        id={`${id}-button-background`}
                                                        onPreview={(color) =>
                                                            annotationTexts.current.preview?.previewColors(
                                                                { buttonBackground: color },
                                                                draft.id,
                                                            )
                                                        }
                                                        label="Màu nút"
                                                        value={
                                                            presentation.buttonBackground ??
                                                            draft.style.color
                                                        }
                                                        onChange={(buttonBackground) =>
                                                            appearance({ buttonBackground })
                                                        }
                                                    />
                                                </>
                                            )}
                                        </FieldSet>
                                    )}
                                    {presentation?.kind === 'annotation' && (
                                        <Field>
                                            <FieldLabel htmlFor={`${id}-description`}>
                                                Mô tả
                                            </FieldLabel>
                                            <Textarea
                                                id={`${id}-description`}
                                                wrap="soft"
                                                className="min-h-28 resize-none overflow-hidden [field-sizing:content] [overflow-wrap:anywhere]"
                                                rows={4}
                                                value={presentation.description}
                                                maxLength={1000}
                                                onChange={(event) =>
                                                    appearance({
                                                        description: event.target.value,
                                                    })
                                                }
                                                placeholder="Nhập nội dung mô tả chú thích…"
                                            />
                                        </Field>
                                    )}
                                    {presentation?.kind !== 'annotation' && colorControls}
                                    {presentation?.kind === 'annotation' &&
                                        presentation.shape === 'circle' && (
                                            <FieldSet className="gap-3">
                                                <FieldLegend className="sr-only">
                                                    Màu mô tả
                                                </FieldLegend>
                                                <FieldGroup className="grid grid-cols-2 gap-3">
                                                    <ColorField
                                                        id={`${id}-description-color`}
                                                        onPreview={(color) =>
                                                            annotationTexts.current.preview?.previewColors(
                                                                { descriptionColor: color },
                                                                draft.id,
                                                            )
                                                        }
                                                        label="Chữ mô tả"
                                                        value={
                                                            presentation.descriptionColor ??
                                                            ANNOTATION_DESCRIPTION_DEFAULTS.color
                                                        }
                                                        onChange={(descriptionColor) =>
                                                            appearance({ descriptionColor })
                                                        }
                                                    />
                                                    <ColorField
                                                        id={`${id}-description-background`}
                                                        onPreview={(color) =>
                                                            annotationTexts.current.preview?.previewColors(
                                                                { descriptionBackground: color },
                                                                draft.id,
                                                            )
                                                        }
                                                        label="Nền mô tả"
                                                        value={
                                                            presentation.descriptionBackground ??
                                                            ANNOTATION_DESCRIPTION_DEFAULTS.background
                                                        }
                                                        onChange={(descriptionBackground) =>
                                                            appearance({ descriptionBackground })
                                                        }
                                                    />
                                                </FieldGroup>
                                            </FieldSet>
                                        )}
                                    {presentation?.kind === 'annotation' &&
                                        presentation.shape === 'line' && (
                                            <Field>
                                                <FieldLabel id={`${id}-connector-label`}>
                                                    Điểm nối trên nhãn
                                                </FieldLabel>
                                                <ToggleGroup
                                                    type="single"
                                                    variant="outline"
                                                    className="grid grid-cols-4"
                                                    aria-labelledby={`${id}-connector-label`}
                                                    value={annotationConnectorSide(
                                                        presentation,
                                                        draft.type === 'label'
                                                            ? draft.target
                                                            : [-0.3, 0, 0],
                                                    )}
                                                    onValueChange={(value) => {
                                                        const side = connectorSides.find(
                                                            (item) => item.value === value,
                                                        );
                                                        if (side)
                                                            appearance({
                                                                connectorSide: side.value,
                                                            });
                                                    }}
                                                >
                                                    {connectorSides.map((direction) => (
                                                        <ToggleGroupItem
                                                            key={direction.value}
                                                            value={direction.value}
                                                            aria-label={`Cạnh ${direction.label.toLowerCase()}`}
                                                            title={`Giữa cạnh ${direction.label.toLowerCase()}`}
                                                        >
                                                            <direction.icon />
                                                            {direction.label}
                                                        </ToggleGroupItem>
                                                    ))}
                                                </ToggleGroup>
                                                <FieldDescription>
                                                    Đầu nối giữ giữa cạnh đã chọn. Kéo nhãn trong
                                                    khung xem trước để đổi vị trí.
                                                </FieldDescription>
                                            </Field>
                                        )}
                                    {(presentation?.kind === 'screen' ||
                                        presentation?.kind === 'bubble') && (
                                        <FieldSet
                                            className="gap-3"
                                            aria-labelledby={`${id}-border-label`}
                                        >
                                            <Field orientation="horizontal">
                                                <FieldLabel
                                                    id={`${id}-border-label`}
                                                    htmlFor={`${id}-border-enabled`}
                                                >
                                                    {presentation.kind === 'bubble'
                                                        ? 'Viền bong bóng'
                                                        : 'Viền thẻ'}
                                                </FieldLabel>
                                                <Switch
                                                    id={`${id}-border-enabled`}
                                                    checked={border.enabled}
                                                    onCheckedChange={(enabled) =>
                                                        appearance({
                                                            border: { ...border, enabled },
                                                        })
                                                    }
                                                />
                                            </Field>
                                            {border.enabled && (
                                                <FieldGroup className="grid grid-cols-2 gap-3">
                                                    <Field>
                                                        <FieldLabel htmlFor={`${id}-border-width`}>
                                                            Độ dày
                                                        </FieldLabel>
                                                        <FormSelect
                                                            id={`${id}-border-width`}
                                                            className="mt-0"
                                                            value={border.width}
                                                            options={Array.from(
                                                                { length: 16 },
                                                                (_, index) => ({
                                                                    value: (index + 1) / 2,
                                                                    label: `${(index + 1) / 2} px`,
                                                                }),
                                                            )}
                                                            onValueChange={(width) =>
                                                                appearance({
                                                                    border: {
                                                                        ...border,
                                                                        width: Number(width),
                                                                    },
                                                                })
                                                            }
                                                        />
                                                    </Field>
                                                    <ColorField
                                                        id={`${id}-border-color`}
                                                        onPreview={(color) =>
                                                            annotationTexts.current.preview?.previewColors(
                                                                { border: { ...border, color } },
                                                                draft.id,
                                                            )
                                                        }
                                                        label="Màu viền"
                                                        value={border.color}
                                                        onChange={(color) =>
                                                            appearance({
                                                                border: { ...border, color },
                                                            })
                                                        }
                                                    />
                                                </FieldGroup>
                                            )}
                                        </FieldSet>
                                    )}
                                    {mode !== 'screen' && mode !== 'annotation' && (
                                        <Field orientation="horizontal">
                                            <Checkbox
                                                id={`${id}-bold`}
                                                checked={draft.style.bold}
                                                onCheckedChange={(checked) =>
                                                    style({ bold: checked === true })
                                                }
                                            />
                                            <FieldLabel htmlFor={`${id}-bold`}>Chữ đậm</FieldLabel>
                                        </Field>
                                    )}
                                    {mode === 'text' && (
                                        <>
                                            <FieldSet className="gap-3">
                                                <Field orientation="horizontal">
                                                    <FieldLabel htmlFor={`${id}-three-dimensional`}>
                                                        Chữ 3D
                                                    </FieldLabel>
                                                    <Switch
                                                        id={`${id}-three-dimensional`}
                                                        checked={presentation?.kind === 'extruded'}
                                                        onCheckedChange={(enabled) => {
                                                            if (enabled)
                                                                setFlatFont(draft.style.font);
                                                            patch({
                                                                style: {
                                                                    ...draft.style,
                                                                    font: enabled
                                                                        ? 'sans'
                                                                        : flatFont,
                                                                },
                                                                presentation: enabled
                                                                    ? {
                                                                          kind: 'extruded',
                                                                          depth: extrusionDepth,
                                                                      }
                                                                    : undefined,
                                                            });
                                                        }}
                                                    />
                                                </Field>
                                                <FieldDescription>
                                                    Bật để tạo độ nổi cho chữ.
                                                </FieldDescription>
                                                {presentation?.kind === 'extruded' && (
                                                    <Field>
                                                        <FieldLabel htmlFor={`${id}-depth`}>
                                                            Độ nổi
                                                        </FieldLabel>
                                                        <div className="flex items-center gap-3">
                                                            <Input
                                                                type="range"
                                                                id={`${id}-depth`}
                                                                min={0.001}
                                                                max={0.2}
                                                                step={0.001}
                                                                value={presentation.depth}
                                                                className="h-8 flex-1 border-0 p-0 accent-primary"
                                                                onChange={(event) => {
                                                                    const depth = Number(
                                                                        event.target.value,
                                                                    );
                                                                    setExtrusionDepth(depth);
                                                                    appearance({ depth });
                                                                }}
                                                            />
                                                            <output className="min-w-12 text-right text-xs tabular-nums">
                                                                {Math.round(
                                                                    (presentation.depth /
                                                                        draft.style.size) *
                                                                        100,
                                                                )}
                                                                %
                                                            </output>
                                                        </div>
                                                        <FieldDescription>
                                                            Phông Be Vietnam Pro hỗ trợ tiếng Việt.
                                                        </FieldDescription>
                                                    </Field>
                                                )}
                                            </FieldSet>
                                            {!presentation && (
                                                <Field>
                                                    <FieldLabel htmlFor={`${id}-font`}>
                                                        Phông chữ
                                                    </FieldLabel>
                                                    <FormSelect
                                                        id={`${id}-font`}
                                                        value={draft.style.font}
                                                        options={[
                                                            {
                                                                value: 'sans',
                                                                label: 'Be Vietnam Pro',
                                                            },
                                                            { value: 'serif', label: 'Có chân' },
                                                            {
                                                                value: 'rounded',
                                                                label: 'Không chân',
                                                            },
                                                        ]}
                                                        onValueChange={(value) =>
                                                            style({
                                                                font: value as TextualObject['style']['font'],
                                                            })
                                                        }
                                                    />
                                                </Field>
                                            )}
                                        </>
                                    )}
                                    {presentation?.kind === 'bubble' && (
                                        <FieldGroup>
                                            <Field>
                                                <FieldLabel>Hướng mũi nhọn</FieldLabel>
                                                <ToggleGroup
                                                    type="single"
                                                    variant="outline"
                                                    value={presentation.pointer}
                                                    className="grid w-full grid-cols-2"
                                                    onValueChange={(value) => {
                                                        if (value) appearance({ pointer: value });
                                                    }}
                                                >
                                                    {[
                                                        {
                                                            value: 'top',
                                                            label: 'Trên',
                                                            icon: ArrowUp,
                                                        },
                                                        {
                                                            value: 'bottom',
                                                            label: 'Dưới',
                                                            icon: ArrowDown,
                                                        },
                                                        {
                                                            value: 'left',
                                                            label: 'Trái',
                                                            icon: ArrowLeft,
                                                        },
                                                        {
                                                            value: 'right',
                                                            label: 'Phải',
                                                            icon: ArrowRight,
                                                        },
                                                    ].map((item) => (
                                                        <ToggleGroupItem
                                                            value={item.value}
                                                            key={item.value}
                                                        >
                                                            <item.icon />
                                                            {item.label}
                                                        </ToggleGroupItem>
                                                    ))}
                                                </ToggleGroup>
                                            </Field>
                                            <Field>
                                                <div className="flex items-center justify-between gap-3">
                                                    <FieldLabel
                                                        id={`${id}-pointer-label`}
                                                        htmlFor={`${id}-pointer-position`}
                                                    >
                                                        Vị trí mũi nhọn
                                                    </FieldLabel>
                                                    <Button
                                                        variant="plain"
                                                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                                                        aria-label="Đặt mũi nhọn về giữa"
                                                        title="Đặt mũi nhọn về giữa"
                                                        disabled={
                                                            (presentation.pointerPosition ??
                                                                0.5) === 0.5
                                                        }
                                                        onClick={() =>
                                                            appearance({ pointerPosition: 0.5 })
                                                        }
                                                    >
                                                        <RotateCcw className="size-4" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Slider
                                                        id={`${id}-pointer-position`}
                                                        aria-labelledby={`${id}-pointer-label`}
                                                        aria-valuetext={`${Math.round((presentation.pointerPosition ?? 0.5) * 100)}%`}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        value={[
                                                            (presentation.pointerPosition ?? 0.5) *
                                                                100,
                                                        ]}
                                                        onValueChange={([position]) => {
                                                            if (position !== undefined)
                                                                appearance({
                                                                    pointerPosition: position / 100,
                                                                });
                                                        }}
                                                    />
                                                    <output className="min-w-10 text-right text-xs tabular-nums">
                                                        {Math.round(
                                                            (presentation.pointerPosition ?? 0.5) *
                                                                100,
                                                        )}
                                                        %
                                                    </output>
                                                </div>
                                                <FieldDescription>
                                                    {presentation.pointer === 'top' ||
                                                    presentation.pointer === 'bottom'
                                                        ? 'Từ trái sang phải trên cạnh đã chọn.'
                                                        : 'Từ trên xuống dưới trên cạnh đã chọn.'}
                                                </FieldDescription>
                                            </Field>
                                        </FieldGroup>
                                    )}
                                    <Field orientation="horizontal">
                                        <Checkbox
                                            id={`${id}-billboard`}
                                            checked={draft.billboard}
                                            onCheckedChange={(checked) =>
                                                patch({
                                                    billboard: checked === true,
                                                    transform: {
                                                        ...draft.transform,
                                                        rotation:
                                                            checked !== true && draft.billboard
                                                                ? (annotationTexts.current.preview?.getDisplayedRotation() ??
                                                                  draft.transform.rotation)
                                                                : draft.transform.rotation,
                                                    },
                                                })
                                            }
                                        />
                                        <FieldLabel htmlFor={`${id}-billboard`}>
                                            Luôn hướng về camera
                                        </FieldLabel>
                                    </Field>
                                </FieldGroup>
                            </TabsContent>
                            <section
                                className="flex min-h-0 flex-col gap-3 bg-canvas p-6"
                                aria-label="Xem trước trực tiếp"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">
                                        Xem trước trực tiếp
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {mode === 'annotation'
                                            ? 'Kéo nhãn: di chuyển · Kéo nền: xoay · Chuột phải/giữa: dịch'
                                            : mode === 'bubble' && count > 1
                                              ? 'Kéo: xoay · Chuột phải/giữa: dịch · Chạm: đổi lượt'
                                              : 'Kéo: xoay · Chuột phải/giữa: dịch · Cuộn: phóng'}
                                    </span>
                                </div>
                                <TextVisualPreview
                                    ref={(handle) => {
                                        annotationTexts.current.preview = handle;
                                    }}
                                    onAnnotationOffsetChange={
                                        mode === 'annotation' && !disabled
                                            ? (labelOffset) => appearance({ labelOffset })
                                            : undefined
                                    }
                                    object={preview}
                                    imageUrl={image?.url}
                                    page={textPage}
                                    onReadyChange={setPreviewReady}
                                    onAdvance={
                                        mode === 'bubble' && count > 1
                                            ? (page) =>
                                                  setTextPage(
                                                      (value) => page ?? (value + 1) % count,
                                                  )
                                            : undefined
                                    }
                                />
                                <div className="flex h-8 shrink-0 items-center justify-center">
                                    {mode === 'annotation' &&
                                        presentation?.kind === 'annotation' && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Đặt lại vị trí nhãn chú thích"
                                                title="Đặt lại vị trí nhãn chú thích"
                                                disabled={
                                                    disabled ||
                                                    !presentation.labelOffset?.some(Boolean)
                                                }
                                                onClick={() =>
                                                    appearance({ labelOffset: undefined })
                                                }
                                            >
                                                <RotateCcw />
                                            </Button>
                                        )}
                                    {mode === 'bubble' && count > 1 && (
                                        <FieldSet
                                            className="flex flex-row items-center justify-center gap-3"
                                            aria-label="Điều hướng hội thoại"
                                        >
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Lượt thoại trước"
                                                disabled={textPage === 0}
                                                onClick={() => setTextPage((value) => value - 1)}
                                            >
                                                <ChevronLeft />
                                            </Button>
                                            <span
                                                className="text-xs tabular-nums"
                                                role="status"
                                                aria-live="polite"
                                            >
                                                {textPage + 1} / {count}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label="Lượt thoại sau"
                                                disabled={textPage >= count - 1}
                                                onClick={() => setTextPage((value) => value + 1)}
                                            >
                                                <ChevronRight />
                                            </Button>
                                        </FieldSet>
                                    )}
                                </div>
                            </section>
                        </div>
                        <footer className="flex items-center justify-between border-border border-t px-6 py-4">
                            <Button variant="outline" onClick={onClose}>
                                Hủy
                            </Button>
                            <Button
                                disabled={!ready}
                                onClick={() => {
                                    setSubmitted(true);
                                    if (errors.length > 0) {
                                        const messages = [...new Set(errors)];
                                        toast.warning(messages[0], {
                                            id: `${id}-validation`,
                                            description: messages.slice(1).join('\n') || undefined,
                                        });
                                        const field = textError
                                            ? 'text'
                                            : urlError
                                              ? 'url'
                                              : undefined;
                                        const control = field
                                            ? document.getElementById(`${id}-${field}`)
                                            : document
                                                  .getElementById(`${id}-text`)
                                                  ?.closest('[role="tabpanel"]')
                                                  ?.querySelector<HTMLElement>(
                                                      '[aria-invalid="true"]',
                                                  );
                                        control?.focus();
                                        control?.scrollIntoView({
                                            block: 'nearest',
                                            behavior: 'smooth',
                                        });
                                        return;
                                    }
                                    if (
                                        validation.success &&
                                        (validation.data.type === 'text' ||
                                            validation.data.type === 'label')
                                    )
                                        onCommit(validation.data, chosen);
                                }}
                            >
                                {initial ? 'Áp dụng thay đổi' : 'Thêm vào scene'}
                            </Button>
                        </footer>
                    </Tabs>
                </DialogContent>
            </Dialog>
            {choosingImage && (
                <AssetPicker
                    type="IMAGE"
                    onClose={() => setChoosingImage(false)}
                    onChoose={(asset) => {
                        setChosen((current) => ({ ...current, [asset.id]: asset }));
                        appearance({ imageAssetId: asset.id });
                        setChoosingImage(false);
                    }}
                />
            )}
        </>
    );
}
