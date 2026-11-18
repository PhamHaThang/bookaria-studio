import { Check, ChevronDown, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Button as PlainButton } from '@/shared/ui/primitives/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';

const voiceStyles: Record<string, { description: string; color: string }> = {
    baotrang: { description: 'Nữ, trưởng thành, rõ ràng, trung tính', color: '#be185d' },
    giahuy: { description: 'Nam, trẻ, kể chuyện, trầm ấm', color: '#047857' },
    hamy: { description: 'Nữ, trẻ, hoạt hình, biểu cảm', color: '#b45309' },
    huuduc: { description: 'Nam, lớn tuổi, trầm, điềm đạm', color: '#9f1239' },
    kimoanh: { description: 'Nữ, trung niên, ấm áp, truyền cảm', color: '#a21caf' },
    maichi: { description: 'Nữ, trẻ, nhẹ nhàng, thân thiện', color: '#6d28d9' },
    quangminh: { description: 'Nam, trẻ, rõ ràng, dứt khoát', color: '#0e7490' },
    tiendat: { description: 'Nam, trẻ, sôi nổi, năng lượng cao', color: '#1d4ed8' },
};

export function VoicePicker({
    id,
    voices,
    value,
    onValueChange,
    disabled,
}: {
    id: string;
    voices: { id: string; name: string }[];
    value: string;
    onValueChange: (voice: string) => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [playing, setPlaying] = useState('');
    const [error, setError] = useState('');
    const audio = useRef<HTMLAudioElement | null>(null);
    const sampleId = useRef('');
    const bindAudio = useCallback((node: HTMLAudioElement | null) => {
        audio.current = node;
        return () => {
            node?.pause();
            audio.current = null;
        };
    }, []);
    const selected = voices.find((voice) => voice.id === value);

    useEffect(() => {
        if (!open || disabled) audio.current?.pause();
    }, [open, disabled]);

    async function preview(voice: string) {
        const player = audio.current;
        if (!player) return;
        if (sampleId.current === voice && !player.paused) {
            player.pause();
            return;
        }
        player.pause();
        sampleId.current = voice;
        setError('');
        player.src = `${import.meta.env.BASE_URL}audio/voice-samples/${voice}.mp3`;
        try {
            await player.play();
        } catch (cause) {
            if (
                sampleId.current === voice &&
                !(cause instanceof DOMException && cause.name === 'AbortError')
            )
                setError('Không phát được âm mẫu. Hãy bấm nghe lại.');
        }
    }

    return (
        <>
            <Popover open={open && !disabled} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className="w-full justify-between font-normal"
                    >
                        {selected?.name || 'Chọn giọng đọc'}
                        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    collisionPadding={16}
                    aria-label="Chọn giọng đọc"
                    className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-32px)] gap-1 overflow-hidden p-1.5"
                >
                    <div
                        role="radiogroup"
                        aria-label="Giọng đọc có sẵn"
                        className="max-h-100 min-h-0 overflow-y-auto"
                    >
                        {voices.map((voice) => {
                            const style = voiceStyles[voice.id];
                            const active = playing === voice.id;
                            return (
                                <div
                                    key={voice.id}
                                    className="flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted has-focus-visible:bg-muted"
                                    data-selected={voice.id === value}
                                >
                                    <PlainButton
                                        type="button"
                                        variant="plain"
                                        className="group/avatar relative size-10 shrink-0 overflow-hidden rounded-full text-white disabled:opacity-50"
                                        style={{ backgroundColor: style?.color || '#475569' }}
                                        aria-label={`${active ? 'Dừng' : 'Nghe'} mẫu giọng ${voice.name}`}
                                        aria-pressed={active}
                                        disabled={!style || disabled}
                                        onClick={() => void preview(voice.id)}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-0 flex items-center justify-center font-semibold text-sm group-hover/avatar:opacity-0"
                                            style={{ opacity: active ? 0 : undefined }}
                                        >
                                            {voice.name
                                                .split(' ')
                                                .map((word) => word[0])
                                                .slice(0, 2)
                                                .join('')}
                                        </span>
                                        {style && (
                                            <img
                                                src={`${import.meta.env.BASE_URL}images/voice-avatars/${voice.id}.jpg`}
                                                alt=""
                                                aria-hidden="true"
                                                width={40}
                                                height={40}
                                                loading="lazy"
                                                className="absolute inset-0 size-full object-cover"
                                                onError={(event) => {
                                                    event.currentTarget.hidden = true;
                                                }}
                                            />
                                        )}
                                        <span
                                            aria-hidden="true"
                                            className={`absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover/avatar:opacity-100 [@media(hover:none)]:opacity-100 ${active ? 'opacity-100' : ''}`}
                                        >
                                            {active ? (
                                                <Pause className="size-4 fill-current" />
                                            ) : (
                                                <Play className="size-4 fill-current" />
                                            )}
                                        </span>
                                    </PlainButton>
                                    <PlainButton
                                        type="button"
                                        variant="plain"
                                        role="radio"
                                        aria-checked={value === voice.id}
                                        aria-label={voice.name}
                                        disabled={disabled}
                                        onKeyDown={(event) => {
                                            if (
                                                !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                                                    event.key,
                                                )
                                            )
                                                return;
                                            event.preventDefault();
                                            const choices = Array.from(
                                                event.currentTarget
                                                    .closest('[role="radiogroup"]')
                                                    ?.querySelectorAll<HTMLButtonElement>(
                                                        '[role="radio"]',
                                                    ) ?? [],
                                            );
                                            const index = choices.indexOf(event.currentTarget);
                                            const next =
                                                event.key === 'Home'
                                                    ? 0
                                                    : event.key === 'End'
                                                      ? choices.length - 1
                                                      : (index +
                                                            (event.key === 'ArrowDown' ? 1 : -1) +
                                                            choices.length) %
                                                        choices.length;
                                            choices[next]?.focus();
                                            onValueChange(voices[next].id);
                                            audio.current?.pause();
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left"
                                        onClick={() => {
                                            audio.current?.pause();
                                            onValueChange(voice.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium text-sm">
                                                {voice.name}
                                            </span>
                                            {style && (
                                                <span
                                                    className="block truncate text-muted-foreground text-xs"
                                                    title={style.description}
                                                >
                                                    {style.description}
                                                </span>
                                            )}
                                        </span>
                                        {value === voice.id && (
                                            <Check className="size-4 shrink-0" aria-hidden="true" />
                                        )}
                                    </PlainButton>
                                </div>
                            );
                        })}
                    </div>
                    {error && (
                        <p role="status" className="m-0 px-2 py-1 text-danger-foreground text-xs">
                            {error}
                        </p>
                    )}
                    <p className="m-0 shrink-0 border-border border-t px-2 py-2 text-muted-foreground text-xs">
                        Bấm avatar để nghe mẫu, bấm tên để chọn giọng.
                    </p>
                </PopoverContent>
            </Popover>
            <audio
                hidden
                preload="none"
                ref={bindAudio}
                aria-label="Âm mẫu giọng đọc"
                onPlay={() => setPlaying(sampleId.current)}
                onPause={() => setPlaying('')}
                onEnded={() => setPlaying('')}
            >
                <track kind="captions" />
            </audio>
        </>
    );
}
