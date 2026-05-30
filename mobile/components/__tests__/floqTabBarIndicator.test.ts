import { describe, expect, it } from 'vitest';

import { indicatorTranslateX } from '../FloqTabBar.helpers';

const HAIRLINE = 30;

describe('indicatorTranslateX', () => {
  it('returns null before the track is measured (cellWidth 0) — audit #24', () => {
    // The bug: a 0 width gave target (0 - 30)/2 = -15, animating off-screen-left.
    expect(indicatorTranslateX(0, 0, HAIRLINE)).toBeNull();
    expect(indicatorTranslateX(3, 0, HAIRLINE)).toBeNull();
  });

  it('returns null for a negative width too', () => {
    expect(indicatorTranslateX(0, -10, HAIRLINE)).toBeNull();
  });

  it('centers the hairline within the active cell once measured', () => {
    // cell width 60, hairline 30 → centered at (60-30)/2 = 15 into the cell.
    expect(indicatorTranslateX(0, 60, HAIRLINE)).toBe(15);
    expect(indicatorTranslateX(1, 60, HAIRLINE)).toBe(75); // 60 + 15
    expect(indicatorTranslateX(2, 60, HAIRLINE)).toBe(135); // 120 + 15
  });

  it('never produces the off-screen-left target for index 0', () => {
    const x = indicatorTranslateX(0, 70, HAIRLINE);
    expect(x).not.toBeNull();
    expect(x!).toBeGreaterThanOrEqual(0);
  });
});
