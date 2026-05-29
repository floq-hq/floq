// M4.6 / L16 — overrunMinutes + recoveryBreakMinutes.
//
// The break recompute is the high-leverage assertion: it must equal cold-start's
// break when the input is the planned focus. Otherwise drift between
// `services/timer/coldStart.ts` and `services/session/overrun.ts` can sneak in
// silently, exactly what lifting the frozen constants to imports was supposed
// to prevent.

import { describe, it, expect } from 'vitest';
import { overrunMinutes, recoveryBreakMinutes } from '../overrun';
import {
  BREAK_MAX,
  BREAK_MIN,
  BREAK_RATIO,
} from '../../timer/coldStart';

describe('overrunMinutes', () => {
  it('is 0 when actual <= planned', () => {
    expect(overrunMinutes(45, 60)).toBe(0);
    expect(overrunMinutes(60, 60)).toBe(0);
  });

  it('returns the excess when actual > planned', () => {
    expect(overrunMinutes(75, 60)).toBe(15);
    expect(overrunMinutes(91, 90)).toBe(1);
  });

  it('never returns negative', () => {
    expect(overrunMinutes(0, 60)).toBe(0);
  });
});

describe('recoveryBreakMinutes', () => {
  it('matches the frozen formula at the planned input (drift guard)', () => {
    // The cold-start break for a 50-min focus is clamp(round(50*0.22), 5, 25).
    // recoveryBreakMinutes(50) MUST produce the same value — both use the same
    // frozen constants. If this asserts and fails, somebody redefined a
    // constant or reordered the operations; do not "fix" the test.
    const planned = 50;
    const expected = Math.min(
      BREAK_MAX,
      Math.max(BREAK_MIN, Math.round(planned * BREAK_RATIO)),
    );
    expect(recoveryBreakMinutes(planned)).toBe(expected);
  });

  it('clamps to BREAK_MIN at very short focus', () => {
    expect(recoveryBreakMinutes(0)).toBe(BREAK_MIN);
    expect(recoveryBreakMinutes(10)).toBe(BREAK_MIN); // round(2.2) = 2 → clamps to 5
  });

  it('clamps to BREAK_MAX at very long focus', () => {
    expect(recoveryBreakMinutes(200)).toBe(BREAK_MAX); // round(44) clamps to 25
    expect(recoveryBreakMinutes(120)).toBe(BREAK_MAX); // round(26.4) clamps to 25
  });

  it('scales linearly between the clamps', () => {
    // round(60 * 0.22) = 13 — inside [5, 25].
    expect(recoveryBreakMinutes(60)).toBe(13);
    // round(90 * 0.22) = 20.
    expect(recoveryBreakMinutes(90)).toBe(20);
  });
});
