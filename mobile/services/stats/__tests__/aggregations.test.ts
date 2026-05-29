import { describe, expect, it } from 'vitest';

import type { CompletedSession } from '../../session/types';
import {
  currentStreak,
  distractionRate,
  personalBest,
  weeklyFocusScore,
  weekStartMs,
} from '../aggregations';

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed clock for deterministic time math: Tue 2026-05-26 12:00 local.
const NOON = new Date(2026, 4, 26, 12, 0, 0).getTime();
const TODAY_MID = new Date(2026, 4, 26, 0, 0, 0).getTime();

function makeSession(over: Partial<CompletedSession> = {}): CompletedSession {
  return {
    id: 's1',
    taskId: 't1',
    task: { title: 'work', difficulty: 3, estMinutes: 45 },
    plan: { focusMinutes: 50, breakMinutes: 11, regime: 'cold' },
    startedAt: 1000,
    endedAt: TODAY_MID + 10 * 60 * 60 * 1000, // today 10:00
    actualFocusMinutes: 50,
    focusScore: 50,
    distractions: [],
    completed: true,
    overrunMinutes: 0,
    clientVersion: '1.0.0',
    ...over,
  };
}

describe('weekStartMs', () => {
  it('returns device-local midnight 6 days before the day of `now`', () => {
    const expected = new Date(2026, 4, 20, 0, 0, 0).getTime(); // 6 days before May 26
    expect(weekStartMs(NOON)).toBe(expected);
  });
});

describe('weeklyFocusScore', () => {
  it('returns null when no rows are in the rolling window', () => {
    expect(weeklyFocusScore([], NOON)).toBeNull();
    // single session 8 days ago → strictly outside the window (window is 7 days incl. today).
    const oldSession = makeSession({ endedAt: TODAY_MID - 8 * DAY_MS });
    expect(weeklyFocusScore([oldSession], NOON)).toBeNull();
  });

  it('returns the single in-window session score unchanged', () => {
    expect(weeklyFocusScore([makeSession({ focusScore: 42 })], NOON)).toBe(42);
  });

  it('counts only sessions inside the rolling 7-day window', () => {
    const inWindow = makeSession({ id: 'in', focusScore: 60, endedAt: TODAY_MID - 2 * DAY_MS });
    const outOfWindow = makeSession({ id: 'out', focusScore: 100, endedAt: TODAY_MID - 7 * DAY_MS });
    // averaged over the single in-window row only
    expect(weeklyFocusScore([inWindow, outOfWindow], NOON)).toBe(60);
  });

  it('includes a session ended exactly at the week-start boundary', () => {
    const boundary = weekStartMs(NOON); // 2026-05-20 00:00 local
    const boundarySession = makeSession({ focusScore: 30, endedAt: boundary });
    expect(weeklyFocusScore([boundarySession], NOON)).toBe(30);
  });

  it('averages multiple in-window sessions', () => {
    const rows = [
      makeSession({ id: 'a', focusScore: 30 }),
      makeSession({ id: 'b', focusScore: 60 }),
      makeSession({ id: 'c', focusScore: -10 }), // negatives allowed per M4.1
    ];
    expect(weeklyFocusScore(rows, NOON)).toBeCloseTo((30 + 60 - 10) / 3, 6);
  });
});

