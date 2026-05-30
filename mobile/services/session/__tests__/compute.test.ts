import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../../onboarding/types';
import type { BehavioralSession, SessionPlan } from '../../timer';
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
  sessionsCompleted: 0, // M5.4: lifetime count → regime (0 keeps the cold tests cold)
  lastEndedAt: null as number | null,
  // Rows carry the M4.7 prevBreak (plan.breakMinutes) AND, from M5.4, the fields
  // the warming behavioral blend reads (actualFocusMinutes / startedAt / endedAt).
  // The behavioral fields are optional so the cold/M4.7 tests can keep the terse
  // `[{ plan: { breakMinutes } }]` shape — cold regime ignores behavioral.
  recent: [] as Array<{
    plan: { breakMinutes: number };
    actualFocusMinutes?: number;
    startedAt?: number;
    endedAt?: number;
  }>,
}));
vi.mock('../../storage/sessions', () => ({
  countSessionsToday: vi.fn(() => sql.sessionsToday),
  countSessionsAllTime: vi.fn(() => sql.sessionsCompleted),
  getLastSessionEndedAt: vi.fn(() => sql.lastEndedAt),
  getRecentSessions: vi.fn((_n: number) => sql.recent),
}));

// M5.3: compute now injects the TFLite matureInfer into routeSessionPlan. Stub it
// to "model unavailable" (null) here so these tests stay native-free — the mature
// path then falls back to warming, exactly as on a device before the model loads.
// matureInfer's own decode logic is covered in services/ml/__tests__/matureInfer.test.ts.
vi.mock('../../ml/matureInfer', () => ({ matureInfer: () => null }));

import {
  TASK_ESTIMATE_BUFFER,
  hourBucket,
  buildSessionInputs,
  computeSessionPlan,
} from '../compute';

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
    // Default estMinutes is high enough that the L20 task-estimate cap (1.5×)
    // never bites in the formula-arithmetic tests below — those isolate the
    // depletion/clamp behavior. Cap-specific tests override this explicitly.
    estMinutes: 120,
    order: 0,
    done: false,
    createdAt: 0,
    ...over,
  };
}

// compute now attaches the ML feature vector (L23) to every plan. These tests
// assert the recommendation itself, so compare the core fields; the captured
// vector is verified separately below + in featureVector.test.ts.
const corePlan = (p: SessionPlan) => ({
  focusMinutes: p.focusMinutes,
  breakMinutes: p.breakMinutes,
  regime: p.regime,
});

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
    expect(corePlan(plan)).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('attaches the 13-dim ML feature vector to the plan (L23 capture)', () => {
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.features).toHaveLength(13);
    expect(plan.features?.every((n) => typeof n === 'number' && Number.isFinite(n))).toBe(true);
  });

  it('sources sessions_today from SQLite when ctx omits it (fatigue applies as depletion floor)', () => {
    sql.sessionsToday = 2; // 3rd session today → fatigue ×0.8
    // Without a prior session inside the recovery window, recovery_mod = 1.0
    // → depletion_mod = max(0.75, 0.8 × 1.0) = 0.8 (matches the old fatigue-
    // only behavior for the first session of a recovery cycle).
    // 60 × 1.0 × 0.85 × 1.0 × 0.8 = 40.8 → floor 40; break floor(40 × 0.22) = 8
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 40, breakMinutes: 8, regime: 'cold' });
  });

  it('lets an explicit ctx.sessionsToday override the SQLite count', () => {
    sql.sessionsToday = 2; // SQLite would say 3rd today...
    // ...but the caller pins it to the 1st → fatigue ×1.0 → focus 51
    const plan = computeSessionPlan('t1', { now: morning10, sessionsToday: 0 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
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
    expect(corePlan(plan)).toEqual({ focusMinutes: 39, breakMinutes: 8, regime: 'cold' });
  });

  it('M4.7: worst-corner depletion clips to DEPLETION_FLOOR (0.75)', () => {
    // 3rd+ session today (fatigue=0.8), gap=0 (recovery_mod=0.85) →
    // raw product 0.68, clipped to 0.75. Pre-fatigue baseline = 51.
    // 51 × 0.75 = 38.25 → floor 38; break floor(38 × 0.22) = 8.
    sql.sessionsToday = 2;
    sql.lastEndedAt = morning10;
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 38, breakMinutes: 8, regime: 'cold' });
  });

  it('M4.7: rested fully (gap >= recommended break) yields no recovery penalty', () => {
    sql.sessionsToday = 0; // back to fatigue 1.0 to isolate the recovery effect
    sql.lastEndedAt = morning10 - 30 * 60_000; // gap = 30 min, well past any break
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    // depletion_mod = max(0.75, 1.0 × 1.0) = 1.0 → no trim, focus = 51.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
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
    expect(corePlan(plan)).toEqual({ focusMinutes: 43, breakMinutes: 9, regime: 'cold' });
  });

  it('throws when the task id is unknown', () => {
    expect(() => computeSessionPlan('nope', { now: morning10 })).toThrow(/no task found/);
  });

  it('throws when onboarding answers are missing', () => {
    store.answers = null;
    expect(() => computeSessionPlan('t1', { now: morning10 })).toThrow(/onboarding/);
  });
});

