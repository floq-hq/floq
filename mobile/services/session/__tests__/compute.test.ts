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

// compute.ts now sources sessions_today from SQLite (M4.2). Mock the storage
// barrel so the node env doesn't load expo-sqlite / firebase, and so we can
// drive the count from the test.
const sql = vi.hoisted(() => ({ sessionsToday: 0 }));
vi.mock('../../storage', () => ({
  countSessionsToday: vi.fn(() => sql.sessionsToday),
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
  });

  it('round-trips the timer.md worked example: hard task at preferred time → focus 51, break 11, cold', () => {
    // 60 × 1.0 (neutral) × 0.85 (difficulty 5) × 1.0 (morning match) × 1.0 (1st today) = 51
    const plan = computeSessionPlan('t1', { now: morning10 });
    expect(plan).toEqual({ focusMinutes: 51, breakMinutes: 11, regime: 'cold' });
  });

  it('sources sessions_today from SQLite when ctx omits it (fatigue applies)', () => {
    sql.sessionsToday = 2; // 3rd session today → fatigue ×0.8
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

  it('throws when the task id is unknown', () => {
    expect(() => computeSessionPlan('nope', { now: morning10 })).toThrow(/no task found/);
  });

  it('throws when onboarding answers are missing', () => {
    store.answers = null;
    expect(() => computeSessionPlan('t1', { now: morning10 })).toThrow(/onboarding/);
  });
});
