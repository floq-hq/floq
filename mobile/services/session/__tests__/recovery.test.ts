// M4.7 / L17 — recoveryMod + depletionMod.

import { describe, it, expect } from 'vitest';
import {
  DEPLETION_FLOOR,
  RECOVERY_FLOOR,
  depletionMod,
  recoveryMod,
} from '../recovery';

describe('recoveryMod', () => {
  it('returns 1.0 when fully rested (gap >= recommended break)', () => {
    expect(recoveryMod(15, 11)).toBe(1.0);
    expect(recoveryMod(11, 11)).toBe(1.0);
  });

  it('returns RECOVERY_FLOOR when restarted with no gap', () => {
    expect(recoveryMod(0, 11)).toBe(RECOVERY_FLOOR);
  });

  it('returns 1.0 when there is no recommended break (no prior session)', () => {
    expect(recoveryMod(0, 0)).toBe(1.0);
    expect(recoveryMod(120, -1)).toBe(1.0);
  });

  it('is monotonic + linear in the fraction between the bounds', () => {
    // gap = half the recommended break → halfway between FLOOR and 1.0.
    const halfway = recoveryMod(5, 10);
    const expected = RECOVERY_FLOOR + (1 - RECOVERY_FLOOR) * 0.5;
    expect(halfway).toBeCloseTo(expected, 6);

    // Strict monotonicity sanity check.
    expect(recoveryMod(2, 10)).toBeLessThan(recoveryMod(7, 10));
    expect(recoveryMod(7, 10)).toBeLessThan(recoveryMod(11, 10));
  });
});

describe('depletionMod', () => {
  it('floors at DEPLETION_FLOOR (worst-corner 0.8 × 0.85 = 0.68 → 0.75)', () => {
    expect(depletionMod(0.8, 0.85)).toBe(DEPLETION_FLOOR);
  });

  it('multiplies freely when the product is above the floor', () => {
    expect(depletionMod(0.9, 1.0)).toBeCloseTo(0.9, 6);
    expect(depletionMod(1.0, 0.9)).toBeCloseTo(0.9, 6);
    expect(depletionMod(1.0, 1.0)).toBe(1.0);
  });

  it('respects the floor on any sub-floor multiplication', () => {
    expect(depletionMod(0.5, 0.5)).toBe(DEPLETION_FLOOR);
  });
});