// L20 / Bug #6 — task-estimate cap. The cold-start formula recommends focus
// CAPACITY, not task duration. A 25-min task can land a 72-min suggestion
// without this cap (real sim test, 2026-05-29). The cap lives outside the
// frozen formula at the orchestration layer.
describe('TASK_ESTIMATE_BUFFER constant (drift guard)', () => {
  it('is exactly 1.5 (decisions.md L20)', () => {
    // If this asserts and someone "fixed" the value, read L20 — the buffer is
    // calibrated, not frozen, but a change without spec sign-off is the
    // forbidden silent drift the test guards against.
    expect(TASK_ESTIMATE_BUFFER).toBe(1.5);
  });
});

describe('computeSessionPlan — task-estimate cap (L20)', () => {
  beforeEach(() => {
    store.answers = answers;
    sql.sessionsToday = 0;
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  it('caps a 25-min task: ceil(25 × 1.5) = 38 → focus ≤ 38 instead of 51', () => {
    // Without the cap: the worked-example formula gives focus = 51 (60 × 0.85).
    // With the cap: min(51, ceil(25 × 1.5) = 38) = 38; break floor(38 × 0.22) = 8.
    store.tasks = [makeTask({ estMinutes: 25 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.focusMinutes).toBe(38);
    expect(plan.breakMinutes).toBe(8);
  });

  it('does NOT cap a long task: 4-hr estimate → cap (360) > FOCUS_MAX (90)', () => {
    // Long task: cap = ceil(240 × 1.5) = 360 → never bites; formula wins.
    // Worked example: focus = 51, break = 11.
    store.tasks = [makeTask({ estMinutes: 240 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('FOCUS_MIN (15) still wins for tiny tasks (5-min estimate)', () => {
    // 5-min task: cap = ceil(5 × 1.5) = 8 → final = clamp(8, 15, 90) = 15.
    // The science floor (no flow below 15 min) is intact (timer.md / L20).
    store.tasks = [makeTask({ estMinutes: 5 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.focusMinutes).toBe(15);
  });

  it("doesn't cap when the cap >= the formula output (cap stays inert)", () => {
    // 60-min task: cap = ceil(60 × 1.5) = 90; formula = 51 → cap inert.
    store.tasks = [makeTask({ estMinutes: 60 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.focusMinutes).toBe(51);
  });

  it('treats estMinutes = 0 as no-cap so the formula governs (audit Finding #8)', () => {
    // Without the guard: ceil(0 × 1.5) = 0 → min(focus, 0) = 0 → clamp to
    // FOCUS_MIN (15). The guard makes the cap Infinity → formula = 51.
    store.tasks = [makeTask({ estMinutes: 0 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.focusMinutes).toBe(51);
  });

  it('treats negative estMinutes (corrupted task) as no-cap too', () => {
    store.tasks = [makeTask({ estMinutes: -10 })];
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan.focusMinutes).toBe(51);
  });

  it('cap bites only when stricter than depletion + clamp combined', () => {
    // High depletion (3rd today, gap=0): pre-cap formula goes to 38 already.
    // Cap with 25-min estimate: ceil(25 × 1.5) = 38 → same number → no
    // visible change but the path is exercised.
    store.tasks = [makeTask({ estMinutes: 25 })];
    sql.sessionsToday = 2;
    sql.lastEndedAt = morning10;
    sql.recent = [{ plan: { breakMinutes: 11 } }];
    const plan = computeSessionPlan('t1', { now: morning10 });
    // depletion alone → 38; cap = 38; min(38, 38) = 38.
    expect(plan.focusMinutes).toBe(38);
  });
});

// M5.4 — computeSessionPlan now routes through the regime router (cold / warming
// blend / mature) by lifetime tenure (`sessions_completed`), instead of always
// cold-starting. These cover the wiring; the blend math itself is covered in
// services/timer/__tests__/warming.test.ts and the cutoffs in regimeRouter.test.ts.
describe('computeSessionPlan — regime routing (M5.4)', () => {
  // Two matching behavioral rows (work + morning, the current session's bucket)
  // with IDENTICAL focus minutes — so behavioral_focus is exactly 30 no matter
  // how recency weighting works, and these tests don't depend on that formula.
  const morningWorkRow = {
    plan: { breakMinutes: 11 },
    actualFocusMinutes: 30,
    startedAt: morning10,
    endedAt: morning10,
  };

  beforeEach(() => {
    store.answers = answers;
    store.tasks = [makeTask()]; // difficulty 5, estMinutes 120 (L20 cap inert)
    sql.sessionsToday = 0;
    sql.sessionsCompleted = 0;
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  it('cold regime (<5 lifetime): ignores behavioral history, the formula governs', () => {
    sql.sessionsCompleted = 4; // last cold session
    sql.recent = [morningWorkRow, morningWorkRow]; // present but unused in cold
    // routeSessionPlan picks cold → computeColdStart → 60 × 0.85 = 51, break 11.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('warming regime (5–13 lifetime): blends the cold formula with behavioral focus', () => {
    sql.sessionsCompleted = 9; // alpha = 1 − (9−4)/10 = 0.5
    sql.recent = [morningWorkRow, morningWorkRow]; // behavioral_focus = 30
    // blend = 0.5 × 51 (cold) + 0.5 × 30 (behavioral) = 40.5 → 40; break floor(40 × 0.22) = 8.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 40, breakMinutes: 8, regime: 'warming' });
  });

  it('mature tenure (14+) with no TFLite model falls back to warming (the M5.3 gap)', () => {
    sql.sessionsCompleted = 20; // alpha = max(0, 1 − (20−4)/10) = 0
    sql.recent = [morningWorkRow, morningWorkRow];
    // No matureInfer injected (M5.3) → routeSessionPlan falls back to computeWarming,
    // stamped regime 'warming'. alpha = 0 → blend = pure behavioral = 30; break 6.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 30, breakMinutes: 6, regime: 'warming' });
  });

  it('the L17 depletion mod still trims the warming baseline', () => {
    sql.sessionsCompleted = 9; // warming baseline focus = 40 (as above)
    sql.recent = [morningWorkRow, morningWorkRow];
    sql.sessionsToday = 2; // fatigue 0.8
    sql.lastEndedAt = morning10; // gap 0 → recovery_mod 0.85 (prevBreak 11 from recent[0])
    // depletion = max(0.75, 0.8 × 0.85 = 0.68) = 0.75 → floor(40 × 0.75) = 30; break 6.
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(corePlan(plan)).toEqual({ focusMinutes: 30, breakMinutes: 6, regime: 'warming' });
  });
});

// M6.2 — warming-blend INTEGRATION verification end-to-end through
// computeSessionPlan (not the isolated computeWarming unit). The behavioral
// signal is injected via ctx.behavioral: ≥2 rows matching the session's bucket
// (work + morning) make behavioralFocus() return the value exactly, independent
// of the recency-weight formula. Every case is a first-of-day session
// (depletion_mod = 1.0) with the default estMinutes = 120 (L20 cap inert), so the
// ONLY difference from the cold reference run is the regime — isolating the blend.
//
// NOTE on the spec's "6 sessions, alpha=0.9": the FROZEN curve
// warmingAlpha(s) = max(0, 1 − (s−4)/10) gives warmingAlpha(6) = 0.8 — alpha=0.9
// is sessionsCompleted = 5. We test the early case at 5 to hit the stated 0.9
// exactly; the ±2-of-cold property holds across all of early warming regardless.
describe('computeSessionPlan — warming-blend integration (M6.2)', () => {
  // A behavioral session matching the live context (work use-case, morning bucket
  // from morning10) so warming's behavioralFocus() returns `focusMinutes` exactly.
  const behavioralRow = (focusMinutes: number): BehavioralSession => ({
    focusMinutes,
    hourBucket: 'morning',
    useCase: 'work',
    endedAt: morning10,
  });
  const matching = (focusMinutes: number) => [
    behavioralRow(focusMinutes),
    behavioralRow(focusMinutes),
  ];

  beforeEach(() => {
    store.answers = answers;
    store.tasks = [makeTask()]; // difficulty 5, estMinutes 120 → L20 cap inert
    sql.sessionsToday = 0;
    sql.sessionsCompleted = 0;
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  // Cold-start reference: same task/answers/ctx, lifetime tenure 0 → cold regime.
  // The timer.md worked example → focus 51 (60 × 0.85). Behavioral is ignored.
  const coldFocus = () =>
    computeSessionPlan('t1', { now: morning10, sessionsCompleted: 0 }).focusMinutes;

  it('early warming (alpha=0.9) lands within ±2 min of pure cold-start', () => {
    const cold = coldFocus(); // 51
    // alpha = warmingAlpha(5) = 0.9. behavioral = 35 (a real 16 min below cold,
    // so the ±2 bound is a genuine property, not a tautology).
    // blend = 0.9 × 51 + 0.1 × 35 = 49.4 → floor 49; |49 − 51| = 2.
    const plan = computeSessionPlan('t1', {
      now: morning10,
      sessionsCompleted: 5,
      behavioral: matching(35),
    });
    expect(plan.regime).toBe('warming');
    expect(Math.abs(plan.focusMinutes - cold)).toBeLessThanOrEqual(2);
  });

  it('late warming (alpha=0.1) is mostly behavioral', () => {
    const cold = coldFocus(); // 51
    // alpha = warmingAlpha(13) = 0.1. behavioral = 30.
    // blend = 0.1 × 51 + 0.9 × 30 = 32.1 → floor 32.
    const plan = computeSessionPlan('t1', {
      now: morning10,
      sessionsCompleted: 13,
      behavioral: matching(30),
    });
    expect(plan.regime).toBe('warming');
    expect(Math.abs(plan.focusMinutes - 30)).toBeLessThanOrEqual(2);
    // Strictly nearer the behavioral average than the cold formula.
    expect(Math.abs(plan.focusMinutes - 30)).toBeLessThan(
      Math.abs(plan.focusMinutes - cold),
    );
  });

  it('slides monotonically cold → behavioral as tenure grows 5 → 13', () => {
    const cold = coldFocus(); // 51
    const behavioral = 30; // fixed, below cold
    const focusByTenure = [];
    for (let s = 5; s <= 13; s += 1) {
      const plan = computeSessionPlan('t1', {
        now: morning10,
        sessionsCompleted: s,
        behavioral: matching(behavioral),
      });
      focusByTenure.push(plan.focusMinutes);
    }
    // Non-increasing (more behavioral weight each step pulls toward 30 < 51)...
    for (let i = 1; i < focusByTenure.length; i += 1) {
      expect(focusByTenure[i]).toBeLessThanOrEqual(focusByTenure[i - 1]);
    }
    // ...and always bounded inside [behavioral, cold].
    for (const f of focusByTenure) {
      expect(f).toBeGreaterThanOrEqual(behavioral);
      expect(f).toBeLessThanOrEqual(cold);
    }
    // End-to-end: it really did move (early ≈ cold, late ≈ behavioral).
    expect(focusByTenure[0]).toBeGreaterThan(focusByTenure[focusByTenure.length - 1]);
  });

  it('empty behavioral history falls back to the cold result (never NaN)', () => {
    const cold = coldFocus(); // 51
    // Warming tenure but no behavioral signal at all: no matching rows AND no
    // 7-day fallback → computeWarming returns the cold result alone (timer.md
    // edge case), stamped 'warming'. Never NaN.
    const plan = computeSessionPlan('t1', {
      now: morning10,
      sessionsCompleted: 8,
      behavioral: [],
      history: { recent_focus_avg: null, recent_distract: null },
    });
    expect(plan.regime).toBe('warming');
    expect(plan.focusMinutes).toBe(cold);
    expect(Number.isFinite(plan.focusMinutes)).toBe(true);
  });
});
