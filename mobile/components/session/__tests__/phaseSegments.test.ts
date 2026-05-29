import { describe, expect, it } from 'vitest';

import { flowMinutes, phaseSegments } from '../phaseSegments';
import { phaseFor } from '../../../services/timer/phases';
import type { SessionPlan } from '../../../services/timer';

describe('phaseSegments', () => {
  it('returns nothing for a zero/negative total', () => {
    expect(phaseSegments(0)).toEqual([]);
    expect(phaseSegments(-5)).toEqual([]);
  });

  it('a short session is all struggle', () => {
    const segs = phaseSegments(12);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ phase: 'struggle', minutes: 12, fraction: 1 });
  });

  it('between 20 and 21 min adds a release sliver, no flow', () => {
    const segs = phaseSegments(20.5);
    expect(segs.map((s) => s.phase)).toEqual(['struggle', 'release']);
    expect(segs[0].minutes).toBe(20);
    expect(segs[1].minutes).toBeCloseTo(0.5, 6);
  });

  it('a long session is struggle + 1-min release + flow', () => {
    const segs = phaseSegments(50);
    expect(segs.map((s) => s.phase)).toEqual(['struggle', 'release', 'flow']);
    expect(segs.find((s) => s.phase === 'struggle')!.minutes).toBe(20);
    expect(segs.find((s) => s.phase === 'release')!.minutes).toBe(1);
    expect(segs.find((s) => s.phase === 'flow')!.minutes).toBe(29);
  });

  it('fractions sum to 1', () => {
    const total = phaseSegments(73).reduce((sum, s) => sum + s.fraction, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('flowMinutes is time past the 21-min flow start', () => {
    expect(flowMinutes(50)).toBe(29);
    expect(flowMinutes(15)).toBe(0);
  });

  // Drift guard: our local boundary constants must agree with the FROZEN
  // phaseFor() state machine (we duplicate them rather than edit phases.ts).
  it('boundaries agree with the frozen phaseFor()', () => {
    const plan: SessionPlan = { focusMinutes: 90, breakMinutes: 18, regime: 'cold' };
    expect(phaseFor(20 * 60 - 1, plan)).toBe('struggle'); // struggle ends at 20:00
    expect(phaseFor(20 * 60, plan)).toBe('release'); // release [20:00, 21:00)
    expect(phaseFor(21 * 60, plan)).toBe('flow'); // flow from 21:00
  });
});
