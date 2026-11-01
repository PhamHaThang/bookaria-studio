import { Check, Circle, Download, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Button as StatusButton } from '@/shared/ui/primitives/button';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import { Spinner } from '@/shared/ui/primitives/spinner';

export function EditorSaveStatus({
    dirty,
    saving,
    autosaving,
    conflict,
    uncertain,
    error,
    validationMessage,
    disabled,
    backupDisabled,
    onCheck,
    onDownload,
    onReload,
}: {
    dirty: boolean;
    saving: boolean;
    autosaving: boolean;
    conflict: boolean;
    uncertain: boolean;
    error: string | null;
    validationMessage?: string | null;
    disabled: boolean;
    backupDisabled?: boolean;
    onCheck: () => void;
    onDownload?: () => void;
    onReload: () => void;
}) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const issue = uncertain ? 'uncertain' : conflict ? 'conflict' : error ? 'error' : null;
    const label = uncertain
        ? 'Chưa xác nhận lưu'
        : conflict
          ? 'Có phiên bản mới'
          : error
            ? 'Kiểm tra lưu sách'
            : validationMessage
              ? 'Kiểm tra thông số'
              : saving
                ? autosaving
                    ? 'Đang tự lưu…'
                    : 'Đang lưu…'
                : dirty
                  ? 'Chưa lưu thay đổi'
                  : 'Đã lưu sách';
    const title = uncertain
        ? 'Chưa xác nhận được kết quả lưu'
        : conflict
          ? 'Sách đã thay đổi trên máy chủ'
          : error
            ? 'Chưa đồng bộ được sách'
            : label;
    const description = uncertain
        ? 'Yêu cầu có thể đã được máy chủ nhận. Kiểm tra kết quả trước khi lưu lại. Bản đang sửa vẫn được giữ trên máy.'
        : conflict
          ? onDownload
              ? 'Bản đang sửa vẫn được giữ. Tải bản sao trước khi thay toàn bộ bản nháp bằng nội dung mới nhất trên máy chủ.'
              : 'Bản đang sửa vẫn được giữ. Chỉ tải nội dung mới nhất khi bạn muốn thay toàn bộ bản nháp bằng bản trên máy chủ.'
          : validationMessage ||
            (dirty
                ? 'Bản đang sửa được giữ trên máy. Sách tự lưu sau 5 giây ngừng thao tác trong Thiết kế. Bạn cũng có thể bấm Lưu sách hoặc Ctrl S.'
                : 'Nội dung sách đã được lưu lên máy chủ. Tự lưu tạm dừng khi xem trước hoặc đang mở hộp thoại.');
    useEffect(() => {
        if (!issue) {
            toast.dismiss(id);
            return;
        }
        const options = {
            id,
            duration: 6000,
            action: { label: 'Xử lý', onClick: () => setOpen(true) },
        };
        if (issue === 'error') toast.error(error, options);
        else toast.warning(title, { ...options, description: 'Bản đang sửa vẫn được giữ.' });
    }, [issue, title, error, id]);
    useEffect(
        () => () => {
            toast.dismiss(id);
        },
        [id],
    );
    return (
        <div className="w-32 shrink-0 max-[1280px]:w-8" data-editor-save-status>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <StatusButton
                        variant="plain"
                        aria-label={`Trạng thái lưu sách: ${label}`}
                        className={cn(
                            'inline-flex h-10 w-full! min-w-0 items-center justify-end gap-1.5 rounded-md px-0! text-muted-foreground text-xs hover:text-primary',
                            (uncertain || conflict) && 'text-warning-foreground',
                            ((!uncertain && !conflict && error) || validationMessage) &&
                                'text-destructive',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className="flex shrink-0 items-center [&_svg]:size-3.5"
                        >
                            {saving ? (
                                <Spinner />
                            ) : issue || validationMessage ? (
                                <TriangleAlert />
                            ) : dirty ? (
                                <Circle className="size-2! fill-current" />
                            ) : (
                                <Check />
                            )}
                        </span>
                        <span className="truncate max-[1280px]:sr-only">{label}</span>
                        <span role="status" className="sr-only">
                            {label}
                        </span>
                    </StatusButton>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    sideOffset={10}
                    collisionPadding={16}
                    aria-labelledby={`${id}-title`}
                    aria-describedby={`${id}-description`}
                    className="w-88 max-w-[calc(100vw-32px)] gap-4 p-4"
                >
                    <PopoverHeader className="gap-2">
                        <PopoverTitle id={`${id}-title`} className="m-0 text-sm leading-6">
                            {title}
                        </PopoverTitle>
                        <PopoverDescription id={`${id}-description`} className="m-0 leading-6">
                            {description}
                        </PopoverDescription>
                    </PopoverHeader>
                    {error && (
                        <p role="alert" className="m-0 text-destructive text-sm">
                            {error}
                        </p>
                    )}
                    {issue && (
                        <div className="flex flex-col gap-2">
                            <Button
                                size="sm"
                                disabled={disabled || saving}
                                aria-busy={saving}
                                onClick={onCheck}
                            >
                                {saving ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <RefreshCw data-icon="inline-start" />
                                )}
                                {uncertain ? 'Kiểm tra kết quả lưu' : 'Kiểm tra lại'}
                            </Button>
                            {onDownload && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={backupDisabled || saving}
                                    onClick={onDownload}
                                >
                                    <Download data-icon="inline-start" />
                                    Tải bản đang sửa
                                </Button>
                            )}
                            {conflict && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled || saving}
                                    onClick={() => {
                                        setOpen(false);
                                        onReload();
                                    }}
                                >
                                    Tải nội dung mới nhất
                                </Button>
                            )}
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
