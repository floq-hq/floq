import { describe, it, expect } from 'vitest';
import { decayWeight, toOnboardingSeed } from '../seed';
import { computeColdStart } from '../../timer';
import type { TimerInputs } from '../../timer';
import type { OnboardingAnswers } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const answers: OnboardingAnswers = {
  base_focus: 60,
  distraction_level: 'neutral',
  preferred_time: 'morning',
  use_case: 'work',
  completed_at: 0,
};

describe('decayWeight', () => {
  it('is 1.0 at completion', () => {
    expect(decayWeight(0, 0)).toBe(1);
  });

  it('is 0.5 at 7 days (linear over 14)', () => {
    expect(decayWeight(0, 7 * DAY_MS)).toBeCloseTo(0.5);
  });

  it('is 0 at 14 days and clamps at 0 beyond', () => {
    expect(decayWeight(0, 14 * DAY_MS)).toBe(0);
    expect(decayWeight(0, 30 * DAY_MS)).toBe(0);
  });
});

describe('toOnboardingSeed', () => {
  it('copies the four answer fields and derives decay_weight', () => {
    const seed = toOnboardingSeed(answers, 0);
    expect(seed).toEqual({
      base_focus: 60,
      distraction_level: 'neutral',
      preferred_time: 'morning',
      use_case: 'work',
      decay_weight: 1,
    });
  });
});

describe('AC4: stored answers feed the cold-start formula', () => {
  it('computeColdStart accepts toOnboardingSeed(answers) and returns a SessionPlan', () => {
    const inputs: TimerInputs = {
      task: { difficulty: 5, estimated_minutes: 30 }, // hard ×0.85
      context: {
        hour_bucket: 'morning', // matches preferred_time ×1.0
        day_of_week: 2,
        sessions_today: 0, // 1st today ×1.0
        hours_since_last: 24,
      },
      history: { recent_focus_avg: null, recent_distract: null },
      onboarding: toOnboardingSeed(answers),
      sessions_completed: 0,
    };

    const plan = computeColdStart(inputs);

    // 60 × 1.0 × 0.85 × 1.0 × 1.0 = 51 (timer.md worked example)
    expect(plan.regime).toBe('cold');
    expect(plan.focusMinutes).toBe(51);
    expect(plan.breakMinutes).toBe(11);
    expect(plan.focusMinutes).toBeGreaterThanOrEqual(15);
    expect(plan.focusMinutes).toBeLessThanOrEqual(90);
  });
});
