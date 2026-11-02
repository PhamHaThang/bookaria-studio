import { cn } from '@/shared/lib/cn';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Spin } from './primitives/spin';

export function ThemeSwitcher({ floating = false }: { floating?: boolean }) {
    const { theme, setPreference } = useTheme();
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const label = nextTheme === 'dark' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng';
    return (
        <Spin
            variant={floating ? 'outline' : 'ghost'}
            size={floating ? 'icon' : 'icon-sm'}
            className={cn('rounded-[9999px]', floating && 'size-11 shadow-[var(--shadow-popover)]')}
            aria-label={label}
            title={label}
            toggled={theme === 'dark'}
            onClick={() => setPreference(nextTheme)}
        />
    );
}

export function FloatingThemeSwitcher() {
    return (
        <div
            data-slot="floating-theme-switcher"
            className="fixed right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-30"
        >
            <ThemeSwitcher floating />
        </div>
    );
}
