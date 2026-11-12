import { CaseSensitive, Hash, Plus, ToggleLeft, Trash2 } from 'lucide-react';
import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Page } from '@/shared/contracts/dto.schema';
import { type WorkflowVariable, WorkflowVariablesSchema } from '@/shared/contracts/scene.schema';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { SearchInput } from '@/shared/ui/SearchInput';
import { memoryTypeNames, memoryUses, memoryValue } from '../model/memory-variables';

const kinds = {
    number: { icon: Hash, label: 'Số' },
    boolean: { icon: ToggleLeft, label: 'Đúng / Sai' },
    string: { icon: CaseSensitive, label: 'Văn bản' },
};
type SelectMemory = (definition: WorkflowVariable) => void;
export type MemoryVariablesPanelHandle = {
    create: (select?: SelectMemory) => void;
    showList: () => void;
    confirmLeave: (action: () => void) => void;
};
export function MemoryVariablesPanel({
    definitions,
    pages,
    disabled,
    loading,
    error,
    onRetry,
    onChange,
    onDirtyChange,
    ref,
}: {
    definitions: WorkflowVariable[];
    pages: Pick<Page, 'id' | 'title' | 'scene'>[];
    disabled: boolean;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    onChange: (definitions: WorkflowVariable[]) => void;
    onDirtyChange: (dirty: boolean) => void;
    ref?: Ref<MemoryVariablesPanelHandle>;
}) {
    const [query, setQuery] = useState('');
    const [draft, setDraft] = useState<WorkflowVariable | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [showUses, setShowUses] = useState(false);
    const [pending, setPending] = useState<(() => void) | null>(null);
    const select = useRef<SelectMemory | undefined>(undefined);
    const nameInput = useRef<HTMLInputElement>(null);
    const original = draft && definitions.find((item) => item.key === draft.key);
    const dirty =
        !!draft &&
        (original
            ? JSON.stringify(original) !== JSON.stringify(draft)
            : !!draft.name || draft.type !== 'boolean' || draft.initialValue !== false);
    const busy = disabled || loading || !!error;
    const usages = draft ? memoryUses(draft.key, pages) : [];
    useLayoutEffect(() => {
        onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    const draftKey = draft?.key;
    useEffect(() => {
        if (draftKey && !loading) nameInput.current?.focus({ preventScroll: true });
    }, [draftKey, loading]);
    function guard(action: () => void) {
        if (dirty) setPending(() => action);
        else action();
    }
    function clear() {
        setDraft(null);
        setFormError(null);
        setShowUses(false);
        select.current = undefined;
    }
    function create(callback?: SelectMemory) {
        if (disabled || definitions.length >= 200) return;
        guard(() => {
            select.current = callback;
            setDraft({
                key: `state_${crypto.randomUUID().replaceAll('-', '')}`,
                name: '',
                type: 'boolean',
                initialValue: false,
            });
            setFormError(null);
            setShowUses(false);
        });
    }
    useImperativeHandle(ref, () => ({ create, showList: () => guard(clear), confirmLeave: guard }));
    function save() {
        if (!draft || busy) return;
        const next = original
            ? definitions.map((item) => (item.key === draft.key ? draft : item))
            : [...definitions, draft];
        const checked = WorkflowVariablesSchema.safeParse(next);
        if (!checked.success) {
            setFormError(
                draft.name.trim()
                    ? checked.error.issues[0]?.message || 'Kiểm tra lại thông tin.'
                    : 'Vui lòng nhập tên thông tin.',
            );
            nameInput.current?.focus({ preventScroll: true });
            return;
        }
        const saved = checked.data.find((item) => item.key === draft.key);
        if (!saved) return;
        try {
            onChange(checked.data);
            const callback = select.current;
            clear();
            callback?.(saved);
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Chưa lưu được thông tin.');
        }
    }
    function remove(definition: WorkflowVariable) {
        if (busy || memoryUses(definition.key, pages).length) return;
        try {
            onChange(definitions.filter((item) => item.key !== definition.key));
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Chưa xóa được thông tin.');
        }
    }
    const matches = definitions.filter((item) =>
        item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')),
    );
    return (
        <section
            aria-label="Thông tin ghi nhớ của sách"
            className="flex min-h-0 flex-1 flex-col gap-3 py-4"
        >
            <div className="flex shrink-0 items-center justify-between gap-2 px-3">
                <h2 className="m-0 font-semibold text-sm">Thông tin ghi nhớ</h2>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Thêm thông tin ghi nhớ"
                    title="Thêm thông tin"
                    disabled={busy || definitions.length >= 200}
                    onClick={() => create()}
                >
                    <Plus />
                </Button>
            </div>
            {loading && (
                <p role="status" className="m-0 shrink-0 px-4 text-muted-foreground text-xs">
                    Đang kiểm tra thông tin trên các trang…
                </p>
            )}
            {error && (
                <div className="flex shrink-0 flex-col gap-2 px-3">
                    <Feedback error={error} className="m-0" />
                    <Button variant="outline" size="sm" disabled={loading} onClick={onRetry}>
                        Thử lại
                    </Button>
                </div>
            )}
            <div className="shrink-0 px-3">
                <SearchInput
                    aria-label="Tìm thông tin ghi nhớ"
                    placeholder="Tìm theo tên…"
                    value={query}
                    onValueChange={setQuery}
                />
            </div>
            <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-1">
                {matches.map((definition) => {
                    const { icon: Icon, label } = kinds[definition.type];
                    const used = memoryUses(definition.key, pages).length;
                    return (
                        <li key={definition.key} className="flex shrink-0 items-center gap-1">
                            <Button
                                variant="ghost"
                                className="h-auto min-w-0 flex-1 justify-start gap-3 px-3 py-2.5 text-left"
                                disabled={disabled}
                                aria-label={`Sửa thông tin “${definition.name}”`}
                                title={`${definition.name} — ${label} — Ban đầu: ${memoryValue(definition.initialValue)}`}
                                onClick={() => {
                                    select.current = undefined;
                                    setDraft(definition);
                                    setFormError(null);
                                    setShowUses(false);
                                }}
                            >
                                <Icon data-icon="inline-start" />
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="truncate">{definition.name}</span>
                                    <span className="truncate font-normal text-muted-foreground text-xs">
                                        {label} — Ban đầu: {memoryValue(definition.initialValue)}
                                    </span>
                                </span>
                            </Button>
                            <Button
                                variant="destructive-ghost"
                                size="icon-xs"
                                aria-label={`Xóa ${definition.name}`}
                                title={
                                    used
                                        ? `Đang dùng trong ${used} bước. Sửa các bước đó trước khi xóa.`
                                        : `Xóa ${definition.name}`
                                }
                                disabled={busy || used > 0}
                                onClick={() => remove(definition)}
                            >
                                <Trash2 />
                            </Button>
                        </li>
                    );
                })}
                {!matches.length && !loading && !error && (
                    <li className="px-3 py-3 text-muted-foreground text-xs leading-5">
                        {definitions.length
                            ? 'Không tìm thấy thông tin phù hợp.'
                            : 'Chưa có thông tin ghi nhớ. Nhấn + để thêm.'}
                    </li>
                )}
            </ul>
            {draft && (
                <Dialog
                    open
                    onOpenChange={(open) => {
                        if (!open && !disabled) guard(clear);
                    }}
                >
                    <DialogContent className="flex max-h-[calc(100dvh-64px)] w-[min(520px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden p-0">
                        <DialogHeader className="shrink-0 border-border border-b px-6 py-5 pr-12">
                            <DialogTitle className="m-0">
                                {original ? 'Sửa thông tin ghi nhớ' : 'Thêm thông tin ghi nhớ'}
                            </DialogTitle>
                            <DialogDescription className="m-0">
                                Đặt tên, chọn loại và giá trị ban đầu dùng trong sách.
                            </DialogDescription>
                            {loading && (
                                <p role="status" className="m-0 text-muted-foreground text-xs">
                                    Đang kiểm tra các bước sử dụng…
                                </p>
                            )}
                            {error && (
                                <>
                                    <Feedback error={error} className="m-0" />
                                    <Button variant="outline" size="sm" onClick={onRetry}>
                                        Thử lại
                                    </Button>
                                </>
                            )}
                        </DialogHeader>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                            <FieldGroup className="gap-4">
                                <Field data-invalid={!!formError}>
                                    <FieldLabel htmlFor="memory-name">Tên thông tin</FieldLabel>
                                    <Input
                                        ref={nameInput}
                                        id="memory-name"
                                        maxLength={100}
                                        value={draft.name}
                                        aria-invalid={!!formError}
                                        disabled={disabled}
                                        placeholder="Ví dụ: Đã tìm thấy"
                                        onChange={(event) => {
                                            setDraft({ ...draft, name: event.target.value });
                                            setFormError(null);
                                        }}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="memory-type">Loại thông tin</FieldLabel>
                                    <FormSelect
                                        id="memory-type"
                                        value={draft.type}
                                        disabled={busy || usages.length > 0}
                                        options={Object.entries(memoryTypeNames).map(
                                            ([value, label]) => ({ value, label }),
                                        )}
                                        onValueChange={(type) => {
                                            const common = { key: draft.key, name: draft.name };
                                            setDraft(
                                                type === 'number'
                                                    ? { ...common, type, initialValue: 0 }
                                                    : type === 'string'
                                                      ? { ...common, type, initialValue: '' }
                                                      : {
                                                            ...common,
                                                            type: 'boolean',
                                                            initialValue: false,
                                                        },
                                            );
                                            setFormError(null);
                                        }}
                                    />
                                    {usages.length > 0 && (
                                        <FieldDescription>
                                            Đang được sử dụng. Giữ nguyên loại để các luồng hoạt
                                            động đúng.
                                        </FieldDescription>
                                    )}
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="memory-initial">Ban đầu là</FieldLabel>
                                    {draft.type === 'boolean' ? (
                                        <FormSelect
                                            id="memory-initial"
                                            value={String(draft.initialValue)}
                                            disabled={disabled}
                                            options={[
                                                { value: 'false', label: 'Sai' },
                                                { value: 'true', label: 'Đúng' },
                                            ]}
                                            onValueChange={(value) =>
                                                setDraft({
                                                    ...draft,
                                                    initialValue: value === 'true',
                                                })
                                            }
                                        />
                                    ) : (
                                        <Input
                                            id="memory-initial"
                                            type={draft.type === 'number' ? 'number' : 'text'}
                                            maxLength={draft.type === 'string' ? 500 : undefined}
                                            disabled={disabled}
                                            value={
                                                typeof draft.initialValue === 'number' &&
                                                !Number.isFinite(draft.initialValue)
                                                    ? ''
                                                    : String(draft.initialValue)
                                            }
                                            onChange={(event) =>
                                                setDraft(
                                                    draft.type === 'number'
                                                        ? {
                                                              ...draft,
                                                              initialValue:
                                                                  event.target.value === ''
                                                                      ? Number.NaN
                                                                      : Number(event.target.value),
                                                          }
                                                        : {
                                                              ...draft,
                                                              initialValue: event.target.value,
                                                          },
                                                )
                                            }
                                        />
                                    )}
                                    <FieldDescription>
                                        Giá trị khi bắt đầu hoặc đặt lại tiến trình.
                                    </FieldDescription>
                                </Field>
                                {formError && <Feedback error={formError} className="m-0" />}
                            </FieldGroup>
                            {original && (
                                <div className="mt-4 flex flex-col gap-2">
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="justify-start px-0"
                                        aria-expanded={showUses}
                                        onClick={() => setShowUses(!showUses)}
                                    >
                                        {usages.length} nơi sử dụng
                                    </Button>
                                    {showUses && (
                                        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-muted-foreground text-xs leading-5">
                                            {usages.map((usage) => (
                                                <li
                                                    key={`${usage.pageId}:${usage.ruleId}:${usage.index}`}
                                                >
                                                    {usage.pageName} / {usage.ruleName} /{' '}
                                                    {usage.index < 0
                                                        ? 'Sự kiện bắt đầu'
                                                        : `Bước ${usage.index + 1}`}
                                                </li>
                                            ))}
                                            {!usages.length && <li>Chưa dùng trong luồng nào.</li>}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                        <DialogFooter className="mt-0 shrink-0 px-6 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => guard(clear)}
                            >
                                Hủy
                            </Button>
                            <Button size="sm" disabled={busy} onClick={save}>
                                {original ? 'Lưu thông tin' : 'Thêm thông tin'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {pending && (
                <ConfirmationDialog
                    title="Thông tin ghi nhớ chưa lưu"
                    description="Bạn có muốn bỏ phần đang nhập để tiếp tục?"
                    busy={false}
                    onClose={() => setPending(null)}
                >
                    <div className="mt-5 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setPending(null)}>
                            Tiếp tục sửa
                        </Button>
                        <Button
                            onClick={() => {
                                const action = pending;
                                setPending(null);
                                clear();
                                action();
                            }}
                        >
                            Bỏ thay đổi
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
