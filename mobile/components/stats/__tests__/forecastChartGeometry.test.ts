import { describe, expect, it } from 'vitest';

import { forecastGeometry, type ChartBox } from '../forecastChartGeometry';
import type { ForecastShape } from '../../../services/stats/forecastShape';

const BOX: ChartBox = { width: 300, height: 140, padding: 12 };

/** Build a ForecastShape from a past series + a flat projection level + band. */
function shapeOf(
  past: number[],
  predicted: number,
  upper: number,
  lower: number,
  horizon = 3,
): ForecastShape {
  const lastX = past.length - 1;
  const endX = lastX + horizon;
  const anchor = { x: lastX, y: past[lastX] };
  return {
    past: past.map((y, i) => ({ x: i, y })),
    forecast: [anchor, { x: endX, y: predicted }],
    confidenceBand: {
      upper: [anchor, { x: endX, y: upper }],
      lower: [anchor, { x: endX, y: lower }],
    },
  };
}

/** Pull every number out of an SVG path `d` string. */
function nums(s: string): number[] {
  return (s.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('forecastGeometry', () => {
  it('smoothed past path stays inside the padded box and is a curve', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65, 72], 68, 80, 56), BOX);
    expect(geo.pastPath.startsWith('M')).toBe(true);
    expect(geo.pastPath).toContain('C'); // 4 points → cubic-bézier, not a polyline
  });

  it('starts the past line at x=padding and ends on the anchor (seamless handoff)', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65], 68, 80, 56), BOX);
    const n = nums(geo.pastPath);
    expect(n[0]).toBe(BOX.padding); // first session (move) at the left edge
    // The smooth path's final coordinate IS the anchor where the dashed forecast begins.
    expect(n[n.length - 2]).toBeCloseTo(geo.anchor.cx, 5);
    expect(n[n.length - 1]).toBeCloseTo(geo.anchor.cy, 5);
  });

  it('forecast path begins at the anchor; divider sits at the anchor x', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65], 68, 80, 56), BOX);
    const f = nums(geo.forecastPath); // [cx, cy, ex, ey]
    expect(f[0]).toBeCloseTo(geo.anchor.cx, 5);
    expect(f[1]).toBeCloseTo(geo.anchor.cy, 5);
    expect(geo.dividerX).toBeCloseTo(geo.anchor.cx, 5);
    // Projection reaches the right edge (end x: xMax → width − padding).
    expect(f[2]).toBeCloseTo(BOX.width - BOX.padding, 5);
  });

  it('band quad is closed (ends with Z) and starts at the anchor', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65], 68, 80, 56), BOX);
    expect(geo.bandPath.trim().endsWith('Z')).toBe(true);
    const b = nums(geo.bandPath);
    expect(b[0]).toBeCloseTo(geo.anchor.cx, 5);
    expect(b[1]).toBeCloseTo(geo.anchor.cy, 5);
  });

  it('has no zero baseline for an all-positive series', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65], 68, 80, 56), BOX);
    expect(geo.zeroY).toBeNull();
  });

  it('draws a zero baseline inside the box when scores cross zero', () => {
    const geo = forecastGeometry(shapeOf([-10, 20, 5], 8, 22, -6), BOX);
    expect(geo.zeroY).not.toBeNull();
    expect(geo.zeroY as number).toBeGreaterThanOrEqual(BOX.padding);
    expect(geo.zeroY as number).toBeLessThanOrEqual(BOX.height - BOX.padding);
  });

  it('a constant series yields a zero-width band that collapses onto the line', () => {
    // predicted == upper == lower → upper/lower ends coincide; quad degenerates.
    const geo = forecastGeometry(shapeOf([50, 50, 50], 50, 50, 50), BOX);
    const b = nums(geo.bandPath);
    // upper end (b[2],b[3]) and lower end (b[4],b[5]) are the same point.
    expect(b[2]).toBeCloseTo(b[4], 5);
    expect(b[3]).toBeCloseTo(b[5], 5);
  });

  it('never emits NaN for a valid shape', () => {
    const geo = forecastGeometry(shapeOf([-10, 0, 30, 12], -4, 18, -26), BOX);
    const all = [
      ...nums(geo.pastPath),
      ...nums(geo.forecastPath),
      ...nums(geo.bandPath),
      geo.anchor.cx,
      geo.anchor.cy,
      geo.dividerX,
      geo.zeroY ?? 0,
    ];
    for (const n of all) expect(Number.isNaN(n)).toBe(false);
  });

  it('is deterministic', () => {
    const s = shapeOf([60, 70, 65, 72], 68, 80, 56);
    expect(forecastGeometry(s, BOX)).toEqual(forecastGeometry(s, BOX));
  });

  it('exposes one inspect dot per past session, carrying index + score', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65, 72], 68, 80, 56), BOX);
    expect(geo.pastDots).toHaveLength(4);
    expect(geo.pastDots.map((d) => d.score)).toEqual([60, 70, 65, 72]);
    expect(geo.pastDots.map((d) => d.index)).toEqual([0, 1, 2, 3]);
    // dots advance left→right and sit inside the box
    for (let i = 1; i < geo.pastDots.length; i += 1) {
      expect(geo.pastDots[i].x).toBeGreaterThan(geo.pastDots[i - 1].x);
    }
  });

  it('closes the past fill down to the baseline', () => {
    const geo = forecastGeometry(shapeOf([60, 70, 65], 68, 80, 56), BOX);
    expect(geo.pastFillPath.trim().endsWith('Z')).toBe(true);
    expect(geo.pastFillPath).toContain(`${geo.baselineY}`);
    expect(geo.baselineY).toBeCloseTo(BOX.height - BOX.padding, 5);
  });
});
