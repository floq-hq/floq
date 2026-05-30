import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CompletedSession } from '../../session/types';

vi.mock('expo-sqlite', () => import('../../../test/expoSqliteFake'));

// Mock the Firestore-mirror dependency so importing storage/sessions doesn't
// pull in firebase/init (which throws without env). Lets us assert the mirror is
// fired and that its failure is swallowed.
const { writeSessionMock } = vi.hoisted(() => ({
  writeSessionMock: vi.fn((..._a: unknown[]) => Promise.resolve()),
}));
vi.mock('../../session/distraction', () => ({ writeSession: writeSessionMock }));

import { resetExpoSqliteFake } from '../../../test/expoSqliteFake';
import {
  insertSession,
  getRecentSessions,
  countSessionsToday,
  countSessionsAllTime,
  saveCompletedSession,
  getSessionsSince,
  getAllSessionEndedAt,
  getMaxFocusScore,
  getLastSessionEndedAt,
  deleteAllSessions,
} from '../sessions';

function makeSession(over: Partial<CompletedSession> = {}): CompletedSession {
  return {
    id: 's1',
    taskId: 't1',
    task: { title: 'ship M4.2', difficulty: 4, estMinutes: 45 },
    plan: { focusMinutes: 50, breakMinutes: 11, regime: 'cold' },
    startedAt: 1000,
    endedAt: 2000,
    actualFocusMinutes: 50,
    focusScore: 37,
    distractions: [],
    completed: true,
    overrunMinutes: 0,
    clientVersion: '1.0.0',
    ...over,
  };
}

beforeEach(() => {
  resetExpoSqliteFake();
  writeSessionMock.mockClear();
  writeSessionMock.mockImplementation(() => Promise.resolve());
});

describe('insertSession + getRecentSessions', () => {
  it('round-trips a session with its distraction timestamps', () => {
    insertSession(makeSession({ distractions: [1100, 1500, 1800] }));
    const [s] = getRecentSessions();
    expect(s).toEqual(makeSession({ distractions: [1100, 1500, 1800] }));
  });

  it('omits modelVersion unless set, and includes it when present', () => {
    insertSession(makeSession({ id: 'a' }));
    insertSession(
      makeSession({
        id: 'c',
        endedAt: 4000,
        modelVersion: 'v1',
        plan: { focusMinutes: 50, breakMinutes: 11, regime: 'mature' },
      }),
    );
    const byId = Object.fromEntries(getRecentSessions().map((x) => [x.id, x]));
    expect('modelVersion' in byId.a).toBe(false);
    expect(byId.c.modelVersion).toBe('v1');
  });

  it('returns newest first and respects the limit', () => {
    insertSession(makeSession({ id: 'old', endedAt: 1000 }));
    insertSession(makeSession({ id: 'mid', endedAt: 2000 }));
    insertSession(makeSession({ id: 'new', endedAt: 3000 }));
    expect(getRecentSessions().map((s) => s.id)).toEqual(['new', 'mid', 'old']);
    expect(getRecentSessions(2).map((s) => s.id)).toEqual(['new', 'mid']);
  });

  it('round-trips a negative/fractional focus score (REAL column, not clamped)', () => {
    insertSession(makeSession({ focusScore: -16 }));
    insertSession(makeSession({ id: 's2', endedAt: 5000, focusScore: 61.6667 }));
    const byId = Object.fromEntries(getRecentSessions().map((x) => [x.id, x.focusScore]));
    expect(byId.s1).toBe(-16);
    expect(byId.s2).toBeCloseTo(61.6667, 4);
  });

  it('re-inserting the same id is idempotent (one row, distractions replaced)', () => {
    insertSession(makeSession({ distractions: [1, 2, 3] }));
    insertSession(makeSession({ distractions: [9] }));
    const all = getRecentSessions();
    expect(all).toHaveLength(1);
    expect(all[0].distractions).toEqual([9]);
  });

  it('returns [] when there are no sessions', () => {
    expect(getRecentSessions()).toEqual([]);
  });
});

