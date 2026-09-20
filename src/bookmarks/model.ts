import type { ContentEntry, Space } from '../types';

export interface Bookmark {
  id: string;
  sourcePath: string;
  route: string;
  spaceSlug: string;
  spaceTitle: string;
  title: string;
  description: string;
  tags: string[];
  savedAt: string;
}

export interface ResolvedBookmark {
  bookmark: Bookmark;
  entry?: ContentEntry;
  space?: Space;
}

export const BOOKMARKS_STORAGE_KEY = 'leo-learn-bookmarks-v1';

export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BookmarkSnapshot {
  bookmarks: readonly Bookmark[];
  error: string | null;
}

export type BookmarkMutationResult = BookmarkSnapshot & { ok: boolean };

const READ_ERROR = '无法读取本地收藏，请检查浏览器是否允许此网站使用本地存储。';
const WRITE_ERROR = '收藏未能保存，请检查浏览器存储权限或可用空间后重试。';
const CORRUPT_ERROR = '本地收藏数据格式异常，已保留原始数据；请修复或清除此网站的收藏存储后重试。';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, limit: number, required = false): value is string {
  return typeof value === 'string' && value.length <= limit && (!required || value.trim().length > 0);
}

function isSourcePath(value: unknown): value is string {
  return isText(value, 2_048, true) && value.startsWith('spaces/') && /\.mdx?$/i.test(value)
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

function parseBookmark(value: unknown): Bookmark | null {
  if (!isRecord(value)
    || !isText(value.id, 2_048, true)
    || !isSourcePath(value.sourcePath)
    || !isRoute(value.route)
    || !isText(value.spaceSlug, 200, true)
    || !/^[\p{Letter}\p{Number}_-]+$/u.test(value.spaceSlug)
    || !isText(value.spaceTitle, 1_000, true)
    || !isText(value.title, 2_000, true)
    || !isText(value.description, 20_000)
    || !Array.isArray(value.tags)
    || value.tags.length > 100
    || !value.tags.every((tag) => isText(tag, 500, true))
    || !isText(value.savedAt, 40, true)
    || !/^\d{4}-\d{2}-\d{2}T/.test(value.savedAt)
    || !Number.isFinite(Date.parse(value.savedAt))) return null;

  // Copy only the schema fields. Stored content is rendered by React as text.
  return {
    id: value.id,
    sourcePath: value.sourcePath,
    route: value.route,
    spaceSlug: value.spaceSlug,
    spaceTitle: value.spaceTitle,
    title: value.title,
    description: value.description,
    tags: [...new Set(value.tags as string[])],
    savedAt: new Date(value.savedAt).toISOString(),
  };
}

function newestFirst(a: Bookmark, b: Bookmark) {
  return b.savedAt.localeCompare(a.savedAt) || a.id.localeCompare(b.id);
}

function normalizeBookmarks(values: readonly unknown[]): Bookmark[] {
  const sorted = values.map(parseBookmark).filter((value): value is Bookmark => value !== null).sort(newestFirst);
  const identities = new Set<string>();
  const sources = new Set<string>();
  const routes = new Set<string>();
  return sorted.filter((bookmark) => {
    if (identities.has(bookmark.id) || sources.has(bookmark.sourcePath) || routes.has(bookmark.route)) return false;
    identities.add(bookmark.id);
    sources.add(bookmark.sourcePath);
    routes.add(bookmark.route);
    return true;
  });
}

export function readBookmarks(storage: BookmarkStorage): BookmarkSnapshot {
  let raw: string | null;
  try {
    raw = storage.getItem(BOOKMARKS_STORAGE_KEY);
  } catch {
    return { bookmarks: [], error: READ_ERROR };
  }
  if (raw === null) return { bookmarks: [], error: null };
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.bookmarks)) {
      return { bookmarks: [], error: CORRUPT_ERROR };
    }
    return { bookmarks: normalizeBookmarks(data.bookmarks), error: null };
  } catch {
    return { bookmarks: [], error: CORRUPT_ERROR };
  }
}

export function matchesBookmark(bookmark: Bookmark, entry: ContentEntry): boolean {
  return Boolean(entry.sourcePath && bookmark.sourcePath === entry.sourcePath) || bookmark.route === entry.route;
}

function isVisibleEntry(entry: ContentEntry): boolean {
  return !entry.draft && !(entry as ContentEntry & { hidden?: boolean }).hidden && Boolean(entry.sourcePath);
}

export function resolveBookmarks(bookmarks: readonly Bookmark[], spaces: readonly Space[]): ResolvedBookmark[] {
  const entries = spaces.filter((space) => !space.hidden).flatMap((space) =>
    space.entries.filter(isVisibleEntry).map((entry) => ({ entry, space })));
  const bySource = new Map(entries.map((item) => [item.entry.sourcePath, item]));
  const byRoute = new Map(entries.map((item) => [item.entry.route, item]));
  return [...bookmarks].sort(newestFirst).map((bookmark) => ({
    bookmark,
    ...(bySource.get(bookmark.sourcePath) ?? byRoute.get(bookmark.route)),
  }));
}

function persistBookmarks(storage: BookmarkStorage, previous: BookmarkSnapshot, bookmarks: readonly Bookmark[]): BookmarkMutationResult {
  if (JSON.stringify(previous.bookmarks) === JSON.stringify(bookmarks)) return { ...previous, ok: true };
  try {
    storage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify({ version: 1, bookmarks }));
    return { bookmarks, error: null, ok: true };
  } catch {
    return { bookmarks: previous.bookmarks, error: WRITE_ERROR, ok: false };
  }
}

export function addBookmark(storage: BookmarkStorage, entry: ContentEntry, space: Space, now = new Date()): BookmarkMutationResult {
  // Always read immediately before a mutation to retain changes from other tabs.
  const current = readBookmarks(storage);
  if (current.error) return { ...current, ok: false };
  if (space.hidden || !isVisibleEntry(entry) || entry.spaceSlug !== space.slug) {
    return { ...current, error: '这篇文档暂时不能收藏。', ok: false };
  }
  const bookmark = parseBookmark({
    id: entry.sourcePath,
    sourcePath: entry.sourcePath,
    route: entry.route,
    spaceSlug: space.slug,
    spaceTitle: space.title,
    title: entry.title,
    description: entry.description,
    tags: [...entry.tags],
    savedAt: now.toISOString(),
  });
  if (!bookmark) return { ...current, error: '这篇文档的收藏信息不完整，暂时不能收藏。', ok: false };
  if (current.bookmarks.some((item) => matchesBookmark(item, entry))) return { ...current, ok: true };
  return persistBookmarks(storage, current, [...current.bookmarks, bookmark].sort(newestFirst));
}

export function removeBookmark(storage: BookmarkStorage, id: string): BookmarkMutationResult {
  const current = readBookmarks(storage);
  if (current.error) return { ...current, ok: false };
  return persistBookmarks(storage, current, current.bookmarks.filter((bookmark) => bookmark.id !== id));
}
