import { describe, it, expect } from 'vitest';
import { previewPhases } from '../phasePreview';
import type { SessionPlan } from '../../timer';

const plan = (focusMinutes: number, breakMinutes = 10): SessionPlan => ({
  focusMinutes,
  breakMinutes,
  regime: 'cold',
});

const sum = (segs: { minutes: number }[]) => segs.reduce((n, s) => n + s.minutes, 0);

describe('previewPhases', () => {
  it('50-min plan → struggle 20 / release 1 / flow 29; sums to focusMinutes', () => {
    const segs = previewPhases(plan(50));
    expect(segs).toEqual([
      { phase: 'struggle', minutes: 20 },
      { phase: 'release', minutes: 1 },
      { phase: 'flow', minutes: 29 },
    ]);
    expect(sum(segs)).toBe(50);
  });

  it('16-min plan → struggle only (never reaches Flow)', () => {
    const segs = previewPhases(plan(16));
    expect(segs).toEqual([{ phase: 'struggle', minutes: 16 }]);
  });

  it('21-min plan → struggle 20 + release 1, no flow', () => {
    const segs = previewPhases(plan(21));
    expect(segs).toEqual([
      { phase: 'struggle', minutes: 20 },
      { phase: 'release', minutes: 1 },
    ]);
  });

  it('90-min plan → all three phases, flow dominates', () => {
    const segs = previewPhases(plan(90));
    expect(segs.map((s) => s.phase)).toEqual(['struggle', 'release', 'flow']);
    expect(segs[2]).toEqual({ phase: 'flow', minutes: 69 });
    expect(sum(segs)).toBe(90);
    // never includes recovery — that's a post-Done terminal phase, not a preview segment
    expect(segs.some((s) => s.phase === 'recovery')).toBe(false);
  });

  it('non-positive focus → empty (guards a deep-linked 0-min plan)', () => {
    expect(previewPhases(plan(0))).toEqual([]);
  });

  it('is deterministic: same plan → same segments', () => {
    expect(previewPhases(plan(50))).toEqual(previewPhases(plan(50)));
  });
});
