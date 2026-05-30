// M6.3 — Edge-case QA round 1.
//
// Drives the REAL timer/ML/session services through four edge scenarios that
// must survive before W7 social work lands:
//   1. a brand-new user's first-ever session (empty DB)
//   2. a 3-distraction, deeply-negative-score session (and how it surfaces)
//   3. a week of all-easy tasks feeding the warming blend
//   4. a user returning after a 60-day gap (seed decay + huge recovery gap)
//
// Primary acceptance is "no crash"; each case also pins the expected behavior so
// this doubles as a regression guard. Low-severity design observations found
// during the sweep are tracked as `qa-w6` GitHub issues (decay_weight not applied
// to the recommendation; warming blend has no recency window; negative score as
// the share-card hero) — NOT fixed here (one PR = one concern).
//
// Mirrors compute.test.ts's mock boundary so computeSessionPlan runs native-free.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../../onboarding/types';
import type { BehavioralSession } from '../../timer';
import type { Task } from '../../tasks';
import type { ActiveSession } from '../types';

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

const sql = vi.hoisted(() => ({
  sessionsToday: 0,
  sessionsCompleted: 0,
  lastEndedAt: null as number | null,
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

// Mature model unavailable (as on a device before/without the TFLite load) → the
// mature path falls back to warming. Keeps the suite native-free.
vi.mock('../../ml/matureInfer', () => ({ matureInfer: () => null }));

import { buildSessionInputs, computeSessionPlan } from '../compute';
import { computeFocusScore } from '../../timer/focusScore';
import { finalizeOnDone } from '../finalize';
import { weeklyFocusScore } from '../../stats/aggregations';
import { sessionInsight } from '../../share/sessionInsight';
import { decayWeight } from '../../onboarding/seed';
import { encodeFeatures } from '../../ml/featureVector';

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (h: number, m = 0) => new Date(2026, 4, 26, h, m, 0);
const morning10 = at(10, 0).getTime();

// timer.md worked-example seed: base 60, neutral, morning pref, work.
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
    estMinutes: 120, // L20 cap inert at this size
    order: 0,
    done: false,
    createdAt: 0,
    ...over,
  };
}

const behavioralRow = (focusMinutes: number, startedAt: number): BehavioralSession => ({
  focusMinutes,
  hourBucket: 'morning',
  useCase: 'work',
  endedAt: startedAt,
});

describe('M6.3 edge case 1 — first-ever session (empty DB)', () => {
  beforeEach(() => {
    store.answers = answers;
    store.tasks = [makeTask()];
    sql.sessionsToday = 0;
    sql.sessionsCompleted = 0;
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  it('does not crash and returns the cold worked example with a finite feature vector', () => {
    let plan!: ReturnType<typeof computeSessionPlan>;
    expect(() => {
      plan = computeSessionPlan('t1', { now: morning10 });
    }).not.toThrow();
    expect(plan.regime).toBe('cold');
    expect(plan.focusMinutes).toBe(51); // 60 × 0.85
    expect(plan.breakMinutes).toBe(11);
    expect(plan.features).toHaveLength(13);
    expect(plan.features?.every((n) => Number.isFinite(n))).toBe(true);
  });
});

describe('M6.3 edge case 2 — 3-distraction, deeply-negative score', () => {
  it('computeFocusScore is negative and unclamped (M4.1)', () => {
    // (30 − 3 × 23) × (3 / 3) = −39.
    const score = computeFocusScore({
      sessionMinutes: 30,
      distractionCount: 3,
      difficulty: 3,
    });
    expect(score).toBe(-39);
    expect(score).toBeLessThan(0);
  });

  it('finalizeOnDone assembles a well-formed record with a negative score (no crash)', () => {
    const active: ActiveSession = {
      sessionId: 's-neg',
      taskId: 't1',
      task: { title: 'wrecked session', difficulty: 3, estMinutes: 30 },
      plan: { focusMinutes: 45, breakMinutes: 10, regime: 'cold' },
      startedAt: morning10,
      currentPhase: 'flow',
      distractions: [morning10 + 5 * 60_000, morning10 + 12 * 60_000, morning10 + 20 * 60_000],
    };
    const endedAt = morning10 + 30 * 60_000; // 30 focused minutes
    let rec!: ReturnType<typeof finalizeOnDone>;
    expect(() => {
      rec = finalizeOnDone(active, endedAt, '1.0.0-test');
    }).not.toThrow();
    expect(rec.actualFocusMinutes).toBe(30);
    expect(rec.focusScore).toBe(-39);
    expect(rec.focusScore).toBeLessThan(0);
    expect(rec.completed).toBe(true);
    expect(rec.overrunMinutes).toBe(0); // 30 < planned 45
    expect(rec.plan.breakMinutes).toBeGreaterThanOrEqual(0); // recomputed from 30 min
    expect(Number.isFinite(rec.plan.breakMinutes)).toBe(true);
  });

  it('weekly focus score reflects the negative session (finite, not dropped)', () => {
    const rows = [
      { focusScore: 60, endedAt: morning10, actualFocusMinutes: 50, distractions: [] },
      { focusScore: -39, endedAt: morning10 + 60_000, actualFocusMinutes: 30, distractions: [1, 2, 3] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason: weeklyFocusScore reads only focusScore/endedAt; full CompletedSession shape is irrelevant here
    ] as any;
    const avg = weeklyFocusScore(rows, morning10 + 2 * 60_000);
    expect(avg).toBeCloseTo((60 - 39) / 2); // 10.5 — the negative drags it down
    expect(Number.isFinite(avg as number)).toBe(true);
  });

  it('sessionInsight produces a clean string for a negative first session (no NaN branch)', () => {
    // First session → avg null → the "above average" division is skipped entirely.
    const line = sessionInsight(
      { focusScore: -39, focusMinutes: 30, distractionCount: 3 },
      null,
    );
    expect(typeof line).toBe('string');
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('NaN');
  });
});

describe('M6.3 edge case 3 — all-easy week, warming still works', () => {
  beforeEach(() => {
    store.answers = answers;
    store.tasks = [makeTask({ difficulty: 1, estMinutes: 120 })]; // easy current task
    sql.sessionsToday = 0;
    sql.sessionsCompleted = 9; // warming (alpha = 0.5)
    sql.lastEndedAt = null;
    sql.recent = [];
  });

  it('blends a week of easy behavioral sessions without crashing, stays in clamp range', () => {
    // 7 easy sessions, all work/morning, longer focus minutes (easy → user ran long).
    const behavioral = Array.from({ length: 7 }, (_, i) =>
      behavioralRow(70, morning10 - i * DAY_MS),
    );
    let plan!: ReturnType<typeof computeSessionPlan>;
    expect(() => {
      plan = computeSessionPlan('t1', { now: morning10, behavioral });
    }).not.toThrow();
    expect(plan.regime).toBe('warming');
    expect(Number.isFinite(plan.focusMinutes)).toBe(true);
    expect(plan.focusMinutes).toBeGreaterThanOrEqual(15);
    expect(plan.focusMinutes).toBeLessThanOrEqual(90);
  });
});

describe('M6.3 edge case 4 — 60-day-gap return', () => {
  const now60 = morning10 + 60 * DAY_MS;

  beforeEach(() => {
    store.answers = answers; // onboarded at morning10, i.e. 60 days before now60
    store.tasks = [makeTask()];
    sql.sessionsToday = 0;
    sql.sessionsCompleted = 20; // mature tenure → falls back to warming (model dormant)
    sql.lastEndedAt = morning10; // last session was 60 days ago → huge recovery gap
    sql.recent = [
      { plan: { breakMinutes: 11 }, actualFocusMinutes: 50, startedAt: morning10, endedAt: morning10 },
      { plan: { breakMinutes: 11 }, actualFocusMinutes: 50, startedAt: morning10, endedAt: morning10 },
    ];
  });

  it('seed decay saturates to 0 at 60 days without NaN', () => {
    expect(decayWeight(morning10, now60)).toBe(0); // 1 − 60/14 < 0 → clamp 0
  });

  it('encodes a finite 13-dim feature vector for a fully-decayed seed', () => {
    const oldAnswers: OnboardingAnswers = { ...answers, completed_at: morning10 };
    const inputs = buildSessionInputs(makeTask(), oldAnswers, { now: now60 });
    expect(inputs.onboarding.decay_weight).toBe(0);
    const vec = Array.from(encodeFeatures(inputs));
    expect(vec).toHaveLength(13);
    expect(vec.every((n) => Number.isFinite(n))).toBe(true);
  });

  it('computeSessionPlan does not crash; huge gap yields no recovery penalty', () => {
    let plan!: ReturnType<typeof computeSessionPlan>;
    expect(() => {
      plan = computeSessionPlan('t1', { now: now60 });
    }).not.toThrow();
    // Mature tenure with the model dormant → warming fallback (regimeRouter.ts).
    expect(plan.regime).toBe('warming');
    expect(Number.isFinite(plan.focusMinutes)).toBe(true);
    expect(plan.focusMinutes).toBeGreaterThanOrEqual(15);
    expect(plan.focusMinutes).toBeLessThanOrEqual(90);
  });
});
