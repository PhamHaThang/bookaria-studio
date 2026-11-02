export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'bookaria.theme';
export function parseThemePreference(value: unknown): ThemePreference {
    return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean) {
    return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
