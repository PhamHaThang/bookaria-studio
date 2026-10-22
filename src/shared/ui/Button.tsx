import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonStyleOptions {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    className?: string;
}
export function buttonStyles({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className,
}: ButtonStyleOptions = {}) {
    return cn(
        'button compact',
        variant,
        size === 'sm' && 'button-sm',
        fullWidth && 'button-full',
        className,
    );
}
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
    loading?: boolean;
}
export function Button({
    variant,
    size,
    fullWidth,
    className,
    loading = false,
    disabled,
    children,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            type={type}
            className={buttonStyles({ variant, size, fullWidth, className })}
            disabled={disabled || loading}
            aria-busy={loading || props['aria-busy']}
        >
            {loading && <LoaderCircle className="button-spinner" size={18} aria-hidden="true" />}
            {children}
        </button>
    );
}
