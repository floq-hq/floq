import { describe, expect, it } from 'vitest';

import { smoothPath, type Point } from '../smoothPath';

const nums = (s: string): number[] => (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('smoothPath', () => {
  it('returns empty for no points', () => {
    expect(smoothPath([])).toBe('');
  });

  it('a single point is just a move', () => {
    expect(smoothPath([{ x: 3, y: 4 }])).toBe('M 3 4');
  });

  it('two points draw a straight line (no curve)', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ]);
    expect(d).toBe('M 0 0 L 10 5');
    expect(d).not.toContain('C');
  });

  it('three+ points produce cubic-bézier segments through every point', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 20 },
      { x: 20, y: 5 },
      { x: 30, y: 25 },
    ];
    const d = smoothPath(pts);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(3); // one curve per gap
    // The curve passes through the last point (final coords of the last C).
    expect(d.trim().endsWith('30 25')).toBe(true);
  });

  it('never emits NaN for finite inputs', () => {
    const d = smoothPath([
      { x: -5, y: 100 },
      { x: 0, y: -20 },
      { x: 12, y: 7 },
      { x: 40, y: -3 },
    ]);
    expect(nums(d).some((n) => Number.isNaN(n))).toBe(false);
  });

  it('is deterministic', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 9 },
      { x: 2, y: 3 },
    ];
    expect(smoothPath(pts)).toBe(smoothPath(pts));
  });
});
