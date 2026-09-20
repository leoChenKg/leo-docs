import { useSyncExternalStore } from 'react';
import type { ContentEntry, Space } from '../types';
import {
  addBookmark,
  BOOKMARKS_STORAGE_KEY,
  matchesBookmark,
  readBookmarks,
  removeBookmark,
  type BookmarkMutationResult,
  type BookmarkSnapshot,
} from './model';

const emptySnapshot: BookmarkSnapshot = { bookmarks: [], error: null };
let snapshot = emptySnapshot;
let initialized = false;
const listeners = new Set<() => void>();

function unavailableSnapshot(): BookmarkSnapshot {
  return { bookmarks: [], error: '本地收藏不可用，请检查浏览器是否允许此网站使用本地存储。' };
}

function publish(next: BookmarkSnapshot) {
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  initialized = true;
  try {
    publish(readBookmarks(window.localStorage));
  } catch {
    publish(unavailableSnapshot());
  }
}

function getSnapshot() {
  if (!initialized && typeof window !== 'undefined') refresh();
  return snapshot;
}

function onStorage(event: StorageEvent) {
  if (event.key === BOOKMARKS_STORAGE_KEY || event.key === null) refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    }
  };
}

function mutate(action: (storage: Storage) => BookmarkMutationResult): { ok: boolean; error?: string } {
  initialized = true;
  let result: BookmarkMutationResult;
  try {
    result = action(window.localStorage);
  } catch {
    result = { ...unavailableSnapshot(), ok: false };
  }
  publish({ bookmarks: result.bookmarks, error: result.error });
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? '收藏操作失败，请重试。' };
}

const add = (entry: ContentEntry, space: Space) => mutate((storage) => addBookmark(storage, entry, space));
const remove = (id: string) => mutate((storage) => removeBookmark(storage, id));

export function useBookmarks() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);
  return {
    bookmarks: current.bookmarks,
    error: current.error,
    add,
    remove,
    isBookmarked: (entry: ContentEntry) => current.bookmarks.some((bookmark) => matchesBookmark(bookmark, entry)),
  };
}
