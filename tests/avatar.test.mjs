import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvatarFallback } from '../src/shared/lib/avatar-fallback.ts';

test('avatar uses first and last initials when no photo is available', () => {
    for (const [name, expected] of [
        ['Nguyễn Minh Anh', 'NA'],
        ['  Đào   Ánh  ', 'ĐÁ'],
        ['An', 'A'],
        ['🌻', '🌻'],
    ]) {
        assert.equal(getAvatarFallback(name).initials, expected, name);
    }
});

test('avatar has no initials when the name is unavailable', () => {
    assert.equal(getAvatarFallback().initials, '');
    assert.equal(getAvatarFallback('  ').initials, '');
});

test('avatar initials remain stable across case, spacing and Unicode variants', () => {
    assert.deepEqual(
        getAvatarFallback('  Đào   Ánh  '),
        getAvatarFallback('đào ánh'.normalize('NFD')),
    );
});
