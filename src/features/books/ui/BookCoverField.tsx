import { ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { Button as IconButton } from '@/shared/ui/primitives/button';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { imageUploadRequest } from '../../assets/model/image';

export function BookCoverField({
    file,
    disabled,
    onChange,
}: {
    file: File | null;
    disabled: boolean;
    onChange: (file: File | null) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return (
        <Field className="gap-2" data-disabled={disabled}>
            <FieldLabel htmlFor="new-book-cover" className="m-0 flex items-center gap-2">
                Ảnh bìa
                <span className="font-normal text-muted-foreground text-xs">Không bắt buộc</span>
            </FieldLabel>
            <div className="flex items-center gap-4">
                <IconButton
                    type="button"
                    variant="plain"
                    className="h-28 w-21 shrink-0 overflow-hidden rounded-lg border border-border p-0"
                    disabled={disabled}
                    aria-label="Chọn ảnh bìa sách"
                    onClick={() => input.current?.click()}
                >
                    <BookCoverImage
                        url={preview}
                        alt={file ? 'Ảnh bìa đã chọn' : 'Bìa mặc định'}
                        loading="eager"
                    />
                </IconButton>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
                    <FieldDescription className="m-0 text-xs">
                        {file ? (
                            <span className="block max-w-full truncate" title={file.name}>
                                {file.name}
                            </span>
                        ) : (
                            'Chưa chọn ảnh: dùng bìa mặc định.'
                        )}
                    </FieldDescription>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => input.current?.click()}
                        >
                            <ImagePlus data-icon="inline-start" />
                            {file ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
                        </Button>
                        {file && (
                            <IconButton
                                type="button"
                                variant="destructive-ghost"
                                size="icon-sm"
                                aria-label="Gỡ ảnh bìa"
                                disabled={disabled}
                                onClick={() => onChange(null)}
                            >
                                <Trash2 />
                            </IconButton>
                        )}
                    </div>
                    <FieldDescription className="m-0 text-xs">
                        JPG, PNG hoặc WebP · Tối đa 10 MB.
                    </FieldDescription>
                </div>
            </div>
            <Input
                id="new-book-cover"
                ref={input}
                type="file"
                className="hidden"
                tabIndex={-1}
                disabled={disabled}
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                    const next = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (!next) return;
                    try {
                        if (
                            next.type &&
                            !['image/jpeg', 'image/png', 'image/webp'].includes(next.type)
                        )
                            throw new Error('Hãy chọn ảnh JPG, PNG hoặc WebP.');
                        imageUploadRequest(next, 'ASSET');
                        onChange(next);
                    } catch (cause) {
                        toast.error(errorMessage(cause));
                    }
                }}
            />
        </Field>
    );
}
