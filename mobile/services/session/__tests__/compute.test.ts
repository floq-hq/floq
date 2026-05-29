import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../../onboarding/types';
import type { Task } from '../../tasks';

// Mock the store modules (the impure boundary) so compute's wiring is tested in
// isolation — without pulling MMKV / Firestore / react-native into the node env.
// compute.ts reaches heavy native deps only through these two value-imports;
// everything else it imports (../timer, ../onboarding/seed) is pure.
const store = vi.hoisted(() => ({
  answers: null as OnboardingAnswers | null,
  tasks: [] as Task[],
}));
vi.mock('../../../stores/useOnboardingStore', () => ({
  useOnboardingStore: { getState: () => ({ answers: store.answers }) },
}));
vi.mock('../../../stores/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasks: store.tasks }) },
}));

// compute.ts now sources sessions_today + the last-session ended_at +
// the last session's break_minutes from SQLite (M4.2 / M4.5 / M4.7). Mock
// the sessions module so the node env doesn't load expo-sqlite / firebase
// and so we can drive each value from the test. Includes the M4.7 inputs
// for the gap-clock / depletion path; default to "no prior session" so the
// existing pre-M4.7 expectations (focus 51 etc.) round-trip unchanged.
const sql = vi.hoisted(() => ({
  sessionsToday: 0,
  lastEndedAt: null as number | null,
  recent: [] as Array<{ plan: { breakMinutes: number } }>,
}));
vi.mock('../../storage/sessions', () => ({
  countSessionsToday: vi.fn(() => sql.sessionsToday),
  getLastSessionEndedAt: vi.fn(() => sql.lastEndedAt),
  getRecentSessions: vi.fn((_n: number) => sql.recent),
}));

import { hourBucket, buildSessionInputs, computeSessionPlan } from '../compute';

// A deterministic local Tuesday, 2026-05-26 10:00 (a "morning" time).
const at = (h: number, m = 0) => new Date(2026, 4, 26, h, m, 0);
const morning10 = at(10, 0).getTime();

// Mirrors the timer.md worked example seed: base 60, neutral, morning pref.
const answers: OnboardingAnswers = {
  base_focus: 60,
  distraction_level: 'neutral',
  preferred_time: 'morning',
  use_case: 'work',
  completed_at: morning10,
};

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'ship the orchestrator',
    difficulty: 5,
    estMinutes: 30,
    order: 0,
    done: false,
    createdAt: 0,
    ...over,
  };
}

describe('hourBucket', () => {
  it('maps local hour to the confirmed cutoffs', () => {
    expect(hourBucket(at(5, 0))).toBe('morning');
    expect(hourBucket(at(11, 59))).toBe('morning');
    expect(hourBucket(at(12, 0))).toBe('afternoon');
    expect(hourBucket(at(16, 59))).toBe('afternoon');
    expect(hourBucket(at(17, 0))).toBe('evening');
    expect(hourBucket(at(20, 59))).toBe('evening');
    expect(hourBucket(at(21, 0))).toBe('night');
    expect(hourBucket(at(4, 59))).toBe('night');
    expect(hourBucket(at(0, 0))).toBe('night');
  });
});

describe('buildSessionInputs', () => {
  it('assembles TimerInputs from task + answers + ctx (pure, deterministic)', () => {
    const inputs = buildSessionInputs(
      makeTask({ difficulty: 4, estMinutes: 25 }),
      answers,
      { now: morning10 },
    );
    expect(inputs.task).toEqual({ difficulty: 4, estimated_minutes: 25 });
    expect(inputs.context.hour_bucket).toBe('morning');
    expect(inputs.context.day_of_week).toBe(2); // Tue 2026-05-26
    expect(inputs.context.sessions_today).toBe(0); // W3 default
    expect(inputs.context.hours_since_last).toBe(24); // W3 default
    expect(inputs.history).toEqual({ recent_focus_avg: null, recent_distract: null });
    expect(inputs.onboarding.base_focus).toBe(60);
    expect(inputs.onboarding.preferred_time).toBe('morning');
    expect(inputs.sessions_completed).toBe(0);
  });

  it('honours ctx overrides for the not-yet-sourced inputs', () => {
    const inputs = buildSessionInputs(makeTask(), answers, {
      now: morning10,
      sessionsToday: 2,
      hoursSinceLast: 1.5,
      history: { recent_focus_avg: 42, recent_distract: 1 },
    });
    expect(inputs.context.sessions_today).toBe(2);
    expect(inputs.context.hours_since_last).toBe(1.5);
    expect(inputs.history).toEqual({ recent_focus_avg: 42, recent_distract: 1 });
  });
});

