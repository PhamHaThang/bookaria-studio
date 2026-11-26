import assert from 'node:assert/strict';
import test from 'node:test';
import { getStudioSection } from '../src/app/studio-navigation.ts';

test('studio navigation gives trash and book statistics their own active section', () => {
    assert.equal(getStudioSection('/books/trash'), '/books/trash');
    assert.equal(getStudioSection('/books/trash/'), '/books/trash');
    assert.equal(getStudioSection('/books/example/stats'), '/stats');
    assert.equal(getStudioSection('/books/example/stats/'), '/stats');
    assert.equal(getStudioSection('/stats'), '/stats');
});
test('nested creation and asset routes retain their owning section', () => {
    for (const path of ['/books', '/books/new', '/books/example', '/books/example/edit'])
        assert.equal(getStudioSection(path), '/books');
    for (const path of ['/studio', '/studio/new-book', '/studio/upload'])
        assert.equal(getStudioSection(path), '/studio');
    for (const path of ['/assets', '/assets/upload', '/assets/example'])
        assert.equal(getStudioSection(path), '/assets');
});
test('public, profile and administration routes do not activate Studio', () => {
    for (const path of [
        '/',
        '/library',
        '/profile',
        '/admin/books',
        '/bookshelf',
        '/assets-public',
        '/stats-public',
        '/studio-public',
    ])
        assert.equal(getStudioSection(path), null);
});
