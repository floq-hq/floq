import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../types';

// In-memory MMKV fake (hoisted so the vi.mock factory can close over it).
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

import { TASKS_KEY, saveTasks, loadTasks, clearTasks } from '../persist';

function sample(): Task[] {
  return [
    { id: 'a', title: 'A', difficulty: 3, estMinutes: 30, order: 0, done: false, createdAt: 1 },
    { id: 'b', title: 'B', difficulty: 5, estMinutes: 60, order: 1, done: false, createdAt: 2 },
    { id: 'c', title: 'C', difficulty: 1, estMinutes: 15, order: 2, done: false, createdAt: 3 },
  ];
}

beforeEach(() => {
  mmkvStore.clear();
});

describe('saveTasks', () => {
  it('writes one JSON blob under floq.tasks', () => {
    saveTasks(sample());
    expect([...mmkvStore.keys()]).toEqual([TASKS_KEY]);
    expect(JSON.parse(mmkvStore.get(TASKS_KEY)!)).toEqual(sample());
  });
});

describe('loadTasks', () => {
  it('round-trips what saveTasks wrote', () => {
    saveTasks(sample());
    expect(loadTasks()).toEqual(sample());
  });

  it('survives an app kill: a fresh read returns the same 3 tasks', () => {
    // "Log 3 tasks" then simulate a kill: the MMKV blob persists; loadTasks reads it.
    saveTasks(sample());
    // (no in-memory state carried over — loadTasks reads straight from the blob)
    const afterRelaunch = loadTasks();
    expect(afterRelaunch).toHaveLength(3);
    expect(afterRelaunch.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] on a fresh install (no blob)', () => {
    expect(loadTasks()).toEqual([]);
  });

  it('returns [] on a corrupt blob', () => {
    mmkvStore.set(TASKS_KEY, '{ not valid json');
    expect(loadTasks()).toEqual([]);
  });

  it('returns [] when the blob is valid JSON but not an array', () => {
    mmkvStore.set(TASKS_KEY, JSON.stringify({ oops: true }));
    expect(loadTasks()).toEqual([]);
  });
});

describe('clearTasks', () => {
  it('removes the blob', () => {
    saveTasks(sample());
    clearTasks();
    expect(mmkvStore.has(TASKS_KEY)).toBe(false);
    expect(loadTasks()).toEqual([]);
  });
});
