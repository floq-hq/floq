import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../types';

// In-memory MMKV fake (the fast-read cache layer).
const { mmkvStore } = vi.hoisted(() => ({ mmkvStore: new Map<string, string>() }));
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string) => {
      mmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mmkvStore.delete(k);
    },
  }),
}));

// SQLite source-of-truth layer + Firestore mirror are mocked: this test covers
// the facade's orchestration, not the SQL/network behind it (those have their
// own tests). Spies let us assert what the facade delegates.
const { upsertQueue, countTasks, deleteAllTasks, mirrorTasks } = vi.hoisted(() => ({
  upsertQueue: vi.fn(),
  countTasks: vi.fn(() => 0),
  deleteAllTasks: vi.fn(),
  mirrorTasks: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../storage', () => ({ upsertQueue, countTasks, deleteAllTasks }));
vi.mock('../firestoreMirror', () => ({ mirrorTasks }));

import { TASKS_KEY, saveTasks, loadTasks, clearTasks } from '../persist';

function sample(): Task[] {
  return [
    { id: 'a', title: 'A', difficulty: 3, estMinutes: 30, order: 0, done: false, createdAt: 1 },
    { id: 'b', title: 'B', difficulty: 5, estMinutes: 60, order: 1, done: false, createdAt: 2 },
  ];
}

beforeEach(() => {
  mmkvStore.clear();
  vi.clearAllMocks();
  countTasks.mockReturnValue(0);
});

describe('saveTasks', () => {
  it('writes SQLite (source of truth), refreshes the MMKV cache, and fires the mirror', () => {
    saveTasks(sample());
    expect(upsertQueue).toHaveBeenCalledWith(sample());
    expect(JSON.parse(mmkvStore.get(TASKS_KEY)!)).toEqual(sample());
    expect(mirrorTasks).toHaveBeenCalledTimes(1);
  });

  it('passes the PREVIOUS queue to the mirror so removed ids can be diffed', () => {
    const prev = sample();
    mmkvStore.set(TASKS_KEY, JSON.stringify(prev));
    const next = [prev[0]]; // dropped 'b'
    saveTasks(next);
    expect(mirrorTasks).toHaveBeenCalledWith(prev, next);
  });

  it('does not throw when the mirror rejects (fire-and-forget)', () => {
    mirrorTasks.mockReturnValueOnce(Promise.reject(new Error('offline')));
    expect(() => saveTasks(sample())).not.toThrow();
  });
});

describe('loadTasks', () => {
  it('returns the cached queue', () => {
    mmkvStore.set(TASKS_KEY, JSON.stringify(sample()));
    countTasks.mockReturnValue(2); // SQLite already populated — no import
    expect(loadTasks()).toEqual(sample());
    expect(upsertQueue).not.toHaveBeenCalled();
  });

  it('one-time import: backfills SQLite from the legacy blob when SQLite is empty', () => {
    mmkvStore.set(TASKS_KEY, JSON.stringify(sample()));
    countTasks.mockReturnValue(0); // fresh SQLite, legacy blob present
    expect(loadTasks()).toEqual(sample());
    expect(upsertQueue).toHaveBeenCalledWith(sample());
  });

  it('skips the import when SQLite already has tasks', () => {
    mmkvStore.set(TASKS_KEY, JSON.stringify(sample()));
    countTasks.mockReturnValue(2);
    loadTasks();
    expect(upsertQueue).not.toHaveBeenCalled();
  });

  it('returns [] on a fresh install (no blob) and does not import', () => {
    expect(loadTasks()).toEqual([]);
    expect(upsertQueue).not.toHaveBeenCalled();
  });

  it('returns [] on a corrupt blob', () => {
    mmkvStore.set(TASKS_KEY, '{ not valid json');
    expect(loadTasks()).toEqual([]);
    expect(upsertQueue).not.toHaveBeenCalled();
  });
});

describe('clearTasks', () => {
  it('clears SQLite and removes the cache blob', () => {
    mmkvStore.set(TASKS_KEY, JSON.stringify(sample()));
    clearTasks();
    expect(deleteAllTasks).toHaveBeenCalledTimes(1);
    expect(mmkvStore.has(TASKS_KEY)).toBe(false);
    expect(loadTasks()).toEqual([]);
  });
});
