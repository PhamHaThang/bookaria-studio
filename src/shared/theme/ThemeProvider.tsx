import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import {
    parseThemePreference,
    resolveTheme,
    THEME_STORAGE_KEY,
    type ThemePreference,
} from './preference';

const ThemeContext = createContext<{
    preference: ThemePreference;
    theme: ReturnType<typeof resolveTheme>;
    setPreference: (value: ThemePreference) => void;
} | null>(null);
function readPreference() {
    try {
        return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
        return 'system' as const;
    }
}
function apply(preference: ThemePreference) {
    const theme = resolveTheme(
        preference,
        window.matchMedia('(prefers-color-scheme: dark)').matches,
    );
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (document.documentElement.dataset.theme !== theme)
        document.documentElement.dataset.theme = theme;
    return theme;
}
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, update] = useState<ThemePreference>(readPreference);
    const [theme, setTheme] = useState(() =>
        resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const sync = () => setTheme(apply(preference));
        sync();
        media.addEventListener('change', sync);
        const storage = (event: StorageEvent) => {
            if (event.key === THEME_STORAGE_KEY || event.key === null) update(readPreference());
        };
        window.addEventListener('storage', storage);
        return () => {
            media.removeEventListener('change', sync);
            window.removeEventListener('storage', storage);
        };
    }, [preference]);
    function setPreference(value: ThemePreference) {
        setTheme(apply(value));
        update(value);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, value);
        } catch {
            /* The choice still works for this tab when storage is unavailable. */
        }
    }
    return <ThemeContext value={{ preference, theme, setPreference }}>{children}</ThemeContext>;
}
export function useTheme() {
    const value = useContext(ThemeContext);
    if (!value) throw new Error('ThemeProvider is missing');
    return value;
}
