import { describe, it, expect } from 'vitest';
import { computeWarming, warmingAlpha } from '../warming';
import type {
  BehavioralSession,
  DistractionLevel,
  HourBucket,
  OnboardingSeed,
  PreferredTime,
  TimerInputs,
} from '../types';

/**
 * Build TimerInputs. Defaults give a cold-start focus of `base_focus` exactly
 * (neutral distraction ×1.0, difficulty 3 ×1.0, matched time ×1.0, 1st today
 * ×1.0), so cold.focusMinutes is predictable in the blends below.
 */
function makeInputs(o: {
  base_focus?: number;
  distraction_level?: DistractionLevel;
  preferred_time?: PreferredTime;
  use_case?: OnboardingSeed['use_case'];
  difficulty?: TimerInputs['task']['difficulty'];
  hour_bucket?: HourBucket;
  sessions_today?: number;
  sessions_completed: number;
  recent_focus_avg: number | null;
}): TimerInputs {
  return {
    task: { difficulty: o.difficulty ?? 3, estimated_minutes: 30 },
    context: {
      hour_bucket: o.hour_bucket ?? 'morning',
      day_of_week: 2,
      sessions_today: o.sessions_today ?? 0,
      hours_since_last: 24,
    },
    history: { recent_focus_avg: o.recent_focus_avg, recent_distract: null },
    onboarding: {
      base_focus: o.base_focus ?? 50,
      distraction_level: o.distraction_level ?? 'neutral',
      preferred_time: o.preferred_time ?? 'morning',
      use_case: o.use_case ?? 'work',
      decay_weight: 1.0,
    },
    sessions_completed: o.sessions_completed,
  };
}

function sess(
  focusMinutes: number,
  endedAt: number,
  useCase: OnboardingSeed['use_case'] = 'work',
  hourBucket: HourBucket = 'morning',
): BehavioralSession {
  return { focusMinutes, hourBucket, useCase, endedAt };
}

describe('warmingAlpha', () => {
  it('sessions_done=5 → alpha=0.9 (heavy cold weight)', () => {
    expect(warmingAlpha(5)).toBeCloseTo(0.9);
  });

  it('sessions_done=14 → alpha=0 (pure behavioral)', () => {
    expect(warmingAlpha(14)).toBe(0);
  });

  it('decays linearly across the warming window', () => {
    expect(warmingAlpha(9)).toBeCloseTo(0.5);
    expect(warmingAlpha(13)).toBeCloseTo(0.1);
  });

  it('floors at 0 past session 14, never negative', () => {
    expect(warmingAlpha(20)).toBe(0);
  });
});

describe('computeWarming', () => {
  it('≥2 matching sessions → recency-weighted behavioral avg, ignores 7-day fallback', () => {
    // cold focus = 50. alpha(9) = 0.5.
    // matching (work/morning): 40@2000 (weight 2), 20@1000 (weight 1)
    //   → (40·2 + 20·1) / 3 = 33.333
    // blend = 0.5·50 + 0.5·33.333 = 41.667 → floor 41
    const plan = computeWarming(
      makeInputs({ sessions_completed: 9, recent_focus_avg: 10 }),
      [
        sess(40, 2000),
        sess(20, 1000),
        sess(90, 3000, 'coding'), // non-matching use_case → filtered out
      ],
    );
    expect(plan.focusMinutes).toBe(41);
    expect(plan.breakMinutes).toBe(9); // floor(41 × 0.22) = floor(9.02)
    expect(plan.regime).toBe('warming');
    // If it had used the 7-day avg (10): 0.5·50 + 0.5·10 = 30.
    expect(plan.focusMinutes).not.toBe(30);
  });

  it('<2 matching sessions → falls back to the 7-day all-sessions average', () => {
    // Only 1 matching session → use recent_focus_avg = 30.
    // blend = 0.5·50 + 0.5·30 = 40
    const plan = computeWarming(
      makeInputs({ sessions_completed: 9, recent_focus_avg: 30 }),
      [
        sess(80, 2000), // 1 matching
        sess(10, 1500, 'coding'), // non-matching
      ],
    );
    expect(plan.focusMinutes).toBe(40);
    expect(plan.breakMinutes).toBe(8); // floor(40 × 0.22) = floor(8.8)
    // If it had used the single matching session (80): 0.5·50 + 0.5·80 = 65.
    expect(plan.focusMinutes).not.toBe(65);
  });

  it('empty behavioral history → cold result alone, never NaN', () => {
    const plan = computeWarming(
      makeInputs({ sessions_completed: 7, recent_focus_avg: null }),
      [],
    );
    // cold: base 50, all neutral → focus 50, break floor(50 × 0.22) = 11.
    expect(plan.focusMinutes).toBe(50);
    expect(plan.breakMinutes).toBe(11);
    expect(plan.regime).toBe('warming');
    expect(Number.isNaN(plan.focusMinutes)).toBe(false);
  });

  it('matching exists but hour_bucket differs → no match, falls back to 7-day avg', () => {
    // Sessions match use_case but not hour_bucket (morning vs evening).
    // 1 effective match? none match → recent_focus_avg = 20.
    // blend = 0.5·50 + 0.5·20 = 35
    const plan = computeWarming(
      makeInputs({ sessions_completed: 9, recent_focus_avg: 20 }),
      [sess(80, 2000, 'work', 'evening'), sess(70, 1000, 'work', 'evening')],
    );
    expect(plan.focusMinutes).toBe(35);
  });

  it('huge behavioral focus → blended focus clamps to 90, break from clamped focus', () => {
    // alpha(13) ≈ 0.1. blend ≈ 0.1·50 + 0.9·200 = 185 → clamp 90.
    const plan = computeWarming(
      makeInputs({ sessions_completed: 13, recent_focus_avg: null }),
      [sess(200, 2000), sess(200, 1000)],
    );
    expect(plan.focusMinutes).toBe(90);
    expect(plan.breakMinutes).toBe(19); // floor(90 × 0.22) = floor(19.8)
  });

  it('tiny behavioral focus → blended focus clamps up to 15, break to 5', () => {
    // base 15 → cold focus 15. alpha(13) ≈ 0.1. blend ≈ 0.1·15 + 0.9·5 = 6 → clamp 15.
    const plan = computeWarming(
      makeInputs({ base_focus: 15, sessions_completed: 13, recent_focus_avg: null }),
      [sess(5, 2000), sess(5, 1000)],
    );
    expect(plan.focusMinutes).toBe(15);
    expect(plan.breakMinutes).toBe(5); // floor(clamp(15 × 0.22, 5, 25)) = 5
  });
});
