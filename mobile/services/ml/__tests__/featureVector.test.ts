import { describe, expect, it } from 'vitest';

import { encodeFeatures, INPUT_DIM } from '../featureVector';
import type { OnboardingSeed, TimerInputs } from '../../timer';

const seed: OnboardingSeed = {
  base_focus: 60,
  distraction_level: 'neutral',
  preferred_time: 'morning',
  use_case: 'work',
  decay_weight: 1.0,
};

function makeInputs(over: Partial<{
  difficulty: TimerInputs['task']['difficulty'];
  est: number;
  hour: TimerInputs['context']['hour_bucket'];
  dow: TimerInputs['context']['day_of_week'];
  sessionsToday: number;
  hoursSinceLast: number;
  recentFocusAvg: number | null;
  recentDistract: number | null;
  baseFocus: number;
  decay: number;
}> = {}): TimerInputs {
  return {
    task: { difficulty: over.difficulty ?? 3, estimated_minutes: over.est ?? 30 },
    context: {
      hour_bucket: over.hour ?? 'morning',
      day_of_week: over.dow ?? 0,
      sessions_today: over.sessionsToday ?? 0,
      hours_since_last: over.hoursSinceLast ?? 24,
    },
    history: {
      recent_focus_avg: over.recentFocusAvg === undefined ? null : over.recentFocusAvg,
      recent_distract: over.recentDistract === undefined ? null : over.recentDistract,
    },
    onboarding: { ...seed, base_focus: over.baseFocus ?? 60, decay_weight: over.decay ?? 1.0 },
    sessions_completed: 20,
  };
}

describe('encodeFeatures (MODEL_SPEC.md contract)', () => {
  it('produces a 13-dim Float32Array', () => {
    const v = encodeFeatures(makeInputs());
    expect(v).toBeInstanceOf(Float32Array);
    expect(v).toHaveLength(INPUT_DIM);
    expect(INPUT_DIM).toBe(13);
  });

  it('normalizes difficulty (idx 0) as (d-1)/4', () => {
    expect(encodeFeatures(makeInputs({ difficulty: 1 }))[0]).toBe(0);
    expect(encodeFeatures(makeInputs({ difficulty: 3 }))[0]).toBeCloseTo(0.5, 6);
    expect(encodeFeatures(makeInputs({ difficulty: 5 }))[0]).toBe(1);
  });

  it('normalizes + clamps est_minutes (idx 1) as (clamp(m,5,180)-5)/175', () => {
    expect(encodeFeatures(makeInputs({ est: 5 }))[1]).toBe(0);
    expect(encodeFeatures(makeInputs({ est: 180 }))[1]).toBe(1);
    expect(encodeFeatures(makeInputs({ est: 1 }))[1]).toBe(0); // clamps up to 5
    expect(encodeFeatures(makeInputs({ est: 500 }))[1]).toBe(1); // clamps down to 180
    expect(encodeFeatures(makeInputs({ est: 92.5 }))[1]).toBeCloseTo(0.5, 6);
  });

  it('one-hot encodes the hour bucket (idx 2-5)', () => {
    expect(Array.from(encodeFeatures(makeInputs({ hour: 'morning' })).slice(2, 6))).toEqual([1, 0, 0, 0]);
    expect(Array.from(encodeFeatures(makeInputs({ hour: 'afternoon' })).slice(2, 6))).toEqual([0, 1, 0, 0]);
    expect(Array.from(encodeFeatures(makeInputs({ hour: 'evening' })).slice(2, 6))).toEqual([0, 0, 1, 0]);
    expect(Array.from(encodeFeatures(makeInputs({ hour: 'night' })).slice(2, 6))).toEqual([0, 0, 0, 1]);
  });

  it('cyclically encodes day_of_week (idx 6-7) mapped to [0,1]', () => {
    // dow 0: sin(0)=0 → 0.5 ; cos(0)=1 → 1.0
    const v0 = encodeFeatures(makeInputs({ dow: 0 }));
    expect(v0[6]).toBeCloseTo(0.5, 6);
    expect(v0[7]).toBeCloseTo(1.0, 6);
    // both stay within [0,1] for every day
    for (let d = 0; d < 7; d += 1) {
      const v = encodeFeatures(makeInputs({ dow: d as TimerInputs['context']['day_of_week'] }));
      expect(v[6]).toBeGreaterThanOrEqual(0);
      expect(v[6]).toBeLessThanOrEqual(1);
      expect(v[7]).toBeGreaterThanOrEqual(0);
      expect(v[7]).toBeLessThanOrEqual(1);
    }
  });

  it('normalizes + clamps sessions_today (idx 8) and hours_since_last (idx 9)', () => {
    const v = encodeFeatures(makeInputs({ sessionsToday: 5, hoursSinceLast: 24 }));
    expect(v[8]).toBeCloseTo(0.5, 6);
    expect(v[9]).toBeCloseTo(0.5, 6);
    expect(encodeFeatures(makeInputs({ sessionsToday: 99 }))[8]).toBe(1); // clamp 10
    expect(encodeFeatures(makeInputs({ hoursSinceLast: 200 }))[9]).toBe(1); // clamp 48
  });

  it('maps null history (idx 10-11) to 0, like the Python encoder', () => {
    const v = encodeFeatures(makeInputs({ recentFocusAvg: null, recentDistract: null }));
    expect(v[10]).toBe(0);
    expect(v[11]).toBe(0);
    expect(encodeFeatures(makeInputs({ recentFocusAvg: 45 }))[10]).toBeCloseTo(0.5, 6);
    expect(encodeFeatures(makeInputs({ recentDistract: 2.5 }))[11]).toBeCloseTo(0.5, 6);
  });

  it('uses base_focus × decay, clamped [10,90]/90 (idx 12)', () => {
    expect(encodeFeatures(makeInputs({ baseFocus: 90, decay: 1.0 }))[12]).toBe(1);
    // decayed below the floor → clamps to 10/90
    expect(encodeFeatures(makeInputs({ baseFocus: 60, decay: 0 }))[12]).toBeCloseTo(10 / 90, 6);
    // 60 × 0.5 = 30 → 30/90
    expect(encodeFeatures(makeInputs({ baseFocus: 60, decay: 0.5 }))[12]).toBeCloseTo(30 / 90, 6);
  });

  it('matches a fully hand-computed vector (Python parity anchor)', () => {
    // difficulty 5, est 60, afternoon, dow 2, 2 today, 12h since, rfa 45, rdr 1, base 80×0.5
    const v = Array.from(
      encodeFeatures(
        makeInputs({
          difficulty: 5,
          est: 60,
          hour: 'afternoon',
          dow: 2,
          sessionsToday: 2,
          hoursSinceLast: 12,
          recentFocusAvg: 45,
          recentDistract: 1,
          baseFocus: 80,
          decay: 0.5,
        }),
      ),
    );
    const expected = [
      1, // (5-1)/4
      (60 - 5) / 175, // est
      0, 1, 0, 0, // afternoon one-hot
      (Math.sin((2 * Math.PI * 2) / 7) + 1) / 2,
      (Math.cos((2 * Math.PI * 2) / 7) + 1) / 2,
      0.2, // 2/10
      0.25, // 12/48
      0.5, // 45/90
      0.2, // 1/5
      40 / 90, // clamp(80×0.5,10,90)/90
    ];
    expected.forEach((e, i) => expect(v[i]).toBeCloseTo(e, 6));
  });
});
