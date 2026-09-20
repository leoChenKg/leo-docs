import type { ContentEntry } from '../types';

/**
 * The position saved for one article. `scrollTop` is useful when reopening in
 * the same viewport, while `scrollRatio` lets the reader recover gracefully
 * when the viewport or rendered content height has changed.
 */
export interface ReadingMemory {
  id: string;
  sourcePath: string;
  route: string;
  spaceSlug: string;
  scrollTop: number;
  scrollRatio: number;
  hash?: string;
  updatedAt: string;
}

export interface ReadingMemoryPosition {
  scrollTop?: number;
  scrollRatio?: number;
  hash?: string;
}

export interface ReadingMemorySnapshot {
  memories: readonly ReadingMemory[];
  error: string | null;
  /** The loaded data can be compacted by an explicit prune or next write. */
  needsCleanup: boolean;
}

export interface ReadingMemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ReadingMemoryMutationResult = ReadingMemorySnapshot & { ok: boolean };

export const READING_MEMORY_STORAGE_KEY = 'leo-learn-reading-memory-v1';
export const READING_MEMORY_MAX_ENTRIES = 100;
export const READING_MEMORY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1_000;

const READ_ERROR = '无法读取阅读记忆，请检查浏览器是否允许此网站使用本地存储。';
const WRITE_ERROR = '阅读位置未能保存，请检查浏览器存储权限或可用空间后重试。';
const CORRUPT_ERROR = '本地阅读记忆数据格式异常，已忽略无效记录。';
const INVALID_MEMORY_ERROR = '这篇文档的阅读位置暂时不能保存。';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, limit: number, required = false): value is string {
  return typeof value === 'string' && value.length <= limit && (!required || value.trim().length > 0);
}

function isSourcePath(value: unknown): value is string {
  return isText(value, 2_048, true) && value.startsWith('spaces/')
    && /\.mdx?$/i.test(value)
    && !/[\\\u0000-\u001f\u007f]/.test(value)
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function isRoute(value: unknown): value is string {
  if (!isText(value, 2_048, true) || !value.startsWith('/spaces/')) return false;
  try {
    const decoded = decodeURIComponent(value);
    return !/[?#\\\s\u0000-\u001f\u007f]/.test(decoded)
      && decoded.slice(1).split('/').every((part) => part !== '' && part !== '.' && part !== '..');
  } catch {
    return false;
  }
}

function isFiniteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizeHash(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isText(value, 1_000)) return undefined;
  const hash = value.startsWith('#') ? value.slice(1) : value;
  if (!hash || /[\s\u0000-\u001f\u007f?#]/.test(hash)) return undefined;
  try {
    decodeURIComponent(hash);
    return hash;
  } catch {
    return undefined;
  }
}

function parseMemory(value: unknown): ReadingMemory | null {
  if (!isRecord(value)
    || !isText(value.id, 2_048, true)
    || !isSourcePath(value.sourcePath)
    || !isRoute(value.route)
    || !isText(value.spaceSlug, 200, true)
    || !/^[\p{Letter}\p{Number}_-]+$/u.test(value.spaceSlug)
    || !isFiniteNumber(value.scrollTop, 0, 100_000_000)
    || !isFiniteNumber(value.scrollRatio, 0, 1)
    || !isText(value.updatedAt, 40, true)
    || !/^\d{4}-\d{2}-\d{2}T/.test(value.updatedAt)
    || !Number.isFinite(Date.parse(value.updatedAt))) return null;

  // Hash is optional; a malformed one is dropped without making the whole
  // reading position unusable.
  const hash = normalizeHash(value.hash);
  return {
    id: value.id,
    sourcePath: value.sourcePath,
    route: value.route,
    spaceSlug: value.spaceSlug,
    scrollTop: value.scrollTop,
    scrollRatio: value.scrollRatio,
    ...(hash ? { hash } : {}),
    updatedAt: new Date(value.updatedAt).toISOString(),
  };
}

function newestFirst(a: ReadingMemory, b: ReadingMemory) {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

function sameIdentity(a: ReadingMemory, b: ReadingMemory) {
  return a.sourcePath === b.sourcePath || a.route === b.route || a.id === b.id;
}

function normalizeMemories(values: readonly unknown[], now: Date, maxEntries: number, maxAgeMs: number): { memories: ReadingMemory[]; needsCleanup: boolean } {
  const parsed: ReadingMemory[] = [];
  let invalid = false;
  for (const value of values) {
    const memory = parseMemory(value);
    if (memory) parsed.push(memory);
    else invalid = true;
  }
  const seen = new Set<string>();
  const deduped = parsed.sort(newestFirst).filter((memory) => {
    // Keep one canonical identity per source path and route. IDs are normally
    // source paths, but old versions may have used a different ID.
    if (seen.has(memory.id) || seen.has(memory.sourcePath) || seen.has(memory.route)) {
      invalid = true;
      return false;
    }
    seen.add(memory.id);
    seen.add(memory.sourcePath);
    seen.add(memory.route);
    return true;
  });
  const cutoff = now.getTime() - maxAgeMs;
  const fresh = deduped.filter((memory) => {
    const keep = Date.parse(memory.updatedAt) >= cutoff;
    if (!keep) invalid = true;
    return keep;
  });
  const limited = fresh.slice(0, maxEntries);
  if (limited.length !== fresh.length) invalid = true;
  return { memories: limited, needsCleanup: invalid || limited.length !== values.length };
}

export interface ReadingMemoryReadOptions {
  now?: Date;
  maxEntries?: number;
  maxAgeMs?: number;
}

export function readReadingMemory(storage: ReadingMemoryStorage, options: ReadingMemoryReadOptions = {}): ReadingMemorySnapshot {
  const now = options.now ?? new Date();
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? READING_MEMORY_MAX_ENTRIES));
  const maxAgeMs = Math.max(0, options.maxAgeMs ?? READING_MEMORY_MAX_AGE_MS);
  let raw: string | null;
  try {
    raw = storage.getItem(READING_MEMORY_STORAGE_KEY);
  } catch {
    return { memories: [], error: READ_ERROR, needsCleanup: false };
  }
  if (raw === null) return { memories: [], error: null, needsCleanup: false };
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.memories)) {
      return { memories: [], error: CORRUPT_ERROR, needsCleanup: false };
    }
    const normalized = normalizeMemories(data.memories, now, maxEntries, maxAgeMs);
    // Invalid individual rows and expired rows are safely ignored. The
    // caller may explicitly prune them; they should not make saving a new
    // position fail when the rest of the collection is usable.
    return { memories: normalized.memories, error: null, needsCleanup: normalized.needsCleanup };
  } catch {
    return { memories: [], error: CORRUPT_ERROR, needsCleanup: false };
  }
}

