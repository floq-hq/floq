import { describe, it, expect } from 'vitest';
import { computeColdStart } from '../coldStart';
import type { TimerInputs } from '../types';

/** Build TimerInputs from the fields the cold-start formula actually reads. */
function makeInputs(o: {
  base_focus: number;
  distraction_level: TimerInputs['onboarding']['distraction_level'];
  preferred_time: TimerInputs['onboarding']['preferred_time'];
  difficulty: TimerInputs['task']['difficulty'];
  hour_bucket: TimerInputs['context']['hour_bucket'];
  sessions_today: number;
}): TimerInputs {
  return {
    task: { difficulty: o.difficulty, estimated_minutes: 30 },
    context: {
      hour_bucket: o.hour_bucket,
      day_of_week: 2,
      sessions_today: o.sessions_today,
      hours_since_last: 24,
    },
    history: { recent_focus_avg: null, recent_distract: null },
    onboarding: {
      base_focus: o.base_focus,
      distraction_level: o.distraction_level,
      preferred_time: o.preferred_time,
      use_case: 'work',
      decay_weight: 1.0,
    },
    sessions_completed: 0,
  };
}

describe('computeColdStart', () => {
  it('worked example (timer.md): hard task, preferred time, 1st session → focus 51, break 11', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 60,
        distraction_level: 'neutral', // ×1.0
        preferred_time: 'morning',
        difficulty: 5, // hard ×0.85
        hour_bucket: 'morning', // match ×1.0
        sessions_today: 0, // 1st today ×1.0
      }),
    );
    // 60 × 1.0 × 0.85 × 1.0 × 1.0 = 51.0
    expect(plan.focusMinutes).toBe(51);
    expect(plan.breakMinutes).toBe(11); // floor(51 × 0.22) = floor(11.22)
    expect(plan.regime).toBe('cold');
  });

  it('neutral baseline: base 45, medium task, matched time, 1st session → focus 45, break 9', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 45,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        difficulty: 3, // medium ×1.0
        hour_bucket: 'morning',
        sessions_today: 0,
      }),
    );
    // 45 × 1 × 1 × 1 × 1 = 45
    expect(plan.focusMinutes).toBe(45);
    expect(plan.breakMinutes).toBe(9); // floor(45 × 0.22) = floor(9.9)
  });

  it('off-peak fatigued: base 60, easy-distract, hard task, off-peak, 4th session → focus 27, break 5', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 60,
        distraction_level: 'easy', // ×0.8
        preferred_time: 'morning',
        difficulty: 5, // hard ×0.85
        hour_bucket: 'night', // off-peak ×0.85
        sessions_today: 3, // 4th session → 3rd+ ×0.8
      }),
    );
    // 60 × 0.8 × 0.85 × 0.85 × 0.8 = 27.744
    expect(plan.focusMinutes).toBe(27);
    expect(plan.breakMinutes).toBe(5); // floor(27 × 0.22) = floor(5.94)
  });

  it('lower clamp: tiny inputs floor focus to 15 and break to 5', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 10,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        difficulty: 5, // ×0.85
        hour_bucket: 'morning',
        sessions_today: 0,
      }),
    );
    // 10 × 0.85 = 8.5 → clamp up to 15
    expect(plan.focusMinutes).toBe(15);
    // 15 × 0.22 = 3.3 → clamp up to 5
    expect(plan.breakMinutes).toBe(5);
  });

  it('upper clamp: large inputs clamp focus to 90; break = floor(90 × 0.22) = 19', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 90,
        distraction_level: 'hard', // ×1.15
        preferred_time: 'morning',
        difficulty: 3, // ×1.0
        hour_bucket: 'morning',
        sessions_today: 0,
      }),
    );
    // 90 × 1.15 = 103.5 → clamp down to 90
    expect(plan.focusMinutes).toBe(90);
    // floor(90 × 0.22) = floor(19.8) = 19 — round down, NOT 20
    expect(plan.breakMinutes).toBe(19);
  });

  it('break is derived from the CLAMPED focus, not the raw product', () => {
    const plan = computeColdStart(
      makeInputs({
        base_focus: 90,
        distraction_level: 'hard', // raw focus = 103.5
        preferred_time: 'morning',
        difficulty: 3,
        hour_bucket: 'morning',
        sessions_today: 0,
      }),
    );
    expect(plan.focusMinutes).toBe(90);
    // From clamped focus 90: floor(90 × 0.22) = 19.
    // If break came from raw 103.5 (the bug): floor(103.5 × 0.22) = floor(22.77) = 22.
    expect(plan.breakMinutes).toBe(19);
    expect(plan.breakMinutes).not.toBe(22);
  });
});
