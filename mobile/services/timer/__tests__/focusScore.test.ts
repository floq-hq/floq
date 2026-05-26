import { describe, it, expect } from 'vitest';
import { computeFocusScore } from '../focusScore';
import type { FocusScoreInputs } from '../types';

/** Build FocusScoreInputs with the three fields the formula reads. */
function makeInputs(o: {
  sessionMinutes: number;
  distractionCount: number;
  difficulty: FocusScoreInputs['difficulty'];
}): FocusScoreInputs {
  return {
    sessionMinutes: o.sessionMinutes,
    distractionCount: o.distractionCount,
    difficulty: o.difficulty,
  };
}

describe('computeFocusScore', () => {
  it('clean session: 60 min, 0 distractions, difficulty 3 → 60', () => {
    // (60 − 0 × 23) × (3 / 3) = 60
    expect(
      computeFocusScore(
        makeInputs({ sessionMinutes: 60, distractionCount: 0, difficulty: 3 }),
      ),
    ).toBe(60);
  });

  it('one distraction at medium difficulty: 60 min, 1 distraction, difficulty 3 → 37', () => {
    // (60 − 1 × 23) × (3 / 3) = 37
    expect(
      computeFocusScore(
        makeInputs({ sessionMinutes: 60, distractionCount: 1, difficulty: 3 }),
      ),
    ).toBe(37);
  });

  it('hard task rewarded: 60 min, 1 distraction, difficulty 5 → ≈ 61.67', () => {
    // (60 − 23) × (5 / 3) = 37 × 1.6667 = 61.6667 — fractional, NOT floored
    expect(
      computeFocusScore(
        makeInputs({ sessionMinutes: 60, distractionCount: 1, difficulty: 5 }),
      ),
    ).toBeCloseTo(61.6667, 4);
  });

  it('negative is meaningful and NOT clamped: 30 min, 2 distractions, difficulty 3 → −16', () => {
    // (30 − 2 × 23) × (3 / 3) = (30 − 46) = −16
    const score = computeFocusScore(
      makeInputs({ sessionMinutes: 30, distractionCount: 2, difficulty: 3 }),
    );
    expect(score).toBe(-16);
    expect(score).toBeLessThan(0); // documents: never clamped to zero
  });

  it('is pure/deterministic: same inputs → same output', () => {
    const inputs = makeInputs({
      sessionMinutes: 45,
      distractionCount: 1,
      difficulty: 4,
    });
    expect(computeFocusScore(inputs)).toBe(computeFocusScore(inputs));
  });
});
