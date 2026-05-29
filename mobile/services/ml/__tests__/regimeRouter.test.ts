import { describe, expect, it, vi } from 'vitest';

import { computeColdStart, computeWarming } from '../../timer';
import type {
  BehavioralSession,
  OnboardingSeed,
  SessionPlan,
  TimerInputs,
} from '../../timer';
import {
  MATURE_MIN_SESSIONS,
  WARMING_MIN_SESSIONS,
  pickRegime,
  routeSessionPlan,
  type MatureInfer,
} from '../regimeRouter';

// Minimal TimerInputs (mirrors warming.test.ts). Neutral defaults so the
// cold/warming math stays finite and predictable; only sessions_completed
// matters for routing. recent_focus_avg defaults non-null so warming has a
// behavioral fallback even with an empty behavioral array.
function makeInputs(sessionsCompleted: number): TimerInputs {
  return {
    task: { difficulty: 3, estimated_minutes: 30 },
    context: {
      hour_bucket: 'morning',
      day_of_week: 2,
      sessions_today: 0,
      hours_since_last: 24,
    },
    history: { recent_focus_avg: 45, recent_distract: null },
    onboarding: {
      base_focus: 50,
      distraction_level: 'neutral',
      preferred_time: 'morning',
      use_case: 'work',
      decay_weight: 1.0,
    },
    sessions_completed: sessionsCompleted,
  };
}

function sess(
  focusMinutes: number,
  endedAt: number,
  useCase: OnboardingSeed['use_case'] = 'work',
  hourBucket: BehavioralSession['hourBucket'] = 'morning',
): BehavioralSession {
  return { focusMinutes, hourBucket, useCase, endedAt };
}

const maturePlan: SessionPlan = { focusMinutes: 72, breakMinutes: 16, regime: 'mature' };

describe('pickRegime — boundaries & domain', () => {
  it('routes by the spec cutoffs (<5 cold, <14 warming, else mature)', () => {
    expect(pickRegime(0)).toBe('cold');
    expect(pickRegime(4)).toBe('cold');
    expect(pickRegime(5)).toBe('warming');
    expect(pickRegime(13)).toBe('warming');
    expect(pickRegime(14)).toBe('mature');
    expect(pickRegime(100)).toBe('mature');
  });

  it('normalizes corrupt counts so they never misroute to mature', () => {
    expect(pickRegime(-1)).toBe('cold'); // negative → 0
    expect(pickRegime(Number.NaN)).toBe('cold'); // non-finite → 0 (NaN<5 is false!)
    expect(pickRegime(Number.POSITIVE_INFINITY)).toBe('cold'); // non-finite → 0
    expect(pickRegime(5.5)).toBe('warming'); // fractional floors to 5
    expect(pickRegime(13.9)).toBe('warming'); // floors to 13, still warming
  });
});

describe('routeSessionPlan — cold/warming dispatch', () => {
  it('cold tenure → cold engine, equal to computeColdStart', () => {
    const inputs = makeInputs(0);
    const plan = routeSessionPlan(inputs, []);
    expect(plan.regime).toBe('cold');
    expect(plan).toEqual(computeColdStart(inputs));
  });

  it('warming tenure with behavioral history → warming engine', () => {
    const inputs = makeInputs(7);
    const behavioral = [sess(50, 3), sess(48, 2), sess(46, 1)];
    const plan = routeSessionPlan(inputs, behavioral);
    expect(plan.regime).toBe('warming');
    expect(plan).toEqual(computeWarming(inputs, behavioral));
  });

  it('warming tenure with empty behavioral → warming, finite & in-bounds (no NaN)', () => {
    const plan = routeSessionPlan(makeInputs(7), []);
    expect(plan.regime).toBe('warming');
    expect(Number.isFinite(plan.focusMinutes)).toBe(true);
    expect(plan.focusMinutes).toBeGreaterThanOrEqual(15);
    expect(plan.focusMinutes).toBeLessThanOrEqual(90);
    expect(plan.breakMinutes).toBeGreaterThanOrEqual(5);
    expect(plan.breakMinutes).toBeLessThanOrEqual(25);
  });
});

describe('routeSessionPlan — mature dispatch & defensive fallback', () => {
  it('mature tenure, inference absent → falls back to warming', () => {
    const inputs = makeInputs(20);
    const behavioral = [sess(60, 2), sess(55, 1)];
    const plan = routeSessionPlan(inputs, behavioral);
    expect(plan.regime).toBe('warming');
    expect(plan).toEqual(computeWarming(inputs, behavioral));
  });

  it('mature tenure, inference returns null → warming (and infer WAS called)', () => {
    const infer = vi.fn<MatureInfer>(() => null);
    const plan = routeSessionPlan(makeInputs(20), [sess(60, 1)], infer);
    expect(plan.regime).toBe('warming');
    expect(infer).toHaveBeenCalledOnce();
  });

  it('mature tenure, inference throws → warming, no throw escapes (empty behavioral)', () => {
    const infer = vi.fn<MatureInfer>(() => {
      throw new Error('no model');
    });
    const plan = routeSessionPlan(makeInputs(20), [], infer);
    expect(plan.regime).toBe('warming');
    expect(Number.isFinite(plan.focusMinutes)).toBe(true);
  });

  it('mature tenure, inference returns a plan → returns it exactly', () => {
    const infer = vi.fn<MatureInfer>(() => maturePlan);
    const plan = routeSessionPlan(makeInputs(20), [], infer);
    expect(plan).toBe(maturePlan); // identity — router passes it through untouched
    expect(plan.regime).toBe('mature');
  });

  it('fallback honesty: a fallen-back mature plan never reports regime mature', () => {
    const infer = vi.fn<MatureInfer>(() => null);
    const plan = routeSessionPlan(makeInputs(20), [sess(60, 1)], infer);
    expect(plan.regime).not.toBe('mature'); // guards the modelVersion invariant
  });

  it('passes (inputs, behavioral) through to the injected infer', () => {
    const inputs = makeInputs(20);
    const behavioral = [sess(60, 1)];
    const infer = vi.fn<MatureInfer>(() => maturePlan);
    routeSessionPlan(inputs, behavioral, infer);
    expect(infer).toHaveBeenCalledWith(inputs, behavioral);
  });

  it('never invokes matureInfer on the cold path', () => {
    const infer = vi.fn<MatureInfer>(() => {
      throw new Error('should not be called');
    });
    const plan = routeSessionPlan(makeInputs(0), [], infer);
    expect(plan.regime).toBe('cold');
    expect(infer).not.toHaveBeenCalled();
  });
});

describe('regime thresholds do not silently drift', () => {
  it('are pinned to the ml-regimes.md spec values', () => {
    expect(WARMING_MIN_SESSIONS).toBe(5);
    expect(MATURE_MIN_SESSIONS).toBe(14);
  });
});