export function matchesReadingMemory(memory: ReadingMemory, entry: ContentEntry): boolean {
  return Boolean(entry.sourcePath && memory.sourcePath === entry.sourcePath) || memory.route === entry.route;
}

export function findReadingMemory(memories: readonly ReadingMemory[], entry: ContentEntry): ReadingMemory | undefined {
  return memories.find((memory) => memory.sourcePath === entry.sourcePath)
    ?? memories.find((memory) => memory.route === entry.route);
}

function writeMemories(storage: ReadingMemoryStorage, previous: ReadingMemorySnapshot, memories: readonly ReadingMemory[]): ReadingMemoryMutationResult {
  try {
    storage.setItem(READING_MEMORY_STORAGE_KEY, JSON.stringify({ version: 1, memories }));
    return { memories, error: null, needsCleanup: false, ok: true };
  } catch {
    return { memories: previous.memories, error: WRITE_ERROR, needsCleanup: previous.needsCleanup, ok: false };
  }
}

export function saveReadingMemory(storage: ReadingMemoryStorage, entry: ContentEntry, position: ReadingMemoryPosition, now = new Date()): ReadingMemoryMutationResult {
  const current = readReadingMemory(storage, { now });
  if (current.error && !current.needsCleanup) return { ...current, ok: false };
  if (!entry.sourcePath || !isSourcePath(entry.sourcePath) || !isRoute(entry.route)) return { ...current, error: INVALID_MEMORY_ERROR, ok: false };
  const scrollTop = position.scrollTop === undefined ? 0 : position.scrollTop;
  const scrollRatio = position.scrollRatio === undefined ? 0 : position.scrollRatio;
  if (!isFiniteNumber(scrollTop, 0, 100_000_000) || !isFiniteNumber(scrollRatio, 0, 1)) return { ...current, error: INVALID_MEMORY_ERROR, ok: false };
  const hash = normalizeHash(position.hash);
  const memory: ReadingMemory = {
    id: entry.sourcePath,
    sourcePath: entry.sourcePath,
    route: entry.route,
    spaceSlug: entry.spaceSlug,
    scrollTop,
    scrollRatio,
    ...(hash ? { hash } : {}),
    updatedAt: now.toISOString(),
  };
  const remaining = current.memories.filter((item) => !sameIdentity(item, memory));
  const memories = [memory, ...remaining].sort(newestFirst).slice(0, READING_MEMORY_MAX_ENTRIES);
  return writeMemories(storage, current, memories);
}

export function removeReadingMemory(storage: ReadingMemoryStorage, identity: string): ReadingMemoryMutationResult {
  const current = readReadingMemory(storage);
  if (current.error && !current.needsCleanup) return { ...current, ok: false };
  const memories = current.memories.filter((memory) => memory.id !== identity && memory.sourcePath !== identity && memory.route !== identity);
  return writeMemories(storage, current, memories);
}

/** Persist the bounded/age-filtered collection without changing positions. */
export function pruneReadingMemory(storage: ReadingMemoryStorage, options: ReadingMemoryReadOptions = {}): ReadingMemoryMutationResult {
  const current = readReadingMemory(storage, options);
  if (current.error && !current.needsCleanup) return { ...current, ok: false };
  if (!current.needsCleanup) return { ...current, ok: true };
  return writeMemories(storage, current, current.memories);
}
