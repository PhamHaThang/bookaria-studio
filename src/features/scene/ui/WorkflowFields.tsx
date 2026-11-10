import { Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import type { Action, Scene, Trigger, WorkflowCondition } from '@/shared/contracts/scene.schema';
import { BufferedInput, BufferedTextarea } from '@/shared/ui/BufferedTextInput';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Button } from '@/shared/ui/primitives/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { objectName } from '../model/interaction-templates';
import { targetObjects, triggerLabels } from '../model/interactions';
import {
    type MemoryValue,
    memoryDefinitions,
    memoryOperations,
    memorySummary,
    memoryValue,
    selectMemory,
} from '../model/memory-variables';
import { InteractionTextInput } from './InteractionTextInput';
import { useMemory } from './MemoryContext';

type Value = boolean | number | string;
function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
    return (
        <Field>
            <FieldLabel>{label}</FieldLabel>
            {children}
            {hint && <FieldDescription>{hint}</FieldDescription>}
        </Field>
    );
}
function StateKey({
    value,
    scene,
    disabled,
    onChange,
    label = 'Thông tin cần ghi nhớ',
}: {
    value: string;
    scene: Scene;
    disabled: boolean;
    onChange: (definition: import('@/shared/contracts/scene.schema').WorkflowVariable) => void;
    label?: string;
}) {
    const memory = useMemory();
    const definitions = memoryDefinitions(memory.definitions, [scene]);
    return (
        <FieldGroup className="gap-2">
            <FormSelect
                aria-label={label}
                value={value}
                disabled={disabled}
                options={definitions.map((item) => ({ value: item.key, label: item.name }))}
                onValueChange={(key) => {
                    const definition = definitions.find((item) => item.key === key);
                    if (definition) onChange(definition);
                }}
            />
            <Button
                variant="outline"
                size="sm"
                disabled={disabled || memory.disabled}
                onClick={() => memory.manage(onChange)}
            >
                <Plus data-icon="inline-start" />
                Tạo thông tin
            </Button>
        </FieldGroup>
    );
}
function ValueField({
    value,
    disabled,
    onChange,
    numeric = false,
    lockType = false,
}: {
    value: Value;
    disabled: boolean;
    onChange: (value: Value) => void;
    numeric?: boolean;
    lockType?: boolean;
}) {
    return (
        <FieldGroup className="gap-3">
            {!numeric && !lockType && (
                <FormSelect
                    aria-label="Loại giá trị"
                    value={typeof value}
                    disabled={disabled}
                    options={[
                        { value: 'number', label: 'Số / điểm' },
                        { value: 'boolean', label: 'Đúng / Sai' },
                        { value: 'string', label: 'Nội dung chữ' },
                    ]}
                    onValueChange={(type) =>
                        onChange(type === 'number' ? 0 : type === 'boolean' ? true : '')
                    }
                />
            )}
            {typeof value === 'boolean' ? (
                <FormSelect
                    aria-label="Giá trị ghi nhớ"
                    value={String(value)}
                    disabled={disabled}
                    options={[
                        { value: 'true', label: 'Đúng' },
                        { value: 'false', label: 'Sai' },
                    ]}
                    onValueChange={(next) => onChange(next === 'true')}
                />
            ) : typeof value === 'string' ? (
                <InteractionTextInput value={value} disabled={disabled} onValueChange={onChange} />
            ) : (
                <Input
                    aria-label="Giá trị ghi nhớ"
                    type={typeof value === 'number' ? 'number' : 'text'}
                    value={
                        typeof value === 'number' && !Number.isFinite(value) ? '' : String(value)
                    }
                    disabled={disabled}
                    onChange={(event) =>
                        onChange(
                            typeof value === 'number'
                                ? event.target.value === ''
                                    ? Number.NaN
                                    : Number(event.target.value)
                                : event.target.value,
                        )
                    }
                />
            )}
        </FieldGroup>
    );
}
const questions = (scene: Scene) =>
    scene.interactions.flatMap((rule) =>
        rule.actions.flatMap((action) => (action.type === 'askQuestion' ? [action.question] : [])),
    );
