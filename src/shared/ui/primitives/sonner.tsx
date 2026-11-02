import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** shadcn/Radix Sonner composition, using Bookaria's existing theme tokens. */
export function Toaster(props: ToasterProps) {
    return (
        <Sonner
            theme="dark"
            position="bottom-right"
            duration={4000}
            closeButton
            visibleToasts={3}
            offset={{ bottom: 24, right: 24 }}
            containerAriaLabel="Thông báo"
            customAriaLabel="Thông báo"
            icons={{
                success: <CircleCheck className="size-4 text-on-dark" />,
                info: <Info className="size-4" />,
                warning: <TriangleAlert className="size-4" />,
                error: <CircleX className="size-4 text-on-dark-danger" />,
                close: <X className="size-4" />,
                loading: <LoaderCircle className="size-4 motion-safe:animate-spin" />,
            }}
            style={
                {
                    '--normal-bg': 'var(--surface-dark)',
                    '--normal-text': 'var(--text-on-dark)',
                    '--normal-border': 'color-mix(in srgb, var(--text-on-dark) 12%, transparent)',
                    '--border-radius': 'var(--radius-lg)',
                    fontFamily: 'var(--font-body)',
                } as CSSProperties
            }
            toastOptions={{
                closeButtonAriaLabel: 'Đóng thông báo',
                classNames: {
                    toast: 'gap-3! rounded-xl!',
                    description: 'text-on-dark/65!',
                    closeButton:
                        'left-auto! right-3! top-1/2! size-7! -translate-y-1/2! transform-none! rounded-md! border-0! bg-transparent! text-on-dark/65! shadow-none! hover:bg-on-dark/10! hover:text-on-dark! focus-visible:outline-2! focus-visible:outline-on-dark! focus-visible:outline-offset-2!',
                    actionButton:
                        'h-7! rounded-lg! border! border-on-dark/15! bg-transparent! text-on-dark! hover:bg-on-dark/10!',
                },
                style: {
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--leading-normal)',
                    minHeight: 64,
                    padding: '16px 52px 16px 16px',
                    border: '1px solid var(--normal-border)',
                    boxShadow: 'var(--shadow-popover)',
                },
            }}
            {...props}
        />
    );
}
