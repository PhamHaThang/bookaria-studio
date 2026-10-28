import { CirclePlay, Mic, Music2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Button as IconButton } from '@/shared/ui/primitives/button';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';

export function PageAudioField({
    background,
    file,
    currentName,
    currentUrl,
    hasCurrent,
    loopControl,
    onFile,
    onRemove,
    onReset,
}: {
    background: boolean;
    file?: File;
    currentName?: string;
    currentUrl?: string;
    hasCurrent: boolean;
    loopControl?: ReactNode;
    onFile: (file: File) => void;
    onRemove: () => void;
    onReset: () => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [localUrl, setLocalUrl] = useState<string>();
    useEffect(() => {
        if (!file) {
            setLocalUrl(undefined);
            return;
        }
        const url = URL.createObjectURL(file);
        setLocalUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    const label = background ? 'âm thanh nền' : 'lời thuyết minh';
    const Icon = background ? Music2 : Mic;
    const url = file ? localUrl : currentUrl;
    const name =
        file?.name || currentName || (hasCurrent ? 'Âm thanh hiện tại' : 'Chọn tệp MP3/WAV');
    return (
        <Field className="min-w-0 gap-2" data-page-audio={background ? 'background' : 'narration'}>
            <div className="flex h-7 min-h-7 items-center justify-between gap-3">
                <FieldLabel className="m-0 flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    {background ? 'Âm thanh nền' : 'Lời thuyết minh'}
                </FieldLabel>
                {loopControl}
            </div>
            <div className="flex h-10 min-w-0 items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 min-w-0 flex-1 justify-start"
                    aria-label={`Tải ${label} từ máy`}
                    title={name}
                    onClick={() => input.current?.click()}
                >
                    <Upload data-icon="inline-start" />
                    <span className="min-w-0 truncate text-left">{name}</span>
                </Button>
                <IconButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Giữ ${label} hiện tại`}
                    title="Giữ tệp hiện tại"
                    disabled={!file || !hasCurrent}
                    onClick={onReset}
                >
                    <RotateCcw />
                </IconButton>
                <IconButton
                    type="button"
                    variant="destructive-ghost"
                    size="icon-sm"
                    aria-label={`Bỏ ${label}`}
                    title="Xóa âm thanh"
                    disabled={!file && !hasCurrent}
                    onClick={onRemove}
                >
                    <Trash2 />
                </IconButton>
            </div>
            <div className="flex h-9 min-h-9 items-center">
                {url ? (
                    <audio
                        key={url}
                        controls
                        preload="none"
                        src={url}
                        aria-label={`Nghe thử ${label}`}
                        className="my-0! h-9 w-full min-w-0"
                    >
                        <track kind="captions" />
                    </audio>
                ) : (
                    <span className="flex items-center gap-2 text-muted-foreground text-xs">
                        <CirclePlay className="size-4" aria-hidden="true" />
                        Chưa có tệp để nghe thử
                    </span>
                )}
            </div>
            <Input
                ref={input}
                type="file"
                hidden
                className="hidden"
                accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/wave"
                aria-label={`Chọn tệp ${label}`}
                onChange={(event) => {
                    const selected = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (selected) onFile(selected);
                }}
            />
        </Field>
    );
}
