import { useSyncExternalStore } from 'react';
import type { ContentEntry } from '../types';
import {
  findReadingMemory,
  READING_MEMORY_STORAGE_KEY,
  readReadingMemory,
  removeReadingMemory,
  saveReadingMemory,
  type ReadingMemory,
  type ReadingMemoryMutationResult,
  type ReadingMemoryPosition,
  type ReadingMemorySnapshot,
} from './model';

const emptySnapshot: ReadingMemorySnapshot = { memories: [], error: null, needsCleanup: false };
let snapshot = emptySnapshot;
let initialized = false;
const listeners = new Set<() => void>();

function unavailableSnapshot(): ReadingMemorySnapshot {
  return { memories: [], error: '本地阅读记忆不可用，请检查浏览器是否允许此网站使用本地存储。', needsCleanup: false };
}

function publish(next: ReadingMemorySnapshot) {
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  initialized = true;
  try {
    publish(readReadingMemory(window.localStorage));
  } catch {
    publish(unavailableSnapshot());
  }
}

function getSnapshot() {
  if (!initialized && typeof window !== 'undefined') refresh();
  return snapshot;
}

function onStorage(event: StorageEvent) {
  if (event.key === READING_MEMORY_STORAGE_KEY || event.key === null) refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    // A focus refresh catches writes made by another tab in browsers that do
    // not dispatch storage events to the opener in every lifecycle state.
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

function mutate(action: (storage: Storage) => ReadingMemoryMutationResult, notify = true): { ok: boolean; error?: string } {
  initialized = true;
  let result: ReadingMemoryMutationResult;
  try {
    result = action(window.localStorage);
  } catch {
    result = { ...unavailableSnapshot(), ok: false };
  }
  const next = { memories: result.memories, error: result.error, needsCleanup: result.needsCleanup };
  if (notify || !result.ok) publish(next);
  else snapshot = next;
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? '阅读位置保存失败，请重试。' };
}

const save = (entry: ContentEntry, position: ReadingMemoryPosition) => mutate((storage) => saveReadingMemory(storage, entry, position), false);
const remove = (identity: string | ReadingMemory) => mutate((storage) => removeReadingMemory(storage, typeof identity === 'string' ? identity : identity.id));

export function useReadingMemory() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => emptySnapshot);
  return {
    memories: current.memories,
    error: current.error,
    needsCleanup: current.needsCleanup,
    get: (entry: ContentEntry) => findReadingMemory(current.memories, entry),
    save,
    remove,
  };
}

export type ReadingMemoryStore = ReturnType<typeof useReadingMemory>;
