import assert from 'node:assert/strict';
import test from 'node:test';
import { parseThemePreference, resolveTheme } from '../src/shared/theme/preference.ts';

test('missing, obsolete or malformed stored preferences follow the system', () => {
    for (const value of [null, undefined, '', 'auto', 'DARK', {}, 0]) {
        const preference = parseThemePreference(value);
        assert.equal(preference, 'system');
        assert.equal(resolveTheme(preference, false), 'light');
        assert.equal(resolveTheme(preference, true), 'dark');
    }
});
test('an explicit theme survives a system theme change', () => {
    for (const theme of ['light', 'dark']) {
        assert.equal(parseThemePreference(theme), theme);
        assert.equal(resolveTheme(theme, false), theme);
        assert.equal(resolveTheme(theme, true), theme);
    }
});
