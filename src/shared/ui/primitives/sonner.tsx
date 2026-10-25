import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react';
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
                success: <CircleCheck className="size-4 text-primary-foreground" />,
                info: <Info className="size-4" />,
                warning: <TriangleAlert className="size-4" />,
                error: <OctagonX className="size-4" />,
                loading: <LoaderCircle className="size-4 motion-safe:animate-spin" />,
            }}
            style={
                {
                    '--normal-bg': 'var(--action-primary)',
                    '--normal-text': 'var(--text-on-primary)',
                    '--normal-border': 'var(--action-primary)',
                    '--border-radius': 'var(--radius-lg)',
                    fontFamily: 'var(--font-body)',
                } as CSSProperties
            }
            toastOptions={{
                closeButtonAriaLabel: 'Đóng thông báo',
                style: {
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--leading-normal)',
                    border: 'none',
                    boxShadow: 'var(--shadow-popover)',
                },
            }}
            {...props}
        />
    );
}