describe('countSessionsToday', () => {
  const today10 = new Date(2026, 4, 26, 10, 0, 0).getTime();
  const todayMidnight = new Date(2026, 4, 26, 0, 0, 0).getTime();
  const yesterday23 = new Date(2026, 4, 25, 23, 0, 0).getTime();
  const noon = new Date(2026, 4, 26, 12, 0, 0).getTime();

  it('counts only sessions ended at/after device-local midnight', () => {
    insertSession(makeSession({ id: 'y', endedAt: yesterday23 }));
    insertSession(makeSession({ id: 'a', endedAt: today10 }));
    insertSession(makeSession({ id: 'm', endedAt: todayMidnight })); // boundary is inclusive
    expect(countSessionsToday(noon)).toBe(2);
  });

  it('is 0 with no sessions today', () => {
    insertSession(makeSession({ id: 'y', endedAt: yesterday23 }));
    expect(countSessionsToday(noon)).toBe(0);
  });
});

describe('countSessionsAllTime (M5.4 regime tenure)', () => {
  it('is 0 on an empty table', () => {
    expect(countSessionsAllTime()).toBe(0);
  });

  it('counts every saved row regardless of day or completed flag', () => {
    insertSession(makeSession({ id: 'a', endedAt: 1000 }));
    insertSession(makeSession({ id: 'b', endedAt: 2_000_000_000 })); // a different day
    insertSession(makeSession({ id: 'c', endedAt: 3000, completed: false })); // saved partial
    expect(countSessionsAllTime()).toBe(3);
  });

  it('does not double-count a re-inserted id', () => {
    insertSession(makeSession({ id: 'a', distractions: [1] }));
    insertSession(makeSession({ id: 'a', distractions: [9] })); // same id, replaced
    expect(countSessionsAllTime()).toBe(1);
  });
});

describe('getSessionsSince', () => {
  it('returns only sessions ended at/after the start time, newest first', () => {
    insertSession(makeSession({ id: 'old', endedAt: 1000 }));
    insertSession(makeSession({ id: 'mid', endedAt: 2000 }));
    insertSession(makeSession({ id: 'new', endedAt: 3000 }));
    expect(getSessionsSince(2000).map((s) => s.id)).toEqual(['new', 'mid']);
    expect(getSessionsSince(2001).map((s) => s.id)).toEqual(['new']);
  });

  it('round-trips distraction timestamps on the returned sessions', () => {
    insertSession(makeSession({ id: 'a', endedAt: 5000, distractions: [3000, 4000] }));
    insertSession(makeSession({ id: 'b', endedAt: 6000, distractions: [] }));
    const [b, a] = getSessionsSince(0);
    expect(a.id).toBe('a');
    expect(a.distractions).toEqual([3000, 4000]);
    expect(b.id).toBe('b');
    expect(b.distractions).toEqual([]);
  });

  it('returns [] when no sessions match (and on an empty DB)', () => {
    expect(getSessionsSince(0)).toEqual([]);
    insertSession(makeSession({ endedAt: 1000 }));
    expect(getSessionsSince(9999)).toEqual([]);
  });
});

describe('getAllSessionEndedAt', () => {
  it('returns ended_at timestamps in chronological (ascending) order', () => {
    insertSession(makeSession({ id: 'new', endedAt: 3000 }));
    insertSession(makeSession({ id: 'old', endedAt: 1000 }));
    insertSession(makeSession({ id: 'mid', endedAt: 2000 }));
    expect(getAllSessionEndedAt()).toEqual([1000, 2000, 3000]);
  });

  it('returns [] on an empty DB', () => {
    expect(getAllSessionEndedAt()).toEqual([]);
  });
});

describe('getMaxFocusScore', () => {
  it('returns null on an empty DB', () => {
    expect(getMaxFocusScore()).toBeNull();
  });

  it('returns the highest score across all sessions', () => {
    insertSession(makeSession({ id: 'a', focusScore: 30 }));
    insertSession(makeSession({ id: 'b', endedAt: 4000, focusScore: 75 }));
    insertSession(makeSession({ id: 'c', endedAt: 5000, focusScore: 50 }));
    expect(getMaxFocusScore()).toBe(75);
  });

  it('handles fully-negative score history', () => {
    insertSession(makeSession({ id: 'a', focusScore: -20 }));
    insertSession(makeSession({ id: 'b', endedAt: 4000, focusScore: -5 }));
    expect(getMaxFocusScore()).toBe(-5);
  });
});