describe('computeSessionPlan', () => {
  beforeEach(() => {
    store.answers = answers;
    store.tasks = [makeTask()];
    sql.sessionsToday = 0;
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  it('round-trips the timer.md worked example: hard task at preferred time → focus 51, break 11, cold', () => {
    // 60 × 1.0 (neutral) × 0.85 (difficulty 5) × 1.0 (morning match) × 1.0 (1st today) = 51
    // No prior session → recovery_mod = 1.0, depletion_mod = 1.0 (no trim).
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('sources sessions_today from SQLite when ctx omits it (fatigue applies as depletion floor)', () => {
    sql.sessionsToday = 2; // 3rd session today → fatigue ×0.8
    // Without a prior session inside the recovery window, recovery_mod = 1.0
    // → depletion_mod = max(0.75, 0.8 × 1.0) = 0.8 (matches the old fatigue-
    // only behavior for the first session of a recovery cycle).
    // 60 × 1.0 × 0.85 × 1.0 × 0.8 = 40.8 → floor 40; break floor(40 × 0.22) = 8
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 40, breakMinutes: 8, regime: 'cold' });
  });

  it('lets an explicit ctx.sessionsToday override the SQLite count', () => {
    sql.sessionsToday = 2; // SQLite would say 3rd today...
    // ...but the caller pins it to the 1st → fatigue ×1.0 → focus 51
    const plan = computeSessionPlan('t1', { now: morning10, sessionsToday: 0 });
    expect(plan).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('M4.7: back-to-back with zero gap trims focus via depletion', () => {
    // 2nd session today, started immediately after the prior one (gap=0,
    // recovery_mod=0.85). fatigue=0.9 → product 0.765 (above the 0.75 floor,
    // so the product wins). Pre-fatigue baseline = 51.
    // 51 × 0.765 = 39.015 → floor 39; break floor(39 × 0.22) = floor(8.58) = 8.
    sql.sessionsToday = 1;
    sql.lastEndedAt = morning10; // gap = 0 minutes
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 39, breakMinutes: 8, regime: 'cold' });
  });

  it('M4.7: worst-corner depletion clips to DEPLETION_FLOOR (0.75)', () => {
    // 3rd+ session today (fatigue=0.8), gap=0 (recovery_mod=0.85) →
    // raw product 0.68, clipped to 0.75. Pre-fatigue baseline = 51.
    // 51 × 0.75 = 38.25 → floor 38; break floor(38 × 0.22) = 8.
    sql.sessionsToday = 2;
    sql.lastEndedAt = morning10;
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 38, breakMinutes: 8, regime: 'cold' });
  });

  it('M4.7: rested fully (gap >= recommended break) yields no recovery penalty', () => {
    sql.sessionsToday = 0; // back to fatigue 1.0 to isolate the recovery effect
    sql.lastEndedAt = morning10 - 30 * 60_000; // gap = 30 min, well past any break
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    // depletion_mod = max(0.75, 1.0 × 1.0) = 1.0 → no trim, focus = 51.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('M4.7: injected ctx.recoveryGapMin + recommendedBreakMin win over storage', () => {
    sql.lastEndedAt = morning10 - 60 * 60_000; // storage says fully rested
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    // Caller pins to gap=0 (just restarted) → recovery_mod = 0.85.
    // fatigue = 1.0 → depletion = max(0.75, 0.85) = 0.85.
    // 60 × 1.0 × 0.85 × 1.0 × 0.85 = 43.35 → floor 43; break floor(43 × 0.22) = 9.
    const plan = computeSessionPlan('t1', {
      now: morning10,
      recoveryGapMin: 0,
      recommendedBreakMin: 11,
    });
    expect(plan).toEqual({ focusMinutes: 43, breakMinutes: 9, regime: 'cold' });
  });

  it('throws when the task id is unknown', () => {
    expect(() => computeSessionPlan('nope', { now: morning10 })).toThrow(/no task found/);
  });

  it('throws when onboarding answers are missing', () => {
    store.answers = null;
    expect(() => computeSessionPlan('t1', { now: morning10 })).toThrow(/onboarding/);
  });
});