export function WorkflowTriggerFields({
    trigger,
    scene,
    assets,
    disabled,
    onChange,
}: {
    trigger: Trigger;
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onChange: (trigger: Trigger) => void;
}) {
    const choose = (type: string) => {
        if (type === 'onTap' || type === 'onAnimationEnd')
            onChange({ type, objectId: targetObjects(scene.objects, type)[0]?.id || '' });
        else if (type === 'onAnswer')
            onChange({ type, questionId: questions(scene)[0]?.questionId || '', answer: 'any' });
        else
            onChange({
                type: type as 'onPageEnter' | 'onPageLeave' | 'onMarkerFound' | 'onMarkerLost',
            });
    };
    return (
        <FieldGroup className="gap-5">
            <Row label="Bắt đầu khi">
                <FormSelect
                    aria-label="Bắt đầu khi"
                    value={trigger.type}
                    options={Object.entries(triggerLabels).map(([value, label]) => ({
                        value,
                        label,
                    }))}
                    disabled={disabled}
                    onValueChange={choose}
                />
            </Row>
            {'objectId' in trigger && (
                <Row
                    label={
                        trigger.type === 'onTap'
                            ? 'Người đọc chạm vào'
                            : 'Mô hình kết thúc hoạt ảnh'
                    }
                >
                    <FormSelect
                        aria-label="Đối tượng kích hoạt"
                        value={trigger.objectId}
                        disabled={disabled}
                        options={[
                            { value: '', label: 'Chọn đối tượng' },
                            ...targetObjects(scene.objects, trigger.type).map((object) => ({
                                value: object.id,
                                label: objectName(object),
                            })),
                        ]}
                        onValueChange={(objectId) => onChange({ ...trigger, objectId })}
                    />
                </Row>
            )}
            {trigger.type === 'onAnimationEnd' && (
                <Row
                    label="Tên hoạt ảnh"
                    hint="Chọn hoạt ảnh cần theo dõi. Hoạt ảnh lặp liên tục không có sự kiện kết thúc."
                >
                    <FormSelect
                        aria-label="Hoạt ảnh kết thúc"
                        value={trigger.clip || ''}
                        disabled={disabled}
                        options={[
                            { value: '', label: 'Mọi hoạt ảnh kết thúc' },
                            ...Array.from(
                                new Set([
                                    ...scene.objects.flatMap((object) =>
                                        object.id === trigger.objectId && object.type === 'model'
                                            ? assets[object.assetId]?.meta.animations || []
                                            : [],
                                    ),
                                    ...(trigger.clip ? [trigger.clip] : []),
                                ]),
                            ).map((clip) => ({ value: clip, label: clip })),
                        ]}
                        onValueChange={(clip) => onChange({ ...trigger, clip: clip || undefined })}
                    />
                </Row>
            )}
            {trigger.type === 'onAnswer' && (
                <>
                    <Row
                        label="Câu hỏi"
                        hint={
                            trigger.questionId &&
                            !questions(scene).some(
                                (question) => question.questionId === trigger.questionId,
                            )
                                ? 'Câu hỏi không còn trên trang. Hãy chọn lại.'
                                : undefined
                        }
                    >
                        <FormSelect
                            aria-label="Câu hỏi kích hoạt"
                            value={
                                questions(scene).some(
                                    (question) => question.questionId === trigger.questionId,
                                )
                                    ? trigger.questionId
                                    : ''
                            }
                            disabled={disabled}
                            options={[
                                { value: '', label: 'Chọn câu hỏi trong trang' },
                                ...questions(scene).map((question) => ({
                                    value: question.questionId,
                                    label: question.title,
                                })),
                            ]}
                            onValueChange={(questionId) => onChange({ ...trigger, questionId })}
                        />
                    </Row>
                    <Row label="Kết quả trả lời">
                        <FormSelect
                            aria-label="Kết quả trả lời"
                            value={trigger.answer}
                            disabled={disabled}
                            options={[
                                { value: 'any', label: 'Mọi câu trả lời' },
                                { value: 'correct', label: 'Trả lời đúng' },
                                { value: 'incorrect', label: 'Trả lời sai' },
                            ]}
                            onValueChange={(answer) =>
                                onChange({
                                    ...trigger,
                                    answer: answer as 'any' | 'correct' | 'incorrect',
                                })
                            }
                        />
                    </Row>
                </>
            )}
            {(trigger.type === 'onMarkerFound' || trigger.type === 'onMarkerLost') && (
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Chạy khi quét sách in. Trong chạy thử, nút Chạy mô phỏng sự kiện này.
                </p>
            )}
        </FieldGroup>
    );
}
export function WorkflowActionFields({
    action,
    scene,
    pages,
    disabled,
    onChange,
}: {
    action: Action;
    scene: Scene;
    pages: BookDetail['pages'];
    disabled: boolean;
    onChange: (action: Action) => void;
}) {
    const id = useId();
    const memory = useMemory();
    const definitions = memoryDefinitions(memory.definitions, [scene]);
    const objectOptions = scene.objects.map((object) => ({
        value: object.id,
        label: objectName(object),
    }));
    if (action.type === 'condition') {
        const test = action.test;
        const patch = (next: WorkflowCondition) => onChange({ ...action, test: next });
        return (
            <FieldGroup className="gap-5">
                <Row label="Kiểm tra điều gì?">
                    <FormSelect
                        aria-label="Loại điều kiện"
                        value={test.type}
                        disabled={disabled}
                        options={[
                            { value: 'variable', label: 'Điểm số / thông tin ghi nhớ' },
                            { value: 'answer', label: 'Kết quả câu hỏi' },
                            { value: 'interactionCount', label: 'Số lần chạm đối tượng' },
                            { value: 'visible', label: 'Đối tượng đang hiện / ẩn' },
                        ]}
                        onValueChange={(type) =>
                            patch(
                                type === 'answer'
                                    ? {
                                          type,
                                          questionId: questions(scene)[0]?.questionId || '',
                                          result: 'correct',
                                      }
                                    : type === 'interactionCount'
                                      ? { type, objectId: scene.objects[0]?.id || '', min: 1 }
                                      : type === 'visible'
                                        ? {
                                              type,
                                              objectId: scene.objects[0]?.id || '',
                                              value: true,
                                          }
                                        : {
                                              type: 'variable',
                                              key: 'score',
                                              operator: 'gte',
                                              value: 1,
                                          },
                            )
                        }
                    />
                </Row>
                {test.type === 'variable' && (
                    <>
                        <Row label="Thông tin cần kiểm tra">
                            <StateKey
                                value={test.key}
                                scene={scene}
                                disabled={disabled}
                                label="Thông tin cần kiểm tra"
                                onChange={(definition) =>
                                    patch({
                                        ...test,
                                        key: definition.key,
                                        operator: definition.type === 'number' ? 'gte' : 'eq',
                                        value:
                                            definition.type === 'number'
                                                ? 1
                                                : definition.type === 'boolean'
                                                  ? true
                                                  : '',
                                    })
                                }
                            />
                        </Row>
                        {typeof test.value !== 'boolean' && (
                            <Row label="So sánh">
                                <FormSelect
                                    aria-label="Phép so sánh"
                                    value={test.operator}
                                    disabled={disabled}
                                    options={[
                                        { value: 'eq', label: 'Bằng' },
                                        { value: 'ne', label: 'Khác' },
                                        ...(typeof test.value === 'number'
                                            ? [
                                                  { value: 'gte', label: 'Ít nhất' },
                                                  { value: 'gt', label: 'Lớn hơn' },
                                                  { value: 'lte', label: 'Không quá' },
                                                  { value: 'lt', label: 'Nhỏ hơn' },
                                              ]
                                            : []),
                                    ]}
                                    onValueChange={(operator) =>
                                        patch({
                                            ...test,
                                            operator: operator as typeof test.operator,
                                            value: ['gt', 'gte', 'lt', 'lte'].includes(operator)
                                                ? typeof test.value === 'number'
                                                    ? test.value
                                                    : 1
                                                : test.value,
                                        })
                                    }
                                />
                            </Row>
                        )}
                        <Row
                            label={
                                typeof test.value === 'boolean'
                                    ? test.operator === 'ne'
                                        ? 'Không phải trạng thái'
                                        : 'Trạng thái cần có'
                                    : 'Giá trị cần đạt'
                            }
                        >
                            <ValueField
                                value={test.value}
                                lockType
                                numeric={['gt', 'gte', 'lt', 'lte'].includes(test.operator)}
                                disabled={disabled}
                                onChange={(value) => patch({ ...test, value })}
                            />
                        </Row>
                    </>
                )}
                {test.type === 'answer' && (
                    <>
                        <Row
                            label="Câu hỏi"
                            hint={
                                test.questionId &&
                                !questions(scene).some(
                                    (question) => question.questionId === test.questionId,
                                )
                                    ? 'Câu hỏi không còn trên trang. Hãy chọn lại.'
                                    : 'Đặt bước hiển thị câu hỏi trước điều kiện để kiểm tra câu trả lời trong lượt chạy này.'
                            }
                        >
                            <FormSelect
                                aria-label="Câu hỏi cần kiểm tra"
                                value={
                                    questions(scene).some(
                                        (question) => question.questionId === test.questionId,
                                    )
                                        ? test.questionId
                                        : ''
                                }
                                disabled={disabled}
                                options={[
                                    { value: '', label: 'Chọn câu hỏi' },
                                    ...questions(scene).map((question) => ({
                                        value: question.questionId,
                                        label: question.title,
                                    })),
                                ]}
                                onValueChange={(questionId) => patch({ ...test, questionId })}
                            />
                        </Row>
                        <Row label="Kết quả cần có">
                            <FormSelect
                                aria-label="Kết quả điều kiện"
                                value={test.result}
                                disabled={disabled}
                                options={[
                                    { value: 'correct', label: 'Trả lời đúng' },
                                    { value: 'incorrect', label: 'Trả lời sai' },
                                ]}
                                onValueChange={(result) =>
                                    patch({ ...test, result: result as 'correct' | 'incorrect' })
                                }
                            />
                        </Row>
                    </>
                )}
                {'objectId' in test && (
                    <Row label="Đối tượng">
                        <FormSelect
                            aria-label="Đối tượng cần kiểm tra"
                            value={test.objectId}
                            disabled={disabled}
                            options={[{ value: '', label: 'Chọn đối tượng' }, ...objectOptions]}
                            onValueChange={(objectId) => patch({ ...test, objectId })}
                        />
                    </Row>
                )}
                {test.type === 'interactionCount' && (
                    <Row label="Đã chạm ít nhất">
                        <Input
                            aria-label="Số lần chạm tối thiểu"
                            type="number"
                            min={1}
                            value={Number.isFinite(test.min) ? test.min : ''}
                            disabled={disabled}
                            onChange={(event) =>
                                patch({
                                    ...test,
                                    min:
                                        event.target.value === ''
                                            ? Number.NaN
                                            : Number(event.target.value),
                                })
                            }
                        />
                    </Row>
                )}
                {test.type === 'visible' && (
                    <Row label="Trạng thái">
                        <FormSelect
                            aria-label="Trạng thái hiển thị cần có"
                            value={String(test.value)}
                            disabled={disabled}
                            options={[
                                { value: 'true', label: 'Đang hiển thị' },
                                { value: 'false', label: 'Đang ẩn' },
                            ]}
                            onValueChange={(value) => patch({ ...test, value: value === 'true' })}
                        />
                    </Row>
                )}
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Kết quả đúng đi theo cổng Đúng; kết quả còn lại đi theo cổng Sai. Thông tin chưa
                    có được coi là 0, Sai hoặc chữ rỗng.
                </p>
            </FieldGroup>
        );
    }
    if (action.type === 'setState') {
        const definition = definitions.find((item) => item.key === action.key);
        const type = definition?.type || typeof action.value;
        const initialValue =
            definition?.initialValue ?? (type === 'number' ? 0 : type === 'boolean' ? false : '');
        const currentValue = memory.currentValues?.[action.key] ?? initialValue;
        const isDecrease = action.operation === 'increment' && Number(action.value) < 0;
        const operation =
            action.operation === 'increment'
                ? isDecrease
                    ? 'decrease'
                    : 'increase'
                : action.operation;
        const options =
            type === 'number'
                ? [
                      { value: 'increase', label: 'Tăng thêm' },
                      { value: 'decrease', label: 'Giảm bớt' },
                      { value: 'set', label: 'Đặt thành' },
                  ]
                : memoryOperations(definition);
        return (
            <FieldGroup className="gap-5">
                <Row label="Ghi nhớ điều gì?">
                    <StateKey
                        value={action.key}
                        scene={scene}
                        disabled={disabled}
                        onChange={(definition) => onChange(selectMemory(action, definition))}
                    />
                </Row>
                <Row
                    label="Giá trị hiện tại"
                    hint={
                        memory.currentValues
                            ? 'Kết quả của lần chạy thử gần nhất.'
                            : 'Giá trị ban đầu, chưa chạy thử.'
                    }
                >
                    <Input
                        aria-label="Giá trị hiện tại"
                        disabled
                        value={memoryValue(currentValue)}
                    />
                </Row>
                <Row label="Thay đổi thế nào?">
                    <FormSelect
                        aria-label="Cách cập nhật ghi nhớ"
                        value={operation}
                        disabled={disabled}
                        options={options}
                        onValueChange={(next) =>
                            onChange({
                                ...action,
                                operation:
                                    next === 'increase' || next === 'decrease'
                                        ? 'increment'
                                        : (next as 'set' | 'toggle'),
                                value:
                                    next === 'increase'
                                        ? Math.abs(Number(action.value)) || 1
                                        : next === 'decrease'
                                          ? -(Math.abs(Number(action.value)) || 1)
                                          : type === 'boolean'
                                            ? true
                                            : action.value,
                            })
                        }
                    />
                </Row>
                {action.operation !== 'toggle' && (
                    <Row
                        label={
                            type === 'number'
                                ? action.operation === 'increment'
                                    ? isDecrease
                                        ? 'Giảm bao nhiêu?'
                                        : 'Tăng bao nhiêu?'
                                    : 'Đặt thành bao nhiêu?'
                                : type === 'boolean'
                                  ? 'Trạng thái'
                                  : 'Nội dung cần ghi nhớ'
                        }
                    >
                        <ValueField
                            value={
                                action.operation === 'increment'
                                    ? Math.abs(Number(action.value))
                                    : action.value
                            }
                            lockType
                            numeric={type === 'number'}
                            disabled={disabled}
                            onChange={(value: MemoryValue) =>
                                onChange({
                                    ...action,
                                    value:
                                        action.operation === 'increment'
                                            ? (isDecrease ? -1 : 1) * Math.abs(Number(value))
                                            : value,
                                })
                            }
                        />
                    </Row>
                )}
                <p role="status" className="m-0 text-sm">
                    {memorySummary(action, definitions)}
                </p>
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Thông tin dùng chung giữa các trang. Chạy thử có tiến trình riêng và có thể đặt
                    lại.
                </p>
            </FieldGroup>
        );
    }
    if (action.type === 'askQuestion') {
        const question = action.question;
        const patch = (change: Partial<typeof question>) =>
            onChange({ ...action, question: { ...question, ...change } });
        return (
            <FieldGroup className="gap-5">
                <Field>
                    <FieldLabel htmlFor={`${id}-question`}>Nội dung câu hỏi</FieldLabel>
                    <BufferedTextarea
                        id={`${id}-question`}
                        aria-label="Nội dung câu hỏi"
                        value={question.title}
                        disabled={disabled}
                        maxLength={500}
                        onValueChange={(title) => patch({ title })}
                    />
                </Field>
                {question.choices.map((choice, index) => (
                    <Field key={choice.id}>
                        <FieldLabel htmlFor={`${id}-${choice.id}`}>Đáp án {index + 1}</FieldLabel>
                        <div className="flex items-center gap-2">
                            <BufferedInput
                                id={`${id}-${choice.id}`}
                                className="mt-0 min-w-0 flex-1"
                                value={choice.text}
                                disabled={disabled}
                                maxLength={200}
                                onValueChange={(text) =>
                                    patch({
                                        choices: question.choices.map((item) =>
                                            item.id === choice.id ? { ...item, text } : item,
                                        ),
                                    })
                                }
                            />
                            <Button
                                variant="destructive-ghost"
                                size="icon-sm"
                                aria-label={`Xóa đáp án ${index + 1}`}
                                disabled={disabled || question.choices.length <= 2}
                                onClick={() =>
                                    patch({
                                        choices: question.choices.filter(
                                            (item) => item.id !== choice.id,
                                        ),
                                        correctChoiceId:
                                            choice.id === question.correctChoiceId
                                                ? question.choices.find(
                                                      (item) => item.id !== choice.id,
                                                  )?.id || ''
                                                : question.correctChoiceId,
                                    })
                                }
                            >
                                <Trash2 />
                            </Button>
                        </div>
                    </Field>
                ))}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || question.choices.length >= 6}
                    onClick={() =>
                        patch({
                            choices: [
                                ...question.choices,
                                {
                                    id: `choice-${crypto.randomUUID().slice(0, 8)}`,
                                    text: 'Đáp án mới',
                                },
                            ],
                        })
                    }
                >
                    <Plus data-icon="inline-start" />
                    Thêm đáp án
                </Button>
                <Row label="Đáp án đúng">
                    <FormSelect
                        aria-label="Đáp án đúng"
                        value={question.correctChoiceId}
                        disabled={disabled}
                        options={question.choices.map((choice, index) => ({
                            value: choice.id,
                            label: `${index + 1}. ${choice.text || 'Chưa nhập đáp án'}`,
                        }))}
                        onValueChange={(correctChoiceId) => patch({ correctChoiceId })}
                    />
                </Row>
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Bước này chờ người đọc trả lời. Nối thêm điều kiện Kết quả câu hỏi để tạo nhánh
                    Đúng / Sai.
                </p>
            </FieldGroup>
        );
    }
    if (action.type === 'navigate')
        return (
            <FieldGroup className="gap-5">
                <Row label="Đi đến đâu?">
                    <FormSelect
                        aria-label="Đích điều hướng"
                        value={action.navigation.target}
                        disabled={disabled}
                        options={[
                            { value: 'next', label: 'Trang tiếp theo' },
                            { value: 'previous', label: 'Trang trước' },
                            { value: 'page', label: 'Một trang cụ thể' },
                            { value: 'end', label: 'Kết thúc trải nghiệm' },
                        ]}
                        onValueChange={(target) =>
                            onChange({
                                ...action,
                                navigation: {
                                    ...action.navigation,
                                    target: target as typeof action.navigation.target,
                                    pageId: target === 'page' ? pages[0]?.id : undefined,
                                },
                            })
                        }
                    />
                </Row>
                {action.navigation.target === 'page' && (
                    <Row label="Trang đích">
                        <FormSelect
                            aria-label="Trang đích"
                            value={action.navigation.pageId || ''}
                            disabled={disabled}
                            options={[
                                { value: '', label: 'Chọn trang' },
                                ...pages.map((page) => ({
                                    value: page.id,
                                    label: page.title || `Trang ${page.orderIndex + 1}`,
                                })),
                            ]}
                            onValueChange={(pageId) =>
                                onChange({
                                    ...action,
                                    navigation: { ...action.navigation, pageId },
                                })
                            }
                        />
                    </Row>
                )}
                {action.navigation.target === 'end' && (
                    <Row label="Lời kết">
                        <BufferedTextarea
                            aria-label="Lời kết trải nghiệm"
                            value={action.navigation.message || ''}
                            disabled={disabled}
                            placeholder="Bạn đã hoàn thành chuyến khám phá!"
                            maxLength={500}
                            onValueChange={(message) =>
                                onChange({
                                    ...action,
                                    navigation: { ...action.navigation, message },
                                })
                            }
                        />
                    </Row>
                )}
                <p className="m-0 text-muted-foreground text-xs leading-5">
                    Điều hướng kết thúc nhánh hiện tại. Khi quét AR, chuyển trang sẽ hướng dẫn người
                    đọc quét trang đích.
                </p>
            </FieldGroup>
        );
    return null;
}
