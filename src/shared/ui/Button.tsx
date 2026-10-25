import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { buttonVariants, Button as PrimitiveButton } from './primitives/button';

export type ButtonVariant = Exclude<
    NonNullable<ComponentProps<typeof PrimitiveButton>['variant']>,
    'plain'
>;
type ButtonSize = NonNullable<ComponentProps<typeof PrimitiveButton>['size']>;
interface ButtonStyleOptions {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    className?: string;
}
/** Uses the primitive's variant and size names without translating their meaning. */
export function buttonStyles({
    variant = 'default',
    size = 'default',
    fullWidth = false,
    className,
}: ButtonStyleOptions = {}) {
    return cn(buttonVariants({ variant, size }), fullWidth && 'button-full w-full', className);
}
export interface ButtonProps
    extends Omit<ComponentProps<typeof PrimitiveButton>, 'variant' | 'size'>,
        ButtonStyleOptions {}
export function Button({
    variant = 'default',
    size = 'default',
    fullWidth,
    className,
    ...props
}: ButtonProps) {
    return (
        <PrimitiveButton
            {...props}
            variant={variant}
            size={size}
            className={cn(fullWidth && 'button-full w-full', className)}
        />
    );
}