describe('currentStreak', () => {
  it('returns 0 for no sessions', () => {
    expect(currentStreak([], NOON)).toBe(0);
  });

  it('counts 1 when today has a session', () => {
    expect(currentStreak([TODAY_MID + 9 * 60 * 60 * 1000], NOON)).toBe(1);
  });

  it('counts 2 for today + yesterday', () => {
    const yesterday = TODAY_MID - DAY_MS + 8 * 60 * 60 * 1000;
    expect(currentStreak([yesterday, TODAY_MID + 10 * 60 * 60 * 1000], NOON)).toBe(2);
  });

  it('grace period: today empty + yesterday-with-session → streak 1', () => {
    const yesterday = TODAY_MID - DAY_MS + 8 * 60 * 60 * 1000;
    expect(currentStreak([yesterday], NOON)).toBe(1);
  });

  it('stops counting at the first gap (older days do not contribute)', () => {
    // Sessions on day-0 (today), day-1, day-3 — gap on day-2 breaks the streak at 2
    const today = TODAY_MID + 10 * 60 * 60 * 1000;
    const yesterday = TODAY_MID - DAY_MS + 10 * 60 * 60 * 1000;
    const threeDaysAgo = TODAY_MID - 3 * DAY_MS + 10 * 60 * 60 * 1000;
    expect(currentStreak([threeDaysAgo, yesterday, today], NOON)).toBe(2);
  });

  it('returns 0 when the latest session is older than yesterday', () => {
    // Latest = 3 days ago. Anchor is yesterday (today is empty); yesterday is also empty.
    const threeDaysAgo = TODAY_MID - 3 * DAY_MS + 10 * 60 * 60 * 1000;
    expect(currentStreak([threeDaysAgo], NOON)).toBe(0);
  });

  it('multiple sessions on the same day count once', () => {
    const t1 = TODAY_MID + 9 * 60 * 60 * 1000;
    const t2 = TODAY_MID + 14 * 60 * 60 * 1000;
    const yesterday = TODAY_MID - DAY_MS + 11 * 60 * 60 * 1000;
    expect(currentStreak([t1, t2, yesterday], NOON)).toBe(2);
  });

  it('input order does not matter', () => {
    const today = TODAY_MID + 10 * 60 * 60 * 1000;
    const yesterday = TODAY_MID - DAY_MS + 10 * 60 * 60 * 1000;
    const dayBefore = TODAY_MID - 2 * DAY_MS + 10 * 60 * 60 * 1000;
    expect(currentStreak([today, yesterday, dayBefore], NOON)).toBe(3);
    expect(currentStreak([dayBefore, today, yesterday], NOON)).toBe(3);
  });
});

describe('distractionRate', () => {
  it('returns null on empty input', () => {
    expect(distractionRate([], NOON)).toBeNull();
  });

  it('returns null when all in-window rows have 0 focus minutes', () => {
    const zero = makeSession({ actualFocusMinutes: 0, distractions: [1, 2] });
    expect(distractionRate([zero], NOON)).toBeNull();
  });

  it('computes distractions per focused hour', () => {
    // 2 distractions over 60 actual minutes = 2.0 per hour
    const row = makeSession({ actualFocusMinutes: 60, distractions: [100, 200] });
    expect(distractionRate([row], NOON)).toBe(2);
  });

  it('aggregates distractions and minutes across in-window rows', () => {
    // 1+3 distractions over 30+90 minutes = 4 / 2h = 2.0
    const rows = [
      makeSession({ id: 'a', actualFocusMinutes: 30, distractions: [1] }),
      makeSession({ id: 'b', actualFocusMinutes: 90, distractions: [2, 3, 4] }),
    ];
    expect(distractionRate(rows, NOON)).toBe(2);
  });

  it('ignores rows outside the rolling 7-day window', () => {
    const inWindow = makeSession({ id: 'in', actualFocusMinutes: 60, distractions: [1] });
    const old = makeSession({
      id: 'old',
      actualFocusMinutes: 60,
      distractions: [1, 2, 3, 4, 5],
      endedAt: TODAY_MID - 30 * DAY_MS,
    });
    // Only the in-window row counts → 1 distraction / 1 hour = 1.0
    expect(distractionRate([inWindow, old], NOON)).toBe(1);
  });
});

describe('personalBest', () => {
  it('passes through null', () => {
    expect(personalBest(null)).toBeNull();
  });

  it('passes through positive scores', () => {
    expect(personalBest(75)).toBe(75);
  });

  it('passes through negative scores (M4.1 allows them)', () => {
    expect(personalBest(-16)).toBe(-16);
  });

  it('passes through fractional scores', () => {
    expect(personalBest(61.6667)).toBe(61.6667);
  });
});
