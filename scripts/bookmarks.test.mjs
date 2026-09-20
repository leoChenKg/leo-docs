import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBookmark,
  BOOKMARKS_STORAGE_KEY,
  readBookmarks,
  removeBookmark,
  resolveBookmarks,
} from '../src/bookmarks/model.ts';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

const entry = (changes = {}) => ({
  spaceSlug: 'frontend', sourcePath: 'spaces/frontend/closure.md', relativePath: 'closure.md',
  route: '/spaces/frontend/closure', kind: 'doc', title: '闭包', description: '词法作用域',
  tags: ['JavaScript'], type: 'note', date: '', order: 0, draft: false, dirParts: [], headings: [], body: '',
  ...changes,
});
const space = (entries = [entry()], changes = {}) => ({
  slug: 'frontend', title: '前端工程', description: '', icon: '', order: 0, hidden: false, entries, ...changes,
});
const firstSaved = new Date('2026-09-18T10:00:00.000Z');

test('persists bookmarks, rereads after reload and prevents duplicate saves without changing savedAt', () => {
  const storage = memoryStorage();
  assert.equal(addBookmark(storage, entry(), space(), firstSaved).ok, true);
  const initial = readBookmarks(storage);
  assert.equal(initial.error, null);
  assert.equal(initial.bookmarks[0].title, '闭包');
  assert.equal(initial.bookmarks[0].id, entry().sourcePath);
  assert.equal(initial.bookmarks[0].savedAt, firstSaved.toISOString());
  assert.equal(JSON.parse(storage.getItem(BOOKMARKS_STORAGE_KEY)).version, 1);
  const addedAgain = addBookmark(storage, entry({ route: '/spaces/frontend/functions' }), space(), new Date());
  assert.deepEqual(addedAgain.bookmarks, initial.bookmarks);
});

test('each mutation reads latest persisted data, removes only its target and removal is idempotent', () => {
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const second = entry({ sourcePath: 'spaces/frontend/scope.md', route: '/spaces/frontend/scope', title: '作用域' });
  addBookmark(storage, second, space(), new Date('2026-09-19T10:00:00Z'));
  assert.equal(readBookmarks(storage).bookmarks.length, 2);
  const removed = removeBookmark(storage, entry().sourcePath);
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.bookmarks.map((item) => item.title), ['作用域']);
  assert.deepEqual(readBookmarks(storage).bookmarks, removed.bookmarks);
  assert.equal(removeBookmark(storage, 'already-deleted').ok, true);
});

test('resolves source path before stale route and displays current metadata after slug/title changes', () => {
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const moved = entry({ route: '/spaces/web/lexical-closures', spaceSlug: 'web', title: '闭包详解', description: '新版说明' });
  const reused = entry({ sourcePath: 'spaces/frontend/other.md', title: '另一篇文章' });
  const result = resolveBookmarks(readBookmarks(storage).bookmarks, [space([reused]), space([moved], { slug: 'web', title: 'Web 工程' })]);
  assert.equal(result[0].entry, moved);
  assert.equal(result[0].space.title, 'Web 工程');
  assert.equal(result[0].entry.description, '新版说明');
  assert.equal(result[0].bookmark.title, '闭包');
});

test('falls back to route for moved files and retains deleted, hidden or draft bookmarks as unavailable', () => {
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const bookmarks = readBookmarks(storage).bookmarks;
  const movedFile = entry({ sourcePath: 'spaces/frontend/functions/closure.mdx' });
  assert.equal(resolveBookmarks(bookmarks, [space([movedFile])])[0].entry, movedFile);
  for (const spaces of [[], [space([], { hidden: true })], [space([entry({ draft: true })])], [space([entry({ hidden: true })])]]) {
    const result = resolveBookmarks(bookmarks, spaces);
    assert.equal(result.length, 1);
    assert.equal(result[0].entry, undefined);
    assert.equal(result[0].bookmark.title, '闭包');
  }
});

test('sorts newest first without modifying the supplied bookmark array', () => {
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const second = entry({ sourcePath: 'spaces/frontend/async.md', route: '/spaces/frontend/async' });
  addBookmark(storage, second, space(), new Date('2026-09-19T10:00:00Z'));
  const oldestFirst = [...readBookmarks(storage).bookmarks].reverse();
  assert.equal(resolveBookmarks(oldestFirst, [space()])[0].bookmark.sourcePath, second.sourcePath);
  assert.equal(oldestFirst[0].sourcePath, entry().sourcePath);
});

test('preserves corrupt or unsupported data and refuses to report success', () => {
  for (const raw of ['{broken', 'null', '[]', '{"version":2,"bookmarks":[]}', '{"version":1,"bookmarks":{}}']) {
    const storage = memoryStorage();
    storage.setItem(BOOKMARKS_STORAGE_KEY, raw);
    assert.ok(readBookmarks(storage).error);
    assert.equal(addBookmark(storage, entry(), space()).ok, false);
    assert.equal(removeBookmark(storage, 'id').ok, false);
    assert.equal(storage.getItem(BOOKMARKS_STORAGE_KEY), raw);
  }
});

test('handles denied reads and quota failures without crashing or losing the previous collection', () => {
  const denied = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.ok(readBookmarks(denied).error);
  assert.equal(addBookmark(denied, entry(), space()).ok, false);
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const quotaExceeded = { ...storage, setItem() { throw new Error('QuotaExceededError'); } };
  const failedRemove = removeBookmark(quotaExceeded, entry().sourcePath);
  assert.equal(failedRemove.ok, false);
  assert.equal(failedRemove.bookmarks.length, 1);
  const failedAdd = addBookmark(quotaExceeded, entry({ sourcePath: 'spaces/frontend/new.md', route: '/spaces/frontend/new' }), space());
  assert.equal(failedAdd.ok, false);
  assert.equal(readBookmarks(storage).bookmarks.length, 1);
});

test('validates stored data, filters unsafe routes and deduplicates without retaining unknown fields', () => {
  const storage = memoryStorage();
  addBookmark(storage, entry(), space(), firstSaved);
  const valid = readBookmarks(storage).bookmarks[0];
  const unsafe = ['javascript:alert(1)', '//example.com', '/spaces/../../evil', '/spaces/frontend/%2e%2e/evil', '/spaces/frontend\\evil'];
  storage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify({ version: 1, bookmarks: [
    null, {}, ...unsafe.map((route, index) => ({ ...valid, id: String(index), route })),
    { ...valid, tags: [false] }, { ...valid, savedAt: 'invalid' },
    { ...valid, sourcePath: '../secret.md' },
    { ...valid, unknown: '<script>bad()</script>', tags: ['JavaScript', 'JavaScript'] },
    { ...valid, id: 'duplicate', savedAt: '2026-09-17T10:00:00Z' },
  ] }));
  const result = readBookmarks(storage);
  assert.equal(result.error, null);
  assert.equal(result.bookmarks.length, 1);
  assert.deepEqual(result.bookmarks[0].tags, ['JavaScript']);
  assert.equal('unknown' in result.bookmarks[0], false);
});

test('rejects drafts, hidden spaces/entries and generated directory entries with no source file', () => {
  for (const [doc, currentSpace] of [
    [entry({ draft: true }), space()], [entry({ hidden: true }), space()],
    [entry(), space([], { hidden: true })], [entry({ sourcePath: '' }), space()],
  ]) {
    const storage = memoryStorage();
    assert.equal(addBookmark(storage, doc, currentSpace).ok, false);
    assert.equal(storage.getItem(BOOKMARKS_STORAGE_KEY), null);
  }
});
