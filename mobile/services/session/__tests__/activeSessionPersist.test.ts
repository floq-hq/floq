import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ActiveSession } from '../types';

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

import {
  ACTIVE_SESSION_KEY,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from '../activeSessionPersist';

function sample(distractions: number[] = []): ActiveSession {
  return {
    sessionId: 's1',
    taskId: 't1',
    task: { title: 'A', difficulty: 5, estMinutes: 30 },
    plan: { focusMinutes: 51, breakMinutes: 11, regime: 'cold' },
    startedAt: 1000,
    currentPhase: 'flow',
    distractions,
  };
}

beforeEach(() => {
  mmkvStore.clear();
});

describe('saveActiveSession / loadActiveSession', () => {
  it('writes one blob under floq.session.active and round-trips it', () => {
    const s = sample([10, 20]);
    saveActiveSession(s);
    expect([...mmkvStore.keys()]).toEqual([ACTIVE_SESSION_KEY]);
    expect(loadActiveSession()).toEqual(s);
  });

  it('survives an app kill: log 3 distractions, then a fresh read still has all 3', () => {
    saveActiveSession(sample([1, 2, 3]));
    // Simulate a kill: no in-memory state carried over — load reads the blob.
    const afterRelaunch = loadActiveSession();
    expect(afterRelaunch?.distractions).toEqual([1, 2, 3]);
    expect(afterRelaunch?.distractions).toHaveLength(3);
  });

  it('returns null on a fresh install (no blob)', () => {
    expect(loadActiveSession()).toBeNull();
  });

  it('returns null on a corrupt blob', () => {
    mmkvStore.set(ACTIVE_SESSION_KEY, '{ not valid json');
    expect(loadActiveSession()).toBeNull();
  });

  it('returns null when the blob is valid JSON but not a session', () => {
    mmkvStore.set(ACTIVE_SESSION_KEY, JSON.stringify({ oops: true }));
    expect(loadActiveSession()).toBeNull();
  });
});

describe('clearActiveSession', () => {
  it('removes the blob', () => {
    saveActiveSession(sample());
    clearActiveSession();
    expect(mmkvStore.has(ACTIVE_SESSION_KEY)).toBe(false);
    expect(loadActiveSession()).toBeNull();
  });
});
