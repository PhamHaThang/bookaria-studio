import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from './primitives/button';

export function ThemeSwitcher({ floating = false }: { floating?: boolean }) {
    const { theme, setPreference } = useTheme();
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const label = nextTheme === 'dark' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng';
    const Icon = nextTheme === 'dark' ? Moon : Sun;
    return (
        <Button
            variant={floating ? 'outline' : 'ghost'}
            size={floating ? 'icon' : 'icon-sm'}
            className={`${floating ? 'size-11 shadow-[var(--shadow-popover)]' : undefined} rounded-[9999px]`}
            aria-label={label}
            title={label}
            aria-pressed={theme === 'dark'}
            onClick={() => setPreference(nextTheme)}
        >
            <Icon aria-hidden="true" />
        </Button>
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