describe('saveCompletedSession', () => {
  it('writes to SQLite and fires the async Firestore mirror', () => {
    saveCompletedSession(makeSession());
    expect(getRecentSessions()).toHaveLength(1);
    expect(writeSessionMock).toHaveBeenCalledTimes(1);
    expect(writeSessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('does not throw and keeps the SQLite row when the mirror rejects', () => {
    writeSessionMock.mockImplementation(() => Promise.reject(new Error('offline')));
    expect(() => saveCompletedSession(makeSession())).not.toThrow();
    expect(getRecentSessions()).toHaveLength(1);
  });
});

// M4.5 (L16) + M4.6: the schema gained `completed` (1=DONE / 0=saved partial)
// and `overrun_minutes`. Both round-trip; both feed aggregations without a
// filter (per L16 — discarded sessions never write a row in the first place).
describe('completed + overrun_minutes (M4.5 + M4.6)', () => {
  it('round-trips a DONE session with the defaults', () => {
    insertSession(makeSession());
    const [s] = getRecentSessions();
    expect(s.completed).toBe(true);
    expect(s.overrunMinutes).toBe(0);
  });

  it('round-trips a saved end-early partial', () => {
    insertSession(
      makeSession({
        id: 'partial',
        completed: false,
        actualFocusMinutes: 18,
        overrunMinutes: 0,
        focusScore: -6, // real focus score is computed for partials too (L16)
      }),
    );
    const [s] = getRecentSessions();
    expect(s.id).toBe('partial');
    expect(s.completed).toBe(false);
    expect(s.focusScore).toBe(-6);
  });

  it('round-trips a non-zero overrun', () => {
    insertSession(
      makeSession({
        actualFocusMinutes: 65, // planned 50 → 15-min overrun
        overrunMinutes: 15,
      }),
    );
    const [s] = getRecentSessions();
    expect(s.actualFocusMinutes).toBe(65);
    expect(s.overrunMinutes).toBe(15);
  });

  it('keeps DONE + saved-partial mixed batches in a single result set (L16 invariant)', () => {
    insertSession(makeSession({ id: 'done', endedAt: 3000, completed: true }));
    insertSession(makeSession({ id: 'partial', endedAt: 4000, completed: false }));
    // Both are returned by getSessionsSince + getAllSessionEndedAt — neither
    // applies a `completed` filter (L16: saved partials count for stats/streak).
    expect(getSessionsSince(0)).toHaveLength(2);
    expect(getAllSessionEndedAt()).toEqual([3000, 4000]);
  });
});

describe('getLastSessionEndedAt (M4.7 gap clock)', () => {
  it('returns null on an empty DB', () => {
    expect(getLastSessionEndedAt()).toBeNull();
  });

  it('returns the single most-recent ended_at', () => {
    insertSession(makeSession({ id: 'old', endedAt: 1000 }));
    insertSession(makeSession({ id: 'new', endedAt: 9000 }));
    insertSession(makeSession({ id: 'mid', endedAt: 5000 }));
    expect(getLastSessionEndedAt()).toBe(9000);
  });

  it('includes saved partials (same L16 invariant)', () => {
    insertSession(makeSession({ id: 'done', endedAt: 1000 }));
    insertSession(makeSession({ id: 'partial', endedAt: 2000, completed: false }));
    expect(getLastSessionEndedAt()).toBe(2000);
  });
});

// bug-audit-w5 #14 — sign-out must wipe session history so it can't leak to the
// next account (no per-user SQLite isolation in MVP).
describe('deleteAllSessions', () => {
  it('empties sessions AND their distractions', () => {
    insertSession(makeSession({ id: 'a', distractions: [1100, 1500] }));
    insertSession(makeSession({ id: 'b', endedAt: 4000, distractions: [4100] }));
    expect(getRecentSessions()).toHaveLength(2);

    deleteAllSessions();

    expect(getRecentSessions()).toHaveLength(0);
    expect(getAllSessionEndedAt()).toEqual([]);
    expect(getLastSessionEndedAt()).toBeNull();
    expect(getMaxFocusScore()).toBeNull();
    // distractions are gone too: re-inserting the same id returns no orphans.
    insertSession(makeSession({ id: 'a', distractions: [] }));
    expect(getRecentSessions()[0].distractions).toEqual([]);
  });

  it('is a no-op on an empty DB (no throw)', () => {
    expect(() => deleteAllSessions()).not.toThrow();
    expect(getRecentSessions()).toHaveLength(0);
  });
});
