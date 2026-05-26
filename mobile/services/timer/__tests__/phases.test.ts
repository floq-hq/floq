import { describe, it, expect } from 'vitest';
import { phaseFor } from '../phases';
import type { SessionPlan } from '../types';

// Standard plan: focus long enough to exercise every transition
// (struggle → release → flow → recovery).
const plan: SessionPlan = { focusMinutes: 50, breakMinutes: 11, regime: 'cold' };

describe('phaseFor', () => {
  it('struggle: start of session', () => {
    expect(phaseFor(0, plan)).toBe('struggle'); // acceptance
  });

  it('struggle: at 19 min (still on the on-ramp)', () => {
    expect(phaseFor(19 * 60, plan)).toBe('struggle'); // acceptance
  });

  it('struggle: last second before the 20-min mark', () => {
    expect(phaseFor(20 * 60 - 1, plan)).toBe('struggle');
  });

  it('release: opens at exactly 20:00', () => {
    expect(phaseFor(20 * 60, plan)).toBe('release');
  });

  it('release: last second of the brief transition (Q1: ends at 21:00)', () => {
    expect(phaseFor(21 * 60 - 1, plan)).toBe('release');
  });

  it('flow: from 21:00', () => {
    expect(phaseFor(21 * 60, plan)).toBe('flow'); // acceptance
  });

  it('flow: last second before Done', () => {
    expect(phaseFor(plan.focusMinutes * 60 - 1, plan)).toBe('flow');
  });

  it('recovery: at exactly focusMinutes*60, the planned Done moment (Q2: >=)', () => {
    expect(phaseFor(plan.focusMinutes * 60, plan)).toBe('recovery');
  });

  it('recovery: one second past Done', () => {
    expect(phaseFor(plan.focusMinutes * 60 + 1, plan)).toBe('recovery'); // acceptance
  });

  it('recovery is terminal: still recovery well past the break window', () => {
    const past = (plan.focusMinutes + plan.breakMinutes) * 60 + 600;
    expect(phaseFor(past, plan)).toBe('recovery');
  });

  it('short plan: focus shorter than the struggle phase goes struggle → recovery, skipping release/flow', () => {
    const shortPlan: SessionPlan = { focusMinutes: 15, breakMinutes: 5, regime: 'cold' };
    expect(phaseFor(14 * 60, shortPlan)).toBe('struggle');
    expect(phaseFor(15 * 60, shortPlan)).toBe('recovery'); // recovery-first ordering
  });

  it('is deterministic: same inputs → same output', () => {
    expect(phaseFor(21 * 60, plan)).toBe(phaseFor(21 * 60, plan));
  });
});
