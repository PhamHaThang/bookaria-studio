import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { buttonVariants, Button as PrimitiveButton } from './primitives/button';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonStyleOptions {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    className?: string;
}
const variants = {
    primary: 'default',
    secondary: 'secondary',
    ghost: 'outline',
    danger: 'destructive',
} as const;
export function buttonStyles({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className,
}: ButtonStyleOptions = {}) {
    return cn(
        buttonVariants({ variant: variants[variant], size: size === 'sm' ? 'sm' : 'default' }),
        fullWidth && 'button-full w-full',
        className,
    );
}
export interface ButtonProps
    extends Omit<ComponentProps<typeof PrimitiveButton>, 'variant' | 'size'>,
        ButtonStyleOptions {}
export function Button({
    variant = 'primary',
    size = 'md',
    fullWidth,
    className,
    ...props
}: ButtonProps) {
    return (
        <PrimitiveButton
            {...props}
            variant={variants[variant]}
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(fullWidth && 'button-full w-full', className)}
        />
    );
}
