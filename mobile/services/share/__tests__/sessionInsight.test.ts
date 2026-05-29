import { describe, expect, it } from 'vitest';

import { meanScore, sessionInsight, type SessionCardData } from '../sessionInsight';

const base: SessionCardData = {
  focusScore: 60,
  focusMinutes: 50,
  distractionCount: 1,
  startedAt: new Date(2026, 4, 26, 9, 0, 0).getTime(), // 09:00 → morning
};

describe('meanScore', () => {
  it('returns null on empty', () => {
    expect(meanScore([])).toBeNull();
  });
  it('averages', () => {
    expect(meanScore([10, 20, 60])).toBe(30);
  });
});

describe('sessionInsight', () => {
  it('leads with "above your average" when ≥5% over a positive mean', () => {
    expect(sessionInsight({ ...base, focusScore: 80 }, 60)).toBe('33% above your average focus.');
  });

  it('skips the average branch when below or under 5%', () => {
    // 2% over → not flattering enough; falls through to flow minutes (50→29).
    expect(sessionInsight({ ...base, focusScore: 61 }, 60)).toBe('29 minutes in deep flow.');
  });

  it('reports deep-flow minutes when no average is known', () => {
    expect(sessionInsight(base, null)).toBe('29 minutes in deep flow.');
  });

  it('calls out a zero-distraction block when there is no flow', () => {
    expect(
      sessionInsight({ focusScore: 40, focusMinutes: 18, distractionCount: 0 }, null),
    ).toBe('Zero distractions — fully locked in.');
  });

  it('falls back to time-of-day when nothing stronger applies', () => {
    expect(
      sessionInsight({ focusScore: 40, focusMinutes: 16, distractionCount: 3, startedAt: base.startedAt }, null),
    ).toBe('A focused morning session.');
  });

  it('final fallback is honest focused-minutes', () => {
    expect(
      sessionInsight({ focusScore: 40, focusMinutes: 16, distractionCount: 3 }, null),
    ).toBe('16 minutes of focused work.');
  });

  it('never divides by a non-positive average', () => {
    // avg 0 → skip branch 1, land on flow.
    expect(sessionInsight(base, 0)).toBe('29 minutes in deep flow.');
  });
});
