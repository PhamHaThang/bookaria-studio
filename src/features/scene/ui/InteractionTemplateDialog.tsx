import {
    AudioLines,
    CircleHelp,
    Eye,
    Link2,
    Move,
    Navigation,
    Scaling,
    Video,
    WandSparkles,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/primitives/field';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group';
import { SearchInput } from '@/shared/ui/SearchInput';
import type { InteractionScope } from '../model/interaction-scope';
import {
    type InteractionTemplateId,
    interactionProblems,
    interactionTemplates,
    templateRule,
    templateUnavailable,
} from '../model/interaction-templates';
import { InteractionTemplateSetup } from './InteractionTemplateSetup';

const templates = [...interactionTemplates.filter((template) => template.id !== 'custom')].sort(
    (a, b) => {
        const order = ['listen', 'reveal', 'toggle', 'quiz', 'video', 'reveal-audio'];
        return (
            (order.includes(a.id) ? order.indexOf(a.id) : 99) -
            (order.includes(b.id) ? order.indexOf(b.id) : 99)
        );
    },
);
const groups = [...new Set(templates.map((template) => template.group))];
const icons = {
    custom: CircleHelp,
    page: Navigation,
    audio: AudioLines,
    reveal: Eye,
    video: Video,
    link: Link2,
    scale: Scaling,
    move: Move,
    animation: WandSparkles,
};

export function InteractionTemplateDialog({
    open,
    scene,
    assets,
    scope,
    disabled,
    onOpenChange,
    onChoose,
    returnFocus,
}: {
    open: boolean;
    scene: Scene;
    assets: Record<string, AssetRef>;
    scope: InteractionScope;
    disabled?: boolean;
    onOpenChange: (open: boolean) => void;
    onChoose: (id: InteractionTemplateId, rule?: InteractionRule, hideTargetId?: string) => void;
    returnFocus: () => void;
}) {
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState('all');
    const [selected, setSelected] = useState<InteractionTemplateId | null>(null);
    const [configured, setConfigured] = useState<InteractionRule | null>(null);
    const [hideTargetId, setHideTargetId] = useState<string>();
    const [submitted, setSubmitted] = useState(false);
    const matches = templates.filter(
        (template) =>
            (group === 'all' || template.group === group) &&
            `${template.title} ${template.description}`
                .toLocaleLowerCase('vi')
                .includes(query.trim().toLocaleLowerCase('vi')),
    );
    const current = templates.find((template) => template.id === selected);
    const reason = current ? templateUnavailable(current.id, scene.objects, scope) : undefined;
    const problems = configured ? interactionProblems(configured, scene) : [];
    const scopeChanged =
        configured?.trigger.type === 'onTap' && hideTargetId === configured.trigger.objectId;
    function close(next: boolean) {
        if (!next) {
            setQuery('');
            setGroup('all');
            setSelected(null);
            setConfigured(null);
            setHideTargetId(undefined);
            setSubmitted(false);
        }
        onOpenChange(next);
    }
    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent
                className="flex max-h-[min(800px,86dvh)] max-w-[min(960px,calc(100vw-48px))] flex-col overflow-hidden p-0"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (!document.querySelector('[role=alertdialog]')) returnFocus();
                }}
            >
                <DialogHeader className="shrink-0 border-border border-b px-6 pt-6 pr-14 pb-4">
                    <DialogTitle>{configured ? current?.title : 'Chọn mẫu tương tác'}</DialogTitle>
                    <DialogDescription className="m-0">
                        {configured
                            ? 'Chọn sự kiện và nội dung. Các bước cần thiết sẽ được tạo sẵn.'
                            : 'Chọn việc bạn muốn người đọc thực hiện, rồi điền thông tin.'}
                    </DialogDescription>
                </DialogHeader>
                {!configured && (
                    <FieldGroup className="shrink-0 flex-row items-center gap-3 px-6 py-4">
                        <Field className="min-w-0 flex-1">
                            <SearchInput
                                aria-label="Tìm mẫu tương tác"
                                placeholder="Tìm mẫu theo tên hoặc mục đích…"
                                value={query}
                                onValueChange={(value) => {
                                    setQuery(value);
                                    setSelected(null);
                                }}
                            />
                        </Field>
                        <Field className="w-56 shrink-0">
                            <FormSelect
                                aria-label="Nhóm mẫu"
                                value={group}
                                options={[
                                    { value: 'all', label: 'Tất cả nhóm' },
                                    ...groups.map((value) => ({ value, label: value })),
                                ]}
                                onValueChange={(value) => {
                                    setGroup(value);
                                    setSelected(null);
                                }}
                            />
                        </Field>
                    </FieldGroup>
                )}
                <section
                    aria-label={configured ? 'Thiết lập mẫu tương tác' : 'Mẫu có sẵn'}
                    data-template-scroll
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6"
                >
                    {configured && current ? (
                        <div className="mx-auto max-w-xl py-5">
                            <InteractionTemplateSetup
                                template={current.id}
                                rule={configured}
                                scene={scene}
                                assets={assets}
                                disabled={!!disabled}
                                hideTargetId={hideTargetId}
                                onHideTarget={setHideTargetId}
                                onChange={setConfigured}
                            />
                            {submitted && (problems.length > 0 || scopeChanged) && (
                                <p role="alert" className="mt-4 text-destructive text-sm">
                                    {scopeChanged
                                        ? 'Đối tượng kích hoạt cần hiển thị để người đọc chạm.'
                                        : problems[0]}
                                </p>
                            )}
                        </div>
                    ) : (
                        <FieldSet className="m-0 min-w-0 border-0 p-0">
                            <FieldLegend className="sr-only">Mẫu tương tác có sẵn</FieldLegend>
                            <RadioGroup
                                aria-label="Mẫu tương tác"
                                value={selected || ''}
                                onValueChange={(value) =>
                                    setSelected(value as InteractionTemplateId)
                                }
                                className="grid-cols-1 gap-3 sm:grid-cols-2"
                            >
                                {matches.map((template) => {
                                    const unavailable = templateUnavailable(
                                        template.id,
                                        scene.objects,
                                        scope,
                                    );
                                    const Icon = icons[template.icon] || Zap;
                                    return (
                                        <FieldLabel
                                            key={template.id}
                                            htmlFor={`interaction-template-${template.id}`}
                                            className={cn(
                                                'flex h-full w-full items-start gap-3 rounded-lg border border-border p-4',
                                                unavailable || disabled
                                                    ? 'cursor-not-allowed'
                                                    : 'cursor-pointer hover:border-primary',
                                                selected === template.id &&
                                                    'border-primary bg-selected',
                                            )}
                                        >
                                            <RadioGroupItem
                                                id={`interaction-template-${template.id}`}
                                                aria-label={template.title}
                                                aria-describedby={`interaction-template-${template.id}-description`}
                                                value={template.id}
                                                disabled={disabled || !!unavailable}
                                                className="mt-1"
                                            />
                                            <span className="flex min-w-0 flex-1 flex-col gap-2">
                                                <span className="flex items-center gap-2">
                                                    <Icon
                                                        className="size-4 shrink-0"
                                                        strokeWidth={1.7}
                                                    />
                                                    <span className="font-medium text-sm">
                                                        {template.title}
                                                    </span>
                                                </span>
                                                <span
                                                    id={`interaction-template-${template.id}-description`}
                                                    className="font-normal text-muted-foreground text-xs leading-5"
                                                >
                                                    {template.description}
                                                    {unavailable && (
                                                        <span className="mt-1 block text-warning-foreground">
                                                            {unavailable}
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                        </FieldLabel>
                                    );
                                })}
                            </RadioGroup>
                            {!matches.length && (
                                <Empty className="min-h-48 border-0">
                                    <EmptyHeader>
                                        <EmptyTitle>Không tìm thấy mẫu phù hợp</EmptyTitle>
                                        <EmptyDescription>
                                            Thử tên khác hoặc đổi nhóm.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </FieldSet>
                    )}
                </section>
                <DialogFooter className="m-0 shrink-0 gap-3 border-border border-t px-6 py-4">
                    <p className="m-0 mr-auto min-w-0 truncate text-muted-foreground text-sm">
                        {current ? current.title : 'Chọn một mẫu để tiếp tục.'}
                    </p>
                    <Button variant="outline" onClick={() => close(false)}>
                        Hủy
                    </Button>
                    {configured && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setConfigured(null);
                                setSubmitted(false);
                                setHideTargetId(undefined);
                            }}
                        >
                            Đổi mẫu
                        </Button>
                    )}
                    <Button
                        disabled={disabled || !current || !!reason}
                        onClick={() => {
                            if (!current || reason || disabled) return;
                            if (!configured) {
                                setConfigured(
                                    templateRule(
                                        current.id,
                                        crypto.randomUUID(),
                                        scene,
                                        assets,
                                        scope,
                                    ),
                                );
                                return;
                            }
                            setSubmitted(true);
                            if (problems.length || scopeChanged) return;
                            const rule = configured;
                            const hidden = rule.actions.some(
                                (action) =>
                                    ((action.type === 'setVisible' && action.value) ||
                                        action.type === 'toggleVisible') &&
                                    action.objectId === hideTargetId,
                            )
                                ? hideTargetId
                                : undefined;
                            close(false);
                            onChoose(current.id, rule, hidden);
                        }}
                    >
                        {configured ? 'Tạo tương tác' : 'Sử dụng mẫu'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
