import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findReadingMemory,
  pruneReadingMemory,
  readReadingMemory,
  removeReadingMemory,
  READING_MEMORY_MAX_ENTRIES,
  READING_MEMORY_STORAGE_KEY,
  saveReadingMemory,
} from '../src/reading-memory/model.ts';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

const entry = (changes = {}) => ({
  spaceSlug: 'frontend', sourcePath: 'spaces/frontend/closure.md', relativePath: 'closure.md',
  route: '/spaces/frontend/closure', kind: 'doc', title: '闭包', description: '词法作用域',
  tags: ['JavaScript'], type: 'note', date: '', order: 0, draft: false, dirParts: [], headings: [], body: '',
  ...changes,
});

const now = new Date('2026-09-19T10:00:00.000Z');

test('saves and reloads a position, hash and update time by source path', () => {
  const storage = memoryStorage();
  const result = saveReadingMemory(storage, entry(), { scrollTop: 480, scrollRatio: 0.42, hash: '#what-is-closure' }, now);
  assert.equal(result.ok, true);
  const loaded = readReadingMemory(storage, { now });
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.memories[0], {
    id: 'spaces/frontend/closure.md', sourcePath: 'spaces/frontend/closure.md', route: '/spaces/frontend/closure',
    spaceSlug: 'frontend', scrollTop: 480, scrollRatio: 0.42, hash: 'what-is-closure', updatedAt: now.toISOString(),
  });
  assert.equal(JSON.parse(storage.getItem(READING_MEMORY_STORAGE_KEY)).version, 1);
});

test('updates one article instead of duplicating it and prefers source path on route changes', () => {
  const storage = memoryStorage();
  saveReadingMemory(storage, entry(), { scrollTop: 100, scrollRatio: 0.1 }, now);
  const moved = entry({ route: '/spaces/web/lexical-closures', spaceSlug: 'web' });
  saveReadingMemory(storage, moved, { scrollTop: 900, scrollRatio: 0.8, hash: 'scope' }, new Date('2026-09-19T11:00:00Z'));
  const loaded = readReadingMemory(storage, { now });
  assert.equal(loaded.memories.length, 1);
  assert.equal(findReadingMemory(loaded.memories, entry()).route, moved.route);
  assert.equal(findReadingMemory(loaded.memories, entry()).scrollTop, 900);
});

test('falls back to route when a source file was renamed and removes by any identity', () => {
  const storage = memoryStorage();
  saveReadingMemory(storage, entry(), { scrollTop: 30, scrollRatio: 0.2 }, now);
  const renamed = entry({ sourcePath: 'spaces/frontend/new-closure.md' });
  assert.equal(findReadingMemory(readReadingMemory(storage, { now }).memories, renamed).route, entry().route);
  assert.equal(removeReadingMemory(storage, entry().route).ok, true);
  assert.equal(readReadingMemory(storage, { now }).memories.length, 0);
});

test('filters malformed rows, expires old rows and explicitly compacts storage', () => {
  const storage = memoryStorage();
  const valid = {
    id: entry().sourcePath, sourcePath: entry().sourcePath, route: entry().route, spaceSlug: 'frontend',
    scrollTop: 12, scrollRatio: 0.2, updatedAt: '2026-09-18T10:00:00.000Z',
  };
  storage.setItem(READING_MEMORY_STORAGE_KEY, JSON.stringify({ version: 1, memories: [
    valid,
    { ...valid, id: 'bad', sourcePath: '../secret.md' },
    { ...valid, id: 'old', sourcePath: 'spaces/frontend/old.md', route: '/spaces/frontend/old', updatedAt: '2025-01-01T00:00:00.000Z' },
  ] }));
  const loaded = readReadingMemory(storage, { now, maxAgeMs: 30 * 24 * 60 * 60 * 1_000 });
  assert.equal(loaded.error, null);
  assert.equal(loaded.memories.length, 1);
  assert.equal(loaded.needsCleanup, true);
  assert.equal(pruneReadingMemory(storage, { now, maxAgeMs: 30 * 24 * 60 * 60 * 1_000 }).ok, true);
  assert.equal(JSON.parse(storage.getItem(READING_MEMORY_STORAGE_KEY)).memories.length, 1);
});

test('bounds the collection and keeps newest positions first', () => {
  const storage = memoryStorage();
  for (let index = 0; index < READING_MEMORY_MAX_ENTRIES + 8; index += 1) {
    const date = new Date(now.getTime() + index * 1_000);
    saveReadingMemory(storage, entry({ sourcePath: `spaces/frontend/doc-${index}.md`, route: `/spaces/frontend/doc-${index}` }), { scrollTop: index, scrollRatio: 0.5 }, date);
  }
  const loaded = readReadingMemory(storage, { now: new Date(now.getTime() + 10_000) });
  assert.equal(loaded.memories.length, READING_MEMORY_MAX_ENTRIES);
  assert.equal(loaded.memories[0].sourcePath, 'spaces/frontend/doc-107.md');
  assert.equal(loaded.needsCleanup, false);
});

test('rejects invalid positions and preserves corrupt storage without reporting success', () => {
  const storage = memoryStorage();
  for (const position of [{ scrollTop: -1, scrollRatio: 0 }, { scrollTop: 1, scrollRatio: 2 }, { scrollTop: Infinity, scrollRatio: 0 }]) {
    assert.equal(saveReadingMemory(storage, entry(), position, now).ok, false);
    assert.equal(storage.getItem(READING_MEMORY_STORAGE_KEY), null);
  }
  for (const raw of ['{broken', 'null', '[]', '{"version":2,"memories":[]}']) {
    storage.setItem(READING_MEMORY_STORAGE_KEY, raw);
    assert.ok(readReadingMemory(storage).error);
    assert.equal(saveReadingMemory(storage, entry(), { scrollTop: 1, scrollRatio: 0.1 }, now).ok, false);
    assert.equal(storage.getItem(READING_MEMORY_STORAGE_KEY), raw);
  }
});

test('handles denied reads and quota failures without losing the previous position', () => {
  const denied = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
  assert.ok(readReadingMemory(denied).error);
  assert.equal(saveReadingMemory(denied, entry(), { scrollTop: 1, scrollRatio: 0.1 }, now).ok, false);
  const storage = memoryStorage();
  saveReadingMemory(storage, entry(), { scrollTop: 10, scrollRatio: 0.2 }, now);
  const quotaExceeded = { ...storage, setItem() { throw new Error('QuotaExceededError'); } };
  const failed = saveReadingMemory(quotaExceeded, entry({ route: '/spaces/frontend/new' }), { scrollTop: 20, scrollRatio: 0.3 }, now);
  assert.equal(failed.ok, false);
  assert.equal(readReadingMemory(storage, { now }).memories[0].scrollTop, 10);
});
