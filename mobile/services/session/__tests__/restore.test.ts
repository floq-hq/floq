// M4.5 / L16 — getRestorableSession + resolveRestore.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ActiveSession } from '../types';

// Same SQLite + Firestore-mirror mocks the storage tests use — keeps this
// test runnable under node without pulling in expo-sqlite / firebase.
vi.mock('expo-sqlite', () => import('../../../test/expoSqliteFake'));
const { writeSessionMock } = vi.hoisted(() => ({
  writeSessionMock: vi.fn((..._a: unknown[]) => Promise.resolve()),
}));
vi.mock('../distraction', () => ({ writeSession: writeSessionMock }));

// react-native-mmkv has a native module that won't load in node — fake it with
// a plain in-memory map so activeSessionPersist works under vitest.
vi.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      __reset: () => store.clear(),
    }),
  };
});

import { resetExpoSqliteFake } from '../../../test/expoSqliteFake';
import {
  ACTIVE_SESSION_KEY,
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../activeSessionPersist';
import { getRestorableSession, resolveRestore } from '../restore';
import { getRecentSessions } from '../../storage/sessions';

function makeActive(over: Partial<ActiveSession> = {}): ActiveSession {
  return {
    sessionId: 'sess-1',
    taskId: 'task-1',
    task: { title: 'finish M4.5', difficulty: 3, estMinutes: 45 },
    plan: { focusMinutes: 45, breakMinutes: 10, regime: 'cold' },
    startedAt: Date.now() - 20 * 60_000, // started 20 min ago
    currentPhase: 'flow',
    distractions: [],
    ...over,
  };
}

beforeEach(() => {
  resetExpoSqliteFake();
  clearActiveSession();
  writeSessionMock.mockClear();
  writeSessionMock.mockImplementation(() => Promise.resolve());
});

describe('getRestorableSession', () => {
  it('returns null when MMKV has no active-session blob', () => {
    expect(getRestorableSession()).toBeNull();
  });

  it('returns the dangling session when MMKV has one', () => {
    const active = makeActive();
    saveActiveSession(active);
    expect(getRestorableSession()?.sessionId).toBe('sess-1');
  });
});

describe('resolveRestore', () => {
  it("returns null when there's nothing to restore", () => {
    expect(resolveRestore('resume')).toBeNull();
    expect(resolveRestore('save')).toBeNull();
    expect(resolveRestore('discard')).toBeNull();
    expect(getRecentSessions()).toHaveLength(0);
  });

  it('resume returns the session unchanged and leaves MMKV intact', () => {
    saveActiveSession(makeActive());
    const out = resolveRestore('resume');
    expect(out?.sessionId).toBe('sess-1');
    // Caller routes to /focus and hydrate() picks up where we left off.
    expect(loadActiveSession()).not.toBeNull();
    expect(getRecentSessions()).toHaveLength(0); // no SQLite write
  });

  it('save writes a completed:false partial with a real focus score, clears MMKV', () => {
    saveActiveSession(makeActive());
    resolveRestore('save');

    const rows = getRecentSessions();
    expect(rows).toHaveLength(1);
    const [partial] = rows;
    expect(partial.completed).toBe(false);
    // 20-min focus, 0 distractions, difficulty 3 → 20.
    expect(partial.actualFocusMinutes).toBe(20);
    expect(partial.focusScore).toBeGreaterThan(0);
    expect(loadActiveSession()).toBeNull();
  });

  it('caps a stale (killed-then-reopened-much-later) save at the planned window', () => {
    // Started a day ago, never DONE. Crediting `now − startedAt` would persist
    // ~1440 phantom minutes + an inflated score forever (bug-audit-w5 #15).
    saveActiveSession(makeActive({ startedAt: Date.now() - 24 * 60 * 60_000 }));
    resolveRestore('save');

    const [partial] = getRecentSessions();
    expect(partial.actualFocusMinutes).toBe(45); // plan.focusMinutes — capped, not 1440
    expect(partial.overrunMinutes).toBe(0); // capped at planned ⇒ no phantom overrun
    expect(partial.completed).toBe(false);
  });

  it('discard clears MMKV and writes nothing', () => {
    saveActiveSession(makeActive());
    resolveRestore('discard');
    expect(loadActiveSession()).toBeNull();
    expect(getRecentSessions()).toHaveLength(0);
  });
});

// Sanity: the persist module's MMKV key contract is unchanged.
describe('ACTIVE_SESSION_KEY', () => {
  it('is stable so this PR does not lose existing dangling sessions in beta', () => {
    expect(ACTIVE_SESSION_KEY).toBe('floq.session.active');
  });
});
