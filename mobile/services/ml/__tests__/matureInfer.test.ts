import { describe, expect, it } from 'vitest';

import { MATURE_MODEL_ACTIVE, matureInfer, runMatureInference } from '../matureInfer';
import type { OnboardingSeed, TimerInputs } from '../../timer';

const seed: OnboardingSeed = {
  base_focus: 60,
  distraction_level: 'neutral',
  preferred_time: 'morning',
  use_case: 'work',
  decay_weight: 1.0,
};

function makeInputs(): TimerInputs {
  return {
    task: { difficulty: 3, estimated_minutes: 30 },
    context: { hour_bucket: 'morning', day_of_week: 2, sessions_today: 0, hours_since_last: 24 },
    history: { recent_focus_avg: 50, recent_distract: 1 },
    onboarding: seed,
    sessions_completed: 20,
  };
}

/** A fake fast-tflite model: returns a fixed scalar in a Float32 ArrayBuffer,
 *  the shape runMatureInference reads (out[0] → new Float32Array(...)[0]). */
function fakeModel(scalar: number) {
  return {
    runSync(_inputs: ArrayBufferLike[]): unknown[] {
      return [new Float32Array([scalar]).buffer];
    },
  };
}

describe('runMatureInference', () => {
  it('decodes the raw scalar into a mature SessionPlan (clamp + 0.22 break)', () => {
    // raw 50 → focus 50, break floor(50×0.22)=11, regime mature.
    expect(runMatureInference(fakeModel(50), makeInputs())).toEqual({
      focusMinutes: 50,
      breakMinutes: 11,
      regime: 'mature',
    });
  });

  it('floors the focus output to an integer', () => {
    expect(runMatureInference(fakeModel(50.9), makeInputs())?.focusMinutes).toBe(50);
  });

  it('clamps focus to FOCUS_MIN (15) and FOCUS_MAX (90)', () => {
    expect(runMatureInference(fakeModel(4), makeInputs())?.focusMinutes).toBe(15);
    expect(runMatureInference(fakeModel(140), makeInputs())?.focusMinutes).toBe(90);
    // break tracks the clamped focus: floor(15×0.22)=3 → clamps up to BREAK_MIN 5.
    expect(runMatureInference(fakeModel(4), makeInputs())?.breakMinutes).toBe(5);
    // floor(90×0.22)=19, within [5,25].
    expect(runMatureInference(fakeModel(140), makeInputs())?.breakMinutes).toBe(19);
  });

  it('returns null on a non-finite model output', () => {
    expect(runMatureInference(fakeModel(NaN), makeInputs())).toBeNull();
  });

  it('returns null (never throws) when the model itself throws', () => {
    const throwing = {
      runSync(): unknown[] {
        throw new Error('native bridge error');
      },
    };
    expect(runMatureInference(throwing, makeInputs())).toBeNull();
  });
});

describe('matureInfer (production closure)', () => {
  it('is dormant for the synthetic v1 model (L23 / O11 — warming leads)', () => {
    // The v1 model is synthetic and can't beat the warming blend, so the mature
    // regime is parked until a real-data v2. Flip this when v2 ships.
    expect(MATURE_MODEL_ACTIVE).toBe(false);
  });

  it('returns null while dormant (→ routeSessionPlan uses the warming blend)', () => {
    expect(matureInfer(makeInputs(), [])).toBeNull();
  });
});
